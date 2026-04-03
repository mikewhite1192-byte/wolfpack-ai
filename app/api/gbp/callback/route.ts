import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { exchangeGbpCode, listAccounts, listLocations } from "@/lib/gbp";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/gbp/callback — Google OAuth callback for GBP
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const workspaceId = searchParams.get("state");

    if (error || !code) {
      return NextResponse.redirect(new URL("/dashboard/settings?gbp=error", req.url));
    }

    const tokens = await exchangeGbpCode(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL("/dashboard/settings?gbp=error", req.url));
    }

    // Get user email
    const userInfo = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userInfo.json();

    // Get GBP accounts and locations
    const accounts = await listAccounts(tokens.access_token);
    const accountList = accounts.accounts || [];

    let accountId = "";
    let locationId = "";
    let locationName = "";

    // Auto-select first account and location
    if (accountList.length > 0) {
      accountId = accountList[0].name || "";
      const locations = await listLocations(tokens.access_token, accountId.replace("accounts/", ""));
      const locationList = locations.locations || [];

      if (locationList.length > 0) {
        locationId = locationList[0].name || "";
        locationName = locationList[0].title || "";
      }
    }

    // Create GBP connection
    await sql`
      INSERT INTO gbp_connections (
        workspace_id, access_token, refresh_token, connected_email, connected,
        account_id, location_id, location_name
      ) VALUES (
        ${workspaceId}, ${tokens.access_token}, ${tokens.refresh_token || null},
        ${user.email || null}, TRUE,
        ${accountId}, ${locationId}, ${locationName}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    return NextResponse.redirect(new URL("/dashboard/settings?gbp=connected", req.url));
  } catch (err) {
    console.error("[gbp-callback] Error:", err);
    return NextResponse.redirect(new URL("/dashboard/settings?gbp=error", req.url));
  }
}
