// Google Business Profile API Integration
// Handles: OAuth, locations, reviews, posts, photos, insights
import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { sendMessage as sendLoop } from "./loop/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sql = neon(process.env.DATABASE_URL!);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/gbp/callback`
  : "https://thewolfpack.ai/api/gbp/callback";

// ── OAuth ───────────────────────────────────────────────────────────
export function getGbpAuthUrl(workspaceId: string) {
  const scopes = [
    "https://www.googleapis.com/auth/business.manage",
  ];

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: workspaceId,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGbpCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function refreshGbpToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

export async function getGbpToken(connectionId: string): Promise<string | null> {
  const conn = await sql`SELECT access_token, refresh_token, connected FROM gbp_connections WHERE id = ${connectionId}`;
  if (!conn[0]?.connected || !conn[0]?.refresh_token) return null;

  try {
    const newToken = await refreshGbpToken(conn[0].refresh_token as string);
    await sql`UPDATE gbp_connections SET access_token = ${newToken}, updated_at = NOW() WHERE id = ${connectionId}`;
    return newToken;
  } catch {
    return conn[0].access_token as string;
  }
}

// ── API Helpers ─────────────────────────────────────────────────────
async function gbpFetch(token: string, url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  return res.json();
}

// v4 legacy API (reviews, posts, photos)
async function gbpV4(token: string, path: string, options?: RequestInit) {
  return gbpFetch(token, `https://mybusiness.googleapis.com/v4/${path}`, options);
}

// New Account Management API
async function gbpAccounts(token: string, path: string, options?: RequestInit) {
  return gbpFetch(token, `https://mybusinessaccountmanagement.googleapis.com/v1/${path}`, options);
}

// New Business Information API
async function gbpInfo(token: string, path: string, options?: RequestInit) {
  return gbpFetch(token, `https://mybusinessbusinessinformation.googleapis.com/v1/${path}`, options);
}

// Performance API
async function gbpPerf(token: string, path: string, options?: RequestInit) {
  return gbpFetch(token, `https://businessprofileperformance.googleapis.com/v1/${path}`, options);
}

// ── Accounts & Locations ────────────────────────────────────────────
export async function listAccounts(token: string) {
  return gbpAccounts(token, "accounts");
}

export async function listLocations(token: string, accountId: string) {
  return gbpInfo(token, `accounts/${accountId}/locations?readMask=name,title,phoneNumbers,storefrontAddress,websiteUri,regularHours,categories`);
}

export async function getLocation(token: string, locationId: string) {
  return gbpInfo(token, `locations/${locationId}?readMask=name,title,phoneNumbers,storefrontAddress,websiteUri,regularHours,categories`);
}

export async function updateLocation(
  token: string,
  locationId: string,
  updates: {
    title?: string;
    phoneNumber?: string;
    websiteUri?: string;
    description?: string;
  },
) {
  const body: Record<string, unknown> = {};
  const masks: string[] = [];

  if (updates.title) { body.title = updates.title; masks.push("title"); }
  if (updates.phoneNumber) { body.phoneNumbers = { primaryPhone: updates.phoneNumber }; masks.push("phoneNumbers"); }
  if (updates.websiteUri) { body.websiteUri = updates.websiteUri; masks.push("websiteUri"); }
  if (updates.description) { body.profile = { description: updates.description }; masks.push("profile.description"); }

  return gbpInfo(token, `locations/${locationId}?updateMask=${masks.join(",")}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── Reviews ─────────────────────────────────────────────────────────
export async function listReviews(token: string, accountId: string, locationId: string, pageSize: number = 50) {
  return gbpV4(token, `accounts/${accountId}/locations/${locationId}/reviews?pageSize=${pageSize}`);
}

export async function replyToReview(token: string, accountId: string, locationId: string, reviewId: string, comment: string) {
  return gbpV4(token, `accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
}

// ── Posts ────────────────────────────────────────────────────────────
export async function createPost(
  token: string,
  accountId: string,
  locationId: string,
  post: {
    summary: string;
    topicType?: "STANDARD" | "EVENT" | "OFFER";
    imageUrl?: string;
    ctaType?: string;
    ctaUrl?: string;
    eventTitle?: string;
    eventStart?: string;
    eventEnd?: string;
    offerTerms?: string;
    offerCode?: string;
  },
) {
  const body: Record<string, unknown> = {
    languageCode: "en",
    summary: post.summary,
    topicType: post.topicType || "STANDARD",
  };

  if (post.imageUrl) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: post.imageUrl }];
  }

  if (post.ctaType && post.ctaUrl) {
    body.callToAction = { actionType: post.ctaType, url: post.ctaUrl };
  }

  if (post.topicType === "EVENT" && post.eventTitle) {
    body.event = {
      title: post.eventTitle,
      schedule: {
        startDate: post.eventStart ? { year: new Date(post.eventStart).getFullYear(), month: new Date(post.eventStart).getMonth() + 1, day: new Date(post.eventStart).getDate() } : undefined,
        endDate: post.eventEnd ? { year: new Date(post.eventEnd).getFullYear(), month: new Date(post.eventEnd).getMonth() + 1, day: new Date(post.eventEnd).getDate() } : undefined,
      },
    };
  }

  if (post.topicType === "OFFER") {
    body.offer = {
      termsConditions: post.offerTerms || "",
      couponCode: post.offerCode || "",
    };
  }

  return gbpV4(token, `accounts/${accountId}/locations/${locationId}/localPosts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listPosts(token: string, accountId: string, locationId: string) {
  return gbpV4(token, `accounts/${accountId}/locations/${locationId}/localPosts`);
}

export async function deletePost(token: string, accountId: string, locationId: string, postId: string) {
  return gbpV4(token, `accounts/${accountId}/locations/${locationId}/localPosts/${postId}`, {
    method: "DELETE",
  });
}

// ── Photos ──────────────────────────────────────────────────────────
export async function uploadPhoto(
  token: string,
  accountId: string,
  locationId: string,
  imageUrl: string,
  category: "COVER" | "PROFILE" | "LOGO" | "EXTERIOR" | "INTERIOR" | "PRODUCT" | "AT_WORK" | "FOOD_AND_DRINK" | "MENU" | "COMMON_AREA" | "ROOMS" | "TEAMS" | "ADDITIONAL" = "ADDITIONAL",
) {
  return gbpV4(token, `accounts/${accountId}/locations/${locationId}/media`, {
    method: "POST",
    body: JSON.stringify({
      mediaFormat: "PHOTO",
      locationAssociation: { category },
      sourceUrl: imageUrl,
    }),
  });
}

export async function listPhotos(token: string, accountId: string, locationId: string) {
  return gbpV4(token, `accounts/${accountId}/locations/${locationId}/media`);
}

// ── Performance / Insights ──────────────────────────────────────────
export async function getPerformance(
  token: string,
  locationId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,
) {
  const metrics = [
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "WEBSITE_CLICKS",
    "CALL_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
  ];

  const dailyMetrics = metrics.map(m => `dailyMetrics=${m}`).join("&");

  return gbpPerf(token,
    `locations/${locationId}:fetchMultiDailyMetricsTimeSeries?${dailyMetrics}&dailyRange.startDate.year=${startDate.split("-")[0]}&dailyRange.startDate.month=${parseInt(startDate.split("-")[1])}&dailyRange.startDate.day=${parseInt(startDate.split("-")[2])}&dailyRange.endDate.year=${endDate.split("-")[0]}&dailyRange.endDate.month=${parseInt(endDate.split("-")[1])}&dailyRange.endDate.day=${parseInt(endDate.split("-")[2])}`,
  );
}

export async function getSearchKeywords(token: string, locationId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // current month (1-based)
  return gbpPerf(token,
    `locations/${locationId}/searchkeywords/impressions/monthly?monthlyRange.startMonth.year=${year}&monthlyRange.startMonth.month=${month > 1 ? month - 1 : 12}&monthlyRange.endMonth.year=${year}&monthlyRange.endMonth.month=${month}`,
  );
}

// ── AI Auto-Reply to Reviews ────────────────────────────────────────
export async function generateReviewReply(
  businessName: string,
  reviewerName: string,
  rating: number,
  comment: string,
  contractorType: string,
): Promise<string> {
  const systemPrompt = `You are Mike from The Wolf Pack AI, replying to a Google review for ${businessName} (${contractorType}).

RULES:
- Keep it short, 1-3 sentences max
- Casual and warm, like a real person
- No dashes, no bullet points, no formal language
- If positive (4-5 stars): thank them genuinely, mention something specific from their review if possible
- If neutral (3 stars): thank them, acknowledge room for improvement, keep it positive
- If negative (1-2 stars): apologize sincerely, take ownership, offer to make it right, give a way to reach you
- Never be defensive or argumentative
- Never mention AI or automation
- Sign off with just "Mike" or "- Mike"

REVIEWER: ${reviewerName}
RATING: ${rating}/5 stars
REVIEW: ${comment || "(no comment)"}

Reply:`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{ role: "user", content: systemPrompt }],
  });

  const textBlock = response.content.find(b => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text.trim() : "Thanks for the review! Really appreciate it. - Mike";
}

// ── Auto-Post Generation ────────────────────────────────────────────
export async function generateWeeklyPost(
  businessName: string,
  contractorType: string,
  city: string,
  services: string,
): Promise<{ summary: string; ctaType: string }> {
  const systemPrompt = `Generate a short Google Business Profile post for ${businessName}, a ${contractorType} in ${city}.

Services: ${services || contractorType + " services"}

RULES:
- 2-4 sentences max
- Casual, like a real local business owner wrote it
- Rotate between: recent project highlight, seasonal tip, service spotlight, community shoutout, availability update
- Include the city name naturally
- No hashtags, no emojis, no "Call us today!" energy
- End with something that makes someone want to reach out
- Do NOT use dashes or bullet points

Return ONLY the post text, nothing else.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{ role: "user", content: systemPrompt }],
  });

  const textBlock = response.content.find(b => b.type === "text");
  return {
    summary: textBlock && "text" in textBlock ? textBlock.text.trim() : `${businessName} is ready for your next ${contractorType} project in ${city}. Give us a call.`,
    ctaType: "CALL",
  };
}

