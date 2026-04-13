import { NextRequest, NextResponse } from "next/server";
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

// GET /api/finance/credit-reports
export async function GET() {
  try {
    await requireAdmin();
    const reports = await sql`
      SELECT * FROM personal_credit_reports ORDER BY report_date DESC LIMIT 20
    `;
    return NextResponse.json({ reports });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/finance/credit-reports — manual score entry
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { score_equifax, score_transunion, score_experian, score_average, utilization_rate, payment_history_pct, hard_inquiries_12mo, oldest_account_years, total_accounts, open_accounts, derogatory_marks } = body;

    const result = await sql`
      INSERT INTO personal_credit_reports (
        report_date, filename, score_equifax, score_transunion, score_experian, score_average,
        utilization_rate, payment_history_pct, hard_inquiries_12mo, oldest_account_years,
        total_accounts, open_accounts, derogatory_marks
      ) VALUES (
        CURRENT_DATE, 'manual_entry', ${score_equifax || null}, ${score_transunion || null},
        ${score_experian || null}, ${score_average || null}, ${utilization_rate || null},
        ${payment_history_pct || null}, ${hard_inquiries_12mo || null},
        ${oldest_account_years || null}, ${total_accounts || null},
        ${open_accounts || null}, ${derogatory_marks || null}
      )
      RETURNING *
    `;

    return NextResponse.json({ report: result[0] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
