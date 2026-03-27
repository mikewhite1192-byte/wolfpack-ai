import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendLinqSMS } from "@/lib/linq";
import { generateSMSReply } from "@/lib/ai";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/webhooks/twilio/sms — incoming SMS from Twilio
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = formData.get("Body") as string;

    console.log(`[sms] Incoming from ${from}: ${body}`);

    // Find workspace by Twilio phone number
    // First check workspace-specific numbers, then fall back to default
    let workspace = await sql`
      SELECT * FROM workspaces WHERE twilio_phone = ${to} AND status = 'active' LIMIT 1
    `;

    // If no workspace-specific number, find the first active workspace
    // (single-tenant mode for now)
    if (workspace.length === 0) {
      workspace = await sql`
        SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1
      `;
    }

    if (workspace.length === 0) {
      console.log("[sms] No workspace found");
      return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
    }

    const ws = workspace[0];

    // Find or create contact by phone number
    let contact = await sql`
      SELECT * FROM contacts WHERE workspace_id = ${ws.id} AND phone = ${from} LIMIT 1
    `;

    if (contact.length === 0) {
      // New lead! Create contact
      contact = await sql`
        INSERT INTO contacts (workspace_id, phone, source)
        VALUES (${ws.id}, ${from}, 'sms')
        RETURNING *
      `;

      // Auto-create deal in first stage
      const firstStage = await sql`
        SELECT id FROM pipeline_stages WHERE workspace_id = ${ws.id} ORDER BY position ASC LIMIT 1
      `;
      if (firstStage.length > 0) {
        await sql`
          INSERT INTO deals (workspace_id, contact_id, stage_id, title)
          VALUES (${ws.id}, ${contact[0].id}, ${firstStage[0].id}, ${"SMS Lead " + from})
        `;
      }
      console.log(`[sms] New contact created: ${contact[0].id}`);
    }

    const contactId = contact[0].id;

    // Find or create conversation
    let conversation = await sql`
      SELECT * FROM conversations
      WHERE workspace_id = ${ws.id} AND contact_id = ${contactId} AND channel = 'sms'
      LIMIT 1
    `;

    if (conversation.length === 0) {
      conversation = await sql`
        INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled)
        VALUES (${ws.id}, ${contactId}, 'sms', 'open', TRUE)
        RETURNING *
      `;
    }

    const convId = conversation[0].id;

    // Save inbound message
    await sql`
      INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by)
      VALUES (${convId}, ${ws.id}, 'inbound', 'sms', ${from}, ${to}, ${body}, 'received', 'contact')
    `;

    // Update conversation timestamp
    await sql`
      UPDATE conversations SET last_message_at = NOW(), status = 'open' WHERE id = ${convId}
    `;

    // Update contact last_contacted
    await sql`
      UPDATE contacts SET last_contacted = NOW() WHERE id = ${contactId}
    `;

    // If AI is enabled, generate and send reply
    if (conversation[0].ai_enabled !== false) {
      // Load recent messages for context
      const recentMessages = await sql`
        SELECT direction, body FROM messages
        WHERE conversation_id = ${convId}
        ORDER BY created_at ASC
        LIMIT 20
      `;

      // Build conversation history for Claude
      const aiMessages = recentMessages.map(m => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: m.body || "",
      }));

      const contactName = [contact[0].first_name, contact[0].last_name].filter(Boolean).join(" ") || "there";
      const businessName = ws.name || "our business";

      const reply = await generateSMSReply({
        businessName,
        contactName,
        messages: aiMessages,
      });

      // Send AI reply via Linq
      const twilioSid = await sendLinqSMS(from, reply);

      // Save outbound AI message
      await sql`
        INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid, credits_used)
        VALUES (${convId}, ${ws.id}, 'outbound', 'sms', ${to}, ${from}, ${reply}, ${twilioSid ? 'sent' : 'failed'}, 'ai', ${twilioSid}, 1)
      `;

      // Update conversation timestamp
      await sql`
        UPDATE conversations SET last_message_at = NOW() WHERE id = ${convId}
      `;

      console.log(`[sms] AI replied to ${from}: ${reply.substring(0, 50)}...`);
    }

    // Return empty TwiML (we send replies via API, not TwiML)
    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[sms] Webhook error:", err);
    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
