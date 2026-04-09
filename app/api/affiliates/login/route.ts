import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

    const lowerEmail = email.toLowerCase();
    const affiliates = await sql`SELECT id FROM affiliates WHERE email = ${lowerEmail}`;
    if (affiliates.length === 0) {
      return NextResponse.json({ error: "No affiliate found with this email" }, { status: 404 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await sql`
      INSERT INTO affiliate_login_tokens (email, token, expires_at)
      VALUES (${lowerEmail}, ${token}, ${expiresAt})
    `;

    // TODO: Send email with link: https://thewolfpack.ai/api/affiliates/login?token=TOKEN
    console.log(`[affiliate login] Magic link token for ${lowerEmail}: ${token}`);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/affiliates?error=missing_token", req.url));
  }

  try {
    const tokens = await sql`
      SELECT id, email FROM affiliate_login_tokens
      WHERE token = ${token} AND used = false AND expires_at > NOW()
    `;

    if (tokens.length === 0) {
      return NextResponse.redirect(new URL("/affiliates?error=invalid_or_expired", req.url));
    }

    const { id, email } = tokens[0];
    await sql`UPDATE affiliate_login_tokens SET used = true WHERE id = ${id}`;

    const response = NextResponse.redirect(new URL("/affiliates/dashboard", req.url));
    response.cookies.set("wp_affiliate_email", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/affiliates?error=server_error", req.url));
  }
}
