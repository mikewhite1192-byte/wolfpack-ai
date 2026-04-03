import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import {
  handleNoShow,
  handleNoClose,
  handleReEngagement,
  sendClientCheckin,
} from "@/lib/email-assistant";
import type { EmailConversation } from "@/lib/email-assistant";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/email-assistant/post-call — Vercel cron: process post-call follow-ups
// Handles: no-show sequences, no-close nudges, 90-day re-engagement
export async function GET() {
  try {
    const now = new Date().toISOString();

    // Get all conversations with a due action
    const dueActions = await sql`
      SELECT * FROM email_assistant_conversations
      WHERE next_action_at IS NOT NULL
        AND next_action_at <= ${now}
        AND next_action_type IS NOT NULL
        AND stage NOT IN ('closed_won', 'dead', 'unsubscribed')
      ORDER BY next_action_at ASC
      LIMIT 20
    `;

    if (dueActions.length === 0) {
      return NextResponse.json({ processed: 0, message: "No due actions" });
    }

    console.log(`[email-assistant] Processing ${dueActions.length} post-call actions`);

    const results: Array<{ id: string; action: string; result: string }> = [];

    for (const row of dueActions) {
      const conv = row as unknown as EmailConversation;
      const actionType = row.next_action_type as string;

      try {
        switch (actionType) {
          // No-show sequence
          case "no_show_check":
            // Mark as no-show — in production, this would check if the call actually happened
            // For now, we manually mark calls as completed via the CRM
            // If still in "booked" stage, assume no-show
            if (conv.stage === "booked") {
              await handleNoShow({ ...conv, stage: "booked" });
              results.push({ id: conv.id, action: actionType, result: "no_show_started" });
            } else {
              // Call happened (stage was updated), clear the action
              await sql`
                UPDATE email_assistant_conversations SET
                  next_action_at = NULL, next_action_type = NULL, updated_at = NOW()
                WHERE id = ${conv.id}
              `;
              results.push({ id: conv.id, action: actionType, result: "call_happened" });
            }
            break;

          case "no_show_text_2":
            await handleNoShow({ ...conv, stage: "no_show_follow_1" });
            results.push({ id: conv.id, action: actionType, result: "sent" });
            break;

          case "no_show_email_3":
            await handleNoShow({ ...conv, stage: "no_show_follow_2" });
            results.push({ id: conv.id, action: actionType, result: "sent" });
            break;

          // No-close sequence
          case "no_close_text_1":
            await handleNoClose({ ...conv, stage: "no_close" });
            results.push({ id: conv.id, action: actionType, result: "sent" });
            break;

          case "no_close_text_2":
            await handleNoClose({ ...conv, stage: "no_close_follow_1" });
            results.push({ id: conv.id, action: actionType, result: "sent" });
            break;

          case "no_close_text_3":
            await handleNoClose({ ...conv, stage: "no_close_follow_2" });
            results.push({ id: conv.id, action: actionType, result: "sent" });
            break;

          case "no_close_text_4":
            await handleNoClose({ ...conv, stage: "no_close_follow_3" });
            results.push({ id: conv.id, action: actionType, result: "sent" });
            break;

          // 90-day re-engagement
          case "re_engagement_90d":
            await handleReEngagement(conv);
            results.push({ id: conv.id, action: actionType, result: "sent" });
            break;

          default:
            console.log(`[email-assistant] Unknown action type: ${actionType}`);
            results.push({ id: conv.id, action: actionType, result: "unknown" });
        }
      } catch (err) {
        console.error(`[email-assistant] Post-call error for ${conv.id} (${actionType}):`, err);
        results.push({ id: conv.id, action: actionType, result: "error" });
      }
    }

    // Also process due client check-ins (1 month, 6 month, 1 year)
    const dueCheckins = await sql`
      SELECT * FROM client_checkins
      WHERE status = 'pending' AND due_at <= ${now}
      ORDER BY due_at ASC
      LIMIT 10
    `;

    for (const checkin of dueCheckins) {
      try {
        await sendClientCheckin({
          id: checkin.id as string,
          contact_name: checkin.contact_name as string,
          business_name: checkin.business_name as string,
          contact_phone: checkin.contact_phone as string,
          checkin_type: checkin.checkin_type as string,
        });
        results.push({ id: checkin.id as string, action: `checkin_${checkin.checkin_type}`, result: "sent" });
      } catch (err) {
        console.error(`[email-assistant] Check-in error for ${checkin.contact_name}:`, err);
        results.push({ id: checkin.id as string, action: `checkin_${checkin.checkin_type}`, result: "error" });
      }
    }

    console.log(`[email-assistant] Post-call processed: ${results.length}`);
    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    console.error("[email-assistant] Post-call error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}

// POST /api/email-assistant/post-call — manual actions (mark call outcome)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, action, reason } = body;

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const convRows = await sql`
      SELECT * FROM email_assistant_conversations WHERE id = ${conversationId}
    `;
    if (convRows.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const conv = convRows[0] as unknown as EmailConversation;

    switch (action) {
      case "call_completed":
        // Call happened but no close
        await sql`
          UPDATE email_assistant_conversations SET
            stage = 'no_close', call_outcome = 'completed', crm_outcome = 'no_close',
            close_reason = ${reason || null},
            next_action_at = ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()},
            next_action_type = 'no_close_text_1',
            updated_at = NOW()
          WHERE id = ${conversationId}
        `;
        return NextResponse.json({ success: true, message: "Marked as no-close, follow-up scheduled" });

      case "closed_won": {
        const { handleClosedWon } = await import("@/lib/email-assistant");
        await handleClosedWon(conv);
        return NextResponse.json({ success: true, message: "Marked as closed won" });
      }

      case "closed_lost": {
        const { handleClosedLost } = await import("@/lib/email-assistant");
        await handleClosedLost(conv, reason);
        return NextResponse.json({ success: true, message: "Marked as closed lost, 90-day re-engagement scheduled" });
      }

      case "follow_up_booked": {
        // They booked a second call
        const { followUpTime } = body;
        if (!followUpTime) {
          return NextResponse.json({ error: "followUpTime required" }, { status: 400 });
        }
        await sql`
          UPDATE email_assistant_conversations SET
            stage = 'no_close', call_outcome = 'completed', close_outcome = 'follow_up_booked',
            close_reason = ${reason || null},
            follow_up_call_time = ${followUpTime},
            next_action_at = ${new Date(new Date(followUpTime).getTime() - 60 * 60000).toISOString()},
            next_action_type = 'follow_up_reminder_contact',
            updated_at = NOW()
          WHERE id = ${conversationId}
        `;

        // Send booking iMessage to Mike
        const ownerPhone = process.env.OWNER_PHONE;
        if (ownerPhone) {
          const { sendMessage } = await import("@/lib/loop/client");
          const callDate = new Date(followUpTime);
          const dayName = callDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" });
          const timeStr = callDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
          await sendMessage(ownerPhone,
            `Second call booked with ${conv.contact_name} from ${conv.business_name}. ${dayName} at ${timeStr} ET. They didn't close first time because ${reason || "unknown"}. ${conv.thread_summary || ""}`
          );
        }

        return NextResponse.json({ success: true, message: "Follow-up call booked" });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[email-assistant] Post-call action error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}
