import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// PATCH /api/deals/[id] — update deal (move stage, update value, etc.)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;
    const body = await req.json();
    const { stageId, value, title, notes, assignedTo } = body;

    // Get current deal for activity logging
    const current = await sql`
      SELECT * FROM deals WHERE id = ${id} AND workspace_id = ${workspace.id}
    `;
    if (current.length === 0) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const deal = await sql`
      UPDATE deals SET
        stage_id = COALESCE(${stageId ?? null}, stage_id),
        value = COALESCE(${value ?? null}, value),
        title = COALESCE(${title ?? null}, title),
        notes = COALESCE(${notes ?? null}, notes),
        assigned_to = COALESCE(${assignedTo ?? null}, assigned_to),
        updated_at = NOW()
      WHERE id = ${id} AND workspace_id = ${workspace.id}
      RETURNING *
    `;

    // Log stage change activity
    if (stageId && stageId !== current[0].stage_id) {
      const oldStage = await sql`SELECT name FROM pipeline_stages WHERE id = ${current[0].stage_id}`;
      const newStage = await sql`SELECT name, is_won, is_lost FROM pipeline_stages WHERE id = ${stageId}`;

      await sql`
        INSERT INTO deal_activity (deal_id, workspace_id, action, details)
        VALUES (${id}, ${workspace.id}, 'stage_changed', ${JSON.stringify({
          from: oldStage[0]?.name,
          to: newStage[0]?.name,
        })})
      `;

      // If moved to won/lost stage, set closed_at + trigger AI learning
      if (newStage[0]?.is_won || newStage[0]?.is_lost) {
        await sql`UPDATE deals SET closed_at = NOW() WHERE id = ${id}`;

        // Trigger AI learning in the background
        const conv = await sql`
          SELECT id FROM conversations
          WHERE workspace_id = ${workspace.id} AND contact_id = ${current[0].contact_id} AND channel = 'sms'
          LIMIT 1
        `;
        if (conv.length > 0) {
          const outcome = newStage[0].is_won ? "won" : "lost";
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/ai-agent/learn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: conv[0].id, outcome }),
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ deal: deal[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
