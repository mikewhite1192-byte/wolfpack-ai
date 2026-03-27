import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { exchangeCodeForTokens } from "@/lib/gmail";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/email/callback — Google OAuth callback
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      return NextResponse.redirect(new URL("/dashboard/settings?email=error", req.url));
    }

    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL("/dashboard/settings?email=error", req.url));
    }

    // Get user email
    const userInfo = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userInfo.json();

    const workspace = await getOrCreateWorkspace();

    await sql`
      UPDATE workspaces SET
        gmail_access_token = ${tokens.access_token},
        gmail_refresh_token = ${tokens.refresh_token || null},
        gmail_email = ${user.email || null},
        gmail_connected = true
      WHERE id = ${workspace.id}
    `;

    return NextResponse.redirect(new URL("/dashboard/email?connected=true", req.url));
  } catch (err) {
    console.error("[email-callback] Error:", err);
    return NextResponse.redirect(new URL("/dashboard/settings?email=error", req.url));
  }
}
