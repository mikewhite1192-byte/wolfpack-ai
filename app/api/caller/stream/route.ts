import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { validateCallerApiKey } from "@/lib/caller/android-auth";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

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

    const encoder = new TextEncoder();
    let cancelled = false;

    const stream = new ReadableStream({
      async start(controller) {
        let lastSessionStatus = "";
        let lastCallCount = 0;
        let lastDemoCount = 0;
        let lastCurrentLeadId = "";

        const poll = async () => {
          if (cancelled) return;

          try {
            // Session status
            const sessions = await sql`
              SELECT id, status, started_at, ended_at
              FROM caller_sessions ORDER BY started_at DESC LIMIT 1
            `;
            const session = sessions[0] || null;
            const sessionStatus = session?.status || "stopped";

            if (sessionStatus !== lastSessionStatus) {
              lastSessionStatus = sessionStatus;
              controller.enqueue(encoder.encode(`event: status.update\ndata: ${JSON.stringify({ session })}\n\n`));
            }

            // Stats
            const statsRows = await sql`
              SELECT
                COUNT(*)::int AS calls_made,
                COUNT(*) FILTER (WHERE outcome = 'pickup')::int AS pickups,
                COUNT(*) FILTER (WHERE outcome = 'voicemail')::int AS voicemails,
                COUNT(*) FILTER (WHERE outcome = 'not_interested')::int AS not_interested,
                COUNT(*) FILTER (WHERE outcome = 'demo_booked')::int AS demos_booked
              FROM caller_leads WHERE called_at >= CURRENT_DATE
            `;
            const stats = statsRows[0];
            const currentCallCount = stats?.calls_made || 0;
            const currentDemoCount = stats?.demos_booked || 0;

            if (currentCallCount !== lastCallCount) {
              lastCallCount = currentCallCount;
              controller.enqueue(encoder.encode(`event: stats.update\ndata: ${JSON.stringify(stats)}\n\n`));
            }

            // Current lead
            if (session && session.status === "running") {
              const current = await sql`
                SELECT id, business_name, contractor_type, city, call_started_at
                FROM caller_leads
                WHERE session_id = ${session.id} AND outcome IS NULL AND call_started_at IS NOT NULL
                ORDER BY call_started_at DESC LIMIT 1
              `;
              const leadId = current[0]?.id || "";
              if (leadId !== lastCurrentLeadId) {
                lastCurrentLeadId = leadId;
                if (leadId) {
                  controller.enqueue(encoder.encode(`event: call.started\ndata: ${JSON.stringify(current[0])}\n\n`));
                } else {
                  controller.enqueue(encoder.encode(`event: call.completed\ndata: {}\n\n`));
                }
              }
            }

            // New demo booked
            if (currentDemoCount > lastDemoCount && currentDemoCount > 0) {
              lastDemoCount = currentDemoCount;
              const latestDemo = await sql`
                SELECT id, business_name, contractor_type, city, demo_time
                FROM caller_leads WHERE outcome = 'demo_booked' AND called_at >= CURRENT_DATE
                ORDER BY called_at DESC LIMIT 1
              `;
              if (latestDemo[0]) {
                controller.enqueue(encoder.encode(`event: demo.booked\ndata: ${JSON.stringify(latestDemo[0])}\n\n`));
              }
            }
            lastDemoCount = currentDemoCount;
          } catch (err) {
            console.error("[caller/stream] poll error:", err);
          }

          if (!cancelled) {
            setTimeout(poll, 2000);
          }
        };

        poll();
      },
      cancel() {
        cancelled = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[caller/stream] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
