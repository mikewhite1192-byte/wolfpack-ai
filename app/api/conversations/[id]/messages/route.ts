import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { sendLinqSMS } from "@/lib/loop";
import { sendMessage as sendLinqReply } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/conversations/[id]/messages — get messages for a conversation
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;

    const conversation = await sql`
      SELECT conv.*, c.first_name, c.last_name, c.phone, c.email, c.company, c.id as contact_id
      FROM conversations conv
      JOIN contacts c ON c.id = conv.contact_id
      WHERE conv.id = ${id} AND conv.workspace_id = ${workspace.id}
    `;

    if (conversation.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await sql`
      SELECT * FROM messages
      WHERE conversation_id = ${id} AND workspace_id = ${workspace.id}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ conversation: conversation[0], messages });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/conversations/[id]/messages — send a message
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;
    const { body, channel } = await req.json();

    if (!body?.trim()) {
      return NextResponse.json({ error: "Message body required" }, { status: 400 });
    }

    // Get conversation + contact
    const conv = await sql`
      SELECT conv.*, c.phone, c.email
      FROM conversations conv
      JOIN contacts c ON c.id = conv.contact_id
      WHERE conv.id = ${id} AND conv.workspace_id = ${workspace.id}
    `;

    if (conv.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const effectiveChannel = channel || conv[0].channel || "sms";
    let msgId: string | null = null;

    // Send via Linq — use existing chat_id if available (stored in assigned_to), otherwise create new
    if ((effectiveChannel === "sms" || effectiveChannel === "imessage") && conv[0].phone) {
      // Send via Loop using phone number directly
      try {
        const result = await sendLinqReply(conv[0].phone, body);
        msgId = result.message_id || "sent";
      } catch {
        msgId = null;
      }
    }

    // Save message
    const message = await sql`
      INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid)
      VALUES (${id}, ${workspace.id}, 'outbound', ${effectiveChannel}, ${process.env.LINQ_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER || ''}, ${conv[0].phone || conv[0].email || ''}, ${body}, ${msgId ? 'sent' : 'failed'}, 'user', ${msgId})
      RETURNING *
    `;

    // Update conversation timestamp + disable AI (user took over)
    await sql`
      UPDATE conversations SET last_message_at = NOW(), ai_enabled = FALSE WHERE id = ${id}
    `;

    // Update contact last_contacted
    await sql`
      UPDATE contacts SET last_contacted = NOW() WHERE id = ${conv[0].contact_id}
    `;

    return NextResponse.json({ message: message[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
