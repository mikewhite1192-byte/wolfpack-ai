import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

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

// Statuses bulk-update supports. Restricted to the ones that make sense for
// multi-select from the pipeline view. 'won' requires contract_value, which
// the per-job PATCH path already handles — don't include it here.
const ALLOWED_STATUSES = new Set(["skipped", "applied", "lost", "interviewing", "new"]);

// POST /api/upwork/jobs/bulk — update status on many rows at once.
// Body: { ids: string[], status: "skipped" | "applied" | ... }
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  const status = typeof body?.status === "string" ? body.status : "";

  if (ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  // applied_at is only set when transitioning to 'applied' so bulk-skip
  // doesn't clobber the applied timestamp on rows that had it.
  const now = new Date().toISOString();
  const setAppliedAt = status === "applied";

  const rows = await sql`
    UPDATE upwork_jobs
    SET status = ${status},
        applied_at = CASE WHEN ${setAppliedAt} THEN ${now} ELSE applied_at END
    WHERE id = ANY(${ids}::uuid[])
    RETURNING id
  `;

  return NextResponse.json({ updated: rows.length });
}
