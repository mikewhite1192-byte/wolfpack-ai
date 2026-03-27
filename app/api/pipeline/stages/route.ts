import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/pipeline/stages — get stages with deals
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();

    const stages = await sql`
      SELECT * FROM pipeline_stages
      WHERE workspace_id = ${workspace.id}
      ORDER BY position ASC
    `;

    const deals = await sql`
      SELECT d.*, c.first_name, c.last_name, c.company, c.phone, c.email, c.lead_score
      FROM deals d
      JOIN contacts c ON c.id = d.contact_id
      WHERE d.workspace_id = ${workspace.id}
      ORDER BY d.created_at DESC
    `;

    // Group deals by stage
    const stagesWithDeals = stages.map(stage => ({
      ...stage,
      deals: deals.filter(d => d.stage_id === stage.id),
    }));

    return NextResponse.json({ stages: stagesWithDeals });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