// ── Cron: Process Reviews ───────────────────────────────────────────
export async function processReviews(): Promise<{ checked: number; replied: number }> {
  const connections = await sql`
    SELECT * FROM gbp_connections WHERE connected = TRUE AND auto_review_reply_enabled = TRUE
  `;

  let checked = 0;
  let replied = 0;

  for (const conn of connections) {
    const token = await getGbpToken(conn.id as string);
    if (!token) continue;

    const accountId = (conn.account_id as string).replace("accounts/", "");
    const locationId = (conn.location_id as string).replace("locations/", "");

    try {
      const reviewData = await listReviews(token, accountId, locationId, 20);
      const reviews = reviewData.reviews || [];

      for (const review of reviews) {
        const googleReviewId = review.reviewId || review.name?.split("/").pop();
        if (!googleReviewId) continue;

        // Check if already processed
        const existing = await sql`
          SELECT id FROM gbp_reviews WHERE connection_id = ${conn.id} AND google_review_id = ${googleReviewId}
        `;
        if (existing.length > 0) continue;

        const rating = review.starRating === "FIVE" ? 5 : review.starRating === "FOUR" ? 4 : review.starRating === "THREE" ? 3 : review.starRating === "TWO" ? 2 : 1;
        const sentiment = rating >= 4 ? "positive" : rating === 3 ? "neutral" : "negative";
        const reviewerName = review.reviewer?.displayName || "Customer";
        const comment = review.comment || "";

        // Generate AI reply
        const aiReply = await generateReviewReply(
          conn.location_name as string || "the business",
          reviewerName,
          rating,
          comment,
          "contractor",
        );

        // Store the review
        await sql`
          INSERT INTO gbp_reviews (connection_id, google_review_id, reviewer_name, star_rating, comment, review_time, sentiment, ai_suggested_reply, reply_status)
          VALUES (${conn.id}, ${googleReviewId}, ${reviewerName}, ${rating}, ${comment}, ${review.createTime || new Date().toISOString()}, ${sentiment}, ${aiReply}, 'pending')
        `;
        checked++;

        // Auto-reply if it's positive or neutral
        if (rating >= 3 && !review.reviewReply) {
          try {
            await replyToReview(token, accountId, locationId, googleReviewId, aiReply);
            await sql`
              UPDATE gbp_reviews SET reply_text = ${aiReply}, reply_status = 'replied', replied_at = NOW()
              WHERE connection_id = ${conn.id} AND google_review_id = ${googleReviewId}
            `;
            replied++;
            console.log(`[gbp] Replied to ${rating}-star review from ${reviewerName}`);
          } catch (err) {
            console.error(`[gbp] Failed to reply to review:`, err);
          }
        } else if (rating < 3 && !review.reviewReply) {
          // Negative reviews — store but don't auto-reply, notify owner
          const ownerPhone = process.env.OWNER_PHONE;
          if (ownerPhone) {
            await sendLoop(ownerPhone,
              `Heads up — ${conn.location_name} got a ${rating}-star review from ${reviewerName}: "${comment.substring(0, 150)}". Suggested reply is saved in the dashboard.`
            );
          }
        }
      }

      // Update last check time
      await sql`UPDATE gbp_connections SET last_review_check_at = NOW(), updated_at = NOW() WHERE id = ${conn.id}`;
    } catch (err) {
      console.error(`[gbp] Review check failed for ${conn.location_name}:`, err);
    }
  }

  return { checked, replied };
}

