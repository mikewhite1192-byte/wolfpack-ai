import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MIKE_PROFILE = `You are writing Upwork proposals for Michael White, founder of Wolf Pack AI. He builds:
- Custom websites and web apps (Next.js, React, Node.js, TypeScript)
- AI integrations (chatbots, LLM-powered tools, automation)
- SaaS platforms and CRM systems
- Marketing automation and ad tech

His style: Direct, confident, no fluff. Shows he understands the problem, briefly mentions relevant experience, proposes a clear next step. Short proposals — 3-4 paragraphs max.

Score this job 1-10 for fit, explain why, and write a ready-to-send proposal.

SCORING GUIDELINES:
- 8-10: Strong fit — AI/automation focus, Next.js/React/Node.js, SaaS, $500+ budget, payment verified, 70%+ hire rate
- 5-7: Decent fit — web dev work but not core specialty, moderate budget, some relevant skills
- 1-4: Poor fit — mobile apps, WordPress/PHP, data entry, design-only, low budget (<$100), non-tech

Respond in this exact JSON format:
{
  "score": <number 1-10>,
  "reasoning": "<1-2 sentences explaining the score>",
  "proposal": "<the full proposal text, ready to paste into Upwork>"
}`;

export async function scoreAndDraftProposal(jobId: string): Promise<{ score: number; reasoning: string; proposal: string }> {
  const rows = await sql`SELECT * FROM upwork_jobs WHERE id = ${jobId}`;
  if (rows.length === 0) throw new Error(`Job ${jobId} not found`);

  const job = rows[0];

  const jobContext = `
JOB TITLE: ${job.title}
DESCRIPTION: ${job.description || "No description provided"}
BUDGET: ${job.budget || "Not specified"}
JOB TYPE: ${job.job_type || "Not specified"}
SKILLS: ${Array.isArray(job.skills) ? job.skills.join(", ") : "Not listed"}
CLIENT COUNTRY: ${job.client_country || "Unknown"}
CLIENT RATING: ${job.client_rating || "Unknown"}
CLIENT HIRE RATE: ${job.client_hire_rate ? job.client_hire_rate + "%" : "Unknown"}
PAYMENT VERIFIED: ${job.client_payment_verified ? "Yes" : "No"}
  `.trim();

  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1000,
    system: MIKE_PROFILE,
    messages: [
      { role: "user", content: jobContext },
    ],
  });

  const textBlock = response.content.find(b => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";

  // Parse JSON response
  let score = 5;
  let reasoning = "Could not parse AI response";
  let proposal = "";

  try {
    // Try to extract JSON from the response (it might have markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      score = Math.min(10, Math.max(1, parseInt(parsed.score)));
      reasoning = parsed.reasoning || reasoning;
      proposal = parsed.proposal || "";
    }
  } catch {
    // If JSON parsing fails, try to extract parts manually
    const scoreMatch = text.match(/score["\s:]*(\d+)/i);
    if (scoreMatch) score = Math.min(10, Math.max(1, parseInt(scoreMatch[1])));
    reasoning = text.slice(0, 200);
    proposal = text;
  }

  // Update the job record
  await sql`
    UPDATE upwork_jobs
    SET ai_score = ${score}, ai_reasoning = ${reasoning}, ai_proposal = ${proposal}
    WHERE id = ${jobId}
  `;

  return { score, reasoning, proposal };
}

export async function scoreAllUnscored(): Promise<number> {
  const rows = await sql`
    SELECT id FROM upwork_jobs
    WHERE ai_score IS NULL AND status = 'new'
    ORDER BY created_at DESC
    LIMIT 20
  `;

  let scored = 0;
  for (const row of rows) {
    try {
      await scoreAndDraftProposal(row.id);
      scored++;
    } catch (err) {
      console.error(`[upwork-scorer] Error scoring ${row.id}:`, err);
    }
  }

  return scored;
}
