import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { getNextLead } from "@/lib/caller/lead-queue";
import { startOutboundCall } from "@/lib/caller/retell-client";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com"];

// POST /api/caller/start-call
// Fetches the next due lead from the queue and initiates a Retell call.
// Respects caller_sessions.status (won't place calls if session is paused
// or stopped). Intended to be polled by the dashboard's client-side loop
// every ~30 seconds while the campaign is running.
//
// Returns:
//   200 { ok: true,  placed: true,  leadId, callId }       → call initiated
//   200 { ok: true,  placed: false, reason }               → queue had nothing to do
//   409 { error: "Session not running" }                   → campaign paused/stopped
//   500 { error: "..." }                                   → Retell API or DB failure
export async function POST(req: NextRequest) {
  void req;
  try {
    // ── Admin auth ─────────────────────────────────────────────
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Session gate: only run if campaign is active ───────────
    const sessions = await sql`
      SELECT id, status FROM caller_sessions
      WHERE status IN ('running', 'paused')
      ORDER BY started_at DESC
      LIMIT 1
    `;
    if (sessions.length === 0 || sessions[0].status !== "running") {
      return NextResponse.json(
        { error: "Session not running" },
        { status: 409 },
      );
    }

    // ── Pull next lead from queue ──────────────────────────────
    // getNextLead enforces:
    //   - 5-minute spacing since last call
    //   - 8am-5pm local timezone window for the lead
    //   - DNC list exclusion
    //   - Only pulls status='pending' leads
    // If any of those reject the attempt, it returns lead=null with
    // a reason, and we return 200 with placed=false so the dashboard
    // can show a "waiting" state without alarming the user.
    const { lead, reason } = await getNextLead();
    if (!lead) {
      return NextResponse.json({
        ok: true,
        placed: false,
        reason: reason || "unknown",
      });
    }

    // ── Initiate the Retell phone call ─────────────────────────
    let callResult;
    try {
      callResult = await startOutboundCall({
        toNumber: lead.phone as string,
        leadId: lead.id as string,
        businessName: lead.business_name as string | null,
        contractorType: lead.contractor_type as string | null,
        city: lead.city as string | null,
        state: lead.state as string | null,
        firstName: (lead.first_name as string) || null,
      });
    } catch (err) {
      // If Retell fails, roll the lead back to pending so it can be
      // retried on the next poll. Log the error for debugging.
      await sql`
        UPDATE caller_leads
        SET status = 'pending'
        WHERE id = ${lead.id}
      `;
      console.error("[caller/start-call] Retell API error for lead", lead.id, err);
      return NextResponse.json(
        {
          error: "Retell call failed",
          message: err instanceof Error ? err.message : String(err),
          leadId: lead.id,
        },
        { status: 500 },
      );
    }

    // ── Record the call attempt on the lead ─────────────────────
    await sql`
      UPDATE caller_leads
      SET retell_call_id = ${callResult.callId},
          called_at = NOW()
      WHERE id = ${lead.id}
    `;

    console.log(
      `[caller/start-call] Placed call → lead=${lead.id} retell_call_id=${callResult.callId} to=${lead.phone}`,
    );

    return NextResponse.json({
      ok: true,
      placed: true,
      leadId: lead.id,
      callId: callResult.callId,
      agentId: callResult.agentId,
      businessName: lead.business_name,
    });
  } catch (err) {
    console.error("[caller/start-call] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
