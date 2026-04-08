import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MIKE_PROFILE = `You are writing Upwork proposals for Mike White. He is a full stack developer who builds:
- Websites and web apps (Next.js, React, Node.js, TypeScript)
- AI chatbots, LLM integrations, and automation tools
- SaaS platforms and CRM systems
- Email marketing, cold outreach, and lead generation systems
- Facebook and Google ads management platforms

PROPOSAL RULES:
- MAX 4-5 sentences total. Short. Direct. No fluff.
- First sentence: show you understand their specific problem. Reference something from their job post.
- Second sentence: briefly mention relevant experience. One line, not a resume.
- Third sentence: what you would do or how you would approach it.
- Last sentence: clear CTA — "Happy to hop on a quick call to walk through my approach."
- NEVER say "I'm excited to apply" or "I believe I'm the perfect fit" or any generic opener.
- NEVER use bullet points or numbered lists in the proposal.
- NEVER say "Best regards" or sign with [Your Name]. Just end with the CTA.
- Sound like a real person, not a template. Casual and confident.
- Address the client by name if available, otherwise just start talking.

SCORING GUIDELINES:
- 8-10: Strong fit — AI/automation, Next.js/React/Node.js, SaaS, web apps, $500+ budget, verified client
- 5-7: Decent fit — web dev but not core specialty, moderate budget, some relevant skills
- 1-4: Poor fit — mobile apps, WordPress/PHP, data entry, design-only, low budget, non-tech

Respond in this exact JSON format:
{
  "score": <number 1-10>,
  "reasoning": "<1-2 sentences>",
  "proposal": "<the full proposal text ready to paste>"
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

  // Text notification for good matches (score 7+)
  const minNotifyScore = 6;
  if (score >= minNotifyScore && process.env.OWNER_PHONE) {
    try {
      const budget = job.budget || "not listed";
      await sendMessage(
        process.env.OWNER_PHONE,
        `Upwork match (${score}/10): ${job.title}\nBudget: ${budget}\n${job.job_url}`
      );
    } catch (err) {
      console.error("[upwork-scorer] Failed to send notification:", err);
    }
  }

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
