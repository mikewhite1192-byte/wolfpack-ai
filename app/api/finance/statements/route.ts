import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// GET /api/finance/statements?type=business|personal
// Mercury-only era: biz_statements / personal_statements are empty. We
// synthesize per-month "statement" rollups from the unified views so
// BusinessDashboard's monthly KPIs, tax filing, quarterly payments all
// render with live data without needing the legacy statement tables.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
    if (!ADMIN_EMAILS.includes(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const type = req.nextUrl.searchParams.get("type") || "business";

    if (type === "business") {
      const statements = await sql`
        SELECT
          to_char(date, 'YYYY-MM') AS id,
          to_char(date, 'YYYY-MM') AS month,
          COUNT(*)::int AS transaction_count,
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::numeric AS total_income,
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::numeric AS total_deposits,
          COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::numeric AS total_expenses,
          COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::numeric AS total_withdrawals,
          NULL::numeric AS opening_balance,
          NULL::numeric AS closing_balance
        FROM business_transactions_unified
        GROUP BY to_char(date, 'YYYY-MM')
        ORDER BY to_char(date, 'YYYY-MM') DESC
      `;

      const year = new Date().getFullYear();
      const ytd = await sql`
        SELECT
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::numeric AS ytd_revenue,
          COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::numeric AS ytd_expenses,
          COUNT(*)::int AS ytd_transactions
        FROM business_transactions_unified
        WHERE date >= ${`${year}-01-01`}
      `;

      return NextResponse.json({
        statements,
        ytd: ytd[0] || { ytd_revenue: 0, ytd_expenses: 0, ytd_transactions: 0 },
      });
    }

    // Personal — synthesize monthly rollups per account so NetWorth/etc work.
    const statements = await sql`
      SELECT
        to_char(date, 'YYYY-MM') || ':' || account_name AS id,
        to_char(date, 'YYYY-MM') AS month,
        'synthetic'::text AS statement_type,
        account_name,
        NULL::text AS account_type,
        NULL::text AS institution,
        COUNT(*)::int AS transaction_count,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::numeric AS total_credits,
        COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::numeric AS total_debits,
        NULL::numeric AS opening_balance,
        NULL::numeric AS closing_balance
      FROM personal_transactions_unified
      GROUP BY to_char(date, 'YYYY-MM'), account_name
      ORDER BY to_char(date, 'YYYY-MM') DESC, account_name
    `;

    return NextResponse.json({ statements });
  } catch (err) {
    console.error("[finance/statements]", err);
    return NextResponse.json({ error: "Failed to fetch statements" }, { status: 500 });
  }
}
