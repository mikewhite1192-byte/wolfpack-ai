import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);
const DEMO_EMAILS = ["mikewhite1192@gmail.com"];

// POST /api/demo/reset — wipe workspace data for DEMO ACCOUNTS ONLY
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Server-side email check — only demo accounts can wipe
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress?.toLowerCase() || "";

    if (!DEMO_EMAILS.includes(email)) {
      return NextResponse.json({ success: true, message: "Not a demo account — no action taken" });
    }

    const workspace = await getOrCreateWorkspace();
    const wsId = workspace.id;

    await sql`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id = ${wsId})`;
    await sql`DELETE FROM calls WHERE workspace_id = ${wsId}`;
    await sql`DELETE FROM conversations WHERE workspace_id = ${wsId}`;
    await sql`DELETE FROM deal_activity WHERE deal_id IN (SELECT id FROM deals WHERE workspace_id = ${wsId})`;
    await sql`DELETE FROM deals WHERE workspace_id = ${wsId}`;
    await sql`DELETE FROM bookings WHERE workspace_id = ${wsId}`;
    await sql`DELETE FROM contacts WHERE workspace_id = ${wsId}`;

    await sql`
      UPDATE workspaces SET
        onboarding_complete = false,
        onboarding_step = 0,
        ai_config = NULL
      WHERE id = ${wsId}
    `;

    console.log(`[demo-reset] Demo workspace ${wsId} wiped for ${email}`);
    return NextResponse.json({ success: true, message: "Demo data wiped" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[demo-reset]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
