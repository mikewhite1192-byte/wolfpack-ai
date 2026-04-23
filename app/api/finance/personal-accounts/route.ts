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

// Maps Mercury kind -> the personal-accounts "type" the UI expects.
function kindToType(kind: string): string {
  if (kind === "creditCard") return "credit_card";
  return kind; // checking, savings, treasury, investment
}

// GET /api/finance/personal-accounts
// Returns the union of Mercury personal-workspace accounts and any rows
// in the legacy personal_accounts table (kept so manual entries still work),
// normalized to the shape the NetWorthDashboard expects.
export async function GET() {
  try {
    await requireAdmin();

    const [mercuryRows, legacyRows] = await Promise.all([
      sql`
        SELECT id, name, kind, legal_business_name AS institution,
               current_balance, NULL::numeric AS credit_limit,
               NULL::numeric AS interest_rate, 'mercury'::text AS source
        FROM mercury_accounts
        WHERE workspace = 'personal' AND archived = false
      `,
      sql`
        SELECT id, name, type AS kind, institution,
               current_balance, credit_limit, interest_rate,
               'manual'::text AS source
        FROM personal_accounts
        WHERE is_active = TRUE
      `,
    ]);

    const accounts = [
      ...mercuryRows.map((r) => ({
        id: r.id,
        name: r.name,
        type: kindToType(r.kind as string),
        institution: r.institution ?? "Mercury",
        current_balance: r.current_balance,
        credit_limit: r.credit_limit,
        interest_rate: r.interest_rate,
        source: "mercury",
      })),
      ...legacyRows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.kind, // legacy already stores the normalized type
        institution: r.institution,
        current_balance: r.current_balance,
        credit_limit: r.credit_limit,
        interest_rate: r.interest_rate,
        source: "manual",
      })),
    ].sort((a, b) => {
      if (a.type === b.type) return String(a.name).localeCompare(String(b.name));
      return String(a.type).localeCompare(String(b.type));
    });

    return NextResponse.json({ accounts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}

// POST /api/finance/personal-accounts — add a new account (manual)
// Still useful for accounts Mercury can't track (external credit cards, 401k, etc.)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { name, type, institution, last_four, current_balance, credit_limit, interest_rate } =
      await req.json();
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

// PATCH /api/finance/personal-accounts — update a manual account
// Mercury accounts are read-only here (they sync from the API). Editing a
// Mercury row via this endpoint is rejected so the next sync won't overwrite
// the change silently.
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const { id, name, current_balance, credit_limit, interest_rate, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Only proceed if this id belongs to the legacy/manual table.
    const exists = await sql`SELECT 1 FROM personal_accounts WHERE id = ${id} LIMIT 1`;
    if (exists.length === 0) {
      return NextResponse.json(
        { error: "Account not found or is a Mercury account (read-only; updates come from sync)" },
        { status: 404 },
      );
    }

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
