import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { getGmailToken } from "@/lib/gmail";
import { createCalendarEvent } from "@/lib/calendar";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/calendar/book — book an appointment (public)
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const token = await getGmailToken(workspace.id);

    if (!token) {
      return NextResponse.json({ error: "Calendar not connected" }, { status: 401 });
    }

    const { name, email, phone, startTime, endTime, notes, duration, addGoogleMeet } = await req.json();

    if (!name || !startTime) {
      return NextResponse.json({ error: "name and startTime required" }, { status: 400 });
    }

    // Calculate end time if not provided
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + (duration || 30) * 60000);

    const bizName = (workspace.ai_config as Record<string, string>)?.businessName || workspace.name || "Meeting";

    // Create Google Calendar event
    const event = await createCalendarEvent(
      token,
      `${bizName} - ${name}`,
      `Name: ${name}\nEmail: ${email || "N/A"}\nPhone: ${phone || "N/A"}\n${notes ? `Notes: ${notes}` : ""}`,
      start.toISOString(),
      end.toISOString(),
      email || undefined,
      addGoogleMeet || false,
    );

    // Find or create contact in CRM
    let contact;
    if (phone || email) {
      const existing = await sql`
        SELECT * FROM contacts WHERE workspace_id = ${workspace.id}
          AND ((${phone || null}::text IS NOT NULL AND phone = ${phone || null})
            OR (${email || null}::text IS NOT NULL AND email = ${email || null}))
        LIMIT 1
      `;

      if (existing.length > 0) {
        contact = existing[0];
        // Update appointment
        await sql`UPDATE contacts SET appointment_at = ${start.toISOString()}, appointment_reminder_sent = false WHERE id = ${contact.id}`;
      } else {
        // Create new contact
        const firstName = name.split(" ")[0] || name;
        const lastName = name.split(" ").slice(1).join(" ") || null;
        const phoneFormatted = phone ? (phone.startsWith("+") ? phone : "+1" + phone.replace(/\D/g, "")) : null;

        contact = (await sql`
          INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, source, appointment_at, appointment_reminder_sent)
          VALUES (${workspace.id}, ${firstName}, ${lastName}, ${email || null}, ${phoneFormatted}, 'booking', ${start.toISOString()}, false)
          RETURNING *
        `)[0];

        // Create deal
        const firstStage = await sql`SELECT id FROM pipeline_stages WHERE workspace_id = ${workspace.id} ORDER BY position ASC LIMIT 1`;
        if (firstStage.length > 0) {
          await sql`INSERT INTO deals (workspace_id, contact_id, stage_id, title) VALUES (${workspace.id}, ${contact.id}, ${firstStage[0].id}, ${name + " - Booking"})`;
        }

        // Create conversation + queue AI follow-up
        if (phoneFormatted) {
          await sql`
            INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled, ai_stage)
            VALUES (${workspace.id}, ${contact.id}, 'sms', 'open', TRUE, 'booked')
          `;
        }
      }
    }

    return NextResponse.json({
      booked: true,
      eventId: event.id,
      start: start.toISOString(),
      end: end.toISOString(),
      contactId: contact?.id,
    });
  } catch (err) {
    console.error("[calendar-book] Error:", err);
    return NextResponse.json({ error: "Failed to book appointment" }, { status: 500 });
  }
}
