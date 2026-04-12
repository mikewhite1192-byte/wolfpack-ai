import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { parseCapitalOneStatement } from "@/lib/finance/pdf-parser";
import { categorizeTransaction, detectTransactionType } from "@/lib/finance/biz-categorizer";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// POST /api/finance/parse-statement
// Accepts a PDF file upload, parses it, categorizes transactions, and
// stores everything in the database.
//
// FormData fields:
//   file: PDF file
//   type: "business" | "personal"
//   account_id: UUID (required for personal, ignored for business)
export async function POST(req: NextRequest) {
  try {
    // Auth
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
    const accountId = formData.get("account_id") as string | null;

    if (!file || !file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "PDF file required" }, { status: 400 });
    }

    // Read the PDF file
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse PDF text — dynamic import to avoid bundling issues
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default || pdfParseModule;
    const pdfData = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer);
    const text = pdfData.text;

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract text from PDF. The file may be image-based — try a text-based PDF statement." },
        { status: 422 },
      );
    }

    // Parse the statement
    const parsed = parseCapitalOneStatement(text);

    if (type === "business") {
      // ── Business statement flow ──────────────────────────────
      // 1. Create statement record
      const stmtResult = await sql`
        INSERT INTO biz_statements (filename, month, opening_balance, closing_balance, total_deposits, total_withdrawals, parsed_at)
        VALUES (${file.name}, ${parsed.month}, ${parsed.openingBalance}, ${parsed.closingBalance}, ${parsed.totalDeposits}, ${parsed.totalWithdrawals}, NOW())
        RETURNING id
      `;
      const statementId = stmtResult[0].id;

      // 2. Categorize and insert transactions
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
        month: parsed.month,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
        totalDeposits: parsed.totalDeposits,
        totalWithdrawals: parsed.totalWithdrawals,
        transactionsImported: inserted,
        transactionsTotal: parsed.transactions.length,
      });
    } else {
      // ── Personal statement flow ──────────────────────────────
      if (!accountId) {
        return NextResponse.json({ error: "account_id required for personal statements" }, { status: 400 });
      }

      // 1. Create statement record
      const stmtResult = await sql`
        INSERT INTO personal_statements (
          account_id, filename, month, statement_type,
          opening_balance, closing_balance, total_credits, total_debits, parsed_at
        ) VALUES (
          ${accountId}, ${file.name}, ${parsed.month}, 'bank',
          ${parsed.openingBalance}, ${parsed.closingBalance},
          ${parsed.totalDeposits}, ${parsed.totalWithdrawals}, NOW()
        )
        RETURNING id
      `;
      const statementId = stmtResult[0].id;

      // 2. Insert transactions (personal categorization is simpler for now)
      let inserted = 0;
      for (const tx of parsed.transactions) {
        const txType = detectTransactionType(tx.amount, tx.description);
        // Personal categorization uses a simplified approach
        // Full personal-categorizer.ts will be built in Phase 6
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

      // 3. Update account balance
      if (parsed.closingBalance > 0) {
        await sql`
          UPDATE personal_accounts SET current_balance = ${parsed.closingBalance}
          WHERE id = ${accountId}
        `;
      }

      return NextResponse.json({
        ok: true,
        type: "personal",
        statementId,
        accountId,
        month: parsed.month,
        transactionsImported: inserted,
      });
    }
  } catch (err) {
    console.error("[finance/parse-statement]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse failed" },
      { status: 500 },
    );
  }
}
