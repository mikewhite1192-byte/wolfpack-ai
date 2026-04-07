import { NextResponse } from "next/server";
import { getOrCreateWorkspace } from "@/lib/workspace";

/**
 * GET /api/meta/connect
 * Redirects the authenticated user to Facebook's OAuth dialog
 * to connect their Facebook page for Lead Ads.
 */
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();

    const clientId = process.env.META_APP_ID;
    if (!clientId) {
      console.error("[meta-connect] META_APP_ID not configured");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?meta=error&reason=config`
      );
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/meta/callback`;
    const scope = "pages_show_list,pages_manage_metadata,leads_retrieval";

    // Encode workspace ID as state parameter (base64 for basic obfuscation)
    const statePayload = JSON.stringify({
      ws: workspace.id,
      ts: Date.now(),
    });
    const state = Buffer.from(statePayload).toString("base64url");

    const oauthUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("scope", scope);
    oauthUrl.searchParams.set("state", state);

    return NextResponse.redirect(oauthUrl.toString());
  } catch (err) {
    console.error("[meta-connect] Error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings?meta=error`
    );
  }
}
