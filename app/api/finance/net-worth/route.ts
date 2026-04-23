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

// Computes personal + business net worth as the union of:
// - Mercury accounts (live sync, source of truth for Mike's banking)
// - Legacy personal_accounts (manual entries the user may add for external
//   cards, 401k, etc. that Mercury can't see)
async function computeBalances() {
  // Mercury personal: split by kind for the assets breakdown.
  const mercuryPersonal = await sql`
    SELECT kind, COALESCE(SUM(current_balance), 0)::numeric AS total
    FROM mercury_accounts
    WHERE workspace = 'personal' AND archived = false
    GROUP BY kind
  `;
  const mp: Record<string, number> = {};
  for (const r of mercuryPersonal) mp[r.kind as string] = parseFloat(String(r.total)) || 0;

  // Mercury business: one aggregate (business net worth).
  const mercuryBusinessRows = await sql`
    SELECT COALESCE(SUM(current_balance), 0)::numeric AS total
    FROM mercury_accounts
    WHERE workspace = 'business' AND archived = false
  `;
  const mercuryBusiness = parseFloat(String(mercuryBusinessRows[0]?.total)) || 0;

  // Legacy personal_accounts (for manual external accounts).
  const legacy = await sql`
    SELECT type, COALESCE(SUM(current_balance), 0)::numeric AS total
    FROM personal_accounts
    WHERE is_active = TRUE
    GROUP BY type
  `;
  const lg: Record<string, number> = {};
  for (const r of legacy) lg[r.type as string] = parseFloat(String(r.total)) || 0;

  // Merge. Mercury "checking" + legacy "checking" etc. Mercury doesn't
  // surface retirement accounts, so those only come from legacy.
  const checking = (mp["checking"] || 0) + (lg["checking"] || 0);
  const savings = (mp["savings"] || 0) + (lg["savings"] || 0);
  const investments = (mp["investment"] || 0) + (lg["investment"] || 0);
  const retirement = lg["retirement"] || 0;
  const treasury = mp["treasury"] || 0;
  // Mercury credit card kind is "creditCard"; legacy uses "credit_card".
  const creditCards = (mp["creditCard"] || 0) + (lg["credit_card"] || 0);

  return {
    checking,
    savings,
    investments,
    retirement,
    treasury,
    creditCards,
    businessNetWorth: mercuryBusiness,
  };
}

// GET /api/finance/net-worth
export async function GET() {
  try {
    await requireAdmin();
    const b = await computeBalances();

    const totalAssets = b.checking + b.savings + b.investments + b.retirement + b.treasury;
    const totalLiabilities = Math.abs(b.creditCards);
    const personalNetWorth = totalAssets - totalLiabilities;
    const combinedNetWorth = personalNetWorth + b.businessNetWorth;

    const history = await sql`
      SELECT snapshot_date, net_worth, combined_net_worth
      FROM personal_net_worth_snapshots
      ORDER BY snapshot_date DESC
      LIMIT 12
    `;
    const prevSnapshot = history.length > 0 ? history[0] : null;
    const monthChange = prevSnapshot
      ? personalNetWorth - (parseFloat(String(prevSnapshot.net_worth)) || 0)
      : 0;

    return NextResponse.json({
      assets: {
        checking: b.checking,
        savings: b.savings,
        investments: b.investments,
        retirement: b.retirement,
        total: totalAssets,
      },
      liabilities: {
        creditCards: totalLiabilities,
        total: totalLiabilities,
      },
      personalNetWorth,
      businessNetWorth: b.businessNetWorth,
      combinedNetWorth,
      monthChange,
      history: history.reverse(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/finance/net-worth — save a snapshot row (for the history chart)
export async function POST() {
  try {
    await requireAdmin();
    const b = await computeBalances();

    const checkingSavings = b.checking + b.savings + b.treasury;
    const totalAssets = checkingSavings + b.investments + b.retirement;
    const creditCardDebt = Math.abs(b.creditCards);
    const netWorth = totalAssets - creditCardDebt;

    const result = await sql`
      INSERT INTO personal_net_worth_snapshots (
        snapshot_date, total_assets, checking_savings, investments, retirement,
        total_liabilities, credit_card_debt, net_worth, business_net_worth, combined_net_worth
      ) VALUES (
        CURRENT_DATE, ${totalAssets}, ${checkingSavings}, ${b.investments}, ${b.retirement},
        ${creditCardDebt}, ${creditCardDebt}, ${netWorth}, ${b.businessNetWorth},
        ${netWorth + b.businessNetWorth}
      )
      RETURNING *
    `;

    return NextResponse.json({ snapshot: result[0] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
