import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com"];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { action } = await req.json();
    if (!["start", "pause", "stop"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be start, pause, or stop." }, { status: 400 });
    }

    if (action === "start") {
      // Check if there's already a running/paused session
      const existing = await sql`
        SELECT id, status FROM caller_sessions
        WHERE status IN ('running', 'paused')
        ORDER BY started_at DESC LIMIT 1
      `;

      if (existing.length > 0 && existing[0].status === "paused") {
        // Resume the paused session
        await sql`
          UPDATE caller_sessions SET status = 'running' WHERE id = ${existing[0].id}
        `;
        const updated = await sql`
          SELECT id, status, started_at, ended_at FROM caller_sessions WHERE id = ${existing[0].id}
        `;
        return NextResponse.json({ session: updated[0] });
      }

      if (existing.length > 0 && existing[0].status === "running") {
        return NextResponse.json({ error: "Session already running", session: existing[0] }, { status: 409 });
      }

      // Create new session
      const result = await sql`
        INSERT INTO caller_sessions (status, started_at)
        VALUES ('running', NOW())
        RETURNING id, status, started_at, ended_at
      `;
      return NextResponse.json({ session: result[0] });
    }

    if (action === "pause") {
      const result = await sql`
        UPDATE caller_sessions
        SET status = 'paused'
        WHERE status = 'running'
          AND id = (SELECT id FROM caller_sessions WHERE status = 'running' ORDER BY started_at DESC LIMIT 1)
        RETURNING id, status, started_at, ended_at
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: "No running session to pause" }, { status: 404 });
      }
      return NextResponse.json({ session: result[0] });
    }

    if (action === "stop") {
      const result = await sql`
        UPDATE caller_sessions
        SET status = 'stopped', ended_at = NOW()
        WHERE status IN ('running', 'paused')
          AND id = (SELECT id FROM caller_sessions WHERE status IN ('running', 'paused') ORDER BY started_at DESC LIMIT 1)
        RETURNING id, status, started_at, ended_at
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: "No active session to stop" }, { status: 404 });
      }
      return NextResponse.json({ session: result[0] });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[caller/command] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
