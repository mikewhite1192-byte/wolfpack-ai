import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (phone.startsWith("+")) return phone;
  return "+" + digits;
}

// POST /api/demo — start a live demo for a prospect
export async function POST(req: Request) {
  try {
    const { name, phone, businessType, source } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
    }

    const formattedPhone = toE164(phone);

    // Get workspace
    const workspace = await sql`
      SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1
    `;
    if (workspace.length === 0) {
      return NextResponse.json({ error: "No workspace" }, { status: 500 });
    }
    const ws = workspace[0];

    // Check if this phone already has a demo
    const existing = await sql`
      SELECT c.id, conv.id as conv_id FROM contacts c
      JOIN conversations conv ON conv.contact_id = c.id
      WHERE c.workspace_id = ${ws.id} AND c.phone = ${formattedPhone} AND c.source = 'demo'
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({
        contactId: existing[0].id,
        conversationId: existing[0].conv_id,
        alreadyStarted: true,
      });
    }

    // Create demo contact
    const firstName = name.split(" ")[0];
    const lastName = name.split(" ").slice(1).join(" ") || null;

    const contact = await sql`
      INSERT INTO contacts (workspace_id, first_name, last_name, phone, source, source_detail)
      VALUES (${ws.id}, ${firstName}, ${lastName}, ${formattedPhone}, ${source || 'demo'}, ${businessType || 'live demo'})
      RETURNING *
    `;

    // Create deal in first stage
    const firstStage = await sql`
      SELECT id FROM pipeline_stages WHERE workspace_id = ${ws.id} ORDER BY position ASC LIMIT 1
    `;
    if (firstStage.length > 0) {
      await sql`
        INSERT INTO deals (workspace_id, contact_id, stage_id, title, value)
        VALUES (${ws.id}, ${contact[0].id}, ${firstStage[0].id}, ${name + ' (Demo)'}, 0)
      `;
    }

    // Create conversation with AI enabled
    const conv = await sql`
      INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled, ai_stage)
      VALUES (${ws.id}, ${contact[0].id}, 'sms', 'open', TRUE, 'new')
      RETURNING *
    `;

    // Route through Maya (Sonnet-powered) — sell Wolf Pack AI directly
    const industry = businessType || "general";
    const msg1 = `Hey ${firstName}! This is Maya with Wolf Pack AI. I saw you were checking us out. Quick question, what kind of business are you in?`;

    try {
      const chatResult = await sendMessage(formattedPhone, msg1);
      // Store as Maya demo for Sonnet-powered conversation
      await sql`
        INSERT INTO maya_demos (phone, first_name, chat_id, step, industry, conversation, created_at)
        VALUES (${formattedPhone}, ${firstName}, ${chatResult.message_id}, 1, ${industry}, ${JSON.stringify([{ role: "assistant", content: msg1 }])}::jsonb, NOW())
        ON CONFLICT DO NOTHING
      `;
      // Also update the CRM conversation with the message_id
      await sql`UPDATE conversations SET assigned_to = ${chatResult.message_id} WHERE id = ${conv[0].id}`;
    } catch (err) {
      console.error("[demo] Maya send failed, falling back to cron:", err);
      await sql`UPDATE contacts SET ai_next_followup = NOW(), ai_followup_count = 0 WHERE id = ${contact[0].id}`;
    }

    return NextResponse.json({
      contactId: contact[0].id,
      conversationId: conv[0].id,
      started: true,
    });
  } catch (err) {
    console.error("[demo] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// GET /api/demo?conversationId=xxx — get live conversation for the demo viewer
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const convId = searchParams.get("conversationId");

    if (!convId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const messages = await sql`
      SELECT direction, body, sent_by, status, created_at FROM messages
      WHERE conversation_id = ${convId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[demo-get] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
