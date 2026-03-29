import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/demo/reset — wipe all workspace data for demo mode
export async function POST() {
  try {
    const workspace = await getOrCreateWorkspace();
    const wsId = workspace.id;

    // Delete in order (foreign key dependencies — children first)
    await sql`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id = ${wsId})`;
    await sql`DELETE FROM calls WHERE workspace_id = ${wsId}`;
    await sql`DELETE FROM conversations WHERE workspace_id = ${wsId}`;
    await sql`DELETE FROM deal_activity WHERE deal_id IN (SELECT id FROM deals WHERE workspace_id = ${wsId})`;
    await sql`DELETE FROM deals WHERE workspace_id = ${wsId}`;
    await sql`DELETE FROM bookings WHERE workspace_id = ${wsId}`;
    await sql`DELETE FROM review_requests WHERE workspace_id IN (SELECT id FROM contacts WHERE workspace_id = ${wsId})`;
    await sql`DELETE FROM contacts WHERE workspace_id = ${wsId}`;
    await sql`DELETE FROM automation_runs WHERE workspace_id = ${wsId}`;

    // Reset onboarding so the bot runs again on next sign-in
    await sql`
      UPDATE workspaces SET
        onboarding_complete = false,
        onboarding_step = 0,
        ai_config = NULL
      WHERE id = ${wsId}
    `;

    console.log(`[demo-reset] Workspace ${wsId} wiped clean`);
    return NextResponse.json({ success: true, message: "Demo data wiped" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[demo-reset]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
