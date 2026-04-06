import { NextResponse } from "next/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { getGmailToken } from "@/lib/gmail";
import { getBusyTimes, getAvailableSlots, getTzOffset } from "@/lib/calendar";

// GET /api/calendar/slots?date=2026-03-28 — get available time slots (public)
export async function GET(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const token = await getGmailToken(workspace.id);

    if (!token) {
      return NextResponse.json({ error: "Calendar not connected" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const duration = parseInt(searchParams.get("duration") || "30");

    if (!date) {
      return NextResponse.json({ error: "date parameter required (YYYY-MM-DD)" }, { status: 400 });
    }

    // Get busy times for the requested date (DST-aware)
    const tz = (workspace.timezone as string) || "America/New_York";
    const offset = getTzOffset(tz, new Date(`${date}T12:00:00Z`));
    const timeMin = `${date}T00:00:00${offset}`;
    const timeMax = `${date}T23:59:59${offset}`;
    const busyTimes = await getBusyTimes(token, timeMin, timeMax);

    // Calculate available slots
    const config = workspace.ai_config as Record<string, unknown> || {};
    const startHour = (config.calendarStartHour as number) || 9;
    const endHour = (config.calendarEndHour as number) || 17;
    const buffer = (config.calendarBuffer as number) || 15;

    const slots = getAvailableSlots(date, busyTimes, duration, buffer, startHour, endHour);

    return NextResponse.json({ date, slots, duration });
  } catch (err) {
    console.error("[calendar-slots] Error:", err);
    return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });
  }
}
