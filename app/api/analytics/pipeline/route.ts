import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();

    const [stageBreakdown, wonThisMonth, lostThisMonth, avgDealSize, stageTransitions, leadSources] = await Promise.all([
      // Stage breakdown: count + total value per stage
      sql`
        SELECT ps.name, ps.color, ps.position, ps.is_won, ps.is_lost,
               COUNT(d.id)::int as deal_count,
               COALESCE(SUM(d.value), 0)::float as total_value
        FROM pipeline_stages ps
        LEFT JOIN deals d ON d.stage_id = ps.id AND d.workspace_id = ps.workspace_id
        WHERE ps.workspace_id = ${workspace.id}
        GROUP BY ps.id, ps.name, ps.color, ps.position, ps.is_won, ps.is_lost
        ORDER BY ps.position
      `,

      // Won this month
      sql`
        SELECT COUNT(d.id)::int as count, COALESCE(SUM(d.value), 0)::float as total_value
        FROM deals d
        JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE d.workspace_id = ${workspace.id}
          AND ps.is_won = true
          AND d.closed_at >= date_trunc('month', CURRENT_DATE)
      `,

      // Lost this month
      sql`
        SELECT COUNT(d.id)::int as count, COALESCE(SUM(d.value), 0)::float as total_value
        FROM deals d
        JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE d.workspace_id = ${workspace.id}
          AND ps.is_lost = true
          AND d.closed_at >= date_trunc('month', CURRENT_DATE)
      `,

      // Average deal size (active + won, exclude lost)
      sql`
        SELECT COALESCE(AVG(d.value), 0)::float as avg_value
        FROM deals d
        JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE d.workspace_id = ${workspace.id}
          AND ps.is_lost IS NOT TRUE
          AND d.value > 0
      `,

      // Average time in each stage (from deal_activity stage_changed events)
      sql`
        SELECT
          da.details->>'to' as stage_name,
          AVG(EXTRACT(EPOCH FROM (
            COALESCE(
              LEAD(da.created_at) OVER (PARTITION BY da.deal_id ORDER BY da.created_at),
              NOW()
            ) - da.created_at
          )) / 86400)::float as avg_days
        FROM deal_activity da
        JOIN deals d ON d.id = da.deal_id
        WHERE da.workspace_id = ${workspace.id}
          AND da.action = 'stage_changed'
        GROUP BY da.details->>'to'
      `,

      // Lead source breakdown
      sql`
        SELECT
          COALESCE(c.source, 'Unknown') as source,
          COUNT(*)::int as count,
          COUNT(CASE WHEN ps.is_won = true THEN 1 END)::int as won_count,
          COALESCE(SUM(d.value), 0)::float as total_value
        FROM contacts c
        LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE c.workspace_id = ${workspace.id}
        GROUP BY COALESCE(c.source, 'Unknown')
        ORDER BY count DESC
      `,
    ]);

    // Compute funnel conversion rates
    const activeStages = stageBreakdown.filter((s: Record<string, unknown>) => !s.is_won && !s.is_lost);
    const funnel = activeStages.map((stage: Record<string, unknown>, i: number) => {
      const nextStage = activeStages[i + 1] as Record<string, unknown> | undefined;
      const currentCount = Number(stage.deal_count) || 0;
      const nextCount = nextStage ? (Number(nextStage.deal_count) || 0) : null;
      const conversionRate = nextCount !== null && currentCount > 0
        ? Math.round((nextCount / currentCount) * 100)
        : null;

      return {
        name: stage.name,
        color: stage.color,
        count: currentCount,
        totalValue: Number(stage.total_value) || 0,
        conversionRate,
      };
    });

    return NextResponse.json({
      funnel,
      stageBreakdown: stageBreakdown.map((s: Record<string, unknown>) => ({
        name: s.name,
        color: s.color,
        isWon: s.is_won,
        isLost: s.is_lost,
        count: Number(s.deal_count) || 0,
        totalValue: Number(s.total_value) || 0,
      })),
      wonThisMonth: {
        count: Number(wonThisMonth[0]?.count) || 0,
        totalValue: Number(wonThisMonth[0]?.total_value) || 0,
      },
      lostThisMonth: {
        count: Number(lostThisMonth[0]?.count) || 0,
        totalValue: Number(lostThisMonth[0]?.total_value) || 0,
      },
      avgDealSize: Number(avgDealSize[0]?.avg_value) || 0,
      avgTimeInStage: stageTransitions.reduce((acc: Record<string, number>, row: Record<string, unknown>) => {
        if (row.stage_name) acc[row.stage_name as string] = Math.round((Number(row.avg_days) || 0) * 10) / 10;
        return acc;
      }, {} as Record<string, number>),
      leadSources: leadSources.map((s: Record<string, unknown>) => ({
        source: s.source,
        count: Number(s.count) || 0,
        wonCount: Number(s.won_count) || 0,
        totalValue: Number(s.total_value) || 0,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[analytics/pipeline] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
