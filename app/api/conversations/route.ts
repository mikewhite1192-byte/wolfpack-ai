import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/conversations — list conversations
export async function GET(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "open";

    const conversations = await sql`
      SELECT conv.*,
             c.first_name, c.last_name, c.phone, c.email, c.company,
             (SELECT body FROM messages WHERE conversation_id = conv.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = conv.id AND direction = 'inbound' AND created_at > COALESCE(conv.last_message_at, conv.created_at)) as unread_count,
             (SELECT d.id FROM deals d WHERE d.contact_id = c.id AND d.workspace_id = conv.workspace_id LIMIT 1) as deal_id
      FROM conversations conv
      JOIN contacts c ON c.id = conv.contact_id
      WHERE conv.workspace_id = ${workspace.id}
        AND (${status} = 'all' OR conv.status = ${status})
      ORDER BY conv.last_message_at DESC NULLS LAST
    `;

    return NextResponse.json({ conversations });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/conversations — create a new conversation with a contact
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { contactId } = await req.json();

    if (!contactId) {
      return NextResponse.json({ error: "contactId required" }, { status: 400 });
    }

    // Check contact exists
    const contact = await sql`
      SELECT * FROM contacts WHERE id = ${contactId} AND workspace_id = ${workspace.id}
    `;
    if (contact.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Check if conversation already exists
    const existing = await sql`
      SELECT * FROM conversations
      WHERE workspace_id = ${workspace.id} AND contact_id = ${contactId} AND channel = 'sms'
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({ conversation: existing[0] });
    }

    // Create new conversation
    const conversation = await sql`
      INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled)
      VALUES (${workspace.id}, ${contactId}, 'sms', 'open', TRUE)
      RETURNING *
    `;

    return NextResponse.json({ conversation: conversation[0] }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
