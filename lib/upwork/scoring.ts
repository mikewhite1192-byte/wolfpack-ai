// ─────────────────────────────────────────────────────────────────────
// UPWORK SCORING — 2026 email-only rules
// ─────────────────────────────────────────────────────────────────────
// Email-only data (no Upwork API scraping): title, description snippet,
// hourly/fixed budget, posted time, payment-verified flag.
//
// Verdict tiers:
//   HOT   — text immediately. Verified + posted <30m + budget HOT floor +
//           description ≥80 chars + no red flags.
//   WARM  — show in pipeline, no text. Verified + posted ≤90m + budget
//           WARM floor + description ≥50 chars + no red flags.
//   COLD  — show in pipeline, low priority. Unverified, too-low budget,
//           too-old, red-flag phrase, or blacklisted title keyword.
//   SKIP  — don't insert at all. >24h old or contains scam phrase.
//
// Tunable constants live at the top of this file (keyword lists +
// thresholds). Adjust there, not in the scoring function body.
// ─────────────────────────────────────────────────────────────────────

export interface JobForScoring {
  title: string;
  description: string;
  posted_at: string | null;           // ISO timestamp from the email Date header
  client_payment_verified: boolean;
  hourly_min: number | null;
  hourly_max: number | null;
  fixed_budget: number | null;
}

export type StoredVerdict = "hot" | "warm" | "cold";
export type VerdictName = StoredVerdict | "skip";

export interface Verdict {
  verdict: VerdictName;
  reasons: string[];
}

// ── Budget thresholds ────────────────────────────────────────────────
const HOURLY_HOT = 40;   // $/hr — any lower and max hourly is not HOT
const HOURLY_WARM = 25;  // $/hr — below this, budget is COLD
const FIXED_HOT = 500;   // $ — fixed budget floor for HOT
const FIXED_WARM = 300;  // $ — fixed budget floor for WARM

// ── Time thresholds (in minutes since email received) ───────────────
const HOT_MINUTES = 30;   // posted within last 30 min = HOT-eligible
const WARM_MINUTES = 90;  // posted within last 90 min = WARM-eligible
const SKIP_HOURS = 24;    // older than this = SKIP (don't insert)

// ── Description length floors ───────────────────────────────────────
const DESC_HOT_MIN = 80;   // chars required for HOT
const DESC_WARM_MIN = 50;  // chars required for WARM

// ── Phrase lists (case-insensitive substring match) ─────────────────

// Scam — skip the job entirely, don't even insert.
const SCAM_PHRASES = [
  "unlock fee",
  "pay to apply",
  "deposit required",
];

// Red flag — force to COLD.
const RED_FLAG_PHRASES = [
  "telegram",
  "whatsapp",
  "contact me off platform",
  "gift card",
  "crypto",
  "rate my",
  "feedback on",
];

// Title keywords we don't do — force to COLD if present in the title.
const COLD_TITLE_KEYWORDS = [
  "wordpress plugin",
  "wix",
  "squarespace",
  "logo design",
  "graphic design",
];

// Priority keywords — not required for HOT but surfaced in the reasons
// array so the matching keyword is visible on the pipeline card.
const PRIORITY_KEYWORDS = [
  "ai",
  "chatbot",
  "voice",
  "framer",
  "next.js",
  "nextjs",
  "react",
  "saas",
  "api integration",
  "rag",
  "langchain",
];

// ── Helpers ─────────────────────────────────────────────────────────

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 60000);
}

function containsAny(text: string, phrases: string[]): string | null {
  const lower = text.toLowerCase();
  for (const p of phrases) {
    if (lower.includes(p)) return p;
  }
  return null;
}

function matchedPriorityKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return PRIORITY_KEYWORDS.filter(k => lower.includes(k));
}

type BudgetTier = "hot" | "warm" | "cold" | "unknown";

function budgetTier(job: JobForScoring): BudgetTier {
  // Prefer hourly max when present; fall back to fixed budget.
  if (job.hourly_max != null) {
    if (job.hourly_max >= HOURLY_HOT) return "hot";
    if (job.hourly_max >= HOURLY_WARM) return "warm";
    return "cold";
  }
  if (job.fixed_budget != null) {
    if (job.fixed_budget >= FIXED_HOT) return "hot";
    if (job.fixed_budget >= FIXED_WARM) return "warm";
    return "cold";
  }
  return "unknown";
}

