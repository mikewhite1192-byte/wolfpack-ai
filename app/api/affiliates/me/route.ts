// GET /api/affiliates/me — read affiliate email from cookie
// DELETE /api/affiliates/me — logout (clear cookie)
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const email = req.cookies.get("wp_affiliate_email")?.value;
  if (!email) {
    return NextResponse.json({ email: null });
  }
  return NextResponse.json({ email });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("wp_affiliate_email", "", { maxAge: 0, path: "/" });
  return res;
}
