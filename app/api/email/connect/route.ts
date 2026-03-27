import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/gmail";

// GET /api/email/connect — redirect to Google OAuth
export async function GET() {
  const url = getGoogleAuthUrl();
  return NextResponse.redirect(url);
}
