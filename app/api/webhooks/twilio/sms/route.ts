import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendLinqSMS } from "@/lib/loop";
import { generateSMSReply } from "@/lib/ai";
import { checkUpgradeEvent } from "@/lib/outreach/upgrade-sequence";
import twilio from "twilio";

const sql = neon(process.env.DATABASE_URL!);

// SMS opt-out keywords per TCPA compliance
const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "quit", "end", "opt out", "optout"];
const OPT_IN_KEYWORDS = ["start", "unstop", "subscribe", "opt in", "optin"];

// POST /api/webhooks/twilio/sms — incoming SMS from Twilio
export async function POST(req: Request) {
  try {
    // Verify Twilio webhook signature
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioSignature = req.headers.get("x-twilio-signature");
    if (twilioAuthToken && twilioSignature) {
      const url = `${process.env.NEXT_PUBLIC_APP_URL || "https://thewolfpack.ai"}/api/webhooks/twilio/sms`;
      const clonedReq = req.clone();
      const formDataForVerify = await clonedReq.formData();
      const params: Record<string, string> = {};
      formDataForVerify.forEach((value, key) => { params[key] = value as string; });
      const isValid = twilio.validateRequest(twilioAuthToken, twilioSignature, url, params);
      if (!isValid) {
        console.error("[sms] Invalid Twilio signature — rejecting");
        return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
      }
    }

    const formData = await req.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = formData.get("Body") as string;

    console.log(`[sms] Incoming from ${from}: ${body}`);

    // TCPA opt-out handling
    const bodyLower = (body || "").trim().toLowerCase();
    if (OPT_OUT_KEYWORDS.some(kw => bodyLower === kw)) {
      // Mark contact as opted out
      await sql`UPDATE contacts SET opted_out = TRUE WHERE phone = ${from}`;
      await sql`UPDATE conversations SET ai_enabled = FALSE WHERE contact_id IN (SELECT id FROM contacts WHERE phone = ${from})`;
      console.log(`[sms] Contact ${from} opted out`);
      return new Response("<Response><Message>You have been unsubscribed. Reply START to re-subscribe.</Message></Response>", { headers: { "Content-Type": "text/xml" } });
    }

    if (OPT_IN_KEYWORDS.some(kw => bodyLower === kw)) {
      await sql`UPDATE contacts SET opted_out = FALSE WHERE phone = ${from}`;
      console.log(`[sms] Contact ${from} opted back in`);
      return new Response("<Response><Message>You have been re-subscribed. Reply STOP to unsubscribe.</Message></Response>", { headers: { "Content-Type": "text/xml" } });
    }

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

    // Check opt-out status before AI reply
    if (contact[0].opted_out === true) {
      console.log(`[sms] Contact ${from} is opted out — skipping AI reply`);
      return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
    }

    // If AI is enabled, generate and send reply
    if (conversation[0].ai_enabled === true) {
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

    // Fire event-based upgrade check (non-blocking)
    checkUpgradeEvent(ws.id as string, "inbound_reply").catch(() => {});

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
