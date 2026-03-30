import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/ai-agent/reminders — send appointment reminders
// Called by cron every 15 minutes
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find contacts with appointments in the next 2 hours that haven't been reminded
    const upcoming = await sql`
      SELECT c.*, conv.id as conv_id, conv.assigned_to as chat_id,
             w.name as workspace_name, w.ai_config
      FROM contacts c
      JOIN conversations conv ON conv.contact_id = c.id AND conv.channel = 'sms'
      JOIN workspaces w ON w.id = c.workspace_id
      WHERE c.appointment_at IS NOT NULL
        AND c.appointment_reminder_sent = false
        AND c.appointment_at > NOW()
        AND c.appointment_at <= NOW() + INTERVAL '2 hours'
    `;

    // Find contacts with appointments tomorrow (24h reminder)
    const tomorrow = await sql`
      SELECT c.*, conv.id as conv_id, conv.assigned_to as chat_id,
             w.name as workspace_name, w.ai_config
      FROM contacts c
      JOIN conversations conv ON conv.contact_id = c.id AND conv.channel = 'sms'
      JOIN workspaces w ON w.id = c.workspace_id
      WHERE c.appointment_at IS NOT NULL
        AND c.appointment_reminder_sent = false
        AND c.appointment_at > NOW() + INTERVAL '23 hours'
        AND c.appointment_at <= NOW() + INTERVAL '25 hours'
    `;

    let sent = 0;

    // Send 24-hour reminders
    for (const contact of tomorrow) {
      const chatId = contact.phone;
      if (!chatId) continue;

      const name = contact.first_name || "there";
      const apptDate = new Date(contact.appointment_at);
      const dayStr = apptDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const timeStr = apptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const biz = contact.workspace_name || "us";

      const reminder = `Hey ${name}! Just a reminder about your appointment with ${biz} tomorrow (${dayStr}) at ${timeStr}. Looking forward to it! Let me know if you need to reschedule.`;

      try {
        const result = await sendMessage(chatId, reminder);
        await sql`
          INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid)
          VALUES (${contact.conv_id}, ${contact.workspace_id}, 'outbound', 'sms', '', ${contact.phone || ''}, ${reminder}, 'sent', 'ai', ${result.message_id})
        `;
        await sql`UPDATE conversations SET last_message_at = NOW() WHERE id = ${contact.conv_id}`;
        sent++;
        console.log(`[reminders] 24h reminder sent to ${name} (${contact.phone})`);
      } catch (err) {
        console.error(`[reminders] Failed to send 24h reminder:`, err);
      }
    }

    // Send 2-hour reminders
    for (const contact of upcoming) {
      const chatId = contact.phone;
      if (!chatId) continue;

      const name = contact.first_name || "there";
      const apptDate = new Date(contact.appointment_at);
      const timeStr = apptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const biz = contact.workspace_name || "us";

      const reminder = `Hi ${name}! Quick reminder — your appointment with ${biz} is coming up today at ${timeStr}. See you soon!`;

      try {
        const result = await sendMessage(chatId, reminder);
        await sql`
          INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid)
          VALUES (${contact.conv_id}, ${contact.workspace_id}, 'outbound', 'sms', '', ${contact.phone || ''}, ${reminder}, 'sent', 'ai', ${result.message_id})
        `;
        await sql`UPDATE conversations SET last_message_at = NOW() WHERE id = ${contact.conv_id}`;
        // Mark reminder as sent
        await sql`UPDATE contacts SET appointment_reminder_sent = true WHERE id = ${contact.id}`;
        sent++;
        console.log(`[reminders] 2h reminder sent to ${name} (${contact.phone})`);
      } catch (err) {
        console.error(`[reminders] Failed to send 2h reminder:`, err);
      }
    }

    return NextResponse.json({ reminders_sent: sent, checked_24h: tomorrow.length, checked_2h: upcoming.length });
  } catch (err) {
    console.error("[reminders] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
