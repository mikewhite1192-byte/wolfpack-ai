import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/contacts/[id] — get single contact
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;

    const contact = await sql`
      SELECT c.*, ps.name as stage_name, ps.color as stage_color, d.value as deal_value, d.id as deal_id
      FROM contacts c
      LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
      LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE c.id = ${id} AND c.workspace_id = ${workspace.id}
    `;

    if (contact.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ contact: contact[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/contacts/[id] — update contact
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;
    const body = await req.json();
    const { firstName, lastName, email, phone, company, tags, assignedTo } = body;

    const contact = await sql`
      UPDATE contacts SET
        first_name = COALESCE(${firstName ?? null}, first_name),
        last_name = COALESCE(${lastName ?? null}, last_name),
        email = COALESCE(${email ?? null}, email),
        phone = COALESCE(${phone ?? null}, phone),
        company = COALESCE(${company ?? null}, company),
        tags = COALESCE(${tags ?? null}, tags),
        assigned_to = COALESCE(${assignedTo ?? null}, assigned_to),
        updated_at = NOW()
      WHERE id = ${id} AND workspace_id = ${workspace.id}
      RETURNING *
    `;

    if (contact.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ contact: contact[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/contacts/[id] — delete contact
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;

    // Delete associated deals first
    await sql`DELETE FROM deal_activity WHERE deal_id IN (SELECT id FROM deals WHERE contact_id = ${id} AND workspace_id = ${workspace.id})`;
    await sql`DELETE FROM deals WHERE contact_id = ${id} AND workspace_id = ${workspace.id}`;
    await sql`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE contact_id = ${id} AND workspace_id = ${workspace.id})`;
    await sql`DELETE FROM conversations WHERE contact_id = ${id} AND workspace_id = ${workspace.id}`;

    const result = await sql`
      DELETE FROM contacts WHERE id = ${id} AND workspace_id = ${workspace.id} RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
