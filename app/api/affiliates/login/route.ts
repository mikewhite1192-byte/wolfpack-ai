import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import nodemailer from "nodemailer";

const sql = neon(process.env.DATABASE_URL!);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "info@thewolfpackco.com",
    pass: process.env.WOLFPACK_SMTP_PASS,
  },
});

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

    const loginUrl = `https://thewolfpack.ai/api/affiliates/login?token=${token}`;

    await transporter.sendMail({
      from: '"The Wolf Pack" <info@thewolfpackco.com>',
      to: lowerEmail,
      subject: "Your Wolf Pack Affiliate Login Link",
      html: `
        <div style="font-family:'Courier New',monospace;max-width:560px;background:#0a0a0a;color:#e8eaf0;padding:40px;border-radius:12px;">
          <div style="background:#E86A2A;display:inline-block;padding:6px 14px;border-radius:6px;font-weight:700;font-size:13px;color:#fff;margin-bottom:24px;">The Wolf Pack</div>
          <h1 style="font-size:20px;font-weight:800;color:#e8eaf0;margin:0 0 12px;">Your login link</h1>
          <p style="font-size:14px;color:#b0b4c8;margin:0 0 24px;line-height:1.6;">Click the button below to access your affiliate dashboard. This link expires in 1 hour.</p>
          <a href="${loginUrl}" style="display:block;text-align:center;background:#E86A2A;color:#fff;text-decoration:none;padding:14px;border-radius:8px;font-weight:700;font-size:14px;margin-bottom:24px;">
            Open Dashboard
          </a>
          <p style="font-size:11px;color:#5a5e72;margin:0;">If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });

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
