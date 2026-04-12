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
  return userId;
}

// GET /api/outreach/groups?product=wolfpack
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const product = req.nextUrl.searchParams.get("product") || "wolfpack";

    const groups = await sql`
      SELECT * FROM social_groups
      WHERE product = ${product}
      ORDER BY
        CASE WHEN last_posted_at IS NULL THEN 0 ELSE 1 END,
        last_posted_at ASC,
        name ASC
    `;

    // Compute stats
    const now = new Date();
    let postedThisWeek = 0;
    let dueCount = 0;
    for (const g of groups) {
      if (g.last_posted_at) {
        const days = Math.floor((now.getTime() - new Date(g.last_posted_at).getTime()) / 86400000);
        if (days <= (g.frequency_days ?? 7) - 1) postedThisWeek++;
        else dueCount++;
      } else {
        dueCount++;
      }
    }

    return NextResponse.json({
      groups,
      stats: {
        total: groups.length,
        postedThisWeek,
        dueCount,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    const status = msg === "Not authenticated" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// POST /api/outreach/groups — create a new group
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { product, name, platform, url, niche, size, rules, frequency_days } = body;

    if (!product || !name || !platform) {
      return NextResponse.json({ error: "product, name, and platform are required" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO social_groups (product, name, platform, url, niche, size, rules, frequency_days)
      VALUES (${product}, ${name}, ${platform}, ${url || null}, ${niche || null}, ${size || null}, ${rules || null}, ${frequency_days || 7})
      RETURNING *
    `;

    return NextResponse.json({ group: result[0] }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    const status = msg === "Not authenticated" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// PATCH /api/outreach/groups — bulk action: mark multiple as posted
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { action, ids } = body;

    if (action === "mark_posted" && Array.isArray(ids)) {
      await sql`
        UPDATE social_groups
        SET last_posted_at = CURRENT_DATE, updated_at = NOW()
        WHERE id = ANY(${ids}::uuid[])
      `;
      return NextResponse.json({ ok: true, updated: ids.length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
