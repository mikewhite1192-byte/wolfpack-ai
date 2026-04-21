// Shared outcome-resolution logic for the AI caller.
//
// Collapses Retell's 30+ possible disconnection_reason values (see
// retell-sdk's call.d.ts) down to the six we track in CallerOutcome.
// Used by:
//   - app/api/caller/retell/route.ts     (call_ended / call_analyzed webhooks)
//   - app/api/cron/caller-stuck-calls    (self-heal rows whose webhook was lost)
//   - scripts/backfill-caller-outcomes   (one-shot historical repair)
//
// Priority order:
//   1. signal_outcome tool call landed call_outcome on custom_analysis_data
//   2. metadata.outcome (rare, kept for compatibility)
//   3. call_analysis.in_voicemail — trusted over disconnection_reason because
//      when the agent leaves a voicemail and hangs up, disconnection_reason
//      is `agent_hangup`, not `voicemail_reached`.
//   4. Explicit disconnection_reason mapping
//   5. For ambiguous end states (agent_hangup / inactivity / max_duration),
//      treat sub-10s calls as voicemail and longer as hung_up.

export type RetellCall = {
  disconnection_reason?: string;
  duration_ms?: number;
  transcript?: string | null;
  metadata?: { outcome?: string } & Record<string, unknown>;
  call_analysis?: {
    in_voicemail?: boolean;
    custom_analysis_data?: Record<string, unknown>;
  };
};

export function resolveOutcome(call: RetellCall): string {
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
      const durationS = call.duration_ms ? call.duration_ms / 1000 : 0;
      return durationS > 10 ? "hung_up" : "voicemail";
    }
    default:
      return "no_answer";
  }
}
