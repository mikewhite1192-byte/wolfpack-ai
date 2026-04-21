#!/usr/bin/env node
/**
 * Backfill outcomes for historical caller_leads rows.
 *
 * Re-fetches each call from Retell and re-runs the same resolveOutcome
 * logic that lives in app/api/caller/retell/route.ts. Only UPDATEs rows
 * where the new outcome differs from what's stored.
 *
 * Motivated by: prior outcome-resolution code had only 4 disconnection_reason
 * cases and ignored call_analysis.in_voicemail, so most voicemails were
 * bucketed as no_answer. This script corrects the history.
 *
 * Usage:
 *   node scripts/backfill-caller-outcomes.mjs           # dry run
 *   node scripts/backfill-caller-outcomes.mjs --apply   # write changes
 *
 * Prerequisites:
 *   .env.local with DATABASE_URL and RETELL_API_KEY set.
 *   Run from the wolfpack-ai project root.
 */

import { neon } from "@neondatabase/serverless";
import Retell from "retell-sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── Load .env.local ──────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const content = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
} catch {
  console.error("Couldn't read .env.local");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL);
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

// Must match app/api/caller/retell/route.ts resolveOutcome exactly.
function resolveOutcome(call) {
  const analysisOutcome =
    call?.call_analysis?.custom_analysis_data?.call_outcome ||
    call?.metadata?.outcome;
  if (analysisOutcome) return analysisOutcome;

  if (call?.call_analysis?.in_voicemail === true) return "voicemail";

  const reason = call?.disconnection_reason;
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
      const durationS = call?.duration_ms ? call.duration_ms / 1000 : 0;
      return durationS > 10 ? "hung_up" : "voicemail";
    }
    default:
      return "no_answer";
  }
}

async function main() {
  console.log(`\n=== Caller outcome backfill (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  // Only reclassify rows that could be wrong under the old logic.
  // no_answer is the big catch-all; null outcomes are rows that finished
  // before outcome was ever written. Leave demo_booked / not_interested
  // alone — those were set authoritatively by signal_outcome.
  const rows = await sql`
    SELECT id, retell_call_id, outcome, called_at, business_name
    FROM caller_leads
    WHERE retell_call_id IS NOT NULL
      AND (outcome = 'no_answer' OR outcome IS NULL)
      AND called_at IS NOT NULL
    ORDER BY called_at DESC
  `;

  console.log(`Candidates: ${rows.length}`);

  const summary = {};
  const toUpdate = [];
  let fetched = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const call = await retell.call.retrieve(row.retell_call_id);
      fetched++;
      const newOutcome = resolveOutcome(call);
      const changed = newOutcome !== row.outcome;
      summary[newOutcome] = (summary[newOutcome] || 0) + 1;

      if (changed) {
        toUpdate.push({
          id: row.id,
          old: row.outcome,
          new: newOutcome,
          call_id: row.retell_call_id,
          business: row.business_name,
          reason: call.disconnection_reason,
          in_vm: call.call_analysis?.in_voicemail,
          duration_s: call.duration_ms ? Math.round(call.duration_ms / 1000) : 0,
        });
      }
    } catch (err) {
      errors++;
      console.error(`  ✗ ${row.retell_call_id}: ${err.message || err}`);
    }
  }

  console.log(`\nFetched from Retell: ${fetched}  (errors: ${errors})`);
  console.log(`Would reclassify: ${toUpdate.length}`);
  console.log(`\nOutcome distribution after resolve:`);
  for (const [k, v] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(22)} ${v}`);
  }

  if (toUpdate.length > 0) {
    console.log(`\nSample changes (first 10):`);
    for (const u of toUpdate.slice(0, 10)) {
      console.log(
        `  ${(u.business || "?").slice(0, 22).padEnd(22)}  ${u.old ?? "null"} → ${u.new}  ` +
        `(reason=${u.reason || "?"}, in_vm=${u.in_vm ?? "?"}, dur=${u.duration_s}s)`,
      );
    }
  }

  if (!APPLY) {
    console.log(`\nDry run complete. Re-run with --apply to write changes.\n`);
    return;
  }

  console.log(`\nApplying ${toUpdate.length} updates…`);
  let applied = 0;
  for (const u of toUpdate) {
    await sql`UPDATE caller_leads SET outcome = ${u.new}, status = ${u.new} WHERE id = ${u.id}`;
    applied++;
  }
  console.log(`Updated ${applied} rows.\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
