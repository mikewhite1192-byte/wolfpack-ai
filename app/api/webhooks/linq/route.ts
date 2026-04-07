import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage, showTyping, type LoopWebhookPayload } from "@/lib/loop/client";
import { runSalesAgent, DEFAULT_CONFIG, type AgentConfig, type LeadQualification, type ConversationStage } from "@/lib/ai-agent";
import { getLearnings } from "@/lib/ai-learner";
import { getGmailToken } from "@/lib/gmail";
import { createCalendarEvent } from "@/lib/calendar";
import { notifyOwner } from "@/lib/notify-owner";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/webhooks/linq — Loop webhook receiver
// NOTE: Route path kept as /linq because Loop dashboard is configured to send here.
// Update the Loop webhook URL and rename this route to /api/webhooks/loop when ready.
export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as LoopWebhookPayload;

    console.log(`[webhook] ${payload.event} (${payload.message_id})`);

    // Only process inbound messages
    if (payload.event !== "message_inbound") {
      return NextResponse.json({ received: true });
    }

    // Log payload for debugging
    console.log(`[webhook] Full payload:`, JSON.stringify(payload, null, 2));

    const from = payload.contact;
    const text = (payload.text || "").trim();
    const msgId = payload.message_id;
    const service = payload.channel || "SMS";
    const chat_id = payload.message_id; // Loop uses message_id as conversation reference

    console.log(`[webhook] from=${from} service=${service} message_id=${msgId}`);

    if (!from) {
      console.log(`[webhook] Missing contact/from`);
      return NextResponse.json({ received: true });
    }

    if (!text) {
      console.log(`[webhook] Skipping empty message`);
      return NextResponse.json({ received: true });
    }

    console.log(`[webhook] ${service} from ${from}: "${text.substring(0, 80)}"`);

    // --- Check if this is a Maya demo conversation ---
    // Normalize phone for lookup (try multiple formats)
    const fromDigits = from.replace(/\D/g, "");
    const fromE164 = fromDigits.startsWith("1") && fromDigits.length === 11 ? "+" + fromDigits : fromDigits.length === 10 ? "+1" + fromDigits : from;

    // Quick DB check first — if this phone has an active Maya demo, skip CRM entirely
    const fromLast10 = fromDigits.slice(-10);
    const mayaQuickCheck = await sql`
      SELECT id FROM maya_demos
      WHERE (
        phone = ${from}
        OR phone = ${fromE164}
        OR phone LIKE ${"%" + fromLast10}
        OR chat_id = ${chat_id}
      )
        AND step < 99
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    console.log(`[webhook] Maya check: from=${from} e164=${fromE164} last10=${fromLast10} chat_id=${chat_id} found=${mayaQuickCheck.length}`);

    if (mayaQuickCheck.length > 0) {
      try {
        const { handleMayaReply } = await import("@/app/api/webhooks/maya/route");
        await handleMayaReply(chat_id, fromE164, text);
        console.log(`[webhook] Handled by Maya demo bot`);
      } catch (mayaErr) {
        console.error("[webhook] Maya handler error (still skipping CRM):", mayaErr);
      }
      return NextResponse.json({ received: true });
    }

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
    let isNewContact = false;
    if (contact.length === 0) {
      isNewContact = true;
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

    // Find or create conversation
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
      VALUES (${convId}, ${ws.id}, 'inbound', ${service.toLowerCase()}, ${from}, ${payload.sender || ''}, ${text}, 'received', 'contact', ${msgId || null})
    `;
    await sql`UPDATE conversations SET last_message_at = NOW(), status = 'open' WHERE id = ${convId}`;
    await sql`UPDATE contacts SET last_contacted = NOW() WHERE id = ${contactId}`;

    // Notify owner: new lead or inbound message
    const leadName = [contact[0].first_name, contact[0].last_name].filter(Boolean).join(" ") || from;
    if (isNewContact) {
      notifyOwner(ws.id, `New lead: ${leadName} (${from}) — ${service.toLowerCase()}`).catch(() => {});
    } else {
      const preview = text.length > 80 ? text.substring(0, 80) + "…" : text;
      notifyOwner(ws.id, `New message from ${leadName}: ${preview}`).catch(() => {});
    }

    console.log(`[webhook] Message saved to CRM`);

    // AI Sales Agent reply if enabled
    if (conversation[0].ai_enabled !== false) {
      showTyping(from).catch(() => {});

      // Load agent config from workspace
      const agentConfig: AgentConfig = { ...DEFAULT_CONFIG, ...(ws.ai_config || {}), businessName: ws.name || "our business" };

      if (!agentConfig.enabled) {
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

      const contactDisplayName = [contact[0].first_name, contact[0].last_name].filter(Boolean).join(" ") || "there";
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
        contactName: contactDisplayName,
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

      // Send the reply via Loop
      let replyMsgId: string | null = null;
      let replyError = false;
      try {
        const sendResult = await sendMessage(from, result.reply);
        replyMsgId = sendResult.message_id;
      } catch (err) {
        console.error("[webhook] Failed to send AI reply:", err);
        replyError = true;
      }

      // Save outbound AI message
      await sql`
        INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid, credits_used)
        VALUES (${convId}, ${ws.id}, 'outbound', ${service.toLowerCase()}, ${payload.sender || ''}, ${from}, ${result.reply}, ${replyError ? 'failed' : 'sent'}, 'ai', ${replyMsgId}, 1)
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

      // Handle handoff: disable AI and notify owner
      if (result.updatedStage === "handed_off") {
        await sql`UPDATE conversations SET ai_enabled = FALSE WHERE id = ${convId}`;
        // TODO: Build a proper owner notification system (in-app alert, push notification, etc.)
        const ownerPhone = process.env.OWNER_PHONE;
        if (ownerPhone) {
          const handoffName = [contact[0].first_name, contact[0].last_name].filter(Boolean).join(" ") || from;
          sendMessage(ownerPhone, `Lead needs human attention: ${handoffName} (${from}). AI has been disabled on this conversation. Check your dashboard.`).catch(() => {});
        }
        console.log(`[webhook] Handed off ${from} to human — AI disabled`);
      }

      // Save AI note for the user
      const aiNotes = result.updatedQualification.notes;
      if (aiNotes) {
        const dealRow = await sql`SELECT id FROM deals WHERE contact_id = ${contactId} AND workspace_id = ${ws.id} LIMIT 1`;
        if (dealRow.length > 0) {
          await sql`
            INSERT INTO deal_activity (deal_id, action, details, created_at)
            VALUES (${dealRow[0].id}, 'ai_note', ${JSON.stringify({ text: aiNotes })}::jsonb, NOW())
          `;
        }
      }

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

            // Notify owner about the appointment
            const apptTimeStr = apptDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
              + " at " + apptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
            notifyOwner(ws.id, `Appointment booked: ${leadName} on ${apptTimeStr} ET`).catch(() => {});

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
