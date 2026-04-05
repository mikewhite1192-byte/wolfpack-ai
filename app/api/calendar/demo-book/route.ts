import { NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/gmail";
import { createCalendarEvent } from "@/lib/calendar";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/calendar/demo-book — book a demo (always on info@thewolfpackco.com calendar)
// Also creates a contact + deal in the owner's pipeline
export async function POST(req: Request) {
  try {
    const refreshToken = process.env.DEMO_BOOKING_REFRESH_TOKEN;
    if (!refreshToken) {
      return NextResponse.json({ error: "Demo booking not configured" }, { status: 500 });
    }

    const token = await refreshAccessToken(refreshToken);

    const { name, email, phone, startTime, endTime, notes } = await req.json();

    if (!name || !startTime) {
      return NextResponse.json({ error: "name and startTime required" }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + 30 * 60000);

    const event = await createCalendarEvent(
      token,
      `Wolf Pack AI Demo - ${name}`,
      `Name: ${name}\nEmail: ${email || "N/A"}\nPhone: ${phone || "N/A"}\n${notes ? `Notes: ${notes}` : ""}`,
      start.toISOString(),
      end.toISOString(),
      email || undefined,
      true, // always add Google Meet
    );

    // ── Create contact + deal in owner's pipeline ──
    try {
      // Find the owner workspace (info@thewolfpackco.com)
      const ws = await sql`SELECT id FROM workspaces WHERE owner_email = 'info@thewolfpackco.com' OR name ILIKE '%wolf%' LIMIT 1`;
      if (ws.length > 0) {
        const workspaceId = ws[0].id;
        const firstName = name.split(" ")[0] || name;
        const lastName = name.split(" ").slice(1).join(" ") || null;
        const cleanPhone = phone ? (phone.replace(/\D/g, "").length === 10 ? "+1" + phone.replace(/\D/g, "") : "+" + phone.replace(/\D/g, "")) : null;

        // Check if contact already exists
        const existing = await sql`
          SELECT id FROM contacts WHERE workspace_id = ${workspaceId}
          AND ((${cleanPhone}::text IS NOT NULL AND phone = ${cleanPhone}) OR (${email}::text IS NOT NULL AND email = ${email}))
          LIMIT 1
        `;

        let contactId: string;
        if (existing.length > 0) {
          contactId = existing[0].id as string;
        } else {
          const contact = await sql`
            INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, source, source_detail)
            VALUES (${workspaceId}, ${firstName}, ${lastName}, ${email || null}, ${cleanPhone}, 'landing_page', 'Book a Demo')
            RETURNING id
          `;
          contactId = contact[0].id as string;

          // Create deal in first pipeline stage
          const firstStage = await sql`SELECT id FROM pipeline_stages WHERE workspace_id = ${workspaceId} ORDER BY position ASC LIMIT 1`;
          if (firstStage.length > 0) {
            await sql`
              INSERT INTO deals (workspace_id, contact_id, stage_id, title)
              VALUES (${workspaceId}, ${contactId}, ${firstStage[0].id}, ${`Demo - ${name}`})
            `;
          }
        }

        // Log activity
        await sql`
          INSERT INTO deal_activity (workspace_id, contact_id, action, details)
          VALUES (${workspaceId}, ${contactId}, 'appointment_booked', ${JSON.stringify({ source: "Book a Demo page", time: start.toISOString() })}::jsonb)
        `;
      }
    } catch (pipelineErr) {
      console.error("[demo-book] Pipeline insert error (non-fatal):", pipelineErr);
    }

    return NextResponse.json({
      booked: true,
      eventId: event.id,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  } catch (err) {
    console.error("[demo-book] Error:", err);
    return NextResponse.json({ error: "Failed to book" }, { status: 500 });
  }
}
