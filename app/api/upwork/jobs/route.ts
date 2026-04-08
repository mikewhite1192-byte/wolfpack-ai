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

  let jobs;
  if (status === "new_high") {
    jobs = await sql`
      SELECT * FROM upwork_jobs
      WHERE status = 'new' AND ai_score >= 7
      ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
    `;
  } else if (status && status !== "all" && minScoreNum > 0) {
    jobs = await sql`
      SELECT * FROM upwork_jobs
      WHERE status = ${status} AND ai_score >= ${minScoreNum}
      ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
    `;
  } else if (status && status !== "all") {
    jobs = await sql`
      SELECT * FROM upwork_jobs
      WHERE status = ${status}
      ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
    `;
  } else if (minScoreNum > 0) {
    jobs = await sql`
      SELECT * FROM upwork_jobs
      WHERE ai_score >= ${minScoreNum}
      ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
    `;
  } else {
    jobs = await sql`
      SELECT * FROM upwork_jobs
      ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
    `;
  }

  // Get counts per status
  const counts = await sql`
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
