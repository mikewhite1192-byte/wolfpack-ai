import { NextRequest, NextResponse } from "next/server";
import { checkUpgradeEvent } from "@/lib/outreach/upgrade-sequence";

// POST /api/outreach/upgrade/event — trigger event-based upgrade check
// Call this from webhook handlers when a workspace gets a reply, books a call, etc.
export async function POST(req: NextRequest) {
  try {
    const { workspaceId, event } = await req.json();

    if (!workspaceId || !event) {
      return NextResponse.json({ error: "workspaceId and event required" }, { status: 400 });
    }

    const sent = await checkUpgradeEvent(workspaceId, event);

    return NextResponse.json({ sent, workspaceId, event });
  } catch (err) {
    console.error("[upgrade-event] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
