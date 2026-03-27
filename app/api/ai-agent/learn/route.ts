import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { analyzeConversation } from "@/lib/ai-learner";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/ai-agent/learn — analyze a conversation and extract learnings
// Called when: deal moves to won/lost, conversation goes cold, lead re-engages
export async function POST(req: Request) {
  try {
    const { conversationId, outcome } = await req.json();

    if (!conversationId || !outcome) {
      return NextResponse.json({ error: "conversationId and outcome required" }, { status: 400 });
    }

    // Load conversation + messages
    const conv = await sql`
      SELECT conv.*, c.id as contact_id
      FROM conversations conv
      JOIN contacts c ON c.id = conv.contact_id
      WHERE conv.id = ${conversationId}
    `;

    if (conv.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await sql`
      SELECT direction, body, sent_by FROM messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `;

    await analyzeConversation({
      conversationId,
      contactId: conv[0].contact_id,
      workspaceId: conv[0].workspace_id,
      outcome,
      messages: messages.map(m => ({
        direction: m.direction as string,
        body: (m.body as string) || "",
        sent_by: (m.sent_by as string) || "",
      })),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[learn] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET /api/ai-agent/learn — trigger learning for all recently closed conversations
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find conversations that moved to won/lost stages but haven't been analyzed
    const unanalyzed = await sql`
      SELECT conv.id as conv_id, conv.contact_id, conv.workspace_id, conv.ai_stage,
             ps.is_won, ps.is_lost, d.id as deal_id
      FROM conversations conv
      JOIN contacts c ON c.id = conv.contact_id
      LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = conv.workspace_id
      LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE (ps.is_won = true OR ps.is_lost = true OR conv.ai_stage = 'closed')
        AND conv.id NOT IN (SELECT conversation_id FROM conversation_insights WHERE conversation_id IS NOT NULL)
      LIMIT 10
    `;

    let analyzed = 0;
    for (const conv of unanalyzed) {
      const messages = await sql`
        SELECT direction, body, sent_by FROM messages
        WHERE conversation_id = ${conv.conv_id}
        ORDER BY created_at ASC
      `;

      if (messages.length < 3) continue;

      const outcome = conv.is_won ? "won" : conv.is_lost ? "lost" : "cold";

      await analyzeConversation({
        conversationId: conv.conv_id,
        contactId: conv.contact_id,
        workspaceId: conv.workspace_id,
        outcome,
        messages: messages.map(m => ({
          direction: m.direction as string,
          body: (m.body as string) || "",
          sent_by: (m.sent_by as string) || "",
        })),
      });

      analyzed++;
    }

    return NextResponse.json({ analyzed, found: unanalyzed.length });
  } catch (err) {
    console.error("[learn-cron] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
