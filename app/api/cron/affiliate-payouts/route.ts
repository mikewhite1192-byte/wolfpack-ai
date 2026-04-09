import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";

const sql = neon(process.env.DATABASE_URL!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1);
  const periodStartStr = periodStart.toISOString().split("T")[0];
  const periodEndStr = periodEnd.toISOString().split("T")[0];

  const affiliates = await sql`SELECT id, name, email, stripe_account_id FROM affiliates WHERE status = 'active'`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];

  for (const affiliate of affiliates) {
    const existing = await sql`
      SELECT id FROM affiliate_payouts
      WHERE affiliate_id = ${affiliate.id} AND period_start = ${periodStartStr} AND period_end = ${periodEndStr}
      LIMIT 1
    `;
    if (existing.length > 0) {
      results.push({ email: affiliate.email, status: "skipped", reason: "already_exists" });
      continue;
    }

    const activeReferrals = await sql`
      SELECT id, commission FROM referrals WHERE affiliate_id = ${affiliate.id} AND status = 'active'
    `;

    if (activeReferrals.length === 0) {
      results.push({ email: affiliate.email, status: "skipped", reason: "no_active_referrals" });
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commission = Math.round(activeReferrals.reduce((sum: number, r: any) => sum + Number(r.commission || 0), 0) * 100) / 100;

    if (commission <= 0) {
      results.push({ email: affiliate.email, status: "skipped", reason: "zero_commission" });
      continue;
    }

    const payout = await sql`
      INSERT INTO affiliate_payouts (affiliate_id, amount, period_start, period_end, status)
      VALUES (${affiliate.id}, ${commission}, ${periodStartStr}, ${periodEndStr}, 'pending')
      RETURNING id
    `;
    const payoutId = payout[0].id;

    if (affiliate.stripe_account_id) {
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(commission * 100),
          currency: "usd",
          destination: affiliate.stripe_account_id as string,
          metadata: { affiliate_id: affiliate.id as string, payout_id: payoutId as string },
        });

        await sql`UPDATE affiliate_payouts SET status = 'paid', stripe_transfer_id = ${transfer.id}, paid_at = NOW() WHERE id = ${payoutId}`;
        await sql`UPDATE affiliates SET total_earned = COALESCE(total_earned, 0) + ${commission}, total_paid = COALESCE(total_paid, 0) + ${commission} WHERE id = ${affiliate.id}`;
        results.push({ email: affiliate.email, status: "paid", amount: commission });
      } catch (err) {
        console.error(`Transfer failed for ${affiliate.email}:`, err);
        await sql`UPDATE affiliate_payouts SET status = 'failed' WHERE id = ${payoutId}`;
        await sql`UPDATE affiliates SET total_earned = COALESCE(total_earned, 0) + ${commission} WHERE id = ${affiliate.id}`;
        results.push({ email: affiliate.email, status: "transfer_failed", amount: commission });
      }
    } else {
      await sql`UPDATE affiliates SET total_earned = COALESCE(total_earned, 0) + ${commission} WHERE id = ${affiliate.id}`;
      results.push({ email: affiliate.email, status: "pending_no_stripe", amount: commission });
    }
  }

  return NextResponse.json({ ok: true, period: { start: periodStartStr, end: periodEndStr }, results });
}
