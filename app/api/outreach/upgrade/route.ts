import { NextRequest, NextResponse } from "next/server";
import { processUpgradeSequences } from "@/lib/outreach/upgrade-sequence";

// POST /api/outreach/upgrade — process upgrade sequences for all workspaces (cron, daily)
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processUpgradeSequences();

    console.log(`[upgrade] Processed: ${result.sent} sent, ${result.skipped} skipped, ${result.errors} errors`);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[upgrade] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
