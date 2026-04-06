import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/gmail";
import { getOrCreateWorkspace } from "@/lib/workspace";
import crypto from "crypto";

// GET /api/email/connect — redirect to Google OAuth
export async function GET(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    // Generate state token: workspace ID + random nonce for CSRF protection
    const nonce = crypto.randomBytes(16).toString("hex");
    const state = `${workspace.id}:${nonce}`;
    const url = getGoogleAuthUrl(state);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings?email=error", req.url));
  }
}
