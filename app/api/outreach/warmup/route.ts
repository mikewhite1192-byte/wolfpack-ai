import { NextRequest, NextResponse } from "next/server";
import {
  runWarmupCycle,
  getWarmupStatus,
  addWarmupAddress,
} from "@/lib/outreach/warmup";

// POST /api/outreach/warmup — run warmup cycle (cron)
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runWarmupCycle();

    console.log(`[warmup] Cycle complete: ${result.sent} sent, ${result.replied} auto-replies, ${result.errors} errors, ${result.completed.length} newly completed warmup`);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[warmup] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// GET /api/outreach/warmup — get warmup status for all addresses
export async function GET() {
  try {
    const status = await getWarmupStatus();
    return NextResponse.json({ addresses: status });
  } catch (err) {
    console.error("[warmup] Status error:", err);
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
