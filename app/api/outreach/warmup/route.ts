import { NextRequest, NextResponse } from "next/server";
import {
  runWarmupCycle,
  runWarmupSend,
  runWarmupReply,
  scanForBounces,
  getWarmupStatus,
  addWarmupAddress,
} from "@/lib/outreach/warmup";

// POST /api/outreach/warmup — run warmup (cron or admin)
// Query params: ?type=send&batch=0 or ?type=reply&batch=0
// No params = full cycle (dashboard manual trigger)
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const batch = parseInt(url.searchParams.get("batch") || "0");

    if (type === "send") {
      const result = await runWarmupSend(batch, 3);
      return NextResponse.json(result);
    }

    if (type === "reply") {
      const result = await runWarmupReply(batch);
      return NextResponse.json(result);
    }

    if (type === "bounce") {
      const result = await scanForBounces(batch);
      return NextResponse.json(result);
    }

    // Full cycle (manual trigger from dashboard)
    const result = await runWarmupCycle();
    console.log(`[warmup] Cycle complete: ${result.sent} sent, ${result.errors} errors`);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[warmup] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// GET /api/outreach/warmup — Vercel cron handler (crons always use GET)
// Query params: ?type=send&batch=0, ?type=reply&batch=0, ?type=bounce&batch=0
// No type param = return status (dashboard)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const batch = parseInt(url.searchParams.get("batch") || "0");

    // If type is specified, this is a cron call — execute the work
    if (type === "send") {
      const result = await runWarmupSend(batch, 3);
      return NextResponse.json(result);
    }
    if (type === "reply") {
      const result = await runWarmupReply(batch);
      return NextResponse.json(result);
    }
    if (type === "bounce") {
      const result = await scanForBounces(batch);
      return NextResponse.json(result);
    }

    // No type = status request (dashboard)
    const status = await getWarmupStatus();
    return NextResponse.json({ addresses: status });
  } catch (err) {
    console.error("[warmup] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// PUT /api/outreach/warmup — add a new email address to warmup
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, displayName, smtpHost, smtpPort, smtpUser, smtpPass, coldSender } = body;

    if (!email || !smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = await addWarmupAddress({
      email,
      displayName: displayName || "Mike",
      smtpHost,
      smtpPort: smtpPort || 587,
      smtpUser,
      smtpPass,
      coldSender: coldSender ?? true, // default to cold sender, pass false for warmup-only
    });

    const role = (coldSender ?? true) ? "cold_sender" : "warmup_only";
    return NextResponse.json({ id, email, role, message: `Address added to warmup (${role})` });
  } catch (err) {
    console.error("[warmup] Add error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