type TimeTier = "hot" | "warm" | "cold" | "unknown";

function timeTier(minutes: number | null): TimeTier {
  if (minutes == null) return "unknown";
  if (minutes <= HOT_MINUTES) return "hot";
  if (minutes <= WARM_MINUTES) return "warm";
  return "cold";
}

function budgetLabel(job: JobForScoring): string {
  if (job.hourly_max != null) {
    return job.hourly_min != null && job.hourly_min !== job.hourly_max
      ? `$${job.hourly_min}-${job.hourly_max}/hr`
      : `$${job.hourly_max}/hr`;
  }
  if (job.fixed_budget != null) return `$${job.fixed_budget} fixed`;
  return "no budget listed";
}

// ── Main scorer ─────────────────────────────────────────────────────

export function scoreUpworkJob(job: JobForScoring): Verdict {
  const haystack = `${job.title}\n${job.description}`;
  const title = job.title;
  const minutes = minutesSince(job.posted_at);

  // ── 1. SKIP — don't insert ────────────────────────────────────────
  if (minutes != null && minutes > SKIP_HOURS * 60) {
    return { verdict: "skip", reasons: [`stale: posted ${Math.round(minutes / 60)}h ago`] };
  }
  const scam = containsAny(haystack, SCAM_PHRASES);
  if (scam) {
    return { verdict: "skip", reasons: [`scam phrase: "${scam}"`] };
  }

  // ── 2. COLD short-circuits ────────────────────────────────────────
  const redFlag = containsAny(haystack, RED_FLAG_PHRASES);
  if (redFlag) {
    return { verdict: "cold", reasons: [`red flag phrase: "${redFlag}"`] };
  }
  const coldTitle = COLD_TITLE_KEYWORDS.find(kw => title.toLowerCase().includes(kw));
  if (coldTitle) {
    return { verdict: "cold", reasons: [`title blacklist: "${coldTitle}"`] };
  }
  if (!job.client_payment_verified) {
    return { verdict: "cold", reasons: ["client payment not verified"] };
  }

  const bTier = budgetTier(job);
  if (bTier === "cold") {
    return { verdict: "cold", reasons: [`budget below floor: ${budgetLabel(job)}`] };
  }

  const tTier = timeTier(minutes);
  if (tTier === "cold") {
    return {
      verdict: "cold",
      reasons: [`posted ${Math.round(minutes!)}m ago (past 90m warm window)`],
    };
  }

  // ── 3. Collect priority-keyword hits for reason logging ───────────
  const priority = matchedPriorityKeywords(haystack);
  const priorityReason = priority.length > 0
    ? `priority kw: ${priority.slice(0, 3).join(", ")}`
    : null;

  // ── 4. HOT evaluation ─────────────────────────────────────────────
  const descLen = (job.description || "").length;
  const timeMsg = minutes != null ? `${Math.round(minutes)}m ago` : "posted time unknown";

  if (bTier === "hot" && tTier === "hot" && descLen >= DESC_HOT_MIN) {
    const reasons = [
      `HOT: ${budgetLabel(job)}, ${timeMsg}, ${descLen}-char desc, verified`,
    ];
    if (priorityReason) reasons.push(priorityReason);
    return { verdict: "hot", reasons };
  }

  // ── 5. WARM evaluation ────────────────────────────────────────────
  const warmBudgetOk = bTier === "hot" || bTier === "warm" || bTier === "unknown";
  const warmTimeOk = tTier === "hot" || tTier === "warm" || tTier === "unknown";

  if (warmBudgetOk && warmTimeOk && descLen >= DESC_WARM_MIN) {
    const reasons = [
      `WARM: ${budgetLabel(job)}, ${timeMsg}, ${descLen}-char desc, verified`,
    ];
    if (priorityReason) reasons.push(priorityReason);
    return { verdict: "warm", reasons };
  }

  // ── 6. Default: COLD ──────────────────────────────────────────────
  const why: string[] = [];
  if (descLen < DESC_WARM_MIN) why.push(`desc only ${descLen} chars`);
  if (bTier === "unknown") why.push("no budget parsed");
  if (tTier === "unknown") why.push("no posted time parsed");
  const reasons = [
    why.length > 0 ? `didn't clear warm threshold: ${why.join(", ")}` : "didn't clear warm threshold",
  ];
  if (priorityReason) reasons.push(priorityReason);
  return { verdict: "cold", reasons };
}
