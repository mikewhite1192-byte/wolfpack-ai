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

// GET /api/finance/personal-accounts
export async function GET() {
  try {
    await requireAdmin();
    const accounts = await sql`
      SELECT * FROM personal_accounts WHERE is_active = TRUE ORDER BY type, name
    `;
    return NextResponse.json({ accounts });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/finance/personal-accounts — add a new account
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { name, type, institution, last_four, current_balance, credit_limit, interest_rate } = await req.json();
    if (!name || !type) return NextResponse.json({ error: "name and type required" }, { status: 400 });

    const result = await sql`
      INSERT INTO personal_accounts (name, type, institution, last_four, current_balance, credit_limit, interest_rate)
      VALUES (${name}, ${type}, ${institution || null}, ${last_four || null}, ${current_balance || 0}, ${credit_limit || null}, ${interest_rate || null})
      RETURNING *
    `;
    return NextResponse.json({ account: result[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// PATCH /api/finance/personal-accounts — update an account's balance or details
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const { id, name, current_balance, credit_limit, interest_rate, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await sql`
      UPDATE personal_accounts SET
        name = COALESCE(${name ?? null}, name),
        current_balance = COALESCE(${current_balance ?? null}, current_balance),
        credit_limit = COALESCE(${credit_limit ?? null}, credit_limit),
        interest_rate = COALESCE(${interest_rate ?? null}, interest_rate),
        is_active = COALESCE(${is_active ?? null}, is_active)
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
