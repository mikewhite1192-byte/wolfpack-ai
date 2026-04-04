import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/analytics/traffic — log a page view (called from middleware)
export async function POST(req: Request) {
  try {
    const { path, referrer, userAgent, visitorId } = await req.json();

    if (!path) return NextResponse.json({ ok: false }, { status: 400 });

    await sql`
      INSERT INTO page_views (path, referrer, user_agent, visitor_id)
      VALUES (${path}, ${referrer || null}, ${userAgent || null}, ${visitorId || null})
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[traffic] log error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// GET /api/analytics/traffic — get traffic stats
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d";

    let interval = "30 days";
    if (range === "7d") interval = "7 days";
    else if (range === "24h") interval = "1 day";
    else if (range === "90d") interval = "90 days";

    // Total views & unique visitors
    const totals = await sql`
      SELECT
        COUNT(*)::int AS total_views,
        COUNT(DISTINCT visitor_id)::int AS unique_visitors
      FROM page_views
      WHERE created_at >= NOW() - CAST(${interval} AS INTERVAL)
    `;

    // Views by day
    const daily = await sql`
      SELECT
        DATE(created_at) AS date,
        COUNT(*)::int AS views,
        COUNT(DISTINCT visitor_id)::int AS visitors
      FROM page_views
      WHERE created_at >= NOW() - CAST(${interval} AS INTERVAL)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Top pages
    const topPages = await sql`
      SELECT
        path,
        COUNT(*)::int AS views,
        COUNT(DISTINCT visitor_id)::int AS visitors
      FROM page_views
      WHERE created_at >= NOW() - CAST(${interval} AS INTERVAL)
      GROUP BY path
      ORDER BY views DESC
      LIMIT 20
    `;

    // Top referrers
    const topReferrers = await sql`
      SELECT
        COALESCE(referrer, 'Direct') AS referrer,
        COUNT(*)::int AS views
      FROM page_views
      WHERE created_at >= NOW() - CAST(${interval} AS INTERVAL)
      GROUP BY referrer
      ORDER BY views DESC
      LIMIT 10
    `;

    // Today vs yesterday
    const todayViews = await sql`
      SELECT COUNT(*)::int AS views FROM page_views WHERE created_at >= CURRENT_DATE
    `;
    const yesterdayViews = await sql`
      SELECT COUNT(*)::int AS views FROM page_views WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE
    `;

    return NextResponse.json({
      totalViews: totals[0]?.total_views || 0,
      uniqueVisitors: totals[0]?.unique_visitors || 0,
      daily,
      topPages,
      topReferrers,
      todayViews: todayViews[0]?.views || 0,
      yesterdayViews: yesterdayViews[0]?.views || 0,
    });
  } catch (e) {
    console.error("[traffic] stats error:", e);
    return NextResponse.json({ totalViews: 0, uniqueVisitors: 0, daily: [], topPages: [], topReferrers: [], todayViews: 0, yesterdayViews: 0 });
  }
}
