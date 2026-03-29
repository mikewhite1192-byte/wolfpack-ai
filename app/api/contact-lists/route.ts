import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/contact-lists — list all contact lists
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();
    const lists = await sql`
      SELECT cl.*,
        (SELECT COUNT(*) FROM contacts c WHERE c.list_id = cl.id) as contact_count
      FROM contact_lists cl
      WHERE cl.workspace_id = ${workspace.id}
      ORDER BY cl.created_at ASC
    `;

    // Also get count of contacts with no list
    const unlistedCount = await sql`
      SELECT COUNT(*) as count FROM contacts
      WHERE workspace_id = ${workspace.id} AND list_id IS NULL
    `;

    return NextResponse.json({ lists, unlistedCount: parseInt(unlistedCount[0].count) });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

// POST /api/contact-lists — create a new list
export async function POST(req: NextRequest) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { name, color } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const list = await sql`
      INSERT INTO contact_lists (workspace_id, name, color)
      VALUES (${workspace.id}, ${name.trim()}, ${color || "#E86A2A"})
      RETURNING *
    `;

    return NextResponse.json({ list: list[0] }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
