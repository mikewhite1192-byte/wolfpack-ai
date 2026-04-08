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

// GET /api/upwork/jobs/[id] — single job detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const rows = await sql`SELECT * FROM upwork_jobs WHERE id = ${id}`;
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}

// PATCH /api/upwork/jobs/[id] — update status, notes, proposal
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { status, notes, ai_proposal, contract_value } = body;

  // Build update dynamically
  const updates: string[] = [];
  const values: Record<string, unknown> = {};

  if (status !== undefined) {
    updates.push("status");
    values.status = status;
    if (status === "applied") {
      updates.push("applied_at");
      values.applied_at = new Date().toISOString();
    }
    if (status === "won") {
      updates.push("won_at");
      values.won_at = new Date().toISOString();
    }
  }
  if (notes !== undefined) {
    updates.push("notes");
    values.notes = notes;
  }
  if (ai_proposal !== undefined) {
    updates.push("ai_proposal");
    values.ai_proposal = ai_proposal;
  }
  if (contract_value !== undefined) {
    updates.push("contract_value");
    values.contract_value = contract_value;
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Use parameterized updates for safety
  const row = await sql`
    UPDATE upwork_jobs SET
      status = COALESCE(${values.status as string ?? null}, status),
      notes = COALESCE(${values.notes as string ?? null}, notes),
      ai_proposal = COALESCE(${values.ai_proposal as string ?? null}, ai_proposal),
      contract_value = COALESCE(${values.contract_value as number ?? null}, contract_value),
      applied_at = COALESCE(${values.applied_at as string ?? null}, applied_at),
      won_at = COALESCE(${values.won_at as string ?? null}, won_at)
    WHERE id = ${id}
    RETURNING *
  `;

  if (row.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row[0]);
}
