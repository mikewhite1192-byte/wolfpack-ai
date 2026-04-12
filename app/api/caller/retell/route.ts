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
        const outcome = call.call_analysis?.outcome || call.metadata?.outcome || null;

        // Update the lead record
        if (leadId) {
          await sql`
            UPDATE caller_leads SET
              duration_seconds = ${duration},
              transcript = ${transcript},
              outcome_summary = ${call.call_analysis?.summary || null},
              status = CASE
                WHEN ${outcome || ""}::text = '' THEN status
                ELSE ${outcome || "no_answer"}
              END,
              updated_at = NOW()
            WHERE id = ${leadId}
          `;

          // Load updated lead for follow-up
          const leads = await sql`SELECT * FROM caller_leads WHERE id = ${leadId}`;
          if (leads.length > 0) {
            const lead = leads[0] as unknown as CallerLead;

            // If demo was booked, send confirmations
            if (lead.status === "demo_booked" && lead.demo_time) {
              sendDemoConfirmations(lead, lead.demo_time).catch(err =>
                console.error("[retell] Confirmation error:", err)
              );
            }

            // Send follow-up SMS (skips demo_booked internally)
            if (!lead.followup_sent) {
              sendPostCallFollowup(lead).then(async () => {
                await sql`
                  UPDATE caller_leads SET followup_sent = TRUE, updated_at = NOW()
                  WHERE id = ${leadId}
                `;
              }).catch(err =>
                console.error("[retell] Follow-up error:", err)
              );
            }
          }
        }

        console.log(`[retell] Call ended: ${leadId}, duration=${duration}s, outcome=${outcome}`);
        break;
      }

      case "call_analyzed": {
        // Post-call analysis from Retell (sentiment, summary, etc.)
        const leadId = call?.metadata?.lead_id;
        if (leadId && call?.call_analysis) {
          await sql`
            UPDATE caller_leads SET
              outcome_summary = ${call.call_analysis.summary || null},
              updated_at = NOW()
            WHERE id = ${leadId}
          `;
          console.log(`[retell] Call analyzed for ${leadId}`);
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
