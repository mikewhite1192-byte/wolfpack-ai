import { NextRequest, NextResponse } from "next/server";
import { syncAllConfigured } from "@/lib/finance/mercury/sync";
import { classifyUnclassifiedPersonal } from "@/lib/finance/business-classifier";

// Runs every 15 minutes (see vercel.json).
// Cron-authed via Bearer CRON_SECRET to match the existing pattern used by
// other cron routes in this repo.
//
// Flow: sync Mercury, then auto-classify any newly-arrived personal txns
// so the business-candidate queue stays current without manual button clicks.
// The classifier short-circuits if no unclassified rows exist, so on most
// cron ticks (nothing new) it's a cheap no-op. ANTHROPIC_API_KEY is required
// for the classifier; if missing we sync but skip classification.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const syncResults = await syncAllConfigured({ trigger: "cron" });

  let classification: Awaited<ReturnType<typeof classifyUnclassifiedPersonal>> | null = null;
  let classifyError: string | null = null;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      classification = await classifyUnclassifiedPersonal({ limit: 200 });
    } catch (err) {
      classifyError = err instanceof Error ? err.message : "classifier failed";
      console.error("[cron/mercury-sync] classifier error:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    sync: syncResults,
    classification,
    classifyError,
  });
}
