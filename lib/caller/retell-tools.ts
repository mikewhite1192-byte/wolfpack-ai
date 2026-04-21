// Retell AI tool functions — called mid-conversation by the AI caller
import { neon } from "@neondatabase/serverless";
import {
  getBusyTimes,
  getAvailableSlots,
  createCalendarEvent,
  getTzOffset,
  type TimeSlot,
} from "@/lib/calendar";
import { refreshAccessToken } from "@/lib/gmail";

const sql = neon(process.env.DATABASE_URL!);

// ── Types ───────────────────────────────────────────────────────────
export type CallerOutcome =
  | "demo_booked"
  | "not_interested"
  | "callback_requested"
  | "hung_up"
  | "voicemail"
  | "no_answer";

export interface CallerLead {
  id: string;
  phone: string;
  business_name: string | null;
  contact_name: string | null;
  contractor_type: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  review_count: number;
  status: string;
  retell_call_id: string | null;
  direction: string;
  duration_seconds: number | null;
  transcript: string | null;
  demo_time: string | null;
  demo_calendar_event_id: string | null;
  followup_sent: boolean;
  source: string | null;
  outreach_contact_id: string | null;
  crm_contact_id: string | null;
}

// ── Calendar Token Helper ───────────────────────────────────────────
async function getCalendarToken(): Promise<string> {
  const ownerEmail = process.env.OWNER_EMAIL || "info@thewolfpackco.com";
  const workspaces = await sql`
    SELECT id, gmail_refresh_token FROM workspaces
    WHERE gmail_connected = TRUE AND gmail_refresh_token IS NOT NULL
      AND (owner_email = ${ownerEmail} OR gmail_email = ${ownerEmail})
    LIMIT 1
  `;
  if (workspaces.length === 0) {
    throw new Error("No workspace with Gmail connected for calendar access");
  }
  return refreshAccessToken(workspaces[0].gmail_refresh_token as string);
}

// ── check_availability ──────────────────────────────────────────────
// Returns next 3 available 15-min slots for the AI to offer
export async function check_availability(): Promise<{
  slots: Array<{ start: string; end: string; display: string; dayDisplay: string }>;
}> {
  console.log("[caller] Checking calendar availability");

  const token = await getCalendarToken();
  const allSlots: (TimeSlot & { dayDisplay: string })[] = [];
  const now = new Date();

  for (let d = 0; d < 7 && allSlots.length < 3; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];

    const offset = getTzOffset("America/New_York", new Date(`${dateStr}T12:00:00Z`));
    const busyTimes = await getBusyTimes(
      token,
      `${dateStr}T00:00:00${offset}`,
      `${dateStr}T23:59:59${offset}`,
    );

    const daySlots = getAvailableSlots(dateStr, busyTimes, 15, 15, 9, 17, "America/New_York");
    const dayName = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });

    for (const s of daySlots) {
      if (allSlots.length >= 3) break;
      allSlots.push({ ...s, dayDisplay: dayName });
    }
  }

  console.log(`[caller] Found ${allSlots.length} available slots`);
  return { slots: allSlots };
}

// ── book_demo ───────────────────────────────────────────────────────
// Book a 15-min demo on Mike's calendar
export async function book_demo(
  proposedTime: string,
  leadId: string,
): Promise<{
  success: boolean;
  confirmedTime?: string;
  dayDisplay?: string;
  timeDisplay?: string;
  error?: string;
}> {
  console.log(`[caller] Booking demo for lead ${leadId} at ${proposedTime}`);

  try {
    const token = await getCalendarToken();

    // Parse the proposed time — could be ISO string or a slot start time
    const startDate = new Date(proposedTime);
    if (isNaN(startDate.getTime())) {
      return { success: false, error: "Could not parse proposed time" };
    }

    const endDate = new Date(startDate.getTime() + 15 * 60000);

    // Get lead info for the event title
    const leads = await sql`SELECT * FROM caller_leads WHERE id = ${leadId}`;
    if (leads.length === 0) {
      return { success: false, error: "Lead not found" };
    }
    const lead = leads[0] as unknown as CallerLead;

    const contactName = lead.contact_name || "Contractor";
    const businessName = lead.business_name || contactName;
    const contractorType = lead.contractor_type || "Contractor";
    const city = lead.city || "";

    const title = `Demo — ${businessName} (${contractorType}, ${city})`.replace(/ \(, \)/, "");
    const description = [
      `15-min demo with ${contactName}`,
      lead.business_name ? `Business: ${lead.business_name}` : null,
      lead.contractor_type ? `Type: ${lead.contractor_type}` : null,
      lead.city ? `City: ${lead.city}` : null,
      `Phone: ${lead.phone}`,
      lead.review_count ? `Google Reviews: ${lead.review_count}` : null,
      "",
      "Booked via AI Cold Caller",
    ].filter(Boolean).join("\n");

    const event = await createCalendarEvent(
      token,
      title,
      description,
      startDate.toISOString(),
      endDate.toISOString(),
      lead.email || undefined,
      false, // no Google Meet — phone call
    );

    const eventAny = event as unknown as Record<string, unknown>;
    const eventId = eventAny.id as string;

    // Update lead record — prod schema has no demo_calendar_event_id / updated_at
    await sql`
      UPDATE caller_leads SET
        status = 'demo_booked',
        outcome = 'demo_booked',
        demo_time = ${startDate.toISOString()}
      WHERE id = ${leadId}
    `;
    void eventId;

    const dayDisplay = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });
    const timeDisplay = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });

    console.log(`[caller] Demo booked: ${dayDisplay} at ${timeDisplay}`);

    return {
      success: true,
      confirmedTime: startDate.toISOString(),
      dayDisplay,
      timeDisplay,
    };
  } catch (err) {
    console.error("[caller] book_demo error:", err);
    return { success: false, error: "Failed to book demo" };
  }
}

// ── signal_outcome ──────────────────────────────────────────────────
// Called by Retell when the conversation outcome is clear
export async function signal_outcome(
  leadId: string,
  result: CallerOutcome,
  demoTime?: string,
): Promise<{ acknowledged: boolean }> {
  console.log(`[caller] Outcome for ${leadId}: ${result}`);

  await sql`
    UPDATE caller_leads SET
      status = ${result},
      outcome = ${result},
      demo_time = ${demoTime ? new Date(demoTime).toISOString() : null}
    WHERE id = ${leadId}
  `;

  return { acknowledged: true };
}
