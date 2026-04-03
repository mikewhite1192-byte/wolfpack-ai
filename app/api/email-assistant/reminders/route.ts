import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendPreCallReminder, sendClientCallReminder, handleFollowUpCall } from "@/lib/email-assistant";
import type { EmailConversation } from "@/lib/email-assistant";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/email-assistant/reminders — Vercel cron: send pre-call reminders
// Runs every 10 minutes, checks for calls happening in the next 30 minutes
export async function GET() {
  try {
    const now = new Date();
    const thirtyMinFromNow = new Date(now.getTime() + 35 * 60000); // 35 min buffer
    const twentyFiveMinFromNow = new Date(now.getTime() + 25 * 60000);

    // Find booked calls with reminder_30min due
    const dueReminders = await sql`
      SELECT * FROM email_assistant_conversations
      WHERE next_action_type = 'reminder_30min'
        AND call_time IS NOT NULL
        AND call_time >= ${twentyFiveMinFromNow.toISOString()}
        AND call_time <= ${thirtyMinFromNow.toISOString()}
    `;

    let sent = 0;

    for (const row of dueReminders) {
      const conv = row as unknown as EmailConversation;
      try {
        await sendPreCallReminder(conv);

        // Update: next action is to check for no-show (5 min after call time)
        const callTime = new Date(conv.call_time!);
        const noShowCheckTime = new Date(callTime.getTime() + 5 * 60000);

        await sql`
          UPDATE email_assistant_conversations SET
            next_action_at = ${noShowCheckTime.toISOString()},
            next_action_type = 'no_show_check',
            updated_at = NOW()
          WHERE id = ${conv.id}
        `;

        sent++;
      } catch (err) {
        console.error(`[email-assistant] Reminder error for ${conv.contact_name}:`, err);
      }
    }

    // Send 1-hour reminder to the contractor (client)
    const sixtyFiveMin = new Date(now.getTime() + 65 * 60000);
    const fiftyFiveMin = new Date(now.getTime() + 55 * 60000);

    const clientReminders = await sql`
      SELECT * FROM email_assistant_conversations
      WHERE stage = 'booked'
        AND call_time IS NOT NULL
        AND call_time >= ${fiftyFiveMin.toISOString()}
        AND call_time <= ${sixtyFiveMin.toISOString()}
    `;

    for (const row of clientReminders) {
      const conv = row as unknown as EmailConversation;
      try {
        await sendClientCallReminder(conv);
        sent++;
      } catch (err) {
        console.error(`[email-assistant] Client reminder error for ${conv.contact_name}:`, err);
      }
    }

    // Also check for follow-up call reminders (second calls)
    // Contact reminder: 1 hour before
    const sixtyFiveMinFromNow = new Date(now.getTime() + 65 * 60000);
    const fiftyFiveMinFromNow = new Date(now.getTime() + 55 * 60000);

    const followUpReminders = await sql`
      SELECT * FROM email_assistant_conversations
      WHERE follow_up_call_time IS NOT NULL
        AND follow_up_call_time >= ${fiftyFiveMinFromNow.toISOString()}
        AND follow_up_call_time <= ${sixtyFiveMinFromNow.toISOString()}
        AND stage NOT IN ('closed_won', 'closed_lost', 'dead')
    `;

    for (const row of followUpReminders) {
      const conv = row as unknown as EmailConversation;
      try {
        await handleFollowUpCall(conv);
        sent++;
      } catch (err) {
        console.error(`[email-assistant] Follow-up reminder error for ${conv.contact_name}:`, err);
      }
    }

    console.log(`[email-assistant] Sent ${sent} reminders`);
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[email-assistant] Reminders error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}
