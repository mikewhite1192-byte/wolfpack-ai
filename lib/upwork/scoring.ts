// Rule-based scoring for ingested Upwork jobs.
// Hard rules → verdict='auto_skip' (row stored, no SMS).
// Soft signals → kept as reasons on a WARM row (still visible, still texted).
// Stack match on an otherwise-clean job → verdict='hot' (🔥 SMS).

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

// Countries we'll actively bid to. Rest are soft-demoted, not auto-skipped —
// the PRD started at US-only; we loosened to these four per owner request.
const PREFERRED_COUNTRIES = new Set([
  "United States",
  "Canada",
  "Australia",
  "United Kingdom",
]);

// Tokens that, when present anywhere in title/description/skills, indicate
// the job is aligned with the owner's stack. Matching is case-insensitive
// substring so "Next.js" and "nextjs" both fire.
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

// Hard body-shop patterns — the title is *explicitly* asking for theme or
// site-builder work. A bare "WordPress" skill tag doesn't match here; those
// jobs are often "migrate us OFF WordPress" and are worth seeing.
const WRONG_STACK_TITLE_PATTERNS: RegExp[] = [
  /\bwordpress\s+(theme|plugin|designer|developer)\b/i,
  /\belementor\s+(site|design|page|developer)\b/i,
  /\bwix\s+(site|developer|designer)\b/i,
  /\bsquarespace\b/i,
  /\bshopify\s+theme\b/i,
];

// Soft skill signals — downgrade to WARM but keep visible.
const WRONG_STACK_SKILLS = new Set([
  "wordpress",
  "elementor",
  "wix",
  "squarespace",
  "shopify",
]);

function normalizeCountry(raw: string): string {
  const c = raw.trim();
  if (/^(usa|u\.s\.?|us|united states)$/i.test(c)) return "United States";
  if (/^(uk|great britain|united kingdom)$/i.test(c)) return "United Kingdom";
  return c;
}

export function scoreUpworkJob(job: JobForScoring): Verdict {
  const haystack = `${job.title} ${job.description} ${job.skills.join(" ")}`.toLowerCase();

  // ── HARD RULES (auto_skip) ──────────────────────────────────────────

  if (!job.client_payment_verified && (job.client_lifetime_spend ?? 0) < 500) {
    return { verdict: "auto_skip", reasons: ["unverified client with <$500 spent"] };
  }

  if (job.job_type === "hourly" && job.hourly_max != null && job.hourly_max < 40) {
    return { verdict: "auto_skip", reasons: [`hourly max $${job.hourly_max} < $40 floor`] };
  }

  if (job.job_type === "fixed" && job.fixed_budget != null && job.fixed_budget < 500) {
    return { verdict: "auto_skip", reasons: [`fixed budget $${job.fixed_budget} < $500 floor`] };
  }

  if (job.proposal_count != null && job.proposal_count > 30) {
    return { verdict: "auto_skip", reasons: [`${job.proposal_count} proposals already`] };
  }

  for (const pattern of WRONG_STACK_TITLE_PATTERNS) {
    if (pattern.test(job.title)) {
      return { verdict: "auto_skip", reasons: [`body-shop title pattern: ${pattern.source}`] };
    }
  }

  // ── SOFT SIGNALS (downgrade, don't skip) ────────────────────────────

  const softReasons: string[] = [];

  if (job.client_country) {
    const normalized = normalizeCountry(job.client_country);
    if (!PREFERRED_COUNTRIES.has(normalized)) {
      softReasons.push(`non-preferred country: ${job.client_country}`);
    }
  }

  for (const skill of job.skills) {
    if (WRONG_STACK_SKILLS.has(skill.toLowerCase())) {
      softReasons.push(`wrong-stack skill tag: ${skill}`);
      break;
    }
  }

  // ── HOT SIGNALS ─────────────────────────────────────────────────────

  const hasStackMatch = HOT_STACK_KEYWORDS.some(k => haystack.includes(k));
  const lowCompetition = job.proposal_count == null || job.proposal_count < 15;
  const payingClient = job.client_lifetime_spend != null && job.client_lifetime_spend > 1000;

  if (hasStackMatch && lowCompetition && payingClient && softReasons.length === 0) {
    return {
      verdict: "hot",
      reasons: ["stack match", "low competition", "established paying client"],
    };
  }

  return { verdict: "warm", reasons: softReasons };
}
