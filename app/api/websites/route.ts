import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/websites — list landing pages
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();
    const pages = await sql`
      SELECT id, name, slug, custom_domain, published, visits, conversions, created_at, updated_at
      FROM landing_pages
      WHERE workspace_id = ${workspace.id}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ pages });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/websites — create new landing page
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const body = await req.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    // Sanitize slug
    const cleanSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    // Check for duplicate slug
    const existing = await sql`
      SELECT id FROM landing_pages
      WHERE workspace_id = ${workspace.id} AND slug = ${cleanSlug}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: "A page with this slug already exists" }, { status: 409 });
    }

    const page = await sql`
      INSERT INTO landing_pages (workspace_id, name, slug)
      VALUES (${workspace.id}, ${name}, ${cleanSlug})
      RETURNING *
    `;

    return NextResponse.json({ page: page[0] }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