// ── Cron: Auto-Post Weekly ──────────────────────────────────────────
export async function processWeeklyPosts(): Promise<{ posted: number }> {
  const connections = await sql`
    SELECT * FROM gbp_connections
    WHERE connected = TRUE AND auto_post_enabled = TRUE
      AND (last_post_at IS NULL OR last_post_at < NOW() - INTERVAL '6 days')
  `;

  let posted = 0;

  for (const conn of connections) {
    const token = await getGbpToken(conn.id as string);
    if (!token) continue;

    const accountId = (conn.account_id as string).replace("accounts/", "");
    const locationId = (conn.location_id as string).replace("locations/", "");

    try {
      const post = await generateWeeklyPost(
        conn.location_name as string || "the business",
        "contractor",
        "",
        "",
      );

      const result = await createPost(token, accountId, locationId, {
        summary: post.summary,
        ctaType: post.ctaType,
      });

      // Log the post
      await sql`
        INSERT INTO gbp_posts (connection_id, google_post_id, post_type, summary, cta_type, status)
        VALUES (${conn.id}, ${result.name || null}, 'STANDARD', ${post.summary}, ${post.ctaType}, 'published')
      `;

      await sql`UPDATE gbp_connections SET last_post_at = NOW(), updated_at = NOW() WHERE id = ${conn.id}`;
      posted++;
      console.log(`[gbp] Posted to ${conn.location_name}: ${post.summary.substring(0, 60)}...`);
    } catch (err) {
      console.error(`[gbp] Post failed for ${conn.location_name}:`, err);
      await sql`
        INSERT INTO gbp_posts (connection_id, post_type, summary, status)
        VALUES (${conn.id}, 'STANDARD', 'Failed to generate post', 'failed')
      `;
    }
  }

  return { posted };
}

