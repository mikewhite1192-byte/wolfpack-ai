import { neon } from "@neondatabase/serverless";
import { refreshAccessToken, gmailFetch } from "@/lib/gmail";
import { sendMessage } from "@/lib/loop/client";
import { scoreUpworkJob } from "@/lib/upwork/scoring";

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
  proposal_count: number | null;
  client_lifetime_spend: number | null;
  hourly_min: number | null;
  hourly_max: number | null;
  fixed_budget: number | null;
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

// Walk the Gmail MIME tree recursively and return the first body matching
// the requested mime type. Gmail nests parts arbitrarily deep on some
// messages (multipart/alternative inside multipart/mixed inside
// multipart/related), so the old 2-level lookup missed ~half of them.
function findBodyByMime(payload: Record<string, unknown>, mime: string): string {
  if ((payload as { mimeType?: string })?.mimeType === mime) {
    const body = payload.body as Record<string, unknown> | undefined;
    if (body?.data) return decodePart(body.data as string);
  }
  const parts = payload?.parts as Array<Record<string, unknown>> | undefined;
  if (!parts) return "";
  for (const p of parts) {
    const found = findBodyByMime(p, mime);
    if (found) return found;
  }
  return "";
}

function extractHtmlBody(payload: Record<string, unknown>): string {
  return findBodyByMime(payload, "text/html") || findBodyByMime(payload, "text/plain");
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

// Upwork Premium alert subjects look like:
//   "New job: Build a P2P Delivery Platform - Budget $1,200"
//   "Invitation to interview: React Developer"
// Strip the prefix so the CRM title matches what the owner sees on Upwork.
function titleFromSubject(subject: string): string {
  return subject
    .replace(/^\s*(new job|invitation to interview|invitation|new invitation|job invite|opportunity)\s*:\s*/i, "")
    .trim();
}

// Pull "$1,200", "$50-$75/hr", "Budget $500", etc. out of a blob of text.
function extractBudget(text: string): string | null {
  const subjectOrBody = text.match(
    /\$[\d,]+(?:\.\d+)?\s*(?:-\s*\$[\d,]+(?:\.\d+)?)?\s*(?:\/\s*hr|per hour|hourly)?/i
  );
  return subjectOrBody ? subjectOrBody[0].replace(/\s+/g, " ").trim() : null;
}

function extractJobType(text: string): string | null {
  if (/hourly|\/\s*hr|per hour/i.test(text)) return "hourly";
  if (/fixed[- ]?price|fixed budget|\bfixed\b/i.test(text)) return "fixed";
  return null;
}

// "$17K spent", "$1.5M spent", "$500 spent"
function extractLifetimeSpend(text: string): number | null {
  const m = text.match(/\$([\d,]+(?:\.\d+)?)\s*([KM])?\s*(?:spent|total\s+spent|lifetime)/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  const suffix = m[2]?.toUpperCase();
  if (suffix === "K") return n * 1000;
  if (suffix === "M") return n * 1_000_000;
  return n;
}

// Upwork shows proposal counts bucketed, not exact. Map to representative
// midpoints so numeric comparisons in the scorer behave sensibly.
function extractProposalCount(text: string): number | null {
  if (/less\s+than\s+5\s+proposals?/i.test(text)) return 3;
  if (/5\s+to\s+10\s+proposals?/i.test(text)) return 8;
  if (/10\s+to\s+20\s+proposals?/i.test(text)) return 15;
  if (/20\s+to\s+50\s+proposals?/i.test(text)) return 35;
  if (/50\+\s*proposals?/i.test(text)) return 75;
  return null;
}

function extractHourlyRange(text: string): { min: number | null; max: number | null } {
  const m = text.match(
    /\$(\d+(?:\.\d+)?)\s*(?:-\s*\$?(\d+(?:\.\d+)?))?\s*(?:\/\s*hr|per hour|hourly)/i
  );
  if (!m) return { min: null, max: null };
  const min = parseFloat(m[1]);
  const max = m[2] ? parseFloat(m[2]) : min;
  return { min, max };
}

// "Fixed: $1,200", "Budget $1,200", "$1,200 fixed"
function extractFixedBudget(text: string): number | null {
  const m =
    text.match(/(?:fixed|budget)[:\s]+\$?([\d,]+(?:\.\d+)?)/i) ||
    text.match(/\$([\d,]+(?:\.\d+)?)\s+fixed/i);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

function extractCountry(text: string): string | null {
  const m = text.match(
    /\b(United States|USA|U\.S\.?|Canada|Australia|United Kingdom|UK|Great Britain|Germany|France|India|Pakistan|Philippines|Ukraine|Russia|Brazil|Mexico|Spain|Italy|Netherlands|Sweden|Norway|Denmark|Poland|Turkey|Egypt|UAE|Saudi Arabia|Singapore|Japan|China|Hong Kong|South Korea|Israel|South Africa|Argentina|Chile|Colombia|New Zealand|Ireland)\b/i
  );
  return m ? m[1] : null;
}

function extractPaymentVerified(text: string): boolean {
  return /payment\s+verified/i.test(text);
}

function extractClientRating(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s+stars?/i);
  return m ? parseFloat(m[1]) : null;
}

// Upwork Premium alerts put the actual description snippet between a
// "Job Description:" label and a "… more" / "View job" marker. Everything
// else is header ("Upwork — New job alert") and footer ("You received
// this email because Freelancer Plus members..."). Without this extractor
// the stored description would be ~2000 chars of boilerplate and the
// length-based HOT/WARM filters would never discriminate.
function extractJobDescription(bodyText: string): string {
  const between = bodyText.match(
    /Job Description:\s*([\s\S]+?)\s*(?:…\s*more|\.\.\.\s*more\b|\bView job\b|Client\s+(?:Fixed|Hourly)\s*:)/i
  );
  if (between) return between[1].trim();

  const labelIdx = bodyText.toLowerCase().indexOf("job description:");
  if (labelIdx !== -1) {
    const after = bodyText.slice(labelIdx + "job description:".length);
    const boilerplateIdx = after.search(/You received this email|manage your alert|unsubscribe/i);
    return (boilerplateIdx !== -1 ? after.slice(0, boilerplateIdx) : after.slice(0, 800)).trim();
  }

  // Last resort: chop the footer and the Upwork intro line.
  const footerIdx = bodyText.search(/You received this email|manage your alert preferences/i);
  const withoutFooter = footerIdx !== -1 ? bodyText.slice(0, footerIdx) : bodyText;
  return withoutFooter
    .replace(/^.*?This job looks like a match for you\.[^.]*\.\s*/i, "")
    .replace(/^.*?Check it out[^.]*\.\s*/i, "")
    .trim()
    .slice(0, 1500);
}

// Parse an Upwork alert email and return every job referenced.
// Premium alerts are one job per email, so when there's a single ~id in
// the body we treat the subject as the authoritative title and the plain
// body as the description. Multi-id emails (older "jobs you may like"
// digests) fall back to per-anchor parsing.
export function parseJobsFromEmail(html: string, subject: string, receivedDate: string | null): ParsedJob[] {
  // Pull every ~id present in the HTML, de-duped. We extract from the raw
  // HTML so tracking-wrapped URLs and canonical URLs both match.
  const ids = new Set<string>();
  const idRe = /~([0-9a-zA-Z]{10,})/g;
  let m;
  while ((m = idRe.exec(html)) !== null) ids.add(m[1]);
  if (ids.size === 0) return [];

  const bodyText = stripTags(html);
  const subjectTitle = titleFromSubject(subject);

  // Single-job email — use subject as title, extracted snippet as description.
  if (ids.size === 1) {
    const upworkId = Array.from(ids)[0];
    const combined = `${subject}\n${bodyText}`;
    const { min: hourlyMin, max: hourlyMax } = extractHourlyRange(combined);
    const fixed = extractFixedBudget(combined);
    const jobType = extractJobType(combined) || (hourlyMax != null ? "hourly" : fixed != null ? "fixed" : null);
    const description = extractJobDescription(bodyText);
    return [{
      upwork_id: upworkId,
      title: subjectTitle || `Upwork Job ${upworkId}`,
      description,
      budget: extractBudget(subject) || extractBudget(bodyText),
      job_type: jobType,
      skills: [],
      client_country: extractCountry(combined),
      client_rating: extractClientRating(combined),
      client_hire_rate: null,
      client_payment_verified: extractPaymentVerified(combined),
      job_url: `https://www.upwork.com/jobs/~${upworkId}`,
      posted_at: receivedDate,
      proposal_count: extractProposalCount(combined),
      client_lifetime_spend: extractLifetimeSpend(combined),
      hourly_min: hourlyMin,
      hourly_max: hourlyMax,
      fixed_budget: fixed,
    }];
  }

  // Multi-job email — walk the anchors and harvest per-job context.
  const jobs: ParsedJob[] = [];
  const seen = new Set<string>();
  const anchorRe = /<a\b[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let a;
  while ((a = anchorRe.exec(html)) !== null) {
    const real = unwrapTrackingUrl(a[1]);
    const idMatch = real.match(/~([0-9a-zA-Z]{10,})/);
    if (!idMatch) continue;
    const upworkId = idMatch[1];
    if (seen.has(upworkId)) continue;
    seen.add(upworkId);

    const anchorText = stripTags(a[2]).trim();
    const looksLikeTitle =
      anchorText.length >= 12 &&
      !/^(view|apply|see|open|click|read|more|unsubscribe|manage|settings|upwork)\b/i.test(anchorText);

    const contextText = stripTags(html.slice(a.index, a.index + 1500));
    const title = looksLikeTitle ? anchorText : subjectTitle || `Upwork Job ${upworkId}`;
    const { min: hourlyMin, max: hourlyMax } = extractHourlyRange(contextText);
    const fixed = extractFixedBudget(contextText);

    jobs.push({
      upwork_id: upworkId,
      title,
      description: contextText.slice(0, 1200),
      budget: extractBudget(contextText),
      job_type: extractJobType(contextText) || (hourlyMax != null ? "hourly" : fixed != null ? "fixed" : null),
      skills: [],
      client_country: extractCountry(contextText),
      client_rating: extractClientRating(contextText),
      client_hire_rate: null,
      client_payment_verified: extractPaymentVerified(contextText),
      job_url: `https://www.upwork.com/jobs/~${upworkId}`,
      posted_at: receivedDate,
      proposal_count: extractProposalCount(contextText),
      client_lifetime_spend: extractLifetimeSpend(contextText),
      hourly_min: hourlyMin,
      hourly_max: hourlyMax,
      fixed_budget: fixed,
    });
  }
  return jobs;
}

// Quiet hours: don't fire SMS between 22:00 and 07:30 in Mike's local
// timezone (America/Detroit). HOT jobs still land in the pipeline and
// will be visible at the top when he opens the CRM in the morning —
// the phone just stays silent overnight. Tunable via env:
//   QUIET_HOURS_TZ    (default "America/Detroit")
//   QUIET_HOURS_START (default "22:00" — 24h format)
//   QUIET_HOURS_END   (default "07:30")
function parseHHMM(s: string, fallback: [number, number]): [number, number] {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

function isQuietHours(now: Date = new Date()): boolean {
  const tz = process.env.QUIET_HOURS_TZ || "America/Detroit";
  const [startH, startM] = parseHHMM(process.env.QUIET_HOURS_START || "22:00", [22, 0]);
  const [endH, endM] = parseHHMM(process.env.QUIET_HOURS_END || "07:30", [7, 30]);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find(p => p.type === "minute")!.value, 10);
  const nowMin = h * 60 + m;
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  // Quiet window crosses midnight (e.g. 22:00 → 07:30): quiet if
  // now >= start OR now < end. Non-wrapping window: now in [start, end).
  return startMin > endMin
    ? nowMin >= startMin || nowMin < endMin
    : nowMin >= startMin && nowMin < endMin;
}

// Add scoring / enriched-parse columns if the 020 migration hasn't been run.
// Runs once per cold start (cheap: IF NOT EXISTS is a no-op when columns exist).
let columnsEnsured = false;
async function ensureScoringColumns(): Promise<void> {
  if (columnsEnsured) return;
  await sql`ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS verdict TEXT`;
  await sql`ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS verdict_reasons TEXT[]`;
  await sql`ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS proposal_count INT`;
  await sql`ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS client_lifetime_spend NUMERIC`;
  await sql`ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS hourly_min NUMERIC`;
  await sql`ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS hourly_max NUMERIC`;
  await sql`ALTER TABLE upwork_jobs ADD COLUMN IF NOT EXISTS fixed_budget NUMERIC`;
  columnsEnsured = true;
}

function formatBudget(job: ParsedJob): string {
  if (job.hourly_max != null) {
    return job.hourly_min != null && job.hourly_min !== job.hourly_max
      ? `$${job.hourly_min}-${job.hourly_max}/hr`
      : `$${job.hourly_max}/hr`;
  }
  if (job.fixed_budget != null) return `$${job.fixed_budget} fixed`;
  return job.budget || "budget TBD";
}

function formatPosted(postedAt: string | null): string {
  if (!postedAt) return "just now";
  const mins = Math.max(0, (Date.now() - new Date(postedAt).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// SMS body for a newly-ingested HOT job. WARM and COLD don't text at all
// per the 2026 rules — they just land in the pipeline.
// Format: "HOT: <title> | <budget> | Posted <time> | <first 50 chars of desc>"
// followed by the job URL on its own line.
function buildSms(job: ParsedJob): string {
  const descSnippet = (job.description || "").trim().slice(0, 50);
  const descSuffix = (job.description || "").length > 50 ? "..." : "";
  const firstLine = [
    `HOT: ${job.title}`,
    formatBudget(job),
    `Posted ${formatPosted(job.posted_at)}`,
    descSnippet ? `${descSnippet}${descSuffix}` : null,
  ].filter(Boolean).join(" | ");
  return `${firstLine}\n${job.job_url}`;
}

// Pull Upwork alert emails from the owner's Gmail inbox, parse jobs, insert
// into upwork_jobs (status='new'), score with the rules engine, and text
// the owner on new inserts whose verdict isn't 'auto_skip'.
// Dedupe is handled by the UNIQUE(upwork_id) constraint on the table.
export async function ingestUpworkEmails(): Promise<number> {
  const token = await getOwnerGmailToken();
  if (!token) {
    console.log("[upwork-email] No Gmail token for owner — skipping email ingest");
    return 0;
  }
  await ensureScoringColumns();

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
          const { verdict, reasons } = scoreUpworkJob({
            title: job.title,
            description: job.description,
            posted_at: job.posted_at,
            client_payment_verified: job.client_payment_verified,
            hourly_min: job.hourly_min,
            hourly_max: job.hourly_max,
            fixed_budget: job.fixed_budget,
          });

          // Per-job log line so the verdict decision is auditable from
          // Vercel function logs (user asked for this explicitly).
          console.log(
            `[upwork-email] ${verdict.toUpperCase()} — "${job.title.slice(0, 60)}" — ${reasons.join(" / ")}`
          );

          // SKIP = don't insert at all. Stale jobs and scam phrases.
          if (verdict === "skip") continue;

          // On conflict, refresh parser-derived fields when the existing row
          // has bad/empty values (earlier ingestion runs stored title="more"
          // because the parser used anchor text). User-state columns
          // (status, applied_at, won_at, notes, ai_*) are left untouched.
          // verdict is always refreshed so tweaking the rules file re-tags
          // existing rows. xmax = 0 distinguishes a real INSERT from a
          // DO UPDATE path so we only SMS once per job, never on re-ingest.
          const result = await sql`
            INSERT INTO upwork_jobs (
              upwork_id, title, description, budget, job_type, skills,
              client_country, client_rating, client_hire_rate, client_payment_verified,
              job_url, posted_at, status,
              proposal_count, client_lifetime_spend, hourly_min, hourly_max, fixed_budget,
              verdict, verdict_reasons
            ) VALUES (
              ${job.upwork_id}, ${job.title}, ${job.description}, ${job.budget},
              ${job.job_type}, ${job.skills}, ${job.client_country},
              ${job.client_rating}, ${job.client_hire_rate}, ${job.client_payment_verified},
              ${job.job_url}, ${job.posted_at}, 'new',
              ${job.proposal_count}, ${job.client_lifetime_spend},
              ${job.hourly_min}, ${job.hourly_max}, ${job.fixed_budget},
              ${verdict}, ${reasons}
            )
            ON CONFLICT (upwork_id) DO UPDATE SET
              title = CASE
                WHEN upwork_jobs.title IN ('more', 'View job', 'Apply')
                  OR upwork_jobs.title LIKE 'Upwork Job %'
                  OR length(upwork_jobs.title) < 12
                THEN EXCLUDED.title
                ELSE upwork_jobs.title
              END,
              description = CASE
                WHEN upwork_jobs.description IS NULL
                  OR upwork_jobs.description = ''
                  OR length(upwork_jobs.description) < length(EXCLUDED.description)
                THEN EXCLUDED.description
                ELSE upwork_jobs.description
              END,
              budget = COALESCE(upwork_jobs.budget, EXCLUDED.budget),
              job_type = COALESCE(upwork_jobs.job_type, EXCLUDED.job_type),
              posted_at = COALESCE(upwork_jobs.posted_at, EXCLUDED.posted_at),
              job_url = COALESCE(upwork_jobs.job_url, EXCLUDED.job_url),
              client_country = COALESCE(upwork_jobs.client_country, EXCLUDED.client_country),
              client_rating = COALESCE(upwork_jobs.client_rating, EXCLUDED.client_rating),
              client_payment_verified = upwork_jobs.client_payment_verified OR EXCLUDED.client_payment_verified,
              proposal_count = COALESCE(upwork_jobs.proposal_count, EXCLUDED.proposal_count),
              client_lifetime_spend = COALESCE(upwork_jobs.client_lifetime_spend, EXCLUDED.client_lifetime_spend),
              hourly_min = COALESCE(upwork_jobs.hourly_min, EXCLUDED.hourly_min),
              hourly_max = COALESCE(upwork_jobs.hourly_max, EXCLUDED.hourly_max),
              fixed_budget = COALESCE(upwork_jobs.fixed_budget, EXCLUDED.fixed_budget),
              verdict = EXCLUDED.verdict,
              verdict_reasons = EXCLUDED.verdict_reasons
            RETURNING id, (xmax = 0) AS was_inserted
          `;
          const wasInserted = result.length > 0 && result[0].was_inserted === true;
          if (wasInserted) {
            newCount++;
            // Text only on HOT per the 2026 rules. WARM/COLD go to the
            // pipeline silently. Also silent during quiet hours
            // (22:00-07:30 Detroit by default) — the HOT job is still
            // in the pipeline for the morning.
            if (verdict === "hot" && process.env.OWNER_PHONE) {
              if (isQuietHours()) {
                console.log(`[upwork-email] HOT suppressed by quiet hours: ${job.upwork_id}`);
              } else {
                try {
                  await sendMessage(process.env.OWNER_PHONE, buildSms(job));
                } catch (err) {
                  console.error(`[upwork-email] Text notification failed for ${job.upwork_id}:`, err);
                }
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
