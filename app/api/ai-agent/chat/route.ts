import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/ai-agent/chat — internal AI assistant for the business owner
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { message, history } = await req.json();

    // Gather live CRM data — wrapped individually so one failure doesn't crash everything
    const safe = async (fn: () => Promise<Record<string, unknown>[]>) => {
      try { return await fn(); } catch (e) { console.error("[ai-chat] query error:", e); return []; }
    };

    const [pipelineData, hotLeads, coldLeads, recentActivity, statsArr, conversations] = await Promise.all([
      safe(() => sql`
        SELECT ps.name, ps.color, COUNT(d.id) as count, COALESCE(SUM(d.value), 0) as total_value
        FROM pipeline_stages ps
        LEFT JOIN deals d ON d.stage_id = ps.id AND d.workspace_id = ps.workspace_id
        WHERE ps.workspace_id = ${workspace.id}
        GROUP BY ps.id, ps.name, ps.color, ps.position
        ORDER BY ps.position
      `),
      safe(() => sql`
        SELECT c.first_name, c.last_name, c.phone, c.lead_score, c.ai_qualification,
               ps.name as stage_name, d.value as deal_value
        FROM contacts c
        LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE c.workspace_id = ${workspace.id} AND c.lead_score >= 60
        ORDER BY c.lead_score DESC
        LIMIT 10
      `),
      safe(() => sql`
        SELECT c.first_name, c.last_name, c.phone, c.last_contacted, c.ai_followup_count, c.lead_score
        FROM contacts c
        JOIN conversations conv ON conv.contact_id = c.id AND conv.status = 'open' AND conv.ai_enabled = true
        WHERE c.workspace_id = ${workspace.id}
          AND c.last_contacted < NOW() - INTERVAL '48 hours'
        ORDER BY c.last_contacted ASC
        LIMIT 10
      `),
      safe(() => sql`
        SELECT da.action, da.details, da.created_at, c.first_name, c.last_name
        FROM deal_activity da
        JOIN deals d ON d.id = da.deal_id
        JOIN contacts c ON c.id = d.contact_id
        WHERE da.workspace_id = ${workspace.id}
        ORDER BY da.created_at DESC
        LIMIT 15
      `),
      safe(() => sql`
        SELECT
          COUNT(*) FILTER (WHERE ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE) as active_deals,
          COUNT(*) FILTER (WHERE ps.is_won = TRUE AND d.closed_at > NOW() - INTERVAL '30 days') as closed_this_month,
          COALESCE(SUM(d.value) FILTER (WHERE ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE), 0) as pipeline_value,
          COALESCE(SUM(d.value) FILTER (WHERE ps.is_won = TRUE AND d.closed_at > NOW() - INTERVAL '30 days'), 0) as revenue_this_month
        FROM deals d
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE d.workspace_id = ${workspace.id}
      `),
      safe(() => sql`
        SELECT conv.*, c.first_name, c.last_name, c.phone,
          (SELECT COUNT(*) FROM messages WHERE conversation_id = conv.id AND direction = 'inbound' AND created_at > NOW() - INTERVAL '24 hours') as new_messages
        FROM conversations conv
        JOIN contacts c ON c.id = conv.contact_id
        WHERE conv.workspace_id = ${workspace.id} AND conv.status = 'open'
        ORDER BY conv.last_message_at DESC
        LIMIT 10
      `),
    ]);

    const stats = statsArr;

    const s = (stats[0] as Record<string, unknown>) || {};
    const crmContext = `
LIVE CRM DATA:
Pipeline: ${s.active_deals || 0} active deals worth $${Number(s.pipeline_value || 0).toLocaleString()}
Revenue this month: $${Number(s.revenue_this_month || 0).toLocaleString()} (${s.closed_this_month || 0} deals closed)

PIPELINE BREAKDOWN:
${pipelineData.map((p: Record<string, unknown>) => `- ${p.name}: ${p.count} deals ($${Number(p.total_value || 0).toLocaleString()})`).join("\n")}

HOT LEADS (score 60+):
${hotLeads.length === 0 ? "None yet" : hotLeads.map((l: Record<string, unknown>) => {
  const name = [l.first_name, l.last_name].filter(Boolean).join(" ");
  const qual = l.ai_qualification as Record<string, unknown> | null;
  return `- ${name} (${l.phone}) — Score: ${l.lead_score}, Stage: ${l.stage_name || "New"}, Value: $${Number(l.deal_value || 0).toLocaleString()}${qual?.needs ? `, Needs: ${qual.needs}` : ""}`;
}).join("\n")}

GOING COLD (no contact 48h+):
${coldLeads.length === 0 ? "None" : coldLeads.map((l: Record<string, unknown>) => {
  const name = [l.first_name, l.last_name].filter(Boolean).join(" ");
  const lastContact = l.last_contacted ? new Date(l.last_contacted as string).toLocaleDateString() : "never";
  return `- ${name} (${l.phone}) — Last contact: ${lastContact}, Follow-ups: ${l.ai_followup_count || 0}, Score: ${l.lead_score || 0}`;
}).join("\n")}

ACTIVE CONVERSATIONS:
${conversations.map((c: Record<string, unknown>) => {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
  return `- ${name}: ${c.new_messages || 0} new messages, AI ${c.ai_enabled ? "on" : "off"}`;
}).join("\n")}

RECENT ACTIVITY:
${recentActivity.slice(0, 8).map((a: Record<string, unknown>) => {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ");
  const d = a.details as Record<string, string> | null;
  const time = new Date(a.created_at as string).toLocaleString();
  if (a.action === "stage_changed") return `- ${name} moved ${d?.from} → ${d?.to} (${time})`;
  if (a.action === "note_added") return `- Note on ${name}: "${(d?.text || "").substring(0, 50)}" (${time})`;
  return `- ${a.action} for ${name} (${time})`;
}).join("\n")}`;

    const chatHistory = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 600,
      system: `You are the AI assistant for ${workspace.name || "this business"}. You have full access to the CRM data below. You help the business owner manage their sales pipeline, prioritize leads, and make decisions.

${crmContext}

YOUR CAPABILITIES:
- Answer questions about leads, pipeline, and performance
- Recommend who to call/text next and why
- Identify leads most likely to close
- Spot leads going cold that need attention
- Give daily briefings (morning plan, EOD summary)
- Provide sales coaching and strategy
- Analyze patterns in the data
- Help set up campaigns (reactivation, outreach, follow-ups)
- Help with CSV imports and bulk actions
- Help users navigate the CRM. If they ask how to do something, guide them step by step:
  * Pipeline: drag and drop cards between stages, click a card to see full details
  * Contacts: click contacts in sidebar, use Import CSV button to bulk upload, click the chat icon to text
  * Conversations: click a conversation on the left, AI toggle in the header, contact info on the right
  * Email: connect Gmail first (Email tab > Connect Gmail), then see all threads, reply, compose
  * Calendar: connect Google (same as Gmail), click days to see appointments, use booking link for leads
  * Settings: AI Sales Agent tab to configure the bot, Pipeline Stages, Templates, Account info
  * AI Toggle: click the green/gray switch in any conversation header to turn AI auto-reply on or off
  * Booking Link: found in Calendar page, share with leads so they can self-book

IMPORTANT RULES:
- You are an ASSISTANT to the business owner. They make the decisions, you execute.
- NEVER refuse to send messages or run campaigns. The owner knows their business and their customer relationships.
- If there's a compliance concern (like texting contacts who may not be opted in), ASK "Have these contacts opted in to receive texts?" If they say yes, proceed immediately. Do NOT lecture them about compliance or refuse to help.
- You are not a compliance officer. You are a sales assistant. Ask the question once, respect the answer, and execute.
- Same applies to any action — if the owner asks you to do something, do it. Ask clarifying questions if needed but never refuse or gatekeep.

STYLE:
- Be direct and actionable. No fluff.
- Use specific names and numbers from the data.
- When recommending actions, explain WHY.
- Keep responses concise — this is a chat, not an essay.
- If asked for a morning briefing, structure it as: Priority calls, follow-ups needed, pipeline health, goals for the day.
- If asked for EOD report, structure it as: what happened today, wins, what needs attention tomorrow.
- Never use dashes in your responses. Use periods or commas instead.`,
      messages: [...chatHistory, { role: "user" as const, content: message }],
    });

    const textBlock = response.content.find(b => b.type === "text");
    const reply = textBlock && "text" in textBlock ? textBlock.text : "I couldn't process that. Try asking again.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[ai-chat] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
