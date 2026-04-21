import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import Retell from "retell-sdk";
import { resolveOutcome, type RetellCall } from "@/lib/caller/outcome";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/cron/caller-stuck-calls
//
// Self-heals caller_leads rows whose call_ended webhook was lost. A lost
// webhook leaves the row at status='calling' indefinitely, which poisons
// dashboard queries and keeps the lead from being reattempted. We detect
// rows stuck for >10 min and re-fetch the call from Retell to write the
// correct outcome.
//
// Triggered by Vercel Cron — see vercel.json.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
  }

  const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

  const stuck = await sql`
    SELECT id, business_name, retell_call_id,
           EXTRACT(EPOCH FROM (NOW() - called_at))::int AS age_s
    FROM caller_leads
    WHERE status = 'calling'
      AND called_at < NOW() - INTERVAL '10 minutes'
    ORDER BY called_at ASC
    LIMIT 100
  `;

  const results: Array<{
    business: string;
    outcome: string;
    age_min: number;
    call_id: string | null;
    error?: string;
  }> = [];

  for (const row of stuck) {
    const age_min = Math.round((row.age_s as number) / 60);
    const business = (row.business_name as string) || "?";
    const call_id = row.retell_call_id as string | null;

    if (!call_id) {
      // No Retell call_id to reconcile against — call never started properly.
      await sql`UPDATE caller_leads SET status = 'no_answer', outcome = 'no_answer' WHERE id = ${row.id}`;
      results.push({ business, outcome: "no_answer", age_min, call_id: null });
      continue;
    }

    try {
      const call = (await retell.call.retrieve(call_id)) as unknown as RetellCall;
      const outcome = resolveOutcome(call);
      await sql`UPDATE caller_leads SET status = ${outcome}, outcome = ${outcome} WHERE id = ${row.id}`;
      results.push({ business, outcome, age_min, call_id });
    } catch (err) {
      results.push({
        business,
        outcome: "error",
        age_min,
        call_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(`[cron/caller-stuck-calls] Reconciled ${results.length} stuck rows`);
  return NextResponse.json({ fixed: results.length, results });
}
