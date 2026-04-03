import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { processMonthlyReports } from "@/lib/gbp";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/gbp/insights — get stored insights or trigger monthly report
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");
    const process_flag = searchParams.get("process");

    if (process_flag === "true") {
      const result = await processMonthlyReports();
      return NextResponse.json(result);
    }

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId required" }, { status: 400 });
    }

    const insights = await sql`
      SELECT * FROM gbp_insights WHERE connection_id = ${connectionId}
      ORDER BY period_start DESC LIMIT 12
    `;

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[gbp-insights] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