// ── Cron: Monthly Insights Report ───────────────────────────────────
export async function processMonthlyReports(): Promise<{ sent: number }> {
  const connections = await sql`
    SELECT * FROM gbp_connections
    WHERE connected = TRUE AND monthly_report_enabled = TRUE AND report_phone IS NOT NULL
      AND (last_report_at IS NULL OR last_report_at < NOW() - INTERVAL '27 days')
  `;

  let sent = 0;

  for (const conn of connections) {
    const token = await getGbpToken(conn.id as string);
    if (!token) continue;

    const locationId = (conn.location_id as string).replace("locations/", "");

    try {
      // Get last 30 days of performance
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = thirtyDaysAgo.toISOString().split("T")[0];
      const endDate = now.toISOString().split("T")[0];

      const perfData = await getPerformance(token, locationId, startDate, endDate);

      // Parse metrics
      let searchImpressions = 0;
      let mapsImpressions = 0;
      let websiteClicks = 0;
      let phoneCalls = 0;
      let directionRequests = 0;

      const timeSeries = perfData.multiDailyMetricTimeSeries || [];
      for (const series of timeSeries) {
        const metric = series.dailyMetricTimeSeries?.dailyMetric || "";
        const points = series.dailyMetricTimeSeries?.timeSeries?.datedValues || [];
        const total = points.reduce((sum: number, p: { value?: string }) => sum + parseInt(p.value || "0"), 0);

        if (metric.includes("SEARCH")) searchImpressions += total;
        if (metric.includes("MAPS")) mapsImpressions += total;
        if (metric === "WEBSITE_CLICKS") websiteClicks = total;
        if (metric === "CALL_CLICKS") phoneCalls = total;
        if (metric === "BUSINESS_DIRECTION_REQUESTS") directionRequests = total;
      }

      // Get search keywords
      const keywordData = await getSearchKeywords(token, locationId);
      const topTerms = (keywordData.searchKeywordsCounts || [])
        .slice(0, 5)
        .map((k: { searchKeyword?: string; insightsValue?: { value?: string } }) => ({
          term: k.searchKeyword || "",
          impressions: parseInt(k.insightsValue?.value || "0"),
        }));

      // Store snapshot
      await sql`
        INSERT INTO gbp_insights (connection_id, period_start, period_end, search_impressions, maps_impressions, website_clicks, phone_calls, direction_requests, top_search_terms, report_sent)
        VALUES (${conn.id}, ${startDate}, ${endDate}, ${searchImpressions}, ${mapsImpressions}, ${websiteClicks}, ${phoneCalls}, ${directionRequests}, ${JSON.stringify(topTerms)}, TRUE)
      `;

      // Text the report to the client
      const totalImpressions = searchImpressions + mapsImpressions;
      const topTermsList = topTerms.slice(0, 3).map((t: { term: string }) => t.term).join(", ");

      const reportMsg = `Hey, here's your monthly Google update for ${conn.location_name}. Last 30 days: ${totalImpressions.toLocaleString()} people saw your listing, ${websiteClicks} clicked your website, ${phoneCalls} called you, ${directionRequests} asked for directions. Top searches: ${topTermsList || "n/a"}. Keep it up`;

      await sendLoop(conn.report_phone as string, reportMsg);
      await sql`UPDATE gbp_connections SET last_report_at = NOW(), updated_at = NOW() WHERE id = ${conn.id}`;
      sent++;
      console.log(`[gbp] Sent monthly report to ${conn.report_phone} for ${conn.location_name}`);
    } catch (err) {
      console.error(`[gbp] Report failed for ${conn.location_name}:`, err);
    }
  }

  return { sent };
}

