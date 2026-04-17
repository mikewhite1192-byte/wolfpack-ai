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
  if (/fixed[- ]?price|fixed budget/i.test(text)) return "fixed";
  return null;
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

  // Single-job email — use subject as title, full body as description.
  if (ids.size === 1) {
    const upworkId = Array.from(ids)[0];
    return [{
      upwork_id: upworkId,
      title: subjectTitle || `Upwork Job ${upworkId}`,
      description: bodyText.slice(0, 2000),
      budget: extractBudget(subject) || extractBudget(bodyText),
      job_type: extractJobType(subject) || extractJobType(bodyText),
      skills: [],
      client_country: null,
      client_rating: null,
      client_hire_rate: null,
      client_payment_verified: false,
      job_url: `https://www.upwork.com/jobs/~${upworkId}`,
      posted_at: receivedDate,
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

    jobs.push({
      upwork_id: upworkId,
      title,
      description: contextText.slice(0, 1200),
      budget: extractBudget(contextText),
      job_type: extractJobType(contextText),
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
          // On conflict, refresh parser-derived fields when the existing row
          // has bad/empty values (earlier ingestion runs stored title="more"
          // because the parser used anchor text). User-state columns
          // (status, applied_at, won_at, notes, ai_*) are left untouched.
          // xmax = 0 distinguishes a real INSERT from a DO UPDATE path so
          // we only SMS once per job, never on re-ingest.
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
              job_url = COALESCE(upwork_jobs.job_url, EXCLUDED.job_url)
            RETURNING id, (xmax = 0) AS was_inserted
          `;
          const wasInserted = result.length > 0 && result[0].was_inserted === true;
          if (wasInserted) {
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
