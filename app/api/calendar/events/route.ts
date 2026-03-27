import { NextResponse } from "next/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { getGmailToken } from "@/lib/gmail";
import { getUpcomingEvents } from "@/lib/calendar";

// GET /api/calendar/events — list upcoming calendar events
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();
    const token = await getGmailToken(workspace.id);

    if (!token) {
      return NextResponse.json({ error: "Calendar not connected", connected: false }, { status: 401 });
    }

    const events = await getUpcomingEvents(token, 30);
    return NextResponse.json({ events, connected: true });
  } catch (err) {
    console.error("[calendar-events] Error:", err);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
