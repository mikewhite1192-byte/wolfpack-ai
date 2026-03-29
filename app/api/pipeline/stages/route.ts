import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/pipeline/stages?pipelineId=xxx
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
      // Fallback: try default pipeline, then all stages
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

    // Get deals for these stages individually (avoid ANY array issues)
    const stagesWithDeals = [];
    for (const stage of stages) {
      const deals = await sql`
        SELECT d.*, c.first_name, c.last_name, c.company, c.phone, c.email, c.lead_score
        FROM deals d
        JOIN contacts c ON c.id = d.contact_id
        WHERE d.workspace_id = ${workspace.id} AND d.stage_id = ${stage.id}
        ORDER BY d.created_at DESC
      `;
      stagesWithDeals.push({ ...stage, deals });
    }

    return NextResponse.json({ stages: stagesWithDeals });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[pipeline/stages]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
