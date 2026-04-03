import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { processInboxReply } from "@/lib/email-assistant";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/email-assistant/process — Vercel cron: process unhandled cold email replies
export async function GET() {
  return handleProcess();
}

// POST /api/email-assistant/process — manual trigger
export async function POST() {
  return handleProcess();
}

async function handleProcess() {
  try {
    // Get unprocessed cold replies that have an outreach contact match
    const unprocessed = await sql`
      SELECT ci.*
      FROM campaign_inbox ci
      WHERE ci.ai_processed = FALSE
        AND ci.email_category = 'cold_reply'
        AND ci.outreach_contact_id IS NOT NULL
      ORDER BY ci.received_at ASC
      LIMIT 10
    `;

    if (unprocessed.length === 0) {
      return NextResponse.json({ processed: 0, message: "No new replies" });
    }

    console.log(`[email-assistant] Processing ${unprocessed.length} new replies`);

    const results: Array<{ email: string; action: string }> = [];

    for (const reply of unprocessed) {
      try {
        const result = await processInboxReply({
          id: reply.id as string,
          from_email: reply.from_email as string,
          from_name: reply.from_name as string,
          to_address: reply.to_address as string,
          subject: reply.subject as string,
          body: reply.body as string,
          outreach_contact_id: reply.outreach_contact_id as string,
          message_id: reply.message_id as string | null,
          in_reply_to: reply.in_reply_to as string | null,
        });

        results.push({ email: reply.from_email as string, action: result.action });
        console.log(`[email-assistant] ${reply.from_email}: ${result.action}`);
      } catch (err) {
        console.error(`[email-assistant] Error processing reply from ${reply.from_email}:`, err);
        // Mark as processed to avoid infinite retry loops
        await sql`UPDATE campaign_inbox SET ai_processed = TRUE WHERE id = ${reply.id}`;
        results.push({ email: reply.from_email as string, action: "error" });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    console.error("[email-assistant] Process error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}
