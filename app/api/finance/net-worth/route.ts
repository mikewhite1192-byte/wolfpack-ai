import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) throw new Error("Forbidden");
}

// GET /api/finance/net-worth — compute current net worth from account balances
export async function GET() {
  try {
    await requireAdmin();

    // Personal accounts
    const accounts = await sql`
      SELECT type, COALESCE(SUM(current_balance), 0)::numeric AS total
      FROM personal_accounts
      WHERE is_active = TRUE
      GROUP BY type
    `;

    const byType: Record<string, number> = {};
    for (const a of accounts) byType[a.type as string] = parseFloat(String(a.total)) || 0;

    const checking = byType["checking"] || 0;
    const savings = byType["savings"] || 0;
    const investments = byType["investment"] || 0;
    const retirement = byType["retirement"] || 0;
    const creditCards = byType["credit_card"] || 0; // These are NEGATIVE (debt)

    const totalAssets = checking + savings + investments + retirement;
    const totalLiabilities = Math.abs(creditCards); // credit card balances are debts
    const personalNetWorth = totalAssets - totalLiabilities;

    // Business net worth (from biz statements — just the latest closing balance)
    const bizBalance = await sql`
      SELECT closing_balance FROM biz_statements ORDER BY month DESC LIMIT 1
    `;
    const businessNetWorth = parseFloat(String(bizBalance[0]?.closing_balance)) || 0;

    const combinedNetWorth = personalNetWorth + businessNetWorth;

    // Historical snapshots
    const history = await sql`
      SELECT snapshot_date, net_worth, combined_net_worth
      FROM personal_net_worth_snapshots
      ORDER BY snapshot_date DESC
      LIMIT 12
    `;

    // Previous month's net worth for comparison
    const prevSnapshot = history.length > 0 ? history[0] : null;
    const monthChange = prevSnapshot ? personalNetWorth - (parseFloat(String(prevSnapshot.net_worth)) || 0) : 0;

    return NextResponse.json({
      assets: {
        checking,
        savings,
        investments,
        retirement,
        total: totalAssets,
      },
      liabilities: {
        creditCards: totalLiabilities,
        total: totalLiabilities,
      },
      personalNetWorth,
      businessNetWorth,
      combinedNetWorth,
      monthChange,
      history: history.reverse(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/finance/net-worth — save a snapshot (triggered after uploads)
export async function POST() {
  try {
    await requireAdmin();

    // Recalculate from accounts
    const accounts = await sql`
      SELECT type, COALESCE(SUM(current_balance), 0)::numeric AS total
      FROM personal_accounts WHERE is_active = TRUE GROUP BY type
    `;
    const byType: Record<string, number> = {};
    for (const a of accounts) byType[a.type as string] = parseFloat(String(a.total)) || 0;

    const checkingSavings = (byType["checking"] || 0) + (byType["savings"] || 0);
    const investments = byType["investment"] || 0;
    const retirement = byType["retirement"] || 0;
    const totalAssets = checkingSavings + investments + retirement;
    const creditCardDebt = Math.abs(byType["credit_card"] || 0);
    const netWorth = totalAssets - creditCardDebt;

    const bizBalance = await sql`SELECT closing_balance FROM biz_statements ORDER BY month DESC LIMIT 1`;
    const businessNetWorth = parseFloat(String(bizBalance[0]?.closing_balance)) || 0;

    const result = await sql`
      INSERT INTO personal_net_worth_snapshots (
        snapshot_date, total_assets, checking_savings, investments, retirement,
        total_liabilities, credit_card_debt, net_worth, business_net_worth, combined_net_worth
      ) VALUES (
        CURRENT_DATE, ${totalAssets}, ${checkingSavings}, ${investments}, ${retirement},
        ${creditCardDebt}, ${creditCardDebt}, ${netWorth}, ${businessNetWorth}, ${netWorth + businessNetWorth}
      )
      RETURNING *
    `;

    return NextResponse.json({ snapshot: result[0] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
