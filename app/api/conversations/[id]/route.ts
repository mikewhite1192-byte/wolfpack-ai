import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// PATCH /api/conversations/[id] — update conversation settings (e.g. ai_enabled)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;
    const { aiEnabled } = await req.json();

    if (typeof aiEnabled !== "boolean") {
      return NextResponse.json({ error: "aiEnabled (boolean) required" }, { status: 400 });
    }

    const result = await sql`
      UPDATE conversations
      SET ai_enabled = ${aiEnabled}
      WHERE id = ${id} AND workspace_id = ${workspace.id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation: result[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
