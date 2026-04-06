import { getGmailToken, gmailFetch } from "./gmail";

export interface TimeSlot {
  start: string; // ISO
  end: string;   // ISO
  display: string; // "10:00 AM"
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
  status: string;
}

// Fetch busy times from Google Calendar for a given date range
export async function getBusyTimes(token: string, timeMin: string, timeMax: string): Promise<Array<{ start: string; end: string }>> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  });
  const data = await res.json();
  return data.calendars?.primary?.busy || [];
}

// Get available slots for a given date
export function getAvailableSlots(
  date: string, // YYYY-MM-DD
  busyTimes: Array<{ start: string; end: string }>,
  durationMinutes: number = 30,
  bufferMinutes: number = 15,
  startHour: number = 9,
  endHour: number = 21,
  timezone: string = "America/New_York",
  weekendStartHour?: number,
  weekendEndHour?: number,
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  // Calculate timezone offset dynamically (handles EST/EDT automatically)
  function getTzOffset(tz: string, refDate: Date): string {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(refDate);
      const offsetPart = parts.find(p => p.type === "timeZoneName");
      if (offsetPart?.value) {
        const match = offsetPart.value.match(/GMT([+-]\d+)/);
        if (match) {
          const hours = parseInt(match[1]);
          return `${hours >= 0 ? "+" : ""}${String(hours).padStart(2, "0")}:00`;
        }
      }
    } catch { /* fallback */ }
    return "-05:00"; // safe fallback to EST
  }

  const refDate = new Date(`${date}T12:00:00Z`);
  const tzOffset = getTzOffset(timezone, refDate);

  const dayCheck = new Date(`${date}T12:00:00${tzOffset}`);
  const dayOfWeek = dayCheck.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Use weekend hours if provided, otherwise use default hours
  const actualStart = isWeekend && weekendStartHour !== undefined ? weekendStartHour : startHour;
  const actualEnd = isWeekend && weekendEndHour !== undefined ? weekendEndHour : endHour;

  const dayStart = new Date(`${date}T${String(actualStart).padStart(2, "0")}:00:00${tzOffset}`);
  const dayEnd = new Date(`${date}T${String(actualEnd).padStart(2, "0")}:00:00${tzOffset}`);

  // Skip past times if today
  const now = new Date();
  let current = new Date(dayStart);
  if (current < now) {
    // Round up to next slot
    current = new Date(now);
    current.setMinutes(Math.ceil(current.getMinutes() / 15) * 15, 0, 0);
  }

  while (current.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
    const slotStart = current.getTime();
    const slotEnd = slotStart + durationMinutes * 60000;

    // Check if slot overlaps with any busy time
    const isBusy = busyTimes.some(b => {
      const busyStart = new Date(b.start).getTime();
      const busyEnd = new Date(b.end).getTime();
      return slotStart < busyEnd && slotEnd > busyStart;
    });

    if (!isBusy) {
      const startDate = new Date(slotStart);
      slots.push({
        start: startDate.toISOString(),
        end: new Date(slotEnd).toISOString(),
        display: startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: timezone,
        }),
      });
    }

    // Move to next slot (duration + buffer)
    current = new Date(current.getTime() + (durationMinutes + bufferMinutes) * 60000);
  }

  return slots;
}

// Create a Google Calendar event
export async function createCalendarEvent(
  token: string,
  summary: string,
  description: string,
  startTime: string,
  endTime: string,
  attendeeEmail?: string,
  addGoogleMeet?: boolean,
): Promise<CalendarEvent> {
  const event: Record<string, unknown> = {
    summary,
    description,
    start: { dateTime: startTime, timeZone: "America/New_York" },
    end: { dateTime: endTime, timeZone: "America/New_York" },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 60 },
        { method: "popup", minutes: 15 },
      ],
    },
  };

  if (attendeeEmail) {
    event.attendees = [{ email: attendeeEmail }];
    event.sendUpdates = "all";
  }

  if (addGoogleMeet) {
    event.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const calUrl = addGoogleMeet
    ? "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1"
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  const res = await fetch(calUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  return res.json();
}

// Update/reschedule a Google Calendar event
export async function updateCalendarEvent(
  token: string,
  eventId: string,
  updates: {
    startTime?: string;
    endTime?: string;
    summary?: string;
    description?: string;
    attendeeEmail?: string;
  },
): Promise<CalendarEvent> {
  const event: Record<string, unknown> = {};

  if (updates.startTime) event.start = { dateTime: updates.startTime, timeZone: "America/New_York" };
  if (updates.endTime) event.end = { dateTime: updates.endTime, timeZone: "America/New_York" };
  if (updates.summary) event.summary = updates.summary;
  if (updates.description) event.description = updates.description;
  if (updates.attendeeEmail) {
    event.attendees = [{ email: updates.attendeeEmail }];
    event.sendUpdates = "all";
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  return res.json();
}

// Cancel/delete a Google Calendar event
export async function cancelCalendarEvent(
  token: string,
  eventId: string,
): Promise<void> {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// List upcoming events
export async function getUpcomingEvents(token: string, maxResults: number = 20): Promise<CalendarEvent[]> {
  const now = new Date().toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();

  return (data.items || []).map((e: Record<string, unknown>) => ({
    id: e.id,
    summary: e.summary || "(No title)",
    start: (e.start as Record<string, string>)?.dateTime || (e.start as Record<string, string>)?.date || "",
    end: (e.end as Record<string, string>)?.dateTime || (e.end as Record<string, string>)?.date || "",
    attendees: ((e.attendees as Array<{ email: string }>) || []).map(a => a.email),
    description: e.description || "",
    status: (e.status as string) || "confirmed",
  }));
}
