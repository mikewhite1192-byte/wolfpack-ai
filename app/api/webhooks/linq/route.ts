import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import {
  WebhookEvent,
  isMessageReceivedEvent,
} from "@/lib/linq/types";
import { sendMessage, markAsRead, startTyping, stopTyping } from "@/lib/linq/client";
import { runSalesAgent, DEFAULT_CONFIG, type AgentConfig, type LeadQualification, type ConversationStage } from "@/lib/ai-agent";
import { getLearnings } from "@/lib/ai-learner";
import { getGmailToken } from "@/lib/gmail";
import { createCalendarEvent } from "@/lib/calendar";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/webhooks/linq — Linq Blue V3 webhook receiver
export async function POST(req: Request) {
  try {
    const event = (await req.json()) as WebhookEvent;

    console.log(`[webhook] ${event.event_type} (${event.event_id})`);

    // Only process message.received events
    if (!isMessageReceivedEvent(event)) {
      return NextResponse.json({ received: true });
    }

    // Log FULL payload first before touching anything
    console.log(`[webhook] Full payload:`, JSON.stringify(event, null, 2));

    // Extract data from ACTUAL Linq V3 payload structure
    const data = event.data as unknown as Record<string, unknown>;
    if (!data) {
      console.log(`[webhook] No data in event`);
      return NextResponse.json({ received: true });
    }

    // Real payload structure (from actual webhook):
    // data.chat.id = chat ID
    // data.sender_handle.handle = sender phone number
    // data.sender_handle.is_me = boolean
    // data.chat.owner_handle.handle = our phone number
    // data.parts[] = message parts (NOT data.message.parts)
    // data.id = message ID
    // data.service = "iMessage" | "SMS" | "RCS"
    // data.direction = "inbound" | "outbound"

    const chat = data.chat as Record<string, unknown> | undefined;
    const senderHandle = data.sender_handle as Record<string, unknown> | undefined;
    const ownerHandle = chat?.owner_handle as Record<string, unknown> | undefined;

    const chat_id = chat?.id as string;
    const from = senderHandle?.handle as string;
    const is_from_me = senderHandle?.is_me as boolean;
    const recipient_phone = ownerHandle?.handle as string;
    const service = (data.service || "SMS") as string;
    const msgId = data.id as string;
    const direction = data.direction as string;

    console.log(`[webhook] chat_id=${chat_id} from=${from} is_from_me=${is_from_me} direction=${direction} service=${service}`);

    if (!chat_id || !from) {
      console.log(`[webhook] Missing chat_id or from`);
      return NextResponse.json({ received: true });
    }

    // Skip messages from ourselves
    if (is_from_me || direction === "outbound") {
      console.log(`[webhook] Skipping own message`);
      return NextResponse.json({ received: true });
    }

    // Extract text from parts (parts are directly on data, NOT data.message.parts)
    const parts = data.parts as Array<{ type: string; value?: string }> | undefined;
    let text = "";
    if (parts && Array.isArray(parts)) {
      text = parts
        .filter(p => p.type === "text")
        .map(p => p.value || "")
        .join("\n")
        .trim();
    }

    console.log(`[webhook] Extracted text: "${text.substring(0, 100)}"`);


    if (!text.trim()) {
      console.log(`[webhook] Skipping empty message`);
      return NextResponse.json({ received: true });
    }

    console.log(`[webhook] ${service} from ${from}: "${text.substring(0, 80)}"`);

    // Mark as read immediately
    markAsRead(chat_id).catch(() => {});

    // --- CRM Integration starts here ---

    // Find workspace
    const workspace = await sql`
      SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1
    `;
    if (workspace.length === 0) {
      console.log("[webhook] No workspace found");
      return NextResponse.json({ received: true });
    }
    const ws = workspace[0];

    // Find or create contact by phone number
    let contact = await sql`
      SELECT * FROM contacts WHERE workspace_id = ${ws.id} AND phone = ${from} LIMIT 1
    `;
    if (contact.length === 0) {
      contact = await sql`
        INSERT INTO contacts (workspace_id, phone, source)
        VALUES (${ws.id}, ${from}, ${service.toLowerCase()})
        RETURNING *
      `;
      // Auto-create deal in first pipeline stage
      const firstStage = await sql`
        SELECT id FROM pipeline_stages WHERE workspace_id = ${ws.id} ORDER BY position ASC LIMIT 1
      `;
      if (firstStage.length > 0) {
        await sql`
          INSERT INTO deals (workspace_id, contact_id, stage_id, title)
          VALUES (${ws.id}, ${contact[0].id}, ${firstStage[0].id}, ${service + " Lead " + from})
        `;
      }
      console.log(`[webhook] New contact created: ${contact[0].id}`);
    }
    const contactId = contact[0].id;

    // Find or create conversation — store Linq chat_id in assigned_to field
    let conversation = await sql`
      SELECT * FROM conversations
      WHERE workspace_id = ${ws.id} AND contact_id = ${contactId} AND channel = 'sms'
      LIMIT 1
    `;
    if (conversation.length === 0) {
      conversation = await sql`
        INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled, assigned_to)
        VALUES (${ws.id}, ${contactId}, 'sms', 'open', TRUE, ${chat_id})
        RETURNING *
      `;
    } else {
      // Update chat_id in case it changed
      await sql`UPDATE conversations SET assigned_to = ${chat_id} WHERE id = ${conversation[0].id}`;
    }
    const convId = conversation[0].id;

    // Save inbound message
    await sql`
      INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid)
      VALUES (${convId}, ${ws.id}, 'inbound', ${service.toLowerCase()}, ${from}, ${recipient_phone || ''}, ${text}, 'received', 'contact', ${msgId || null})
    `;
    await sql`UPDATE conversations SET last_message_at = NOW(), status = 'open' WHERE id = ${convId}`;
    await sql`UPDATE contacts SET last_contacted = NOW() WHERE id = ${contactId}`;

    console.log(`[webhook] Message saved to CRM`);

    // AI Sales Agent reply if enabled
    if (conversation[0].ai_enabled !== false) {
      startTyping(chat_id).catch(() => {});

      // Load agent config from workspace
      const agentConfig: AgentConfig = { ...DEFAULT_CONFIG, ...(ws.ai_config || {}), businessName: ws.name || "our business" };

      if (!agentConfig.enabled) {
        stopTyping(chat_id).catch(() => {});
        return NextResponse.json({ received: true });
      }

      // Load recent messages
      const recentMessages = await sql`
        SELECT direction, body FROM messages
        WHERE conversation_id = ${convId}
        ORDER BY created_at ASC
        LIMIT 30
      `;

      const aiMessages = recentMessages.map(m => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: m.body || "",
      }));

      const leadName = [contact[0].first_name, contact[0].last_name].filter(Boolean).join(" ") || "there";
      const qualification: LeadQualification = contact[0].ai_qualification || {};
      const convStage: ConversationStage = conversation[0].ai_stage || "new";

      // Calculate hours since last contact
      const lastMsg = await sql`
        SELECT created_at FROM messages WHERE conversation_id = ${convId} AND direction = 'outbound'
        ORDER BY created_at DESC LIMIT 1
      `;
      const hoursSinceLastContact = lastMsg.length > 0
        ? (Date.now() - new Date(lastMsg[0].created_at).getTime()) / (1000 * 60 * 60)
        : 0;

      // Load accumulated learnings
      const learnings = await getLearnings(ws.id).catch(() => "");

      // Run the AI Sales Agent
      const result = await runSalesAgent({
        config: agentConfig,
        contactName: leadName,
        contactPhone: from,
        source: contact[0].source || "unknown",
        qualification,
        conversationStage: convStage,
        messages: aiMessages,
        hoursSinceLastContact,
        followUpCount: contact[0].ai_followup_count || 0,
        isFollowUp: false,
        learnings,
      });

      stopTyping(chat_id).catch(() => {});

      // Send the reply
      let replyMsgId: string | null = null;
      let replyError = false;
      try {
        const sendResult = await sendMessage(chat_id, result.reply);
        replyMsgId = sendResult.message.id;
      } catch (err) {
        console.error("[webhook] Failed to send AI reply:", err);
        replyError = true;
      }

      // Save outbound AI message
      await sql`
        INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid, credits_used)
        VALUES (${convId}, ${ws.id}, 'outbound', ${service.toLowerCase()}, ${recipient_phone || ''}, ${from}, ${result.reply}, ${replyError ? 'failed' : 'sent'}, 'ai', ${replyMsgId}, 1)
      `;
      await sql`UPDATE conversations SET last_message_at = NOW(), ai_stage = ${result.updatedStage} WHERE id = ${convId}`;

      // Update contact with AI qualification data + lead score
      await sql`
        UPDATE contacts SET
          ai_qualification = ${JSON.stringify(result.updatedQualification)}::jsonb,
          lead_score = ${result.suggestedScore},
          ai_next_followup = ${result.shouldFollowUp && result.nextFollowUpHours
            ? new Date(Date.now() + result.nextFollowUpHours * 60 * 60 * 1000).toISOString()
            : null},
          ai_followup_count = 0
        WHERE id = ${contactId}
      `;

      // If AI detected an appointment, auto-book calendar + send invite
      if (result.appointmentDetected) {
        try {
          const apptDate = new Date(result.appointmentDetected);
          if (!isNaN(apptDate.getTime())) {
            const apptEnd = new Date(apptDate.getTime() + 30 * 60000);
            const apptEmail = (result as Record<string, unknown>).appointmentEmail as string | null;
            const bizName = agentConfig.businessName || ws.name || "Meeting";
            const leadName = [contact[0].first_name, contact[0].last_name].filter(Boolean).join(" ") || "Lead";
            const useMeet = (agentConfig as unknown as Record<string, unknown>).autoGoogleMeet || false;

            // Save appointment to contact
            await sql`
              UPDATE contacts SET
                appointment_at = ${apptDate.toISOString()},
                appointment_reminder_sent = false,
                email = COALESCE(${apptEmail || null}, email)
              WHERE id = ${contactId}
            `;

            // Book on Google Calendar if connected
            try {
              const calToken = await getGmailToken(ws.id);
              if (calToken) {
                await createCalendarEvent(
                  calToken,
                  `${bizName} - ${leadName}`,
                  `Phone: ${from}\nEmail: ${apptEmail || "N/A"}\nBooked via AI Sales Agent`,
                  apptDate.toISOString(),
                  apptEnd.toISOString(),
                  apptEmail || undefined,
                  useMeet as boolean,
                );
                console.log(`[webhook] Calendar event created for ${leadName} at ${apptDate.toISOString()}${useMeet ? " with Google Meet" : ""}`);
              }
            } catch (calErr) {
              console.error("[webhook] Calendar booking failed:", calErr);
            }

            console.log(`[webhook] Appointment booked: ${apptDate.toISOString()} for ${leadName}${apptEmail ? ` (${apptEmail})` : ""}`);
          }
        } catch { /* invalid date, skip */ }
      }

      console.log(`[webhook] AI Agent replied: "${result.reply.substring(0, 50)}..." | Stage: ${result.updatedStage} | Score: ${result.suggestedScore}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] Error:", err);
    return NextResponse.json({ received: true });
  }
}
