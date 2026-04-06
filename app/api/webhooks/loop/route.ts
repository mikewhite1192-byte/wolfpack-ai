import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage, showTyping, validateWebhook } from "@/lib/loop/client";
import type { LoopWebhookPayload } from "@/lib/loop/client";
import { runSalesAgent, DEFAULT_CONFIG, type AgentConfig, type LeadQualification, type ConversationStage } from "@/lib/ai-agent";
import { getLearnings } from "@/lib/ai-learner";
import { getGmailToken } from "@/lib/gmail";
import { createCalendarEvent } from "@/lib/calendar";

const sql = neon(process.env.DATABASE_URL!);

// Simple in-memory rate limiter for inbound messages (10 per minute per phone)
const inboundRateMap = new Map<string, { count: number; resetAt: number }>();
function isInboundRateLimited(phone: string): boolean {
  const now = Date.now();
  const entry = inboundRateMap.get(phone);
  if (!entry || now > entry.resetAt) {
    inboundRateMap.set(phone, { count: 1, resetAt: now + 60000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

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

    // Rate limit inbound messages
    if (isInboundRateLimited(from)) {
      console.log(`[loop-webhook] Rate limited ${from}`);
      return NextResponse.json({ received: true });
    }

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

    // Check for completed Maya demo — handle rescheduling, otherwise ignore
    const mayaCompleted = await sql`
      SELECT id, calendar_event_id, phone FROM maya_demos
      WHERE (
        phone = ${from}
        OR phone = ${fromE164}
        OR phone LIKE ${"%" + fromLast10}
      )
        AND step >= 99
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC LIMIT 1
    `;

    if (mayaCompleted.length > 0) {
      // Check if they're trying to reschedule
      const isReschedule = /reschedul|cancel|change.*time|switch.*time|move.*appointment|different.*day|different.*time/i.test(text);
      const eventId = mayaCompleted[0].calendar_event_id as string | null;

      if (isReschedule && eventId) {
        try {
          const { sendMessage } = await import("@/lib/loop/client");
          const { refreshAccessToken } = await import("@/lib/gmail");
          const { cancelCalendarEvent } = await import("@/lib/calendar");

          // Cancel the old event
          const refreshToken = process.env.DEMO_BOOKING_REFRESH_TOKEN;
          if (refreshToken) {
            const calToken = await refreshAccessToken(refreshToken);
            await cancelCalendarEvent(calToken, eventId);
            await sql`UPDATE maya_demos SET calendar_event_id = NULL, step = 97 WHERE id = ${mayaCompleted[0].id}`;
            await sendMessage(fromE164, "No problem! I cancelled your current appointment. What day and time works better for you? Just let me know and I'll get a new invite sent over.");
            console.log(`[loop-webhook] Cancelled event ${eventId} for ${from}, waiting for new time`);
          }
        } catch (err) {
          console.error("[loop-webhook] Reschedule error:", err);
          const { sendMessage } = await import("@/lib/loop/client");
          await sendMessage(fromE164, "I'm having trouble updating the calendar right now. Can you email info@thewolfpackco.com and we'll get it switched for you?");
        }
        return NextResponse.json({ received: true });
      }

      // Check if they're giving a new time after cancellation (step 97)
      const mayaReschedule = await sql`
        SELECT * FROM maya_demos
        WHERE (phone = ${from} OR phone = ${fromE164} OR phone LIKE ${"%" + fromLast10})
          AND step = 97 AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC LIMIT 1
      `;

      if (mayaReschedule.length > 0) {
        try {
          const { sendMessage } = await import("@/lib/loop/client");
          const { refreshAccessToken } = await import("@/lib/gmail");
          const { createCalendarEvent } = await import("@/lib/calendar");
          const demo = mayaReschedule[0];
          const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

          // Try to parse a day/time from their message
          const timeMatch = /monday|tuesday|wednesday|thursday|friday|tomorrow|today/i.exec(text);
          const hourMatch = /(\d{1,2})\s*(am|pm|AM|PM)/i.exec(text);

          if (timeMatch || hourMatch) {
            const refreshToken = process.env.DEMO_BOOKING_REFRESH_TOKEN;
            if (refreshToken) {
              const calToken = await refreshAccessToken(refreshToken);
              const newDate = new Date();

              // Parse day
              if (timeMatch) {
                const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
                const targetDay = dayMap[timeMatch[0].toLowerCase()];
                if (targetDay !== undefined) {
                  const currentDay = newDate.getDay();
                  let daysToAdd = targetDay - currentDay;
                  if (daysToAdd <= 0) daysToAdd += 7;
                  newDate.setDate(newDate.getDate() + daysToAdd);
                } else if (timeMatch[0].toLowerCase() === "tomorrow") {
                  newDate.setDate(newDate.getDate() + 1);
                }
              }

              // Parse time
              if (hourMatch) {
                let hour = parseInt(hourMatch[1]);
                if (hourMatch[2].toLowerCase() === "pm" && hour < 12) hour += 12;
                if (hourMatch[2].toLowerCase() === "am" && hour === 12) hour = 0;
                newDate.setHours(hour + 4, 0, 0, 0); // Convert ET to UTC
              } else {
                newDate.setHours(18, 0, 0, 0); // Default 2pm ET
              }

              const end = new Date(newDate.getTime() + 30 * 60000);
              const calEvent = await createCalendarEvent(
                calToken,
                `Wolf Pack AI Demo — ${demo.first_name}`,
                `Rescheduled demo with ${demo.first_name}\nPhone: ${demo.phone}`,
                newDate.toISOString(),
                end.toISOString(),
                emailMatch?.[0] || undefined,
                true,
              );

              await sql`UPDATE maya_demos SET step = 99, calendar_event_id = ${calEvent.id} WHERE id = ${demo.id}`;

              const dayStr = newDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York" });
              const timeStr = newDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
              await sendMessage(fromE164, `You're all set! New appointment booked for ${dayStr} at ${timeStr} ET. Calendar invite is on its way. See you then!`);
            }
          } else {
            await sendMessage(fromE164, "What day and time works best for you? Something like 'Tuesday at 2pm' works great.");
          }
        } catch (err) {
          console.error("[loop-webhook] Rebook error:", err);
        }
        return NextResponse.json({ received: true });
      }

      console.log(`[loop-webhook] Ignoring message from completed Maya demo contact ${from}`);
      return NextResponse.json({ received: true });
    }

    // --- TCPA Opt-out handling ---
    const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "quit", "end", "opt out", "optout"];
    const OPT_IN_KEYWORDS = ["start", "unstop", "subscribe", "opt in", "optin"];
    const textLower = text.toLowerCase().trim();

    if (OPT_OUT_KEYWORDS.some(kw => textLower === kw)) {
      await sql`UPDATE contacts SET opted_out = TRUE WHERE phone = ${from} OR phone = ${fromE164}`;
      await sql`UPDATE conversations SET ai_enabled = FALSE WHERE contact_id IN (SELECT id FROM contacts WHERE phone = ${from} OR phone = ${fromE164})`;
      try { await sendMessage(fromE164, "You have been unsubscribed. Reply START to re-subscribe."); } catch {}
      console.log(`[loop-webhook] Contact ${from} opted out`);
      return NextResponse.json({ received: true });
    }

    if (OPT_IN_KEYWORDS.some(kw => textLower === kw)) {
      await sql`UPDATE contacts SET opted_out = FALSE WHERE phone = ${from} OR phone = ${fromE164}`;
      try { await sendMessage(fromE164, "You have been re-subscribed. Reply STOP to unsubscribe."); } catch {}
      console.log(`[loop-webhook] Contact ${from} opted back in`);
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

    // Check opt-out before AI reply
    if (contact[0].opted_out === true) {
      console.log(`[loop-webhook] Contact ${from} opted out — skipping AI reply`);
      return NextResponse.json({ received: true });
    }

    // AI Sales Agent reply
    if (conversation[0].ai_enabled === true) {
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

      // Handle handoff: disable AI and notify owner
      if (result.updatedStage === "handed_off") {
        await sql`UPDATE conversations SET ai_enabled = FALSE WHERE id = ${convId}`;
        const ownerPhone = process.env.OWNER_PHONE;
        if (ownerPhone) {
          const leadName = [contact[0].first_name, contact[0].last_name].filter(Boolean).join(" ") || from;
          sendMessage(ownerPhone, `Lead needs human attention: ${leadName} (${from}). AI has been disabled on this conversation. Check your dashboard.`).catch(() => {});
        }
        console.log(`[loop-webhook] Handed off ${from} to human — AI disabled`);
      }

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
