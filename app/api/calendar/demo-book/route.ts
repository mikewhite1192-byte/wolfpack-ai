import { NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/gmail";
import { createCalendarEvent } from "@/lib/calendar";

// POST /api/calendar/demo-book — book a demo (always on info@thewolfpackco.com calendar)
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
