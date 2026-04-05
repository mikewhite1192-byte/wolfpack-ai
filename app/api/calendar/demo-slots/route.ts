import { NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/gmail";
import { getBusyTimes, getAvailableSlots } from "@/lib/calendar";

// GET /api/calendar/demo-slots?date=2026-03-28 — slots for demo booking (always uses info@thewolfpackco.com)
export async function GET(req: Request) {
  try {
    const refreshToken = process.env.DEMO_BOOKING_REFRESH_TOKEN;
    if (!refreshToken) {
      return NextResponse.json({ error: "Demo booking not configured" }, { status: 500 });
    }

    const token = await refreshAccessToken(refreshToken);

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "date parameter required" }, { status: 400 });
    }

    const timeMin = `${date}T00:00:00-04:00`;
    const timeMax = `${date}T23:59:59-04:00`;
    const busyTimes = await getBusyTimes(token, timeMin, timeMax);

    // Weekdays: 9am-9pm, Weekends: 10am-7pm
    const slots = getAvailableSlots(date, busyTimes, 30, 15, 9, 21, "America/New_York", 10, 19);

    return NextResponse.json({ date, slots, duration: 30 });
  } catch (err) {
    console.error("[demo-slots] Error:", err);
    return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });
  }
}
