import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import {
  book_demo,
  check_availability,
  signal_outcome,
  type CallerLead,
  type CallerOutcome,
} from "@/lib/caller/retell-tools";
import { sendDemoConfirmations } from "@/lib/caller/confirmations";
import { sendPostCallFollowup } from "@/lib/caller/followup";
import { markWebhookProcessed } from "@/lib/webhook-idempotency";

const sql = neon(process.env.DATABASE_URL!);

// ── Outcome resolution ──────────────────────────────────────────────
// Collapse Retell's 30+ possible disconnection_reason values (see
// retell-sdk's call.d.ts) down to the six we track in CallerOutcome.
// Priority order inside resolveOutcome:
//   1. signal_outcome tool call landed call_outcome on custom_analysis_data
//   2. metadata.outcome (rare, kept for compatibility)
//   3. call_analysis.in_voicemail is the explicit voicemail flag — trust it
//      over disconnection_reason, because when the agent leaves a voicemail
//      message and hangs up, disconnection_reason is `agent_hangup`, not
//      `voicemail_reached`. Without this check voicemails get bucketed as
//      no_answer (which is what was tanking the dashboard's vm count).
//   4. Explicit disconnection_reason mapping
//   5. Fallback: treat unknowns with real audio duration as hung_up,
//      otherwise no_answer
type RetellCall = {
  disconnection_reason?: string;
  duration_ms?: number;
  transcript?: string | null;
  metadata?: { outcome?: string } & Record<string, unknown>;
  call_analysis?: {
    in_voicemail?: boolean;
    custom_analysis_data?: Record<string, unknown>;
  };
};

function resolveOutcome(call: RetellCall): string {
  const analysisOutcome =
    (call.call_analysis?.custom_analysis_data?.call_outcome as string | undefined) ||
    call.metadata?.outcome;
  if (analysisOutcome) return analysisOutcome;

  if (call.call_analysis?.in_voicemail === true) return "voicemail";

  const reason = call.disconnection_reason;
  switch (reason) {
    case "voicemail_reached":
      return "voicemail";
    case "user_hangup":
      return "hung_up";
    case "call_transfer":
    case "transfer_bridged":
      return "callback_requested";
    case "dial_busy":
    case "dial_failed":
    case "dial_no_answer":
    case "invalid_destination":
    case "registered_call_timeout":
    case "user_declined":
    case "marked_as_spam":
    case "scam_detected":
    case "telephony_provider_permission_denied":
    case "telephony_provider_unavailable":
    case "sip_routing_error":
    case "no_valid_payment":
    case "concurrency_limit_reached":
    case "ivr_reached":
    case "transfer_cancelled":
      return "no_answer";
    case "inactivity":
    case "agent_hangup":
    case "max_duration_reached": {
      // The agent ended the call. If there was meaningful audio time (>10s)
      // and signal_outcome never fired, treat it as a hang-up from the
      // contact's side — they answered but the conversation didn't resolve.
      // Sub-10s calls are almost always voicemail beeps the agent reacted to.
      const durationS = call.duration_ms ? call.duration_ms / 1000 : 0;
      return durationS > 10 ? "hung_up" : "voicemail";
    }
    default:
      // Errors (error_*), unknowns: no pickup
      return "no_answer";
  }
}

// POST /api/caller/retell — Retell AI webhook events
export async function POST(req: Request) {
  try {
    // Optional: verify Retell webhook signature
    const retellSecret = process.env.RETELL_WEBHOOK_SECRET;
    if (retellSecret) {
      const sig = req.headers.get("x-retell-signature");
      if (sig !== retellSecret) {
        console.error("[retell] Invalid webhook signature");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();
    const { event, call } = body;

    console.log(`[retell] Webhook event: ${event}, call_id: ${call?.call_id || "none"}`);

    // Idempotency: use call_id + event type as the dedup key.
    // Retell may retry on 5xx — without this, call_ended could fire
    // follow-up SMS twice or book the same demo twice.
    if (call?.call_id) {
      const isNew = await markWebhookProcessed("retell", `${call.call_id}:${event}`);
      if (!isNew) {
        console.log(`[retell] Duplicate webhook skipped: ${call.call_id}:${event}`);
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    switch (event) {
      case "call_started": {
        if (call?.call_id && call?.metadata?.lead_id) {
          await sql`
            UPDATE caller_leads SET
              retell_call_id = ${call.call_id},
              status = 'calling',
              call_attempts = call_attempts + 1,
              updated_at = NOW()
            WHERE id = ${call.metadata.lead_id}
          `;
          console.log(`[retell] Call started for lead ${call.metadata.lead_id}`);
        }
        break;
      }

      case "call_ended": {
        if (!call?.call_id) break;

        const leadId = call.metadata?.lead_id;
        const duration = call.duration_ms ? Math.round(call.duration_ms / 1000) : null;
        const transcript = call.transcript || null;

        const outcome = resolveOutcome(call);

        if (leadId) {
          await sql`
            UPDATE caller_leads SET
              call_duration_s = ${duration},
              transcript = ${transcript},
              outcome = ${outcome},
              status = ${outcome}
            WHERE id = ${leadId}
          `;

          // If demo was booked, send confirmations (non-blocking)
          if (outcome === "demo_booked") {
            const leads = await sql`SELECT * FROM caller_leads WHERE id = ${leadId}`;
            if (leads.length > 0) {
              const lead = leads[0] as unknown as CallerLead;
              if (lead.demo_time) {
                sendDemoConfirmations(lead, lead.demo_time).catch(err =>
                  console.error("[retell] Confirmation error:", err)
                );
              }
            }
          }
        }

        console.log(`[retell] Call ended: ${leadId}, duration=${duration}s, outcome=${outcome}`);
        break;
      }

      case "call_analyzed": {
        // call_analyzed fires seconds after call_ended with call_analysis
        // populated (signal_outcome's call_outcome and Retell's in_voicemail).
        // Re-resolve through the same helper so the more accurate signal
        // overrides whatever fallback call_ended wrote — including upgrading
        // no_answer → voicemail when Retell's VM detection runs post-call.
        const leadId = call?.metadata?.lead_id;
        if (leadId && call) {
          const outcome = resolveOutcome(call);
          await sql`
            UPDATE caller_leads SET
              outcome = ${outcome},
              status = ${outcome}
            WHERE id = ${leadId}
          `;
          console.log(`[retell] Call analyzed for ${leadId}: outcome=${outcome}`);
        }
        break;
      }

      case "tool_call_result": {
        // Retell is requesting a tool function call
        const toolName = body.tool_call?.name || body.tool_name;
        const args = body.tool_call?.arguments || body.arguments || {};
        const leadId = call?.metadata?.lead_id;

        console.log(`[retell] Tool call: ${toolName}, lead: ${leadId}`);

        let result: unknown;

        switch (toolName) {
          case "check_availability":
            result = await check_availability();
            break;

          case "book_demo":
            if (!leadId) {
              result = { success: false, error: "No lead ID" };
            } else {
              result = await book_demo(args.proposedTime || args.proposed_time, leadId);
            }
            break;

          case "signal_outcome":
            if (!leadId) {
              result = { acknowledged: false };
            } else {
              result = await signal_outcome(
                leadId,
                (args.result || args.outcome) as CallerOutcome,
                args.demoTime || args.demo_time,
              );
            }
            break;

          default:
            console.log(`[retell] Unknown tool: ${toolName}`);
            result = { error: `Unknown tool: ${toolName}` };
        }

        return NextResponse.json({ result });
      }

      default:
        console.log(`[retell] Unhandled event: ${event}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[retell] Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
