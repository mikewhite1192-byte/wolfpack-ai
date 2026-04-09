import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { pollUpworkRSS } from "@/lib/upwork/feed";
import { scoreAllUnscored } from "@/lib/upwork/scorer";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/upwork/poll — cron handler, protected by CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if auto-poll is enabled
    let autoPoll = true;
    try {
      const settings = await sql`
        SELECT value FROM upwork_settings WHERE key = 'auto_poll'
      `;
      if (settings.length > 0) autoPoll = settings[0].value === "true";
    } catch {
      // Settings table might not exist yet — skip
    }

    if (!autoPoll) {
      return NextResponse.json({ skipped: true, reason: "auto_poll disabled" });
    }

    // Get feed URLs
    let feedUrls: string[] = [];
    try {
      const settings = await sql`
        SELECT value FROM upwork_settings WHERE key = 'feed_urls'
      `;
      if (settings.length > 0 && settings[0].value) {
        feedUrls = JSON.parse(settings[0].value);
      }
    } catch {
      // Settings table might not exist yet
    }

    if (feedUrls.length === 0) {
      return NextResponse.json({ skipped: true, reason: "no feed URLs configured" });
    }

    const newJobs = await pollUpworkRSS(feedUrls);
    // Don't auto-score — proposals are generated on-demand via button click
    return NextResponse.json({ newJobs, scored: 0 });
  } catch (err) {
    console.error("[upwork-poll] Error:", err);
    return NextResponse.json({ error: "Poll failed" }, { status: 500 });
  }
}
