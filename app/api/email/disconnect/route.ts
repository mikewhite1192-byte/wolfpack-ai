import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

export async function POST() {
  try {
    const workspace = await getOrCreateWorkspace();

    await sql`
      UPDATE workspaces SET
        gmail_connected = false,
        gmail_access_token = NULL,
        gmail_refresh_token = NULL,
        gmail_email = NULL
      WHERE id = ${workspace.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
