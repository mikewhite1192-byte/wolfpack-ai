import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

/**
 * POST /api/meta/disconnect
 * Disconnects the Facebook page from the workspace.
 * Unsubscribes from leadgen webhooks and clears stored tokens.
 */
export async function POST() {
  try {
    const workspace = await getOrCreateWorkspace();

    // Try to unsubscribe from webhooks if we have a page token
    if (workspace.meta_page_id && workspace.meta_page_access_token) {
      try {
        const unsubRes = await fetch(
          `https://graph.facebook.com/v19.0/${workspace.meta_page_id}/subscribed_apps`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: workspace.meta_page_access_token,
            }),
          }
        );
        const unsubData = await unsubRes.json();
        console.log("[meta-disconnect] Unsubscribe result:", unsubData);
      } catch (unsubErr) {
        console.warn("[meta-disconnect] Unsubscribe failed:", unsubErr);
        // Continue anyway — we still want to clear local data
      }
    }

    // Clear meta fields on the workspace
    await sql`
      UPDATE workspaces SET
        meta_page_id = NULL,
        meta_page_name = NULL,
        meta_page_access_token = NULL,
        meta_user_access_token = NULL,
        meta_connected = FALSE,
        meta_connected_at = NULL
      WHERE id = ${workspace.id}
    `;

    console.log(
      `[meta-disconnect] Disconnected Meta from workspace ${workspace.id}`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[meta-disconnect] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
