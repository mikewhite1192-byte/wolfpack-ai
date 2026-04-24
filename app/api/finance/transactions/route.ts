import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// GET /api/finance/transactions?type=business&month=2026-04&category=Software
// Reads from the unified views so Mercury-synced rows and any legacy
// statement-imported rows come through the same API.
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

    if (type === "business") {
      const transactions = month
        ? category
          ? await sql`
              SELECT * FROM business_transactions_unified
              WHERE to_char(date, 'YYYY-MM') = ${month} AND category = ${category}
              ORDER BY date DESC LIMIT 500
            `
          : await sql`
              SELECT * FROM business_transactions_unified
              WHERE to_char(date, 'YYYY-MM') = ${month}
              ORDER BY date DESC LIMIT 500
            `
        : category
          ? await sql`
              SELECT * FROM business_transactions_unified
              WHERE category = ${category}
              ORDER BY date DESC LIMIT 500
            `
          : await sql`
              SELECT * FROM business_transactions_unified
              ORDER BY date DESC LIMIT 500
            `;

      const categories = month
        ? await sql`
            SELECT
              COALESCE(category, 'Uncategorized') AS category,
              COUNT(*)::int AS count,
              COALESCE(SUM(ABS(amount)), 0)::numeric AS total,
              COALESCE(SUM(CASE WHEN is_deductible
                                 THEN ABS(amount) * COALESCE(deduction_pct, 100) / 100
                                 ELSE 0 END), 0)::numeric AS deductible_total
            FROM business_transactions_unified
            WHERE amount < 0 AND to_char(date, 'YYYY-MM') = ${month}
            GROUP BY COALESCE(category, 'Uncategorized')
            ORDER BY total DESC
          `
        : await sql`
            SELECT
              COALESCE(category, 'Uncategorized') AS category,
              COUNT(*)::int AS count,
              COALESCE(SUM(ABS(amount)), 0)::numeric AS total,
              COALESCE(SUM(CASE WHEN is_deductible
                                 THEN ABS(amount) * COALESCE(deduction_pct, 100) / 100
                                 ELSE 0 END), 0)::numeric AS deductible_total
            FROM business_transactions_unified
            WHERE amount < 0
            GROUP BY COALESCE(category, 'Uncategorized')
            ORDER BY total DESC
          `;

      return NextResponse.json({ transactions, categories });
    }

    // Personal
    const accountId = req.nextUrl.searchParams.get("account_id");

    const transactions = month
      ? category
        ? await sql`
            SELECT * FROM personal_transactions_unified
            WHERE to_char(date, 'YYYY-MM') = ${month} AND category = ${category}
            ORDER BY date DESC LIMIT 500
          `
        : await sql`
            SELECT * FROM personal_transactions_unified
            WHERE to_char(date, 'YYYY-MM') = ${month}
            ORDER BY date DESC LIMIT 500
          `
      : category
        ? await sql`
            SELECT * FROM personal_transactions_unified
            WHERE category = ${category}
            ORDER BY date DESC LIMIT 500
          `
        : accountId
          ? await sql`
              SELECT * FROM personal_transactions_unified
              WHERE account_ref = ${accountId}
              ORDER BY date DESC LIMIT 500
            `
          : await sql`
              SELECT * FROM personal_transactions_unified
              ORDER BY date DESC LIMIT 500
            `;

    return NextResponse.json({ transactions });
  } catch (err) {
    console.error("[finance/transactions]", err);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

// POST /api/finance/transactions — create a manual business expense
// (used for pre-Mercury historical spend that lived on personal cards).
// Not wired for personal creation; personal txns come from Mercury.
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

// PATCH /api/finance/transactions — update category/notes on a transaction.
// The unified view pulls from multiple tables; we dispatch to the right one
// based on which table the id exists in.
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
      // Try Mercury first (most personal txns are Mercury now), then legacy.
      const mercuryHit = await sql`
        UPDATE mercury_transactions SET
          our_category = COALESCE(${category ?? null}, our_category),
          our_subcategory = COALESCE(${subcategory ?? null}, our_subcategory),
          our_notes = ${notes ?? null},
          updated_at = now()
        WHERE id = ${id} AND workspace = 'personal'
        RETURNING id
      `;
      if (mercuryHit.length === 0) {
        await sql`
          UPDATE personal_transactions SET
            category = COALESCE(${category ?? null}, category),
            subcategory = COALESCE(${subcategory ?? null}, subcategory),
            notes = ${notes ?? null}
          WHERE id = ${id}
        `;
      }
    } else {
      // Business: Mercury business or legacy biz_transactions.
      const mercuryHit = await sql`
        UPDATE mercury_transactions SET
          our_category = COALESCE(${category ?? null}, our_category),
          our_subcategory = COALESCE(${subcategory ?? null}, our_subcategory),
          is_deductible = COALESCE(${is_deductible ?? null}, is_deductible),
          deduction_pct = COALESCE(${deduction_pct ?? null}, deduction_pct),
          irs_reference = COALESCE(${irs_reference ?? null}, irs_reference),
          our_notes = ${notes ?? null},
          updated_at = now()
        WHERE id = ${id} AND workspace = 'business'
        RETURNING id
      `;
      if (mercuryHit.length === 0) {
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
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[finance/transactions PATCH]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
