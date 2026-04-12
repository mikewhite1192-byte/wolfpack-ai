import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];
const MILEAGE_RATE = 0.67;

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) throw new Error("Forbidden");
}

// GET /api/finance/mileage?year=2026
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const year = req.nextUrl.searchParams.get("year") || String(new Date().getFullYear());

    const trips = await sql`
      SELECT * FROM biz_mileage_log
      WHERE EXTRACT(YEAR FROM date) = ${parseInt(year)}
      ORDER BY date DESC
    `;

    const totals = await sql`
      SELECT
        COALESCE(SUM(miles), 0)::numeric AS total_miles,
        COALESCE(SUM(deduction), 0)::numeric AS total_deduction,
        COUNT(*)::int AS trip_count
      FROM biz_mileage_log
      WHERE EXTRACT(YEAR FROM date) = ${parseInt(year)}
    `;

    return NextResponse.json({
      trips,
      totals: totals[0] || { total_miles: 0, total_deduction: 0, trip_count: 0 },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/finance/mileage — log a trip
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { date, destination, miles, purpose } = await req.json();

    if (!date || !destination || !miles) {
      return NextResponse.json({ error: "date, destination, and miles required" }, { status: 400 });
    }

    const deduction = parseFloat(miles) * MILEAGE_RATE;

    const result = await sql`
      INSERT INTO biz_mileage_log (date, destination, miles, purpose, deduction)
      VALUES (${date}, ${destination}, ${parseFloat(miles)}, ${purpose || null}, ${deduction})
      RETURNING *
    `;

    return NextResponse.json({ trip: result[0] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// DELETE /api/finance/mileage — remove a trip
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { id } = await req.json();
    await sql`DELETE FROM biz_mileage_log WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
