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

// PATCH /api/outreach/groups/[id] — update a group's fields or mark as posted
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    // Special action: mark as posted today
    if (body.action === "mark_posted") {
      const result = await sql`
        UPDATE social_groups
        SET last_posted_at = CURRENT_DATE, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json({ group: result[0] || null });
    }

    // Special action: undo last posted (clear the date)
    if (body.action === "undo_posted") {
      const result = await sql`
        UPDATE social_groups
        SET last_posted_at = NULL, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json({ group: result[0] || null });
    }

    // General field update
    const { name, platform, url, niche, size, rules, frequency_days } = body;

    const result = await sql`
      UPDATE social_groups SET
        name = COALESCE(${name ?? null}, name),
        platform = COALESCE(${platform ?? null}, platform),
        url = ${url !== undefined ? url : null},
        niche = COALESCE(${niche ?? null}, niche),
        size = COALESCE(${size ?? null}, size),
        rules = COALESCE(${rules ?? null}, rules),
        frequency_days = COALESCE(${frequency_days ?? null}, frequency_days),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ group: result[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    const status = msg === "Not authenticated" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// DELETE /api/outreach/groups/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const result = await sql`
      DELETE FROM social_groups WHERE id = ${id} RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    const status = msg === "Not authenticated" ? 401 : msg === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
