import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { parseStatementWithClaude } from "@/lib/finance/pdf-parser-claude";
import { categorizeTransaction, detectTransactionType } from "@/lib/finance/biz-categorizer";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// POST /api/finance/parse-statement
// Accepts a PDF file upload, parses it via Claude (handles any bank/credit card),
// auto-creates the personal_accounts row if needed, and stores everything.
//
// FormData fields:
//   file: PDF file (required)
//   type: "business" | "personal" (required)
//   account_id: UUID (optional for personal — we'll find-or-create based on
//     detected institution + last_four. Required if you want to force a specific account.)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = (formData.get("type") as string) || "business";
    const suppliedAccountId = formData.get("account_id") as string | null;

    if (!file || !file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "PDF file required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseStatementWithClaude(buffer, file.name);

    if (!parsed.transactions || parsed.transactions.length === 0) {
      return NextResponse.json(
        { error: "Parser found no transactions. Is this a valid statement PDF?" },
        { status: 422 },
      );
    }

    if (type === "business") {
      // Business flow: single biz_statements table, no per-account split.
      const stmtResult = await sql`
        INSERT INTO biz_statements (
          filename, month, opening_balance, closing_balance,
          total_deposits, total_withdrawals, parsed_at
        ) VALUES (
          ${file.name}, ${parsed.month},
          ${parsed.opening_balance}, ${parsed.closing_balance},
          ${parsed.total_credits}, ${parsed.total_debits}, NOW()
        )
        RETURNING id
      `;
      const statementId = stmtResult[0].id as string;

      let inserted = 0;
      for (const tx of parsed.transactions) {
        const cat = categorizeTransaction(tx.description);
        const txType = detectTransactionType(tx.amount, tx.description);

        await sql`
          INSERT INTO biz_transactions (
            statement_id, date, description, amount, type,
            category, subcategory, is_deductible, deduction_pct, irs_reference
          ) VALUES (
            ${statementId}, ${tx.date}, ${tx.description}, ${tx.amount}, ${txType},
            ${cat.category}, ${cat.subcategory}, ${cat.isDeductible}, ${cat.deductionPct}, ${cat.irsReference}
          )
        `;
        inserted++;
      }

      return NextResponse.json({
        ok: true,
        type: "business",
        statementId,
        institution: parsed.institution,
        account_type: parsed.account_type,
        statement_type: parsed.statement_type,
        last_four: parsed.last_four,
        month: parsed.month,
        openingBalance: parsed.opening_balance,
        closingBalance: parsed.closing_balance,
        totalDeposits: parsed.total_credits,
        totalWithdrawals: parsed.total_debits,
        transactionsImported: inserted,
      });
    }

    // Personal flow: resolve account_id (supplied or find-or-create).
    let accountId = suppliedAccountId;

    if (!accountId) {
      // Find-or-create by (institution, last_four). If last_four is null we
      // fall back to (institution, type).
      const existing = parsed.last_four
        ? await sql`
            SELECT id FROM personal_accounts
            WHERE institution = ${parsed.institution}
              AND last_four = ${parsed.last_four}
            LIMIT 1
          `
        : await sql`
            SELECT id FROM personal_accounts
            WHERE institution = ${parsed.institution}
              AND type = ${parsed.account_type}
            LIMIT 1
          `;

      if (existing.length > 0) {
        accountId = existing[0].id as string;
      } else {
        const name =
          parsed.account_type === "credit_card"
            ? `${parsed.institution} Credit Card${parsed.last_four ? ` ••${parsed.last_four}` : ""}`
            : `${parsed.institution} ${parsed.account_type === "savings" ? "Savings" : "Checking"}${parsed.last_four ? ` ••${parsed.last_four}` : ""}`;
        const created = await sql`
          INSERT INTO personal_accounts (
            name, type, institution, last_four,
            current_balance, credit_limit, is_active
          ) VALUES (
            ${name}, ${parsed.account_type}, ${parsed.institution}, ${parsed.last_four},
            ${parsed.closing_balance ?? 0}, ${parsed.credit_limit}, true
          )
          RETURNING id
        `;
        accountId = created[0].id as string;
      }
    }

    const stmtResult = await sql`
      INSERT INTO personal_statements (
        account_id, filename, month, statement_type,
        opening_balance, closing_balance,
        total_credits, total_debits,
        minimum_payment, parsed_at
      ) VALUES (
        ${accountId}, ${file.name}, ${parsed.month}, ${parsed.statement_type},
        ${parsed.opening_balance}, ${parsed.closing_balance},
        ${parsed.total_credits}, ${parsed.total_debits},
        ${parsed.minimum_payment_due}, NOW()
      )
      RETURNING id
    `;
    const statementId = stmtResult[0].id as string;

    let inserted = 0;
    for (const tx of parsed.transactions) {
      const txType = detectTransactionType(tx.amount, tx.description);
      const category = txType === "income" ? "Income" : "Uncategorized";

      await sql`
        INSERT INTO personal_transactions (
          statement_id, account_id, date, description, amount, type, category
        ) VALUES (
          ${statementId}, ${accountId}, ${tx.date}, ${tx.description}, ${tx.amount},
          ${txType}, ${category}
        )
      `;
      inserted++;
    }

    // Update account current balance from closing balance.
    if (parsed.closing_balance != null) {
      await sql`
        UPDATE personal_accounts
        SET current_balance = ${parsed.closing_balance},
            credit_limit = COALESCE(${parsed.credit_limit}, credit_limit)
        WHERE id = ${accountId}
      `;
    }

    return NextResponse.json({
      ok: true,
      type: "personal",
      statementId,
      accountId,
      institution: parsed.institution,
      account_type: parsed.account_type,
      statement_type: parsed.statement_type,
      last_four: parsed.last_four,
      month: parsed.month,
      openingBalance: parsed.opening_balance,
      closingBalance: parsed.closing_balance,
      transactionsImported: inserted,
    });
  } catch (err) {
    console.error("[finance/parse-statement]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse failed" },
      { status: 500 },
    );
  }
}
