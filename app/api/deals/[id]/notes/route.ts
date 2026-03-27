import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/deals/[id]/notes — add a note
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;
    const { note } = await req.json();

    if (!note?.trim()) {
      return NextResponse.json({ error: "Note is required" }, { status: 400 });
    }

    await sql`
      INSERT INTO deal_activity (deal_id, workspace_id, action, details)
      VALUES (${id}, ${workspace.id}, 'note_added', ${JSON.stringify({ text: note })})
    `;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
