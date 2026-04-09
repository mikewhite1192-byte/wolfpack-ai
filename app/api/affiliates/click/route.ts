import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ ok: false });

    await sql`
      UPDATE affiliates SET total_clicks = COALESCE(total_clicks, 0) + 1
      WHERE code = ${code} AND status = 'active'
    `;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
