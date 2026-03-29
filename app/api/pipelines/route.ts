import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/pipelines — list all pipelines
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();
    const pipelines = await sql`
      SELECT p.*
      FROM pipelines p
      WHERE p.workspace_id = ${workspace.id}
      ORDER BY p.is_default DESC, p.created_at ASC
    `;
    return NextResponse.json({ pipelines });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

// POST /api/pipelines — create a new pipeline with default stages
export async function POST(req: NextRequest) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { name } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const pipeline = await sql`
      INSERT INTO pipelines (workspace_id, name, is_default)
      VALUES (${workspace.id}, ${name.trim()}, FALSE)
      RETURNING *
    `;

    // Create default stages for the new pipeline
    const stages = [
      { name: "New Lead", position: 0, color: "#3498db", is_won: false, is_lost: false },
      { name: "Contacted", position: 1, color: "#9b59b6", is_won: false, is_lost: false },
      { name: "Qualified", position: 2, color: "#E86A2A", is_won: false, is_lost: false },
      { name: "Proposal Sent", position: 3, color: "#f39c12", is_won: false, is_lost: false },
      { name: "Closed Won", position: 4, color: "#2ecc71", is_won: true, is_lost: false },
      { name: "Closed Lost", position: 5, color: "#e74c3c", is_won: false, is_lost: true },
    ];

    for (const s of stages) {
      await sql`
        INSERT INTO pipeline_stages (workspace_id, pipeline_id, name, position, color, is_won, is_lost)
        VALUES (${workspace.id}, ${pipeline[0].id}, ${s.name}, ${s.position}, ${s.color}, ${s.is_won}, ${s.is_lost})
      `;
    }

    return NextResponse.json({ pipeline: pipeline[0] }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
