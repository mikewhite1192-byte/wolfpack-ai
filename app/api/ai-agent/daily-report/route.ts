import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { type } = await req.json(); // "morning" or "eod"

    if (type !== "morning" && type !== "eod") {
      return NextResponse.json({ error: "type must be 'morning' or 'eod'" }, { status: 400 });
    }

    // Gather CRM data (same queries as chat endpoint)
    const safe = async (fn: () => Promise<Record<string, unknown>[]>) => {
      try { return await fn(); } catch (e) { console.error("[daily-report] query error:", e); return []; }
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

    const s = (statsArr[0] as Record<string, unknown>) || {};
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

    const prompt = type === "morning"
      ? `Generate a morning briefing for the business owner. Structure it as:
1. PRIORITY CALLS: Who should they call first today and why
2. FOLLOW-UPS NEEDED: Leads going cold or needing attention
3. PIPELINE HEALTH: Quick overview of where things stand
4. TODAY'S GOALS: 3 actionable items for the day
Be direct, use specific names and numbers. No fluff.`
      : `Generate an end-of-day report for the business owner. Structure it as:
1. TODAY'S WINS: What went well (deals moved forward, new leads, closes)
2. ACTIVITY SUMMARY: Key conversations and movements
3. NEEDS ATTENTION TOMORROW: Leads or deals that need follow-up
4. PIPELINE SNAPSHOT: Current state overview
Be direct, use specific names and numbers. No fluff.`;

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 800,
      system: `You are the AI sales assistant for ${workspace.name || "this business"}. You have access to real-time CRM data. Generate a concise, actionable daily report. Never use dashes in your responses. Use periods or commas instead.\n\n${crmContext}`,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === "text");
    const report = textBlock && "text" in textBlock ? textBlock.text : "Unable to generate report.";

    // Save to daily_reports table
    await sql`
      INSERT INTO daily_reports (workspace_id, type, content)
      VALUES (${workspace.id}, ${type}, ${report})
    `;

    return NextResponse.json({ ok: true, report, type });
  } catch (err) {
    console.error("[daily-report] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET — fetch latest reports
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();

    const reports = await sql`
      SELECT id, type, content, created_at
      FROM daily_reports
      WHERE workspace_id = ${workspace.id}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return NextResponse.json({ reports });
  } catch (err) {
    console.error("[daily-report] GET Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
