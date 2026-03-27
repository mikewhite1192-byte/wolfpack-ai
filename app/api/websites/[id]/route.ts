import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/websites/[id] — get single page
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspace = await getOrCreateWorkspace();
    const pages = await sql`
      SELECT * FROM landing_pages
      WHERE id = ${id} AND workspace_id = ${workspace.id}
    `;
    if (pages.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ page: pages[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/websites/[id] — update page
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspace = await getOrCreateWorkspace();
    const body = await req.json();
    const { html_content, css_content, published, custom_domain, name } = body;

    // Build dynamic update
    const updates: string[] = [];
    const values: Record<string, unknown> = {};

    if (html_content !== undefined) {
      values.html_content = html_content;
    }
    if (css_content !== undefined) {
      values.css_content = css_content;
    }
    if (published !== undefined) {
      values.published = published;
    }
    if (custom_domain !== undefined) {
      values.custom_domain = custom_domain;
    }
    if (name !== undefined) {
      values.name = name;
    }

    // Use a single update query with coalesce
    const page = await sql`
      UPDATE landing_pages SET
        html_content = COALESCE(${values.html_content ?? null}, html_content),
        css_content = COALESCE(${values.css_content ?? null}, css_content),
        published = COALESCE(${values.published ?? null}, published),
        custom_domain = COALESCE(${values.custom_domain ?? null}, custom_domain),
        name = COALESCE(${values.name ?? null}, name),
        updated_at = now()
      WHERE id = ${id} AND workspace_id = ${workspace.id}
      RETURNING *
    `;

    if (page.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ page: page[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/websites/[id] — delete page
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspace = await getOrCreateWorkspace();
    const result = await sql`
      DELETE FROM landing_pages
      WHERE id = ${id} AND workspace_id = ${workspace.id}
      RETURNING id
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
