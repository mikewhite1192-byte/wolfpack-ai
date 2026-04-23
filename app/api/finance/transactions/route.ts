import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// GET /api/finance/transactions?type=business&month=2026-04&category=Software
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
    if (!ADMIN_EMAILS.includes(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const type = req.nextUrl.searchParams.get("type") || "business";
    const month = req.nextUrl.searchParams.get("month");
    const category = req.nextUrl.searchParams.get("category");
    const statementId = req.nextUrl.searchParams.get("statement_id");

    if (type === "business") {
      const transactions = await sql`
        SELECT t.*, s.month AS statement_month
        FROM biz_transactions t
        JOIN biz_statements s ON s.id = t.statement_id
        WHERE 1=1
        ${statementId ? sql`AND t.statement_id = ${statementId}` : sql``}
        ${month ? sql`AND s.month = ${month}` : sql``}
        ${category ? sql`AND t.category = ${category}` : sql``}
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 500
      `;

      const categories = await sql`
        SELECT
          category,
          COUNT(*)::int AS count,
          COALESCE(SUM(ABS(amount)), 0)::numeric AS total,
          COALESCE(SUM(CASE WHEN is_deductible THEN ABS(amount) * deduction_pct / 100 ELSE 0 END), 0)::numeric AS deductible_total
        FROM biz_transactions
        WHERE amount < 0
        ${month ? sql`AND statement_id IN (SELECT id FROM biz_statements WHERE month = ${month})` : sql``}
        GROUP BY category
        ORDER BY total DESC
      `;

      return NextResponse.json({ transactions, categories });
    } else {
      // Personal transactions
      const accountId = req.nextUrl.searchParams.get("account_id");

      const transactions = await sql`
        SELECT t.*, a.name AS account_name, a.type AS account_type
        FROM personal_transactions t
        JOIN personal_accounts a ON a.id = t.account_id
        WHERE 1=1
        ${statementId ? sql`AND t.statement_id = ${statementId}` : sql``}
        ${accountId ? sql`AND t.account_id = ${accountId}` : sql``}
        ${month ? sql`AND t.statement_id IN (SELECT id FROM personal_statements WHERE month = ${month})` : sql``}
        ${category ? sql`AND t.category = ${category}` : sql``}
        ORDER BY t.date DESC
        LIMIT 500
      `;

      return NextResponse.json({ transactions });
    }
  } catch (err) {
    console.error("[finance/transactions]", err);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

// POST /api/finance/transactions — create a manual business expense
// (used for pre-Mercury historical spend that lived on personal cards).
// Not wired for personal creation; personal txns come from Mercury or PDFs.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
    if (!ADMIN_EMAILS.includes(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const {
      type = "business",
      date,
      description,
      amount,
      category,
      subcategory,
      is_deductible = true,
      deduction_pct = 100,
      irs_reference,
      notes,
    } = body;

    if (type !== "business") {
      return NextResponse.json({ error: "Manual creation only supported for business" }, { status: 400 });
    }
    if (!date || !description || typeof amount !== "number" || !category) {
      return NextResponse.json(
        { error: "Missing required fields: date, description, amount, category" },
        { status: 400 },
      );
    }

    // Manual biz expenses are negative (money spent). Accept positive input and flip.
    const signedAmount = amount > 0 ? -Math.abs(amount) : amount;

    const result = await sql`
      INSERT INTO biz_transactions (
        statement_id, date, description, amount, type,
        category, subcategory, is_deductible, deduction_pct, irs_reference, notes
      ) VALUES (
        NULL, ${date}, ${description}, ${signedAmount}, 'expense',
        ${category}, ${subcategory ?? null}, ${is_deductible}, ${deduction_pct},
        ${irs_reference ?? null}, ${notes ?? null}
      )
      RETURNING id
    `;

    return NextResponse.json({ ok: true, id: result[0].id });
  } catch (err) {
    console.error("[finance/transactions POST]", err);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

// PATCH /api/finance/transactions — update a transaction's category
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
    if (!ADMIN_EMAILS.includes(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id, type, category, subcategory, is_deductible, deduction_pct, irs_reference, notes } = await req.json();

    if (!id) return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });

    if (type === "personal") {
      await sql`
        UPDATE personal_transactions SET
          category = COALESCE(${category ?? null}, category),
          subcategory = COALESCE(${subcategory ?? null}, subcategory),
          notes = ${notes ?? null}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE biz_transactions SET
          category = COALESCE(${category ?? null}, category),
          subcategory = COALESCE(${subcategory ?? null}, subcategory),
          is_deductible = COALESCE(${is_deductible ?? null}, is_deductible),
          deduction_pct = COALESCE(${deduction_pct ?? null}, deduction_pct),
          irs_reference = COALESCE(${irs_reference ?? null}, irs_reference),
          notes = ${notes ?? null}
        WHERE id = ${id}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[finance/transactions PATCH]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
