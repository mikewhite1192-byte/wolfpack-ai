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

// GET /api/finance/quarterly-payments?year=2026
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const year = parseInt(req.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));
    const payments = await sql`
      SELECT * FROM biz_tax_payments
      WHERE year = ${year}
      ORDER BY quarter ASC, type ASC
    `;
    return NextResponse.json({ payments });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/finance/quarterly-payments — record a payment
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { quarter, year, type, amount, confirmation_number } = await req.json();

    if (!quarter || !year || !type || !amount) {
      return NextResponse.json({ error: "quarter, year, type, and amount required" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO biz_tax_payments (quarter, year, type, amount, paid_date, confirmation_number, status)
      VALUES (${quarter}, ${year}, ${type}, ${amount}, CURRENT_DATE, ${confirmation_number || null}, 'paid')
      RETURNING *
    `;

    return NextResponse.json({ payment: result[0] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
