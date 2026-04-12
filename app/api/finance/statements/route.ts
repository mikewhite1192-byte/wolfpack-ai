import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// GET /api/finance/statements?type=business
// Returns all uploaded statements with summary stats
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
          s.*,
          COUNT(t.id)::int AS transaction_count,
          COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0)::numeric AS total_income,
          COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.amount < 0), 0)::numeric AS total_expenses
        FROM biz_statements s
        LEFT JOIN biz_transactions t ON t.statement_id = s.id
        GROUP BY s.id
        ORDER BY s.month DESC
      `;

      // YTD aggregates
      const year = new Date().getFullYear();
      const ytd = await sql`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::numeric AS ytd_revenue,
          COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0)::numeric AS ytd_expenses,
          COUNT(*)::int AS ytd_transactions
        FROM biz_transactions
        WHERE date >= ${`${year}-01-01`}
      `;

      return NextResponse.json({
        statements,
        ytd: ytd[0] || { ytd_revenue: 0, ytd_expenses: 0, ytd_transactions: 0 },
      });
    } else {
      const statements = await sql`
        SELECT
          s.*,
          a.name AS account_name,
          a.type AS account_type,
          a.institution,
          COUNT(t.id)::int AS transaction_count
        FROM personal_statements s
        JOIN personal_accounts a ON a.id = s.account_id
        LEFT JOIN personal_transactions t ON t.statement_id = s.id
        GROUP BY s.id, a.name, a.type, a.institution
        ORDER BY s.month DESC
      `;

      return NextResponse.json({ statements });
    }
  } catch (err) {
    console.error("[finance/statements]", err);
    return NextResponse.json({ error: "Failed to fetch statements" }, { status: 500 });
  }
}
