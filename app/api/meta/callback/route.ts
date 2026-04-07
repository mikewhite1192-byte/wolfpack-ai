import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

/**
 * GET /api/meta/callback
 * Facebook OAuth callback — exchanges code for tokens,
 * stores page info, and subscribes to leadgen webhooks.
 */
export async function GET(req: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thewolfpack.ai";

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");

    // User denied permissions
    if (errorParam) {
      console.error("[meta-callback] User denied:", errorParam);
      return NextResponse.redirect(
        `${siteUrl}/dashboard/settings?meta=error&reason=denied`
      );
    }

    if (!code || !stateParam) {
      console.error("[meta-callback] Missing code or state");
      return NextResponse.redirect(
        `${siteUrl}/dashboard/settings?meta=error&reason=missing_params`
      );
    }

    // Decode state to get workspace ID
    let workspaceId: string;
    try {
      const decoded = JSON.parse(
        Buffer.from(stateParam, "base64url").toString("utf-8")
      );
      workspaceId = decoded.ws;
      // Reject states older than 10 minutes
      if (Date.now() - decoded.ts > 10 * 60 * 1000) {
        console.error("[meta-callback] State expired");
        return NextResponse.redirect(
          `${siteUrl}/dashboard/settings?meta=error&reason=expired`
        );
      }
    } catch {
      console.error("[meta-callback] Invalid state parameter");
      return NextResponse.redirect(
        `${siteUrl}/dashboard/settings?meta=error&reason=invalid_state`
      );
    }

    // Verify workspace exists
    const workspace = await sql`
      SELECT id FROM workspaces WHERE id = ${workspaceId} AND status = 'active' LIMIT 1
    `;
    if (workspace.length === 0) {
      console.error("[meta-callback] Workspace not found:", workspaceId);
      return NextResponse.redirect(
        `${siteUrl}/dashboard/settings?meta=error&reason=workspace`
      );
    }

    const clientId = process.env.META_APP_ID!;
    const clientSecret = process.env.META_APP_SECRET!;
    const redirectUri = `${siteUrl}/api/meta/callback`;

    // Step 1: Exchange code for short-lived user access token
    const tokenUrl = new URL(
      "https://graph.facebook.com/v19.0/oauth/access_token"
    );
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("[meta-callback] Token exchange error:", tokenData.error);
      return NextResponse.redirect(
        `${siteUrl}/dashboard/settings?meta=error&reason=token`
      );
    }

    const shortLivedToken: string = tokenData.access_token;

    // Step 2: Exchange for long-lived user access token
    const longTokenUrl = new URL(
      "https://graph.facebook.com/v19.0/oauth/access_token"
    );
    longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longTokenUrl.searchParams.set("client_id", clientId);
    longTokenUrl.searchParams.set("client_secret", clientSecret);
    longTokenUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = await longTokenRes.json();

    if (longTokenData.error) {
      console.error(
        "[meta-callback] Long-lived token error:",
        longTokenData.error
      );
      return NextResponse.redirect(
        `${siteUrl}/dashboard/settings?meta=error&reason=long_token`
      );
    }

    const longLivedUserToken: string = longTokenData.access_token;

    // Step 3: Get user's pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedUserToken}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error || !pagesData.data || pagesData.data.length === 0) {
      console.error(
        "[meta-callback] No pages found:",
        pagesData.error || "empty"
      );
      return NextResponse.redirect(
        `${siteUrl}/dashboard/settings?meta=error&reason=no_pages`
      );
    }

    // Use the first page (page selection can be added later)
    const page = pagesData.data[0];
    const pageId: string = page.id;
    const pageName: string = page.name;
    const pageAccessToken: string = page.access_token; // Non-expiring for long-lived user tokens

    // Step 4: Subscribe the page to leadgen webhooks
    try {
      const subscribeRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscribed_fields: "leadgen",
            access_token: pageAccessToken,
          }),
        }
      );
      const subscribeData = await subscribeRes.json();
      if (!subscribeData.success) {
        console.warn(
          "[meta-callback] Webhook subscription warning:",
          subscribeData
        );
        // Continue anyway — the connection is still valid, webhooks can be retried
      }
    } catch (subErr) {
      console.warn("[meta-callback] Webhook subscription failed:", subErr);
      // Continue — page is connected, subscription can be retried
    }

    // Step 5: Store in database
    await sql`
      UPDATE workspaces SET
        meta_page_id = ${pageId},
        meta_page_name = ${pageName},
        meta_page_access_token = ${pageAccessToken},
        meta_user_access_token = ${longLivedUserToken},
        meta_connected = TRUE,
        meta_connected_at = NOW()
      WHERE id = ${workspaceId}
    `;

    console.log(
      `[meta-callback] Connected page "${pageName}" (${pageId}) to workspace ${workspaceId}`
    );

    return NextResponse.redirect(
      `${siteUrl}/dashboard/settings?meta=connected`
    );
  } catch (err) {
    console.error("[meta-callback] Error:", err);
    return NextResponse.redirect(
      `${siteUrl}/dashboard/settings?meta=error`
    );
  }
}
