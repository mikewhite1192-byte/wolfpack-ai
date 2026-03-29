import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/pipeline/stages?pipelineId=xxx — get stages with deals for a specific pipeline
export async function GET(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipelineId");

    let stages;
    if (pipelineId) {
      stages = await sql`
        SELECT * FROM pipeline_stages
        WHERE workspace_id = ${workspace.id} AND pipeline_id = ${pipelineId}
        ORDER BY position ASC
      `;
    } else {
      // Default: get stages from the default pipeline, or all if no pipeline_id set
      const defaultPipeline = await sql`
        SELECT id FROM pipelines WHERE workspace_id = ${workspace.id} AND is_default = TRUE LIMIT 1
      `;
      if (defaultPipeline.length > 0) {
        stages = await sql`
          SELECT * FROM pipeline_stages
          WHERE workspace_id = ${workspace.id} AND pipeline_id = ${defaultPipeline[0].id}
          ORDER BY position ASC
        `;
      } else {
        stages = await sql`
          SELECT * FROM pipeline_stages
          WHERE workspace_id = ${workspace.id}
          ORDER BY position ASC
        `;
      }
    }

    const stageIds = stages.map((s: Record<string, unknown>) => s.id);
    let deals: Record<string, unknown>[] = [];
    if (stageIds.length > 0) {
      deals = await sql`
        SELECT d.*, c.first_name, c.last_name, c.company, c.phone, c.email, c.lead_score
        FROM deals d
        JOIN contacts c ON c.id = d.contact_id
        WHERE d.workspace_id = ${workspace.id} AND d.stage_id = ANY(${stageIds})
        ORDER BY d.created_at DESC
      `;
    }

    const stagesWithDeals = stages.map((stage: Record<string, unknown>) => ({
      ...stage,
      deals: deals.filter((d: Record<string, unknown>) => d.stage_id === stage.id),
    }));

    return NextResponse.json({ stages: stagesWithDeals });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
