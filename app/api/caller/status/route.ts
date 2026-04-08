import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com"];

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Latest session
    const sessions = await sql`
      SELECT id, status, started_at, ended_at
      FROM caller_sessions
      ORDER BY started_at DESC LIMIT 1
    `;
    const session = sessions.length > 0 ? sessions[0] : null;

    // Today's stats
    const statsRows = await sql`
      SELECT
        COUNT(*)::int AS calls_made,
        COUNT(*) FILTER (WHERE outcome = 'pickup')::int AS pickups,
        COUNT(*) FILTER (WHERE outcome = 'voicemail')::int AS voicemails,
        COUNT(*) FILTER (WHERE outcome = 'not_interested')::int AS not_interested,
        COUNT(*) FILTER (WHERE outcome = 'demo_booked')::int AS demos_booked
      FROM caller_leads
      WHERE called_at >= CURRENT_DATE
    `;
    const stats = statsRows[0] || {
      calls_made: 0,
      pickups: 0,
      voicemails: 0,
      not_interested: 0,
      demos_booked: 0,
    };

    // Currently calling lead (if session is running)
    let currentLead = null;
    if (session && session.status === "running") {
      const current = await sql`
        SELECT id, business_name, contractor_type, city, phone, call_started_at
        FROM caller_leads
        WHERE session_id = ${session.id}
          AND outcome IS NULL
          AND call_started_at IS NOT NULL
        ORDER BY call_started_at DESC LIMIT 1
      `;
      currentLead = current.length > 0 ? current[0] : null;
    }

    // Today's booked demos
    const demos = await sql`
      SELECT id, business_name, contractor_type, city, demo_time, called_at
      FROM caller_leads
      WHERE outcome = 'demo_booked'
        AND called_at >= CURRENT_DATE
      ORDER BY called_at DESC
    `;

    // Today's call log
    const callLog = await sql`
      SELECT id, business_name, phone, outcome, duration_seconds, called_at, contractor_type, city
      FROM caller_leads
      WHERE called_at >= CURRENT_DATE
      ORDER BY called_at DESC
      LIMIT 100
    `;

    // Pending leads count
    const pendingRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM caller_leads
      WHERE outcome IS NULL AND called_at IS NULL
    `;
    const pendingCount = pendingRows[0]?.count || 0;

    return NextResponse.json({
      session,
      stats,
      currentLead,
      demos,
      callLog,
      pendingCount,
    });
  } catch (err) {
    console.error("[caller/status] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
