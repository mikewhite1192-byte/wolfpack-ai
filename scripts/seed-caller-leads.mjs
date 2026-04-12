#!/usr/bin/env node
/**
 * Seeds caller_leads from scraped_businesses — the "no-website, has-phone"
 * segment that's the target ICP for the AI cold caller.
 *
 * DOES NOT AUTO-RUN. Invoke manually:
 *
 *   # Seed 30 leads (default)
 *   node scripts/seed-caller-leads.mjs
 *
 *   # Seed a specific count
 *   node scripts/seed-caller-leads.mjs 50
 *
 *   # Seed your own test number (prepended as the first lead) before any scrape imports
 *   node scripts/seed-caller-leads.mjs --test "+12485551234" "Mike Test"
 *
 * The script is intentionally separate from any Vercel cron or dashboard
 * trigger so there's zero chance of accidentally mass-importing leads.
 *
 * Filters:
 *   - website IS NULL (ICP: no digital presence)
 *   - phone IS NOT NULL AND phone != ''
 *   - phone normalizes cleanly to E.164 (drops malformed rows)
 *   - not already in caller_leads (ON CONFLICT DO NOTHING via unique phone)
 *   - not already in caller_dnc
 *
 * Run from the wolfpack-ai project root so .env.local is loaded automatically.
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── Load .env.local manually (Node scripts don't auto-read it) ───────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
try {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
} catch {
  console.error(`Couldn't read .env.local at ${envPath}`);
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// ── Phone normalization (same logic as lib/caller/retell-client.ts) ──
function toE164US(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

// ── Extract city/state from a Google Maps address ─────────────────────
// e.g., "8804 Greenway Ave S, Cottage Grove, MN 55016" → {city: "Cottage Grove", state: "MN"}
function parseAddress(address) {
  if (!address) return { city: null, state: null };
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length < 2) return { city: null, state: null };

  // Last part is usually "STATE ZIP" or "STATE ZIP, USA"
  let stateZip = parts[parts.length - 1];
  if (stateZip === "USA") stateZip = parts[parts.length - 2];
  const stateMatch = stateZip?.match(/\b([A-Z]{2})\b/);
  const state = stateMatch ? stateMatch[1] : null;

  // City is usually the second-to-last part before state/zip
  const cityIdx = stateZip === parts[parts.length - 1] ? parts.length - 2 : parts.length - 3;
  const city = cityIdx >= 0 ? parts[cityIdx] : null;

  return { city, state };
}

// ── Parse CLI args ───────────────────────────────────────────────────
const args = process.argv.slice(2);
let testMode = false;
let testNumber = null;
let testName = null;
let limit = 30;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--test") {
    testMode = true;
    testNumber = args[i + 1];
    testName = args[i + 2] || "Test Lead";
    i += 2;
  } else {
    const n = parseInt(args[i], 10);
    if (!Number.isNaN(n)) limit = n;
  }
}

// ── Main ─────────────────────────────────────────────────────────────
(async () => {
  console.log("─".repeat(60));
  console.log("Seeding caller_leads from scraped_businesses");
  console.log("─".repeat(60));

  // ── Optional: insert a test lead (Mike's own cell) at the front ──
  if (testMode) {
    if (!testNumber) {
      console.error("--test requires a phone number argument");
      process.exit(1);
    }
    const normalized = toE164US(testNumber);
    if (!normalized) {
      console.error(`Could not normalize test number: ${testNumber}`);
      process.exit(1);
    }
    const result = await sql`
      INSERT INTO caller_leads
        (phone, business_name, contractor_type, city, state, timezone, no_website, review_count, status)
      VALUES
        (${normalized}, ${testName}, ${"Test Business"}, ${"Detroit"}, ${"MI"}, ${"America/New_York"}, TRUE, 0, ${"pending"})
      ON CONFLICT (phone) DO UPDATE
        SET status = 'pending', business_name = EXCLUDED.business_name
      RETURNING id, phone, business_name
    `;
    console.log(`\n✅ Test lead inserted: ${result[0].business_name} at ${result[0].phone}`);
    console.log(`   (Lead ID: ${result[0].id})\n`);
  }

  // ── Pull candidates from scraped_businesses ─────────────────────
  console.log(`Querying scraped_businesses for up to ${limit} candidates…`);

  const candidates = await sql`
    SELECT
      sb.id,
      sb.name,
      sb.phone,
      sb.address,
      sb.category,
      sb.review_count
    FROM scraped_businesses sb
    WHERE sb.website IS NULL
      AND sb.phone IS NOT NULL
      AND sb.phone != ''
      AND NOT EXISTS (
        SELECT 1 FROM caller_leads cl WHERE cl.phone = sb.phone
      )
      AND NOT EXISTS (
        SELECT 1 FROM caller_dnc dnc WHERE dnc.phone = sb.phone
      )
    ORDER BY sb.created_at DESC
    LIMIT ${limit * 2}
  `;

  console.log(`Found ${candidates.length} raw candidates. Normalizing phones…`);

  let inserted = 0;
  let skipped = 0;
  let invalidPhone = 0;

  for (const c of candidates) {
    if (inserted >= limit) break;

    const phoneE164 = toE164US(c.phone);
    if (!phoneE164) {
      invalidPhone++;
      continue;
    }

    const { city, state } = parseAddress(c.address);

    try {
      const result = await sql`
        INSERT INTO caller_leads
          (phone, business_name, contractor_type, city, state, timezone, no_website, review_count, status)
        VALUES (
          ${phoneE164},
          ${c.name},
          ${c.category || null},
          ${city},
          ${state},
          ${"America/New_York"},
          TRUE,
          ${c.review_count || 0},
          ${"pending"}
        )
        ON CONFLICT (phone) DO NOTHING
        RETURNING id
      `;
      if (result.length > 0) {
        inserted++;
        console.log(`  [${inserted}/${limit}] ${c.name} (${city || "?"}, ${state || "?"}) → ${phoneE164}`);
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  ✗ Failed to insert ${c.name}:`, err.message);
      skipped++;
    }
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log(`✅ Inserted:       ${inserted}`);
  console.log(`⏭  Skipped:        ${skipped} (already in caller_leads or DNC)`);
  console.log(`⚠  Invalid phone:  ${invalidPhone}`);
  console.log("─".repeat(60));

  // ── Show current queue state ────────────────────────────────────
  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'calling') AS calling,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) AS total
    FROM caller_leads
  `;
  console.log(`\nCurrent caller_leads queue state:`);
  console.log(`  Pending:    ${stats.pending}`);
  console.log(`  Calling:    ${stats.calling}`);
  console.log(`  Completed:  ${stats.completed}`);
  console.log(`  Total:      ${stats.total}`);
  console.log();
})().catch((err) => {
  console.error("\n❌ Seed script failed:", err);
  process.exit(1);
});
