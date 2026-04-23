import { NextRequest, NextResponse } from "next/server";
import { syncAllConfigured } from "@/lib/finance/mercury/sync";

// Runs every 15 minutes (see vercel.json).
// Cron-authed via Bearer CRON_SECRET to match the existing pattern used by
// other cron routes in this repo.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllConfigured({ trigger: "cron" });
  return NextResponse.json({ ok: true, results });
}
