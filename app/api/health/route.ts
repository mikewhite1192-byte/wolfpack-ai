import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) throw new Error("Forbidden");
}

// GET /api/health?year=2026&month=4
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const year = parseInt(req.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));
    const month = parseInt(req.nextUrl.searchParams.get("month") || String(new Date().getMonth() + 1));

    // Use "first of this month" to "first of next month" range.
    // Avoids the "April 31 doesn't exist" bug that crashed the query.
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const entries = await sql`
      SELECT
        TO_CHAR(date, 'YYYY-MM-DD') AS date_key,
        steps, gym, weight, meals, reading, gratitude, affirmation
      FROM health_entries
      WHERE date >= ${startDate}::date AND date < ${endDate}::date
      ORDER BY date ASC
    `;

    const goals = await sql`SELECT * FROM health_goals LIMIT 1`;

    const days: Record<string, Record<string, unknown>> = {};
    for (const e of entries) {
      days[e.date_key as string] = {
        steps: e.steps,
        gym: e.gym,
        weight: e.weight ? parseFloat(String(e.weight)) : null,
        meals: e.meals,
        reading: e.reading,
        gratitude: e.gratitude,
        affirmation: e.affirmation,
      };
    }

    return NextResponse.json({
      days,
      goals: goals[0] || { workouts: 20, target_weight: 180 },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/health — save a day entry
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    if (body.action === "save_day") {
      const { date, steps, gym, weight, meals, reading, gratitude, affirmation } = body;
      if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

      await sql`
        INSERT INTO health_entries (date, steps, gym, weight, meals, reading, gratitude, affirmation, updated_at)
        VALUES (${date}, ${steps ?? null}, ${gym ?? null}, ${weight ?? null}, ${meals || null}, ${reading || null}, ${gratitude || null}, ${affirmation || null}, NOW())
        ON CONFLICT (date) DO UPDATE SET
          steps = ${steps ?? null},
          gym = ${gym ?? null},
          weight = ${weight ?? null},
          meals = ${meals || null},
          reading = ${reading || null},
          gratitude = ${gratitude || null},
          affirmation = ${affirmation || null},
          updated_at = NOW()
      `;

      return NextResponse.json({ ok: true });
    }

    if (body.action === "save_goals") {
      const { workouts, target_weight } = body;
      await sql`
        UPDATE health_goals SET
          workouts = ${workouts || 20},
          target_weight = ${target_weight || 180},
          updated_at = NOW()
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
