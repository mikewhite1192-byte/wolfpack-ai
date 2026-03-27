import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sql = neon(process.env.DATABASE_URL!);

interface ConversationData {
  conversationId: string;
  contactId: string;
  workspaceId: string;
  outcome: "booked" | "won" | "lost" | "cold" | "reengaged";
  messages: { direction: string; body: string; sent_by: string }[];
}

// Analyze a completed/resolved conversation and extract learnings
export async function analyzeConversation(data: ConversationData) {
  if (data.messages.length < 3) return; // not enough data to learn from

  const transcript = data.messages
    .map(m => `${m.direction === "inbound" ? "LEAD" : m.sent_by === "ai" ? "AI" : "HUMAN"}: ${m.body}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 800,
    system: `You are analyzing a sales conversation to extract learnings. The outcome was: ${data.outcome}.

Analyze the conversation and return JSON:
{
  "techniques_worked": ["specific techniques/phrases that moved the conversation forward"],
  "techniques_failed": ["things that didn't work or caused disengagement"],
  "objections_encountered": ["objections the lead raised"],
  "objections_overcome": ["objections that were successfully handled and how"],
  "booking_triggers": ["what specifically led to the booking/win, if applicable"],
  "cold_triggers": ["what caused the lead to go cold, if applicable"],
  "reengagement_wins": ["what brought a cold lead back, if applicable"],
  "summary": "2-3 sentence summary of what happened and the key takeaway"
}

Focus on actionable patterns — things that can improve future conversations.`,
    messages: [{ role: "user", content: transcript }],
  });

  const textBlock = response.content.find(b => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const insights = JSON.parse(jsonMatch[0]);

    // Store the insights
    await sql`
      INSERT INTO conversation_insights (
        workspace_id, conversation_id, contact_id, outcome,
        techniques_worked, techniques_failed,
        objections_encountered, objections_overcome,
        booking_triggers, cold_triggers, reengagement_wins,
        summary, message_count,
        time_to_outcome_hours
      ) VALUES (
        ${data.workspaceId}, ${data.conversationId}, ${data.contactId}, ${data.outcome},
        ${insights.techniques_worked || []}, ${insights.techniques_failed || []},
        ${insights.objections_encountered || []}, ${insights.objections_overcome || []},
        ${insights.booking_triggers || []}, ${insights.cold_triggers || []},
        ${insights.reengagement_wins || []},
        ${insights.summary || ""}, ${data.messages.length},
        ${null}
      )
    `;

    console.log(`[ai-learner] Stored insights for conversation ${data.conversationId}: ${data.outcome}`);
  } catch (err) {
    console.error("[ai-learner] Failed to parse/store insights:", err);
  }
}

// Get accumulated learnings for a workspace to feed into the agent
export async function getLearnings(workspaceId: string): Promise<string> {
  const insights = await sql`
    SELECT * FROM conversation_insights
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  if (insights.length === 0) return "";

  // Aggregate learnings
  const allTechniquesWorked: Record<string, number> = {};
  const allTechniquesFailed: Record<string, number> = {};
  const allObjectionsOvercome: Record<string, number> = {};
  const allBookingTriggers: Record<string, number> = {};
  const allColdTriggers: Record<string, number> = {};
  const allReengagementWins: Record<string, number> = {};

  let booked = 0;
  let cold = 0;
  let total = insights.length;

  for (const i of insights) {
    if (i.outcome === "booked" || i.outcome === "won") booked++;
    if (i.outcome === "cold" || i.outcome === "lost") cold++;

    for (const t of (i.techniques_worked || [])) {
      allTechniquesWorked[t] = (allTechniquesWorked[t] || 0) + 1;
    }
    for (const t of (i.techniques_failed || [])) {
      allTechniquesFailed[t] = (allTechniquesFailed[t] || 0) + 1;
    }
    for (const t of (i.objections_overcome || [])) {
      allObjectionsOvercome[t] = (allObjectionsOvercome[t] || 0) + 1;
    }
    for (const t of (i.booking_triggers || [])) {
      allBookingTriggers[t] = (allBookingTriggers[t] || 0) + 1;
    }
    for (const t of (i.cold_triggers || [])) {
      allColdTriggers[t] = (allColdTriggers[t] || 0) + 1;
    }
    for (const t of (i.reengagement_wins || [])) {
      allReengagementWins[t] = (allReengagementWins[t] || 0) + 1;
    }
  }

  // Sort by frequency and take top items
  const topBy = (obj: Record<string, number>, n: number) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

  const sections: string[] = [];
  sections.push(`PERFORMANCE: ${booked} bookings, ${cold} cold leads out of ${total} analyzed conversations.`);

  const tw = topBy(allTechniquesWorked, 5);
  if (tw.length) sections.push(`WHAT WORKS BEST:\n${tw.map(t => `- ${t}`).join("\n")}`);

  const tf = topBy(allTechniquesFailed, 5);
  if (tf.length) sections.push(`AVOID (these backfired):\n${tf.map(t => `- ${t}`).join("\n")}`);

  const oo = topBy(allObjectionsOvercome, 5);
  if (oo.length) sections.push(`OBJECTION HANDLING THAT WORKS:\n${oo.map(t => `- ${t}`).join("\n")}`);

  const bt = topBy(allBookingTriggers, 5);
  if (bt.length) sections.push(`WHAT TRIGGERS BOOKINGS:\n${bt.map(t => `- ${t}`).join("\n")}`);

  const ct = topBy(allColdTriggers, 5);
  if (ct.length) sections.push(`WHAT KILLS DEALS (avoid):\n${ct.map(t => `- ${t}`).join("\n")}`);

  const rw = topBy(allReengagementWins, 3);
  if (rw.length) sections.push(`WHAT RE-ENGAGES COLD LEADS:\n${rw.map(t => `- ${t}`).join("\n")}`);

  return `\n\nLEARNED FROM ${total} PAST CONVERSATIONS:\n${sections.join("\n\n")}`;
}
