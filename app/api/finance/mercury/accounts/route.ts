import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// GET /api/finance/mercury/accounts?workspace=business|personal
// Returns accounts + latest sync metadata for the dashboard panel.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workspace = req.nextUrl.searchParams.get("workspace");

  const accounts = workspace
    ? await sql`
        SELECT * FROM mercury_accounts
        WHERE workspace = ${workspace} AND archived = false
        ORDER BY kind, name
      `
    : await sql`
        SELECT * FROM mercury_accounts
        WHERE archived = false
        ORDER BY workspace, kind, name
      `;

  const lastRuns = await sql`
    SELECT workspace, MAX(finished_at) AS last_finished
    FROM mercury_sync_runs
    WHERE status = 'success'
    GROUP BY workspace
  `;

  return NextResponse.json({ accounts, lastRuns });
}
