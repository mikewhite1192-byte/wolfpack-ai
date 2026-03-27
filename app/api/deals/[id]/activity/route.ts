import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/deals/[id]/activity — full timeline for a deal
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;

    // Get deal with contact info
    const deal = await sql`
      SELECT d.*, c.first_name, c.last_name, c.email, c.phone, c.company,
             c.source, c.source_detail, c.lead_score, c.lead_score_reasons, c.tags, c.created_at as contact_created_at,
             ps.name as stage_name, ps.color as stage_color
      FROM deals d
      JOIN contacts c ON c.id = d.contact_id
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.id = ${id} AND d.workspace_id = ${workspace.id}
    `;

    if (deal.length === 0) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Get activity timeline
    const activity = await sql`
      SELECT * FROM deal_activity
      WHERE deal_id = ${id} AND workspace_id = ${workspace.id}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // Get messages for this contact
    const contactId = deal[0].contact_id;
    const messages = await sql`
      SELECT m.* FROM messages m
      JOIN conversations conv ON conv.id = m.conversation_id
      WHERE conv.contact_id = ${contactId} AND conv.workspace_id = ${workspace.id}
      ORDER BY m.created_at DESC
      LIMIT 20
    `;

    // Get calls for this contact
    const calls = await sql`
      SELECT * FROM calls
      WHERE contact_id = ${contactId} AND workspace_id = ${workspace.id}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Get all stages for the stage selector
    const stages = await sql`
      SELECT id, name, color, position FROM pipeline_stages
      WHERE workspace_id = ${workspace.id}
      ORDER BY position ASC
    `;

    return NextResponse.json({
      deal: deal[0],
      activity,
      messages,
      calls,
      stages,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
