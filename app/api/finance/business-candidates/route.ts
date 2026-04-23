import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// GET /api/finance/business-candidates
// Returns pending-review personal transactions grouped by merchant/subscription_name
// so the UI can show "Anthropic — $600 across 12 txns, 95% confidence".
// Also returns detected subscriptions (independent of business-candidate flag)
// so the user can see recurring spend.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Business candidates (awaiting review): union of legacy + Mercury personal rows.
  const candidates = await sql`
    WITH unified AS (
      SELECT 'legacy'::text AS source, id, date::text AS date, amount, description,
             business_candidate_confidence AS confidence,
             business_candidate_reason AS reason,
             suggested_biz_category, suggested_deduction_pct, suggested_irs_reference,
             subscription_name
      FROM personal_transactions
      WHERE business_review_status = 'pending_review'
      UNION ALL
      SELECT 'mercury'::text AS source, id, COALESCE(posted_at::date::text, created_at::date::text) AS date,
             amount,
             COALESCE(counterparty_name, bank_description, '') AS description,
             business_candidate_confidence AS confidence,
             business_candidate_reason AS reason,
             suggested_biz_category, suggested_deduction_pct, suggested_irs_reference,
             subscription_name
      FROM mercury_transactions
      WHERE workspace = 'personal' AND business_review_status = 'pending_review'
    )
    SELECT
      COALESCE(subscription_name, description) AS merchant,
      suggested_biz_category AS category,
      COUNT(*)::int AS txn_count,
      SUM(ABS(amount))::numeric AS total_amount,
      ROUND(AVG(confidence))::int AS avg_confidence,
      MAX(suggested_deduction_pct) AS suggested_deduction_pct,
      MAX(suggested_irs_reference) AS suggested_irs_reference,
      MAX(reason) AS reason,
      MIN(date) AS first_seen,
      MAX(date) AS last_seen,
      json_agg(json_build_object('source', source, 'id', id, 'date', date, 'amount', amount, 'description', description) ORDER BY date DESC) AS transactions
    FROM unified
    GROUP BY COALESCE(subscription_name, description), suggested_biz_category
    ORDER BY total_amount DESC
  `;

  // All detected subscriptions (business OR personal)
  const subscriptions = await sql`
    WITH unified AS (
      SELECT subscription_name, amount, business_candidate, business_review_status,
             COUNT(*) OVER (PARTITION BY subscription_name) AS occurrence_count
      FROM personal_transactions
      WHERE subscription_name IS NOT NULL
      UNION ALL
      SELECT subscription_name, amount, business_candidate, business_review_status,
             COUNT(*) OVER (PARTITION BY subscription_name)
      FROM mercury_transactions
      WHERE workspace = 'personal' AND subscription_name IS NOT NULL
    )
    SELECT subscription_name, COUNT(*)::int AS occurrence_count,
           SUM(ABS(amount))::numeric AS total_spent,
           BOOL_OR(business_candidate) AS is_business_candidate
    FROM unified
    GROUP BY subscription_name
    ORDER BY total_spent DESC
  `;

  // Counts for status bar
  const counts = await sql`
    SELECT
      COUNT(*) FILTER (WHERE business_review_status = 'pending_review')::int AS pending_count,
      COUNT(*) FILTER (WHERE business_review_status = 'confirmed_business')::int AS confirmed_count,
      COUNT(*) FILTER (WHERE business_review_status = 'kept_personal')::int AS kept_personal_count,
      COUNT(*) FILTER (WHERE business_review_status IS NULL OR business_review_status = 'unclassified')::int AS unclassified_count
    FROM (
      SELECT business_review_status FROM personal_transactions
      UNION ALL
      SELECT business_review_status FROM mercury_transactions WHERE workspace = 'personal'
    ) s
  `;

  return NextResponse.json({
    candidates,
    subscriptions,
    counts: counts[0],
  });
}

// PATCH /api/finance/business-candidates
// Body: { source: 'legacy'|'mercury', id: uuid, action: 'keep_personal'|'dismiss' }
// Marks a candidate as not-business without reclassifying.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { source, id, action } = body;

  if (source !== "legacy" && source !== "mercury") {
    return NextResponse.json({ error: "source must be 'legacy' or 'mercury'" }, { status: 400 });
  }
  if (action !== "keep_personal" && action !== "dismiss") {
    return NextResponse.json({ error: "action must be 'keep_personal' or 'dismiss'" }, { status: 400 });
  }

  const newStatus = action === "keep_personal" ? "kept_personal" : "dismissed";

  if (source === "legacy") {
    await sql`
      UPDATE personal_transactions
      SET business_review_status = ${newStatus}, reviewed_at = now()
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE mercury_transactions
      SET business_review_status = ${newStatus}, reviewed_at = now()
      WHERE id = ${id} AND workspace = 'personal'
    `;
  }

  return NextResponse.json({ ok: true });
}
