import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const lowerEmail = email.toLowerCase();
    const affiliates = await sql`
      SELECT id, name, email, code, stripe_account_id, commission_rate, total_earned, total_paid, total_clicks, status, created_at
      FROM affiliates WHERE email = ${lowerEmail} LIMIT 1
    `;

    if (affiliates.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const affiliate = affiliates[0];

    const referrals = await sql`
      SELECT id, org_id, status, monthly_value, commission, created_at
      FROM referrals WHERE affiliate_id = ${affiliate.id} ORDER BY created_at DESC
    `;

    const payouts = await sql`
      SELECT id, amount, stripe_transfer_id, period_start, period_end, status, paid_at, created_at
      FROM affiliate_payouts WHERE affiliate_id = ${affiliate.id} ORDER BY created_at DESC
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeReferrals = referrals.filter((r: any) => r.status === "active");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monthlyEarnings = activeReferrals.reduce((sum: number, r: any) => sum + Number(r.commission || 0), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingPayout = payouts.filter((p: any) => p.status === "pending").reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lifetimePaid = payouts.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    return NextResponse.json({
      affiliate: {
        name: affiliate.name,
        email: affiliate.email,
        code: affiliate.code,
        stripe_connected: !!affiliate.stripe_account_id,
        status: affiliate.status,
        created_at: affiliate.created_at,
      },
      stats: {
        total_referrals: referrals.length,
        active_referrals: activeReferrals.length,
        monthly_earnings: Math.round(monthlyEarnings * 100) / 100,
        lifetime_paid: Math.round(lifetimePaid * 100) / 100,
        pending_payout: Math.round(pendingPayout * 100) / 100,
        total_clicks: Number(affiliate.total_clicks || 0),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      referrals: referrals.slice(0, 50).map((r: any) => ({
        id: r.id,
        email: maskEmail(r.org_id),
        status: r.status,
        monthly_value: Number(r.monthly_value || 0),
        commission: Number(r.commission || 0),
        joined: r.created_at,
      })),
      payouts,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
