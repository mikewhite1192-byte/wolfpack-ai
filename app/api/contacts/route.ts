import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/contacts — list contacts
export async function GET(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "active"; // 'active', 'won', 'lost'
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 50;
    const offset = (page - 1) * limit;

    // Status filter maps to pipeline stage properties
    let statusFilter = "";
    if (status === "active") {
      statusFilter = "AND (ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE)";
    } else if (status === "won") {
      statusFilter = "AND ps.is_won = TRUE";
    } else if (status === "lost") {
      statusFilter = "AND ps.is_lost = TRUE";
    }

    let contacts;
    if (search) {
      contacts = await sql`
        SELECT c.*, ps.name as stage_name, ps.color as stage_color, d.value as deal_value, d.id as deal_id, ps.is_won, ps.is_lost
        FROM contacts c
        LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE c.workspace_id = ${workspace.id}
          AND (c.first_name ILIKE ${"%" + search + "%"} OR c.last_name ILIKE ${"%" + search + "%"} OR c.email ILIKE ${"%" + search + "%"} OR c.phone ILIKE ${"%" + search + "%"})
          AND CASE
            WHEN ${status} = 'active' THEN (ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE)
            WHEN ${status} = 'won' THEN ps.is_won = TRUE
            WHEN ${status} = 'lost' THEN ps.is_lost = TRUE
            ELSE TRUE
          END
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      contacts = await sql`
        SELECT c.*, ps.name as stage_name, ps.color as stage_color, d.value as deal_value, d.id as deal_id, ps.is_won, ps.is_lost
        FROM contacts c
        LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE c.workspace_id = ${workspace.id}
          AND CASE
            WHEN ${status} = 'active' THEN (ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE)
            WHEN ${status} = 'won' THEN ps.is_won = TRUE
            WHEN ${status} = 'lost' THEN ps.is_lost = TRUE
            ELSE TRUE
          END
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // Count per status for tab badges
    const counts = await sql`
      SELECT
        COUNT(*) FILTER (WHERE ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE) as active_count,
        COUNT(*) FILTER (WHERE ps.is_won = TRUE) as won_count,
        COUNT(*) FILTER (WHERE ps.is_lost = TRUE) as lost_count
      FROM contacts c
      LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
      LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE c.workspace_id = ${workspace.id}
    `;

    return NextResponse.json({
      contacts,
      counts: {
        active: parseInt(counts[0].active_count),
        won: parseInt(counts[0].won_count),
        lost: parseInt(counts[0].lost_count),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Format phone to E.164
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (phone.startsWith('+')) return phone;
  return '+' + digits;
}

// POST /api/contacts — create contact
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const body = await req.json();
    const { firstName, lastName, email, company, source, tags } = body;
    const phone = body.phone ? toE164(body.phone) : null;

    if (!firstName && !lastName && !email && !phone) {
      return NextResponse.json({ error: "At least one field is required" }, { status: 400 });
    }

    // Duplicate check
    if (phone || email) {
      const dupe = await sql`
        SELECT id FROM contacts
        WHERE workspace_id = ${workspace.id}
          AND (
            (${phone}::text IS NOT NULL AND phone = ${phone})
            OR (${email}::text IS NOT NULL AND email = ${email})
          )
        LIMIT 1
      `;
      if (dupe.length > 0) {
        return NextResponse.json({ error: "Contact with this phone or email already exists", existingId: dupe[0].id }, { status: 409 });
      }
    }

    const contact = await sql`
      INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, company, source, tags)
      VALUES (${workspace.id}, ${firstName || null}, ${lastName || null}, ${email || null}, ${phone || null}, ${company || null}, ${source || "manual"}, ${tags || null})
      RETURNING *
    `;

    // Auto-create deal in first pipeline stage
    const firstStage = await sql`
      SELECT id FROM pipeline_stages
      WHERE workspace_id = ${workspace.id}
      ORDER BY position ASC LIMIT 1
    `;

    if (firstStage.length > 0) {
      await sql`
        INSERT INTO deals (workspace_id, contact_id, stage_id, title)
        VALUES (${workspace.id}, ${contact[0].id}, ${firstStage[0].id}, ${(firstName || "") + " " + (lastName || "") + " Deal"})
      `;
    }

    return NextResponse.json({ contact: contact[0] }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
