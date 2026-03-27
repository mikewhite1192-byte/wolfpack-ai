import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/dashboard — overview stats
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();
    const wid = workspace.id;

    // Pipeline value (sum of open deal values)
    const pipelineValue = await sql`
      SELECT COALESCE(SUM(d.value::numeric), 0) as total
      FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wid} AND ps.is_won = FALSE AND ps.is_lost = FALSE
    `;

    // Closed this month (sum of won deal values this month)
    const closedThisMonth = await sql`
      SELECT COALESCE(SUM(d.value::numeric), 0) as total, COUNT(*) as count
      FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wid} AND ps.is_won = TRUE
        AND d.closed_at >= DATE_TRUNC('month', NOW())
    `;

    // Total deals closed all time (for conversion rate)
    const totalClosed = await sql`
      SELECT COUNT(*) as total FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wid} AND (ps.is_won = TRUE OR ps.is_lost = TRUE)
    `;

    // Total leads
    const totalLeads = await sql`
      SELECT COUNT(*) as total FROM contacts WHERE workspace_id = ${wid}
    `;

    // Active leads (in non-won, non-lost stages)
    const activeLeads = await sql`
      SELECT COUNT(*) as total FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wid} AND ps.is_won = FALSE AND ps.is_lost = FALSE
    `;

    // Won deals for avg deal size
    const wonDeals = await sql`
      SELECT COALESCE(AVG(d.value::numeric), 0) as avg_value, COUNT(*) as count
      FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wid} AND ps.is_won = TRUE AND d.value IS NOT NULL
    `;

    // Conversion rate
    const totalDeals = parseInt(totalLeads[0].total);
    const totalWon = parseInt(wonDeals[0].count);
    const conversionRate = totalDeals > 0 ? Math.round((totalWon / totalDeals) * 100) : 0;

    // Pipeline breakdown by stage
    const stageBreakdown = await sql`
      SELECT ps.name, ps.color, ps.position, COUNT(d.id) as count
      FROM pipeline_stages ps
      LEFT JOIN deals d ON d.stage_id = ps.id AND d.workspace_id = ps.workspace_id
      WHERE ps.workspace_id = ${wid}
      GROUP BY ps.id, ps.name, ps.color, ps.position
      ORDER BY ps.position ASC
    `;

    // Recent activity (last 15)
    const recentActivity = await sql`
      SELECT da.action, da.details, da.created_at,
             c.first_name, c.last_name
      FROM deal_activity da
      JOIN deals d ON d.id = da.deal_id
      JOIN contacts c ON c.id = d.contact_id
      WHERE da.workspace_id = ${wid}
      ORDER BY da.created_at DESC
      LIMIT 15
    `;

    return NextResponse.json({
      stats: {
        pipelineValue: parseFloat(pipelineValue[0].total),
        closedThisMonth: parseFloat(closedThisMonth[0].total),
        closedCount: parseInt(closedThisMonth[0].count),
        conversionRate,
        avgDealSize: parseFloat(parseFloat(wonDeals[0].avg_value).toFixed(0)),
        totalLeads: parseInt(totalLeads[0].total),
        activeLeads: parseInt(activeLeads[0].total),
      },
      stages: stageBreakdown,
      activity: recentActivity,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
