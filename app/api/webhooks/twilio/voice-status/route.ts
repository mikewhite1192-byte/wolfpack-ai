import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/webhooks/twilio/voice-status — call status updates
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const duration = formData.get("CallDuration") as string;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;

    console.log(`[voice-status] ${callSid}: ${callStatus} (${duration}s)`);

    // Update call record by matching phone numbers and recent timing
    if (callStatus === "completed" || callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
      const statusMap: Record<string, string> = {
        completed: "completed",
        "no-answer": "missed",
        busy: "missed",
        failed: "missed",
      };

      // Find the most recent call matching these numbers
      await sql`
        UPDATE calls SET
          status = ${statusMap[callStatus] || callStatus},
          duration_seconds = ${duration ? parseInt(duration) : null}
        WHERE id = (
          SELECT id FROM calls
          WHERE (from_number = ${from} OR to_number = ${to} OR from_number = ${to} OR to_number = ${from})
            AND created_at > NOW() - INTERVAL '1 hour'
          ORDER BY created_at DESC
          LIMIT 1
        )
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voice-status] Error:", err);
    return NextResponse.json({ ok: true });
  }
}
