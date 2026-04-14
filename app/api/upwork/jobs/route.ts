import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { pollUpworkRSS } from "@/lib/upwork/feed";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com"];

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) return null;
  return email;
}

// Map a range keyword to {start, end} ISO timestamps (end=null means "now").
// Rolling ranges (7d/30d/90d) look back by days. Calendar ranges (week/month/year) snap to boundaries.
function rangeBounds(range: string | null): { start: string | null; end: string | null } {
  const now = new Date();
  switch (range) {
    case "today": {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: d.toISOString(), end: null };
    }
    case "yesterday": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: start.toISOString(), end: end.toISOString() };
    }
    case "this_week": {
      // Sunday as week start (US convention)
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      return { start: d.toISOString(), end: null };
    }
    case "last_week": {
      const endD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const startD = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate() - 7);
      return { start: startD.toISOString(), end: endD.toISOString() };
    }
    case "this_month": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: d.toISOString(), end: null };
    }
    case "last_month": {
      const startD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endD = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startD.toISOString(), end: endD.toISOString() };
    }
    case "this_year": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { start: d.toISOString(), end: null };
    }
    case "7d":
      return { start: new Date(now.getTime() - 7 * 86400000).toISOString(), end: null };
    case "30d":
      return { start: new Date(now.getTime() - 30 * 86400000).toISOString(), end: null };
    case "90d":
      return { start: new Date(now.getTime() - 90 * 86400000).toISOString(), end: null };
    default:
      return { start: null, end: null };
  }
}

// GET /api/upwork/jobs — list jobs with optional filters
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const minScore = searchParams.get("min_score");
  const lim = parseInt(searchParams.get("limit") || "100");
  const off = parseInt(searchParams.get("offset") || "0");
  const minScoreNum = minScore ? parseInt(minScore) : 0;
  const { start: rangeStartISO, end: rangeEndISO } = rangeBounds(searchParams.get("range"));
  const hasRange = rangeStartISO !== null;
  // When a range has no explicit end, use a far-future sentinel so the same BETWEEN-style query works.
  const since = rangeStartISO;
  const until = rangeEndISO ?? "9999-12-31T23:59:59.999Z";

  // For scoped status tabs, filter/order by the action timestamp when a range is active,
  // so "Applied last 7 days" counts jobs you actually applied to in that window.
  let jobs;
  if (status === "new_high") {
    jobs = hasRange
      ? await sql`
          SELECT * FROM upwork_jobs
          WHERE status = 'new' AND ai_score >= 7
            AND created_at >= ${since} AND created_at < ${until}
          ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
        `
      : await sql`
          SELECT * FROM upwork_jobs
          WHERE status = 'new' AND ai_score >= 7
          ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
        `;
  } else if (status === "applied" || status === "interviewing" || status === "lost") {
    jobs = hasRange
      ? await sql`
          SELECT * FROM upwork_jobs
          WHERE status = ${status}
            AND applied_at >= ${since} AND applied_at < ${until}
          ORDER BY applied_at DESC NULLS LAST LIMIT ${lim} OFFSET ${off}
        `
      : await sql`
          SELECT * FROM upwork_jobs
          WHERE status = ${status}
          ORDER BY applied_at DESC NULLS LAST LIMIT ${lim} OFFSET ${off}
        `;
  } else if (status === "won") {
    jobs = hasRange
      ? await sql`
          SELECT * FROM upwork_jobs
          WHERE status = 'won'
            AND won_at >= ${since} AND won_at < ${until}
          ORDER BY won_at DESC NULLS LAST LIMIT ${lim} OFFSET ${off}
        `
      : await sql`
          SELECT * FROM upwork_jobs
          WHERE status = 'won'
          ORDER BY won_at DESC NULLS LAST LIMIT ${lim} OFFSET ${off}
        `;
  } else if (status && status !== "all") {
    jobs = hasRange
      ? await sql`
          SELECT * FROM upwork_jobs
          WHERE status = ${status}
            AND created_at >= ${since} AND created_at < ${until}
          ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
        `
      : await sql`
          SELECT * FROM upwork_jobs
          WHERE status = ${status}
          ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
        `;
  } else if (minScoreNum > 0) {
    jobs = hasRange
      ? await sql`
          SELECT * FROM upwork_jobs
          WHERE ai_score >= ${minScoreNum}
            AND created_at >= ${since} AND created_at < ${until}
          ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
        `
      : await sql`
          SELECT * FROM upwork_jobs
          WHERE ai_score >= ${minScoreNum}
          ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
        `;
  } else {
    jobs = hasRange
      ? await sql`
          SELECT * FROM upwork_jobs
          WHERE created_at >= ${since} AND created_at < ${until}
          ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
        `
      : await sql`
          SELECT * FROM upwork_jobs
          ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
        `;
  }

  // Counts scoped to the range using the action timestamp for each status,
  // so "applied_count" is jobs you applied to in the window, not jobs ingested in it.
  const counts = hasRange
    ? await sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'new' AND created_at >= ${since} AND created_at < ${until}) as new_count,
          COUNT(*) FILTER (WHERE status = 'new' AND ai_score >= 7 AND created_at >= ${since} AND created_at < ${until}) as new_high_count,
          COUNT(*) FILTER (WHERE applied_at >= ${since} AND applied_at < ${until}) as applied_count,
          COUNT(*) FILTER (WHERE status = 'interviewing' AND applied_at >= ${since} AND applied_at < ${until}) as interviewing_count,
          COUNT(*) FILTER (WHERE status = 'won' AND won_at >= ${since} AND won_at < ${until}) as won_count,
          COUNT(*) FILTER (WHERE status = 'lost' AND applied_at >= ${since} AND applied_at < ${until}) as lost_count,
          COUNT(*) FILTER (WHERE status = 'skipped' AND created_at >= ${since} AND created_at < ${until}) as skipped_count,
          COUNT(*) FILTER (WHERE created_at >= ${since} AND created_at < ${until}) as total,
          COALESCE(SUM(contract_value) FILTER (WHERE status = 'won' AND won_at >= ${since} AND won_at < ${until}), 0) as total_revenue
        FROM upwork_jobs
      `
    : await sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'new') as new_count,
          COUNT(*) FILTER (WHERE status = 'new' AND ai_score >= 7) as new_high_count,
          COUNT(*) FILTER (WHERE status = 'applied') as applied_count,
          COUNT(*) FILTER (WHERE status = 'interviewing') as interviewing_count,
          COUNT(*) FILTER (WHERE status = 'won') as won_count,
          COUNT(*) FILTER (WHERE status = 'lost') as lost_count,
          COUNT(*) FILTER (WHERE status = 'skipped') as skipped_count,
          COUNT(*) as total,
          COALESCE(SUM(contract_value) FILTER (WHERE status = 'won'), 0) as total_revenue
        FROM upwork_jobs
      `;

  return NextResponse.json({
    jobs,
    counts: counts[0],
  });
}

// POST /api/upwork/jobs — trigger manual poll
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get feed URLs from settings
  const settings = await sql`
    SELECT value FROM upwork_settings WHERE key = 'feed_urls'
  `;

  const feedUrls: string[] = settings.length > 0 && settings[0].value
    ? JSON.parse(settings[0].value)
    : [];

  if (feedUrls.length === 0) {
    return NextResponse.json({ error: "No RSS feed URLs configured" }, { status: 400 });
  }

  const newCount = await pollUpworkRSS(feedUrls);
  return NextResponse.json({ newJobs: newCount });
}
