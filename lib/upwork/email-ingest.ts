import { neon } from "@neondatabase/serverless";
import { refreshAccessToken, gmailFetch } from "@/lib/gmail";
import { sendMessage } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);

interface ParsedJob {
  upwork_id: string;
  title: string;
  description: string;
  budget: string | null;
  job_type: string | null;
  skills: string[];
  client_country: string | null;
  client_rating: number | null;
  client_hire_rate: number | null;
  client_payment_verified: boolean;
  job_url: string;
  posted_at: string | null;
}

const OWNER_EMAIL = process.env.OWNER_EMAIL || "info@thewolfpackco.com";
const UPWORK_LABEL_NAME = process.env.UPWORK_GMAIL_LABEL || "Upwork - Job Notification";

async function getOwnerGmailToken(): Promise<string | null> {
  const rows = await sql`
    SELECT id, gmail_refresh_token FROM workspaces
    WHERE gmail_connected = TRUE AND gmail_refresh_token IS NOT NULL
      AND (owner_email = ${OWNER_EMAIL} OR gmail_email = ${OWNER_EMAIL})
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  try {
    return await refreshAccessToken(rows[0].gmail_refresh_token as string);
  } catch (err) {
    console.error("[upwork-email] Gmail token refresh failed:", err);
    return null;
  }
}

export interface EmailIngestDebug {
  ownerEmail: string;
  workspaceFound: boolean;
  tokenRefreshed: boolean;
  labelLookedUp: string;
  labelFound: boolean;
  allUpworkLabels: string[];
  messagesFound: number;
  messagesWithHtml: number;
  totalJobsParsed: number;
  totalIdsExtracted: number;
  newlyInserted: number;
  alreadyInDb: number;
  samples: Array<{
    subject: string;
    date: string;
    htmlSize: number;
    idsFound: number;
    firstIds: string[];
    firstTitles: string[];
  }>;
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodePart(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function extractHtmlBody(payload: Record<string, unknown>): string {
  const body = payload?.body as Record<string, unknown> | undefined;
  if (body?.data) return decodePart(body.data as string);
  const parts = payload?.parts as Array<Record<string, unknown>> | undefined;
  if (!parts) return "";
  const html = parts.find(p => p.mimeType === "text/html");
  if (html?.body && (html.body as Record<string, unknown>).data) {
    return decodePart((html.body as Record<string, unknown>).data as string);
  }
  for (const p of parts) {
    const nested = p.parts as Array<Record<string, unknown>> | undefined;
    if (nested) {
      const h = nested.find(x => x.mimeType === "text/html");
      if (h?.body && (h.body as Record<string, unknown>).data) {
        return decodePart((h.body as Record<string, unknown>).data as string);
      }
    }
  }
  const text = parts.find(p => p.mimeType === "text/plain");
  if (text?.body && (text.body as Record<string, unknown>).data) {
    return decodePart((text.body as Record<string, unknown>).data as string);
  }
  return "";
}

function stripTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Unwrap Upwork's click-tracking wrappers (click.upwork.com, upwork.com/e/t/, etc.)
// to recover the real job URL from the `url=` / `destination=` query param.
function unwrapTrackingUrl(url: string): string {
  try {
    const u = new URL(url);
    const candidate =
      u.searchParams.get("url") ||
      u.searchParams.get("destination") ||
      u.searchParams.get("redirect") ||
      u.searchParams.get("u");
    if (candidate && candidate.includes("upwork.com")) {
      return decodeURIComponent(candidate);
    }
  } catch {
    // not a URL — fall through
  }
  return url;
}

// Parse an Upwork alert email body and return every job referenced.
// Upwork Premium alerts bundle multiple jobs per email; each job has an
// anchor linking to a URL containing the cipher id `~<id>`.
export function parseJobsFromEmail(html: string, subject: string, receivedDate: string | null): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const seen = new Set<string>();

  // Match anchor tags and pull href + inner text. Works on raw HTML bodies.
  const anchorRe = /<a\b[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const matches: Array<{ url: string; text: string; index: number }> = [];
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    matches.push({ url: m[1], text: stripTags(m[2]), index: m.index });
  }

  for (const { url, text, index } of matches) {
    const real = unwrapTrackingUrl(url);
    const idMatch = real.match(/~([0-9a-zA-Z]{10,})/);
    if (!idMatch) continue;
    const upworkId = idMatch[1];
    if (seen.has(upworkId)) continue;

    // Require the anchor's visible text to look like a title (skip bare
    // "View job", "Apply", icon-only links — those are navigation chrome).
    const cleanText = text.trim();
    const looksLikeTitle =
      cleanText.length >= 12 &&
      !/^(view|apply|see|open|click|unsubscribe|manage|settings|upwork)\b/i.test(cleanText);
    if (!looksLikeTitle) {
      seen.add(upworkId);
      // Still record with fallback title if nothing else turns up.
      jobs.push({
        upwork_id: upworkId,
        title: cleanText || subject || `Upwork Job ${upworkId}`,
        description: "",
        budget: null,
        job_type: null,
        skills: [],
        client_country: null,
        client_rating: null,
        client_hire_rate: null,
        client_payment_verified: false,
        job_url: `https://www.upwork.com/jobs/~${upworkId}`,
        posted_at: receivedDate,
      });
      continue;
    }
    seen.add(upworkId);

    // Grab ~1200 chars of context after the anchor to harvest budget / type / country.
    const contextHtml = html.slice(index, index + 1500);
    const contextText = stripTags(contextHtml);

    const budgetMatch =
      contextText.match(/\$[\d,]+(?:\.\d+)?\s*(?:-\s*\$[\d,]+(?:\.\d+)?)?\s*(?:\/\s*hr|per hour|hourly)?/i) ||
      null;
    const hourlyMatch = /hourly|\/\s*hr|per hour/i.test(contextText);
    const fixedMatch = /fixed[- ]?price|fixed budget/i.test(contextText);

    // Description: the chunk of text right after the title, trimmed.
    const afterTitle = contextText.replace(cleanText, "").trim().slice(0, 800);

    jobs.push({
      upwork_id: upworkId,
      title: cleanText,
      description: afterTitle,
      budget: budgetMatch ? budgetMatch[0].replace(/\s+/g, " ").trim() : null,
      job_type: hourlyMatch ? "hourly" : fixedMatch ? "fixed" : null,
      skills: [],
      client_country: null,
      client_rating: null,
      client_hire_rate: null,
      client_payment_verified: false,
      job_url: `https://www.upwork.com/jobs/~${upworkId}`,
      posted_at: receivedDate,
    });
  }

  return jobs;
}

