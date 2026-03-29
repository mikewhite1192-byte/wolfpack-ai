import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// DELETE /api/pipelines/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;

    // Can't delete the default pipeline
    const pipeline = await sql`
      SELECT * FROM pipelines WHERE id = ${id} AND workspace_id = ${workspace.id} LIMIT 1
    `;
    if (pipeline.length === 0) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }
    if (pipeline[0].is_default) {
      return NextResponse.json({ error: "Cannot delete the default pipeline" }, { status: 400 });
    }

    // Find default pipeline to move deals into
    const defaultPipeline = await sql`
      SELECT id FROM pipelines WHERE workspace_id = ${workspace.id} AND is_default = TRUE LIMIT 1
    `;
    if (defaultPipeline.length === 0) {
      return NextResponse.json({ error: "No default pipeline to move deals into" }, { status: 400 });
    }
    const defaultPipeId = defaultPipeline[0].id;

    // Get first stage of default pipeline
    const defaultFirstStage = await sql`
      SELECT id FROM pipeline_stages WHERE pipeline_id = ${defaultPipeId} ORDER BY position ASC LIMIT 1
    `;
    const targetStageId = defaultFirstStage[0]?.id;

    if (targetStageId) {
      // Move all deals from this pipeline's stages to default pipeline's first stage
      const stagesInPipeline = await sql`
        SELECT id FROM pipeline_stages WHERE pipeline_id = ${id}
      `;
      for (const stage of stagesInPipeline) {
        await sql`UPDATE deals SET stage_id = ${targetStageId} WHERE stage_id = ${stage.id}`;
      }
    }

    // Delete stages, then pipeline
    await sql`DELETE FROM pipeline_stages WHERE pipeline_id = ${id}`;
    await sql`DELETE FROM pipelines WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
