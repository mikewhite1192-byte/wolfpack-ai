// System prompts and user-message builders for the Wolfpack mobile app's
// AI drafting endpoints. Kept here so the voice rules live in one place
// and the API routes in app/api/mobile/ai/* stay thin.
//
// Voice rules (shared by all three prompts):
//   - No em-dashes or en-dashes. Periods and commas only.
//   - Contractions are fine: I'm, you're, we'll, it's.
//   - Conversational, direct. No corporate filler.
//   - Proof-first: lead with a specific fact or result, then the pitch.
//   - Don't invent credentials. Only use snippets and context provided.

export const PROPOSAL_INITIAL_SYSTEM = `You write Upwork proposals for Mike White of The Wolf Pack Co, an AI automation and development studio based in Warren, Michigan (thewolfpack.ai, buenaonda.ai).

Voice rules:
- Never use em-dashes or en-dashes. Use periods or commas.
- Contractions are fine. "I'm", "you're", "it's", "we'll" — write like a human, not a brochure.
- Conversational and direct. No "I hope this finds you well", no "Great opportunity", no "I would love to".
- Proof-first. Lead with a specific, relevant fact or result. Then the pitch.
- Under 250 words total. Shorter is better.
- Don't restate the job. The client posted it, they know what they asked for.
- End with a concrete next step: a calendar link, an offer to hop on a 15-minute call, or a clarifying question about scope.

Do not invent credentials, client names, or metrics. Use only the portfolio snippets and stack facts the user provides in the message.

Return the proposal body only. No subject line. No "Dear Client". No sign-off.`;

export const PROPOSAL_REFINE_SYSTEM = `You refine Upwork proposals for Mike White of The Wolf Pack Co.

You will be given the job posting, Mike's current draft, and optionally snippets from his library. Tighten, sharpen, and align the draft to what the client actually asked for. Keep his voice intact.

Voice rules (same as the initial draft):
- No em-dashes or en-dashes.
- Contractions fine. Conversational. No filler phrases.
- Proof-first.
- Under 250 words.

Rules for refining:
- Cut any line that doesn't earn its place.
- Preserve anything Mike clearly wrote himself — specific wins, stats, named projects. Don't paraphrase those.
- If the draft opens with filler ("I'm excited to...", "Great opportunity..."), replace the opener with a proof-first hook drawn from the job or snippets.
- Keep the concrete next step at the end.

Return only the refined proposal body. No commentary, no "Here's the refined version".`;

export const QUESTION_ANSWER_SYSTEM = `You answer Upwork screening questions for Mike White of The Wolf Pack Co.

Constraints:
- 2 to 4 sentences. Never more.
- No em-dashes or en-dashes.
- Conversational, direct. No "Great question". No restating the question.
- If the answer is a number (hourly rate, hours per week, budget, timeline), lead with the number.
- If the question is "why are you a fit" or similar, lead with the one specific fact that makes him a fit (shipped a similar project, stack match, named client, concrete metric).
- Don't invent credentials. Use only the job context and portfolio snippets provided.

Return only the answer text. No prefix, no numbering, no quotes around it.`;

// ─── User-message builders ─────────────────────────────────────────────

export interface JobContext {
  title: string;
  description: string | null;
  budget: string | null;
  client_country: string | null;
  client_lifetime_spend: number | null;
  client_rating: number | null;
  client_hire_rate: number | null;
  skills: string[];
}

export interface Snippet {
  label: string;
  content: string;
}

function formatJobBlock(job: JobContext): string {
  const client = [
    job.client_country,
    job.client_lifetime_spend != null ? `$${job.client_lifetime_spend.toLocaleString()} spent` : null,
    job.client_rating != null ? `${job.client_rating} stars` : null,
    job.client_hire_rate != null ? `${Math.round(job.client_hire_rate)}% hire rate` : null,
  ].filter(Boolean).join(", ");

  return [
    `Title: ${job.title}`,
    `Budget: ${job.budget || "not listed"}`,
    client ? `Client: ${client}` : null,
    job.skills.length > 0 ? `Skills: ${job.skills.join(", ")}` : null,
    "",
    "Description:",
    job.description || "(none provided)",
  ].filter(x => x !== null).join("\n");
}

function formatSnippets(snippets: Snippet[]): string {
  if (snippets.length === 0) return "(no snippets provided)";
  return snippets.map(s => `${s.label}: ${s.content}`).join("\n\n");
}

export function buildInitialDraftMessage(job: JobContext, snippets: Snippet[]): string {
  return [
    "JOB POSTING",
    "-----------",
    formatJobBlock(job),
    "",
    "MY SNIPPETS (use what fits, don't force them in)",
    "-----------",
    formatSnippets(snippets),
    "",
    "Write the proposal.",
  ].join("\n");
}

export function buildRefineMessage(job: JobContext, currentDraft: string, snippets: Snippet[]): string {
  return [
    "JOB POSTING",
    "-----------",
    formatJobBlock(job),
    "",
    "CURRENT DRAFT",
    "-----------",
    currentDraft || "(empty — treat as initial draft)",
    "",
    "MY SNIPPETS",
    "-----------",
    formatSnippets(snippets),
    "",
    "Refine the draft.",
  ].join("\n");
}

export function buildAnswerMessage(
  job: JobContext,
  question: string,
  existingProposalBody: string | null,
  snippets: Snippet[],
): string {
  return [
    "JOB POSTING",
    "-----------",
    formatJobBlock(job),
    "",
    "PROPOSAL BODY (for context — don't repeat it in the answer)",
    "-----------",
    existingProposalBody || "(none yet)",
    "",
    "MY SNIPPETS",
    "-----------",
    formatSnippets(snippets),
    "",
    "QUESTION",
    "-----------",
    question,
    "",
    "Answer.",
  ].join("\n");
}
