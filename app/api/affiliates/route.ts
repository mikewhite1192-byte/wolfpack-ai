import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS affiliates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT,
      name TEXT,
      email TEXT UNIQUE,
      code TEXT UNIQUE,
      stripe_account_id TEXT,
      commission_rate NUMERIC DEFAULT 0.20,
      total_earned NUMERIC DEFAULT 0,
      total_paid NUMERIC DEFAULT 0,
      total_clicks INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      affiliate_id UUID REFERENCES affiliates(id),
      org_id TEXT,
      status TEXT DEFAULT 'signed_up',
      monthly_value NUMERIC DEFAULT 0,
      commission NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS affiliate_payouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      affiliate_id UUID REFERENCES affiliates(id),
      amount NUMERIC,
      stripe_transfer_id TEXT,
      period_start DATE,
      period_end DATE,
      status TEXT DEFAULT 'pending',
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS affiliate_login_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      token TEXT,
      expires_at TIMESTAMPTZ,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

function generateCode(name: string): string {
  const firstName = name.trim().split(/\s+/)[0].toLowerCase();
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${firstName}-${suffix}`;
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const { name, email } = await req.json();
    if (!name || !email) {
      return NextResponse.json({ error: "name and email are required" }, { status: 400 });
    }

    const lowerEmail = email.toLowerCase();
    const existing = await sql`SELECT id, code FROM affiliates WHERE email = ${lowerEmail}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Affiliate with this email already exists", code: existing[0].code }, { status: 409 });
    }

    const code = generateCode(name);
    const result = await sql`
      INSERT INTO affiliates (name, email, code, status)
      VALUES (${name}, ${lowerEmail}, ${code}, 'active')
      RETURNING id, name, email, code, commission_rate, status, created_at
    `;

    return NextResponse.json({ ok: true, affiliate: result[0] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("Error creating affiliate:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const email = req.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "email query param is required" }, { status: 400 });
    }

    const lowerEmail = email.toLowerCase();
    const result = await sql`
      SELECT id, name, email, code, commission_rate, total_earned, total_paid, total_clicks, status, created_at
      FROM affiliates WHERE email = ${lowerEmail}
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }

    return NextResponse.json({ affiliate: result[0] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("Error fetching affiliate:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
