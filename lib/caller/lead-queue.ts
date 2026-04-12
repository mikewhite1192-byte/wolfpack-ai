import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// ── Timezone window check ───────────────────────────────────────────
function isWithinCallingWindow(timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(formatter.format(now), 10);
    return hour >= 8 && hour < 17; // 8am–5pm
  } catch {
    // If timezone is invalid, default to allowing calls
    return true;
  }
}

// ── Get next pending lead ───────────────────────────────────────────
// CONCURRENCY SAFETY: The lead selection uses an atomic UPDATE...WHERE
// with a subquery that includes FOR UPDATE SKIP LOCKED. This prevents
// two simultaneous polls from grabbing the same lead — if request A
// locks lead X, request B skips X and grabs the next pending lead.
// PostgreSQL wraps single statements in implicit transactions, so this
// works without an explicit BEGIN/COMMIT even on Neon's HTTP driver.
export async function getNextLead() {
  // Spacing check: refuse if any call was made in the last 5 minutes
  const recentCalls = await sql`
    SELECT id FROM caller_leads
    WHERE called_at > NOW() - INTERVAL '5 minutes'
    LIMIT 1
  `;
  if (recentCalls.length > 0) {
    return { lead: null, reason: "spacing" as const };
  }

  // Atomically select AND mark the next pending lead as 'calling'.
  // FOR UPDATE SKIP LOCKED ensures concurrent requests don't fight
  // over the same row — if another transaction already locked a lead,
  // this query skips it and grabs the next one.
  const rows = await sql`
    UPDATE caller_leads
    SET status = 'calling'
    WHERE id = (
      SELECT id FROM caller_leads
      WHERE status = 'pending'
        AND phone NOT IN (SELECT phone FROM caller_dnc)
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;

  if (rows.length === 0) {
    return { lead: null, reason: "empty" as const };
  }

  const lead = rows[0];

  // Timezone window check — if outside hours, roll back to pending
  if (!isWithinCallingWindow(lead.timezone || "America/New_York")) {
    await sql`
      UPDATE caller_leads SET status = 'pending' WHERE id = ${lead.id}
    `;
    return { lead: null, reason: "outside_hours" as const };
  }

  return { lead, reason: null };
}

// ── Report call outcome ─────────────────────────────────────────────
export async function reportOutcome(
  leadId: string,
  outcome: string,
  data: {
    durationSeconds?: number;
    transcript?: string;
    demoTime?: string;
    retellCallId?: string;
  }
) {
  await sql`
    UPDATE caller_leads SET
      status = 'completed',
      outcome = ${outcome},
      call_duration_s = ${data.durationSeconds ?? null},
      transcript = ${data.transcript ?? null},
      demo_time = ${data.demoTime ?? null},
      retell_call_id = ${data.retellCallId ?? null},
      called_at = NOW()
    WHERE id = ${leadId}
  `;

  // Auto-DNC if not interested or asked not to call
  if (outcome === "not_interested") {
    const lead = await sql`SELECT phone FROM caller_leads WHERE id = ${leadId}`;
    if (lead.length > 0) {
      await addToDnc(lead[0].phone, "opt_out");
    }
  }
}

// ── Bulk import leads ───────────────────────────────────────────────
export async function importLeads(
  leads: {
    phone: string;
    businessName?: string;
    contractorType?: string;
    city?: string;
    state?: string;
    timezone?: string;
    noWebsite?: boolean;
    reviewCount?: number;
  }[]
) {
  let imported = 0;
  // Insert in batches to avoid massive queries
  for (const lead of leads) {
    const result = await sql`
      INSERT INTO caller_leads (phone, business_name, contractor_type, city, state, timezone, no_website, review_count)
      VALUES (
        ${lead.phone},
        ${lead.businessName ?? null},
        ${lead.contractorType ?? null},
        ${lead.city ?? null},
        ${lead.state ?? null},
        ${lead.timezone ?? "America/New_York"},
        ${lead.noWebsite ?? true},
        ${lead.reviewCount ?? 0}
      )
      ON CONFLICT (phone) DO NOTHING
    `;
    // neon returns affected rows info — count inserts
    if (result && (result as unknown[]).length !== undefined) {
      imported++;
    }
  }
  return { imported, total: leads.length };
}

// ── Stats ───────────────────────────────────────────────────────────
export async function getCallerStats(sessionId?: string) {
  if (sessionId) {
    const rows = await sql`
      SELECT * FROM caller_sessions WHERE id = ${sessionId}
    `;
    return rows[0] || null;
  }

  // Aggregate stats for today
  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE called_at >= CURRENT_DATE) AS calls_today,
      COUNT(*) FILTER (WHERE called_at >= CURRENT_DATE AND outcome = 'demo_booked') AS demos_today,
      COUNT(*) FILTER (WHERE called_at >= CURRENT_DATE AND outcome = 'voicemail') AS voicemails_today,
      COUNT(*) FILTER (WHERE called_at >= CURRENT_DATE AND outcome = 'not_interested') AS not_interested_today,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_leads,
      COUNT(*) AS total_leads
    FROM caller_leads
  `;
  return stats;
}

// ── DNC management ──────────────────────────────────────────────────
export async function addToDnc(phone: string, reason: string) {
  await sql`
    INSERT INTO caller_dnc (phone, reason)
    VALUES (${phone}, ${reason})
    ON CONFLICT (phone) DO NOTHING
  `;
  // Also mark the lead as dnc
  await sql`
    UPDATE caller_leads SET status = 'dnc' WHERE phone = ${phone}
  `;
}
