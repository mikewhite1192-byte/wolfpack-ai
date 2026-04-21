import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { validateCallerApiKey } from "@/lib/caller/android-auth";
import { getTzOffset } from "@/lib/calendar";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// The caller runs on Detroit/ET business hours, so "today" in the
// dashboard means the ET calendar day — not UTC (the default on Vercel).
// Without this, opening the dashboard after 8pm ET flips "today" forward
// into the next UTC day and zeros out the stats.
const CALLER_TZ = "America/Detroit";

function ymdInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

// Midnight at the start of the given YYYY-MM-DD in the target tz, as a
// UTC instant. DST-safe: getTzOffset resolves the offset for that date.
function zonedMidnight(ymd: string, tz: string): Date {
  const offset = getTzOffset(tz, new Date(`${ymd}T12:00:00Z`));
  return new Date(`${ymd}T00:00:00${offset}`);
}

// Shift a YYYY-MM-DD by N calendar days (no time-of-day, so DST can't shift it).
function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    // Accept either Clerk session (web) or API key (Android)
    const isAndroid = validateCallerApiKey(request);
    if (!isAndroid) {
      const { userId } = await auth();
      if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

      const user = await currentUser();
      const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
      if (!ADMIN_EMAILS.includes(email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Latest session
    const sessions = await sql`
      SELECT id, status, started_at, ended_at
      FROM caller_sessions
      ORDER BY started_at DESC LIMIT 1
    `;
    const session = sessions.length > 0 ? sessions[0] : null;

    // Date-range filter for stats / callLog / demos.
    //   range=today (default) | yesterday | 7d | 30d | all | custom
    //   when range=custom, callers pass from=YYYY-MM-DD&to=YYYY-MM-DD
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "today";
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const nowYmd = ymdInTz(new Date(), CALLER_TZ);
    const today = zonedMidnight(nowYmd, CALLER_TZ);

    let fromDate: Date | null;
    let toDate: Date | null = null;
    switch (range) {
      case "today":     fromDate = today; break;
      case "yesterday": fromDate = zonedMidnight(addDaysYmd(nowYmd, -1), CALLER_TZ); toDate = today; break;
      case "7d":        fromDate = zonedMidnight(addDaysYmd(nowYmd, -7), CALLER_TZ); break;
      case "30d":       fromDate = zonedMidnight(addDaysYmd(nowYmd, -30), CALLER_TZ); break;
      case "all":       fromDate = null; break;
      case "custom":
        fromDate = fromParam ? zonedMidnight(fromParam, CALLER_TZ) : today;
        if (toParam) toDate = zonedMidnight(addDaysYmd(toParam, 1), CALLER_TZ);
        break;
      default:          fromDate = today;
    }

    // Stats. "Pickup" = contractor actually answered, which means any
    // outcome except voicemail/no_answer. demo_booked, not_interested,
    // callback_requested, and hung_up all count as conversations made.
    const statsRows =
      fromDate && toDate
        ? await sql`
            SELECT
              COUNT(*)::int AS calls_made,
              COUNT(*) FILTER (WHERE outcome IN ('demo_booked','not_interested','callback_requested','hung_up'))::int AS pickups,
              COUNT(*) FILTER (WHERE outcome = 'voicemail')::int AS voicemails,
              COUNT(*) FILTER (WHERE outcome = 'not_interested')::int AS not_interested,
              COUNT(*) FILTER (WHERE outcome = 'demo_booked')::int AS demos_booked
            FROM caller_leads
            WHERE called_at >= ${fromDate.toISOString()} AND called_at < ${toDate.toISOString()}`
        : fromDate
        ? await sql`
            SELECT
              COUNT(*)::int AS calls_made,
              COUNT(*) FILTER (WHERE outcome IN ('demo_booked','not_interested','callback_requested','hung_up'))::int AS pickups,
              COUNT(*) FILTER (WHERE outcome = 'voicemail')::int AS voicemails,
              COUNT(*) FILTER (WHERE outcome = 'not_interested')::int AS not_interested,
              COUNT(*) FILTER (WHERE outcome = 'demo_booked')::int AS demos_booked
            FROM caller_leads
            WHERE called_at >= ${fromDate.toISOString()}`
        : await sql`
            SELECT
              COUNT(*)::int AS calls_made,
              COUNT(*) FILTER (WHERE outcome IN ('demo_booked','not_interested','callback_requested','hung_up'))::int AS pickups,
              COUNT(*) FILTER (WHERE outcome = 'voicemail')::int AS voicemails,
              COUNT(*) FILTER (WHERE outcome = 'not_interested')::int AS not_interested,
              COUNT(*) FILTER (WHERE outcome = 'demo_booked')::int AS demos_booked
            FROM caller_leads
            WHERE called_at IS NOT NULL`;

    const stats = statsRows[0] || {
      calls_made: 0,
      pickups: 0,
      voicemails: 0,
      not_interested: 0,
      demos_booked: 0,
    };

    // Currently calling lead (if session is running). called_at is exposed
    // as call_started_at too so the dashboard's live call timer can bind to
    // a consistent field name.
    // Only treat a row as "currently calling" if it was dialed within the
    // last 5 minutes. Otherwise it's a stuck row from a call whose end
    // webhook never arrived, and the dashboard's live timer would run
    // indefinitely (we saw 128+ min). Retell calls should never take >5 min.
    let currentLead = null;
    if (session && session.status === "running") {
      const current = await sql`
        SELECT id, business_name, contractor_type, city, phone,
               called_at, called_at AS call_started_at
        FROM caller_leads
        WHERE status = 'calling'
          AND called_at > NOW() - INTERVAL '5 minutes'
        ORDER BY called_at DESC LIMIT 1
      `;
      currentLead = current.length > 0 ? current[0] : null;
    }

    // Next lead in the queue — shown on the dashboard while waiting
    // between calls so the user sees who's coming up. Mirrors the ordering
    // used by getNextLead so the preview matches what actually gets dialed.
    const upNextRows = await sql`
      SELECT id, business_name, contractor_type, city, phone
      FROM caller_leads
      WHERE status = 'pending'
        AND phone NOT IN (SELECT phone FROM caller_dnc)
      ORDER BY created_at ASC
      LIMIT 1
    `;
    const upNext = upNextRows.length > 0 ? upNextRows[0] : null;

    // Booked demos in selected range
    const demos =
      fromDate && toDate
        ? await sql`
            SELECT id, business_name, contractor_type, city, demo_time, called_at
            FROM caller_leads
            WHERE outcome = 'demo_booked'
              AND called_at >= ${fromDate.toISOString()}
              AND called_at < ${toDate.toISOString()}
            ORDER BY called_at DESC`
        : fromDate
        ? await sql`
            SELECT id, business_name, contractor_type, city, demo_time, called_at
            FROM caller_leads
            WHERE outcome = 'demo_booked'
              AND called_at >= ${fromDate.toISOString()}
            ORDER BY called_at DESC`
        : await sql`
            SELECT id, business_name, contractor_type, city, demo_time, called_at
            FROM caller_leads
            WHERE outcome = 'demo_booked'
              AND called_at IS NOT NULL
            ORDER BY called_at DESC`;

    // Call log in selected range
    const callLog =
      fromDate && toDate
        ? await sql`
            SELECT id, business_name, phone, outcome, call_duration_s AS duration_seconds, called_at, contractor_type, city
            FROM caller_leads
            WHERE called_at >= ${fromDate.toISOString()}
              AND called_at < ${toDate.toISOString()}
            ORDER BY called_at DESC
            LIMIT 100`
        : fromDate
        ? await sql`
            SELECT id, business_name, phone, outcome, call_duration_s AS duration_seconds, called_at, contractor_type, city
            FROM caller_leads
            WHERE called_at >= ${fromDate.toISOString()}
            ORDER BY called_at DESC
            LIMIT 100`
        : await sql`
            SELECT id, business_name, phone, outcome, call_duration_s AS duration_seconds, called_at, contractor_type, city
            FROM caller_leads
            WHERE called_at IS NOT NULL
            ORDER BY called_at DESC
            LIMIT 100`;

    // Pending leads count
    const pendingRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM caller_leads
      WHERE status = 'pending'
    `;
    const pendingCount = pendingRows[0]?.count || 0;

    return NextResponse.json({
      session,
      stats,
      currentLead,
      upNext,
      demos,
      callLog,
      pendingCount,
    });
  } catch (err) {
    console.error("[caller/status] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
