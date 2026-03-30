import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage, showTyping, validateWebhook } from "@/lib/loop/client";
import type { LoopWebhookPayload } from "@/lib/loop/client";
import { runSalesAgent, DEFAULT_CONFIG, type AgentConfig, type LeadQualification, type ConversationStage } from "@/lib/ai-agent";
import { getLearnings } from "@/lib/ai-learner";
import { getGmailToken } from "@/lib/gmail";
import { createCalendarEvent } from "@/lib/calendar";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/webhooks/loop — Loop Message webhook receiver
export async function POST(req: Request) {
  try {
    // Validate webhook auth
    const authHeader = req.headers.get("authorization");
    if (!validateWebhook(authHeader)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await req.json()) as LoopWebhookPayload;

    console.log(`[loop-webhook] ${payload.event} from ${payload.contact}`);

    // Only process inbound messages and opt-ins
    if (payload.event !== "message_inbound" && payload.event !== "opt-in") {
      return NextResponse.json({ received: true });
    }

    const from = payload.contact;
    const text = payload.text?.trim();
    const messageId = payload.message_id;
    const channel = payload.channel || "iMessage";

    if (!from || !text) {
      console.log(`[loop-webhook] Skipping empty message`);
      return NextResponse.json({ received: true });
    }

    console.log(`[loop-webhook] ${channel} from ${from}: "${text.substring(0, 80)}"`);

    // Normalize phone for lookup
    const fromDigits = from.replace(/\D/g, "");
    const fromE164 = fromDigits.startsWith("1") && fromDigits.length === 11 ? "+" + fromDigits : fromDigits.length === 10 ? "+1" + fromDigits : from;
    const fromLast10 = fromDigits.slice(-10);

    // --- Check if this is a Maya demo conversation ---
    // Check for active Maya demo (still in conversation)
    const mayaActive = await sql`
      SELECT id FROM maya_demos
      WHERE (
        phone = ${from}
        OR phone = ${fromE164}
        OR phone LIKE ${"%" + fromLast10}
      )
        AND step < 99
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;

    if (mayaActive.length > 0) {
      try {
        const { handleMayaReply } = await import("@/app/api/webhooks/maya/route");
        await handleMayaReply(messageId, fromE164, text);
        console.log(`[loop-webhook] Handled by Maya demo bot`);
      } catch (mayaErr) {
        console.error("[loop-webhook] Maya handler error:", mayaErr);
      }
      return NextResponse.json({ received: true });
    }

    // Check for completed Maya demo — don't let CRM agent take over, just ignore
    const mayaCompleted = await sql`
      SELECT id FROM maya_demos
      WHERE (
        phone = ${from}
        OR phone = ${fromE164}
        OR phone LIKE ${"%" + fromLast10}
      )
        AND step >= 99
        AND created_at > NOW() - INTERVAL '7 days'
      LIMIT 1
    `;

    if (mayaCompleted.length > 0) {
      console.log(`[loop-webhook] Ignoring message from completed Maya demo contact ${from}`);
      return NextResponse.json({ received: true });
    }

    // --- CRM Integration ---

    const workspace = await sql`
      SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1
    `;
    if (workspace.length === 0) {
      return NextResponse.json({ received: true });
    }
    const ws = workspace[0];

    // Find or create contact
    let contact = await sql`
      SELECT * FROM contacts WHERE workspace_id = ${ws.id} AND (phone = ${from} OR phone = ${fromE164}) LIMIT 1
    `;
    if (contact.length === 0) {
      contact = await sql`
        INSERT INTO contacts (workspace_id, phone, source)
        VALUES (${ws.id}, ${fromE164}, ${channel.toLowerCase()})
        RETURNING *
      `;
      const firstStage = await sql`
        SELECT id FROM pipeline_stages WHERE workspace_id = ${ws.id} ORDER BY position ASC LIMIT 1
      `;
      if (firstStage.length > 0) {
        await sql`
          INSERT INTO deals (workspace_id, contact_id, stage_id, title)
          VALUES (${ws.id}, ${contact[0].id}, ${firstStage[0].id}, ${channel + " Lead " + from})
        `;
      }
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
      INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid)
      VALUES (${convId}, ${ws.id}, 'inbound', ${channel.toLowerCase()}, ${fromE164}, ${''}, ${text}, 'received', 'contact', ${messageId || null})
    `;
    await sql`UPDATE conversations SET last_message_at = NOW(), status = 'open' WHERE id = ${convId}`;
    await sql`UPDATE contacts SET last_contacted = NOW() WHERE id = ${contactId}`;

    // AI Sales Agent reply
    if (conversation[0].ai_enabled !== false) {
      // Show typing indicator
      showTyping(fromE164, 5, messageId).catch(() => {});

      const agentConfig: AgentConfig = { ...DEFAULT_CONFIG, ...(ws.ai_config || {}), businessName: ws.name || "our business" };

      if (!agentConfig.enabled) {
        return NextResponse.json({ received: true });
      }

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

      const lastMsg = await sql`
        SELECT created_at FROM messages WHERE conversation_id = ${convId} AND direction = 'outbound'
        ORDER BY created_at DESC LIMIT 1
      `;
      const hoursSinceLastContact = lastMsg.length > 0
        ? (Date.now() - new Date(lastMsg[0].created_at).getTime()) / (1000 * 60 * 60)
        : 0;

      const learnings = await getLearnings(ws.id).catch(() => "");

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

      // Send reply via Loop
      let replyError = false;
      let replyMsgId: string | null = null;
      try {
        const sendResult = await sendMessage(fromE164, result.reply);
        replyMsgId = sendResult.message_id;
      } catch (err) {
        console.error("[loop-webhook] Failed to send AI reply:", err);
        replyError = true;
      }

      // Save outbound AI message
      await sql`
        INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid, credits_used)
        VALUES (${convId}, ${ws.id}, 'outbound', ${channel.toLowerCase()}, ${''}, ${fromE164}, ${result.reply}, ${replyError ? 'failed' : 'sent'}, 'ai', ${replyMsgId}, 1)
      `;
      await sql`UPDATE conversations SET last_message_at = NOW(), ai_stage = ${result.updatedStage} WHERE id = ${convId}`;

      // Update contact qualification
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

      // Auto-book calendar if appointment detected
      if (result.appointmentDetected) {
        try {
          const apptDate = new Date(result.appointmentDetected);
          if (!isNaN(apptDate.getTime())) {
            const apptEnd = new Date(apptDate.getTime() + 30 * 60000);
            const apptEmail = (result as Record<string, unknown>).appointmentEmail as string | null;
            const bizName = agentConfig.businessName || ws.name || "Meeting";
            const apptLeadName = [contact[0].first_name, contact[0].last_name].filter(Boolean).join(" ") || "Lead";

            await sql`
              UPDATE contacts SET
                appointment_at = ${apptDate.toISOString()},
                appointment_reminder_sent = false,
                email = COALESCE(${apptEmail || null}, email)
              WHERE id = ${contactId}
            `;

            try {
              const calToken = await getGmailToken(ws.id);
              if (calToken) {
                await createCalendarEvent(
                  calToken,
                  `${bizName} - ${apptLeadName}`,
                  `Phone: ${fromE164}\nEmail: ${apptEmail || "N/A"}\nBooked via AI Sales Agent`,
                  apptDate.toISOString(),
                  apptEnd.toISOString(),
                  apptEmail || undefined,
                  true,
                );
              }
            } catch (calErr) {
              console.error("[loop-webhook] Calendar booking failed:", calErr);
            }
          }
        } catch { /* invalid date */ }
      }

      console.log(`[loop-webhook] AI replied: "${result.reply.substring(0, 50)}..." | Stage: ${result.updatedStage}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[loop-webhook] Error:", err);
    return NextResponse.json({ received: true });
  }
}