// ── Review Nudge System ─────────────────────────────────────────────
// When a client hits "Live Client" stage, start the 3-week nudge sequence

export async function startReviewNudges(
  connectionId: string | null,
  contactPhone: string,
  contactName: string,
  businessName: string,
  reviewLink: string,
): Promise<void> {
  // Schedule first nudge 7 days from now
  await sql`
    INSERT INTO gbp_review_nudges (connection_id, contact_phone, contact_name, business_name, review_link, nudge_count, next_nudge_at)
    VALUES (${connectionId}, ${contactPhone}, ${contactName}, ${businessName}, ${reviewLink}, 0, ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()})
  `;
  console.log(`[gbp] Scheduled review nudges for ${contactName} (${businessName})`);
}

export async function processReviewNudges(): Promise<{ sent: number; completed: number }> {
  const now = new Date().toISOString();

  const dueNudges = await sql`
    SELECT * FROM gbp_review_nudges
    WHERE status = 'active' AND review_received = FALSE AND next_nudge_at <= ${now}
    ORDER BY next_nudge_at ASC
    LIMIT 20
  `;

  let sent = 0;
  let completed = 0;

  for (const nudge of dueNudges) {
    const firstName = (nudge.contact_name as string) || "there";
    const businessName = (nudge.business_name as string) || "your business";
    const reviewLink = (nudge.review_link as string) || "";
    const count = (nudge.nudge_count as number) || 0;

    // Check if they already left a review (if we have a GBP connection)
    if (nudge.connection_id) {
      try {
        const token = await getGbpToken(nudge.connection_id as string);
        if (token) {
          const conn = await sql`SELECT account_id, location_id FROM gbp_connections WHERE id = ${nudge.connection_id}`;
          if (conn.length > 0) {
            const accountId = (conn[0].account_id as string).replace("accounts/", "");
            const locationId = (conn[0].location_id as string).replace("locations/", "");
            const reviewData = await listReviews(token, accountId, locationId, 10);
            const reviews = reviewData.reviews || [];
            // Check if any recent review mentions the business or is from around the time we started nudging
            const hasNewReview = reviews.some((r: { createTime?: string }) => {
              const reviewTime = new Date(r.createTime || "").getTime();
              const nudgeStart = new Date(nudge.created_at as string).getTime();
              return reviewTime > nudgeStart;
            });
            if (hasNewReview) {
              await sql`UPDATE gbp_review_nudges SET review_received = TRUE, status = 'completed' WHERE id = ${nudge.id}`;
              completed++;
              console.log(`[gbp] Review received from ${firstName}, stopping nudges`);
              continue;
            }
          }
        }
      } catch { /* continue with nudge */ }
    }

    // Send the appropriate nudge
    const messages: Record<number, string> = {
      0: `Hey ${firstName}, how's the new site treating you? If you're happy with how ${businessName} looks online, would you mind leaving us a quick Google review? It really helps. ${reviewLink}`,
      1: `Hey ${firstName}, just checking in. If you've got 30 seconds, a Google review would mean a lot for ${businessName}. ${reviewLink}`,
      2: `Hey ${firstName}, honest reviews from real clients like you are the biggest thing that helps us grow. If you've got a sec it would truly mean a lot. ${reviewLink}`,
    };

    const msg = messages[count];
    if (!msg) {
      // Done with 3 nudges
      await sql`UPDATE gbp_review_nudges SET status = 'completed' WHERE id = ${nudge.id}`;
      completed++;
      continue;
    }

    try {
      await sendLoop(nudge.contact_phone as string, msg);
      const nextCount = count + 1;
      const nextNudgeAt = nextCount < 3
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await sql`
        UPDATE gbp_review_nudges SET
          nudge_count = ${nextCount},
          next_nudge_at = ${nextNudgeAt},
          status = ${nextCount >= 3 ? "completed" : "active"}
        WHERE id = ${nudge.id}
      `;
      sent++;
      console.log(`[gbp] Sent review nudge ${nextCount}/3 to ${firstName}`);
    } catch (err) {
      console.error(`[gbp] Failed to send nudge to ${firstName}:`, err);
    }
  }

  return { sent, completed };
}