// Pull Upwork alert emails from the owner's Gmail inbox, parse jobs, insert
// into upwork_jobs (status='new'), and text the owner on new inserts.
// Dedupe is handled by the UNIQUE(upwork_id) constraint on the table.
export async function ingestUpworkEmails(): Promise<number> {
  const token = await getOwnerGmailToken();
  if (!token) {
    console.log("[upwork-email] No Gmail token for owner — skipping email ingest");
    return 0;
  }

  // Resolve the "Upwork - Job Notification" label to its Gmail label ID.
  // Using labelIds (not a `label:` search string) avoids ambiguity with
  // spaces/hyphens in the label name.
  const labelsRes = await gmailFetch(token, "labels");
  const labels = (labelsRes?.labels as Array<{ id: string; name: string }> | undefined) || [];
  const upworkLabel = labels.find(l => l.name === UPWORK_LABEL_NAME);
  if (!upworkLabel) {
    console.log(`[upwork-email] Gmail label "${UPWORK_LABEL_NAME}" not found — skipping`);
    return 0;
  }

  const query = encodeURIComponent("newer_than:2d");
  const list = await gmailFetch(
    token,
    `messages?labelIds=${upworkLabel.id}&q=${query}&maxResults=25`
  );
  const messages = (list?.messages as Array<{ id: string }> | undefined) || [];
  if (messages.length === 0) return 0;

  let newCount = 0;

  for (const { id } of messages) {
    try {
      const msg = await gmailFetch(token, `messages/${id}?format=full`);
      const payload = msg?.payload as Record<string, unknown> | undefined;
      if (!payload) continue;

      const headers = (payload.headers as Array<{ name: string; value: string }>) || [];
      const subject = getHeader(headers, "Subject");
      const dateHeader = getHeader(headers, "Date");
      const receivedIso = dateHeader ? new Date(dateHeader).toISOString() : null;

      const html = extractHtmlBody(payload);
      if (!html) continue;

      const jobs = parseJobsFromEmail(html, subject, receivedIso);

      for (const job of jobs) {
        try {
          const result = await sql`
            INSERT INTO upwork_jobs (
              upwork_id, title, description, budget, job_type, skills,
              client_country, client_rating, client_hire_rate, client_payment_verified,
              job_url, posted_at, status
            ) VALUES (
              ${job.upwork_id}, ${job.title}, ${job.description}, ${job.budget},
              ${job.job_type}, ${job.skills}, ${job.client_country},
              ${job.client_rating}, ${job.client_hire_rate}, ${job.client_payment_verified},
              ${job.job_url}, ${job.posted_at}, 'new'
            )
            ON CONFLICT (upwork_id) DO NOTHING
            RETURNING id
          `;
          if (result.length > 0) {
            newCount++;
            if (process.env.OWNER_PHONE) {
              try {
                await sendMessage(
                  process.env.OWNER_PHONE,
                  `New Upwork job: ${job.title}\nBudget: ${job.budget || "not listed"}\n${job.job_url}`
                );
              } catch (err) {
                console.error(`[upwork-email] Text notification failed for ${job.upwork_id}:`, err);
              }
            }
          }
        } catch (err) {
          console.error(`[upwork-email] Insert error for ${job.upwork_id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[upwork-email] Error processing message ${id}:`, err);
    }
  }

  return newCount;
}

// Diagnostic version — runs the same pipeline but returns detailed counts so
// we can tell which stage is returning 0 (workspace? label? messages? parser?).
export async function debugIngestUpworkEmails(): Promise<EmailIngestDebug> {
  const debug: EmailIngestDebug = {
    ownerEmail: OWNER_EMAIL,
    workspaceFound: false,
    tokenRefreshed: false,
    labelLookedUp: UPWORK_LABEL_NAME,
    labelFound: false,
    allUpworkLabels: [],
    messagesFound: 0,
    messagesWithHtml: 0,
    totalJobsParsed: 0,
    totalIdsExtracted: 0,
    newlyInserted: 0,
    alreadyInDb: 0,
    samples: [],
  };

  const rows = await sql`
    SELECT id, gmail_refresh_token FROM workspaces
    WHERE gmail_connected = TRUE AND gmail_refresh_token IS NOT NULL
      AND (owner_email = ${OWNER_EMAIL} OR gmail_email = ${OWNER_EMAIL})
    LIMIT 1
  `;
  if (rows.length === 0) return debug;
  debug.workspaceFound = true;

  let token: string;
  try {
    token = await refreshAccessToken(rows[0].gmail_refresh_token as string);
    debug.tokenRefreshed = true;
  } catch {
    return debug;
  }

  const labelsRes = await gmailFetch(token, "labels");
  const labels = (labelsRes?.labels as Array<{ id: string; name: string }> | undefined) || [];
  debug.allUpworkLabels = labels
    .map(l => l.name)
    .filter(n => n.toLowerCase().includes("upwork"));
  const upworkLabel = labels.find(l => l.name === UPWORK_LABEL_NAME);
  if (!upworkLabel) return debug;
  debug.labelFound = true;

  const query = encodeURIComponent("newer_than:7d");
  const list = await gmailFetch(
    token,
    `messages?labelIds=${upworkLabel.id}&q=${query}&maxResults=10`
  );
  const messages = (list?.messages as Array<{ id: string }> | undefined) || [];
  debug.messagesFound = messages.length;

  for (const { id } of messages.slice(0, 5)) {
    const msg = await gmailFetch(token, `messages/${id}?format=full`);
    const payload = msg?.payload as Record<string, unknown> | undefined;
    if (!payload) continue;

    const headers = (payload.headers as Array<{ name: string; value: string }>) || [];
    const subject = getHeader(headers, "Subject");
    const dateHeader = getHeader(headers, "Date");
    const receivedIso = dateHeader ? new Date(dateHeader).toISOString() : null;

    const html = extractHtmlBody(payload);
    if (!html) {
      debug.samples.push({ subject, date: dateHeader, htmlSize: 0, idsFound: 0, firstIds: [], firstTitles: [] });
      continue;
    }
    debug.messagesWithHtml++;

    const jobs = parseJobsFromEmail(html, subject, receivedIso);
    debug.totalJobsParsed += jobs.length;

    // Count raw ~id matches in the HTML regardless of parser filters.
    const rawIds = new Set<string>();
    const idRe = /~([0-9a-zA-Z]{10,})/g;
    let m;
    while ((m = idRe.exec(html)) !== null) rawIds.add(m[1]);
    debug.totalIdsExtracted += rawIds.size;

    debug.samples.push({
      subject,
      date: dateHeader,
      htmlSize: html.length,
      idsFound: rawIds.size,
      firstIds: Array.from(rawIds).slice(0, 5),
      firstTitles: jobs.slice(0, 5).map(j => j.title),
    });

    // Check how many of these IDs already exist in the DB.
    if (rawIds.size > 0) {
      const existing = await sql`
        SELECT upwork_id FROM upwork_jobs WHERE upwork_id = ANY(${Array.from(rawIds)})
      `;
      debug.alreadyInDb += existing.length;
    }
  }

  return debug;
}
