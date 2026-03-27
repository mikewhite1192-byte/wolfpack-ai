import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/webhooks/twilio/recording — recording ready callback
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const recordingUrl = formData.get("RecordingUrl") as string;
    const recordingSid = formData.get("RecordingSid") as string;
    const callSid = formData.get("CallSid") as string;
    const duration = formData.get("RecordingDuration") as string;

    console.log(`[recording] ${recordingSid}: ${recordingUrl} (${duration}s)`);

    if (recordingUrl) {
      // Save recording URL to the most recent matching call
      await sql`
        UPDATE calls SET
          recording_url = ${recordingUrl + ".mp3"}
        WHERE id = (
          SELECT id FROM calls
          WHERE recording_url IS NULL
            AND created_at > NOW() - INTERVAL '2 hours'
          ORDER BY created_at DESC
          LIMIT 1
        )
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[recording] Error:", err);
    return NextResponse.json({ ok: true });
  }
}
