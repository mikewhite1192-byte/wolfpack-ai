// ─────────────────────────────────────────────────────────────────────
// SCORING PHILOSOPHY — Red-light vs Yellow-light stacks
// ─────────────────────────────────────────────────────────────────────
// The scorer separates incompatible stacks into two buckets:
//
//   RED-LIGHT (HARD_SKIP_STACKS) — paradigm-different technologies with
//   real learning curves where taking the job risks delivering badly:
//   native iOS/Android, enterprise Java, .NET, Rails, Salesforce Apex,
//   Unity, etc. These auto_skip with verdict "red-light stack".
//
//   YELLOW-LIGHT (LEARNABLE_STACKS) — no-code builders, automation
//   platforms, and familiar-paradigm frameworks a senior Next.js dev
//   can pick up in 3-5 days without risking client outcomes:
//   WordPress, Webflow, Zapier, Shopify, React Native, etc. These
//   flow through as "warm" with the reason "learnable stack — pitch
//   with honest disclosure" so the SMS formatter can render a distinct
//   "stretch stack" variant.
//
// Context: Mike is in the growth phase of his Upwork profile (3 jobs
// completed, targeting Top Rated at ~12 completed). Strict stack
// filtering kills winnable work. The yellow-light bucket lets him
// expand range while being upfront with the client about what he
// primarily builds in ("I build in Next.js primarily, but this scope
// works in [their stack] and I'll execute cleanly").
// ─────────────────────────────────────────────────────────────────────

export interface JobForScoring {
  title: string;
  description: string;
  skills: string[];
  job_type: string | null;
  hourly_min: number | null;
  hourly_max: number | null;
  fixed_budget: number | null;
  proposal_count: number | null;
  client_country: string | null;
  client_lifetime_spend: number | null;
  client_payment_verified: boolean;
}

export interface Verdict {
  verdict: "auto_skip" | "warm" | "hot";
  reasons: string[];
}

// Reason strings are also used by the SMS formatter to pick the right
// notification template — keep this in sync with buildSms() in
// lib/upwork/email-ingest.ts.
export const LEARNABLE_STACK_REASON = "learnable stack — pitch with honest disclosure";

const PREFERRED_COUNTRIES = new Set([
  "United States",
  "Canada",
  "Australia",
  "United Kingdom",
]);

// Positive signals — presence in title/description/skills pushes toward HOT.
const HOT_STACK_KEYWORDS = [
  "next.js",
  "nextjs",
  "supabase",
  "vapi",
  "retell",
  "twilio",
  "claude api",
  "anthropic",
  "openai api",
  "ai voice",
  "ai agent",
  "voice agent",
];

// Red-light stacks: any mention triggers auto_skip. These are paradigm
// shifts where "I'll figure it out" risks delivering badly.
const HARD_SKIP_STACKS = [
  "swift", "swiftui", "ios native",
  "kotlin native", "android native",
  "neo4j", "graph rag", "custom ontology",
  "ruby on rails", "ror",
  ".net core", "asp.net",
  "spring boot", "java spring",
  "laravel", "drupal", "magento",
  "unity", "unreal engine",
  "salesforce apex", "salesforce lightning",
];

// Yellow-light stacks: any mention → warm with honest-disclosure reason.
// Still visible, still texts the owner, but the SMS is flagged as a
// "stretch stack" so the pitch framing is different.
const LEARNABLE_STACKS = [
  "wordpress", "elementor", "divi",
  "webflow", "framer", "bubble", "bubble.io",
  "shopify", "squarespace", "wix",
  "zapier", "make.com", "n8n",
  "airtable", "notion", "retool",
  "flutter", "react native",
  "gohighlevel", "ghl",
  "hubspot", "activecampaign",
];

// Build a word-boundary regex for a stack token. Leading \b is only
// emitted when the term starts with a word char — otherwise ".net core"
// wouldn't match because \b before "." doesn't behave as expected.
function buildStackRegex(term: string): RegExp {
  const escaped = term
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const leading = /^\w/.test(term) ? "\\b" : "";
  const trailing = /\w$/.test(term) ? "\\b" : "";
  return new RegExp(`${leading}${escaped}${trailing}`, "i");
}

const HARD_SKIP_REGEXES = HARD_SKIP_STACKS.map(buildStackRegex);
const LEARNABLE_REGEXES = LEARNABLE_STACKS.map(buildStackRegex);

function firstMatch(haystack: string, terms: string[], regexes: RegExp[]): string | null {
  for (let i = 0; i < regexes.length; i++) {
    if (regexes[i].test(haystack)) return terms[i];
  }
  return null;
}

function normalizeCountry(raw: string): string {
  const c = raw.trim();
  if (/^(usa|u\.s\.?|us|united states)$/i.test(c)) return "United States";
  if (/^(uk|great britain|united kingdom)$/i.test(c)) return "United Kingdom";
  return c;
}

export function scoreUpworkJob(job: JobForScoring): Verdict {
  const haystack = `${job.title} ${job.description} ${job.skills.join(" ")}`.toLowerCase();

  // ── HARD RULES (auto_skip) ──────────────────────────────────────────
  // (The "unverified + <$500 spent" rule was removed — 2 of 3 recent wins
  // were first-time clients with no history, so this signal was costing
  // more money than it saved.)

  if (job.job_type === "hourly" && job.hourly_max != null && job.hourly_max < 40) {
    return { verdict: "auto_skip", reasons: [`hourly max $${job.hourly_max} < $40 floor`] };
  }

  if (job.job_type === "fixed" && job.fixed_budget != null && job.fixed_budget < 500) {
    return { verdict: "auto_skip", reasons: [`fixed budget $${job.fixed_budget} < $500 floor`] };
  }

  if (job.proposal_count != null && job.proposal_count > 30) {
    return { verdict: "auto_skip", reasons: [`${job.proposal_count} proposals already`] };
  }

  const redLight = firstMatch(haystack, HARD_SKIP_STACKS, HARD_SKIP_REGEXES);
  if (redLight) {
    return { verdict: "auto_skip", reasons: [`red-light stack: ${redLight}`] };
  }

  // ── SOFT SIGNALS (country) — collected now but don't short-circuit ─

  const softReasons: string[] = [];
  if (job.client_country) {
    const normalized = normalizeCountry(job.client_country);
    if (!PREFERRED_COUNTRIES.has(normalized)) {
      softReasons.push(`non-preferred country: ${job.client_country}`);
    }
  }

  // ── HOT SIGNALS (runs BEFORE learnable check by design) ────────────
  // A job that mentions Next.js + a learnable stack (e.g., "migrate
  // from WordPress to Next.js") is exactly the HOT target audience —
  // the learnable mention shouldn't demote it.

  const hasStackMatch = HOT_STACK_KEYWORDS.some(k => haystack.includes(k));
  const lowCompetition = job.proposal_count == null || job.proposal_count < 15;
  const payingClient = job.client_lifetime_spend != null && job.client_lifetime_spend > 1000;

  if (hasStackMatch && lowCompetition && payingClient && softReasons.length === 0) {
    return {
      verdict: "hot",
      reasons: ["stack match", "low competition", "established paying client"],
    };
  }

  // ── LEARNABLE STACK CHECK (runs AFTER hot) ─────────────────────────

  const yellow = firstMatch(haystack, LEARNABLE_STACKS, LEARNABLE_REGEXES);
  if (yellow) {
    return {
      verdict: "warm",
      reasons: [...softReasons, LEARNABLE_STACK_REASON, `stack: ${yellow}`],
    };
  }

  return { verdict: "warm", reasons: softReasons };
}
