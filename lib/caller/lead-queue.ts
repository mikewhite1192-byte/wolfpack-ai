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

  // Get next pending lead not on DNC
  const rows = await sql`
    SELECT * FROM caller_leads
    WHERE status = 'pending'
      AND phone NOT IN (SELECT phone FROM caller_dnc)
    ORDER BY created_at ASC
    LIMIT 1
  `;

  if (rows.length === 0) {
    return { lead: null, reason: "empty" as const };
  }

  const lead = rows[0];

  // Timezone window check
  if (!isWithinCallingWindow(lead.timezone || "America/New_York")) {
    return { lead: null, reason: "outside_hours" as const };
  }

  // Mark as calling
  await sql`
    UPDATE caller_leads SET status = 'calling' WHERE id = ${lead.id}
  `;

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
