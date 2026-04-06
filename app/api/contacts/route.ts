import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { generateFirstTouch, DEFAULT_CONFIG, type AgentConfig } from "@/lib/ai-agent";
import { sendMessage } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/contacts — list contacts
export async function GET(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "active";
    const listId = searchParams.get("listId") || null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 50;
    const offset = (page - 1) * limit;

    const contacts = await sql`
      SELECT c.*, ps.name as stage_name, ps.color as stage_color, d.value as deal_value, d.id as deal_id, ps.is_won, ps.is_lost
      FROM contacts c
      LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
      LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE c.workspace_id = ${workspace.id}
        AND (${!search} OR c.first_name ILIKE ${"%" + search + "%"} OR c.last_name ILIKE ${"%" + search + "%"} OR c.email ILIKE ${"%" + search + "%"} OR c.phone ILIKE ${"%" + search + "%"})
        AND CASE
          WHEN ${status} = 'active' THEN (ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE)
          WHEN ${status} = 'won' THEN ps.is_won = TRUE
          WHEN ${status} = 'lost' THEN ps.is_lost = TRUE
          ELSE TRUE
        END
        AND (${listId}::uuid IS NULL OR c.list_id = ${listId}::uuid)
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const counts = await sql`
      SELECT
        COUNT(*) FILTER (WHERE ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE) as active_count,
        COUNT(*) FILTER (WHERE ps.is_won = TRUE) as won_count,
        COUNT(*) FILTER (WHERE ps.is_lost = TRUE) as lost_count
      FROM contacts c
      LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
      LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE c.workspace_id = ${workspace.id}
        AND (${listId}::uuid IS NULL OR c.list_id = ${listId}::uuid)
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
    const { firstName, lastName, email, company, source, tags, listId } = body;
    const phone = body.phone ? toE164(body.phone) : null;

    if (!firstName && !lastName && !email && !phone) {
      return NextResponse.json({ error: "At least one field is required" }, { status: 400 });
    }

    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Validate phone length
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
      }
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
      INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, company, source, tags, list_id)
      VALUES (${workspace.id}, ${firstName || null}, ${lastName || null}, ${email || null}, ${phone || null}, ${company || null}, ${source || "manual"}, ${tags || null}, ${listId || null})
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

    // Instant AI first-touch — text them immediately if workspace is onboarded and contact has a phone
    if (phone && workspace.onboarding_complete && workspace.ai_config?.enabled) {
      try {
        const config: AgentConfig = { ...DEFAULT_CONFIG, ...workspace.ai_config };
        const contactName = [firstName, lastName].filter(Boolean).join(" ") || "there";
        const firstMessage = await generateFirstTouch(config, contactName, source || "manual");

        // Send via messaging provider
        const fromNumber = workspace.twilio_phone || process.env.LINQ_PHONE_NUMBER || "";
        const chatResult = await sendMessage(phone, firstMessage);

        // Create conversation + store the message
        const conv = await sql`
          INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled, ai_stage, assigned_to)
          VALUES (${workspace.id}, ${contact[0].id}, 'sms', 'open', TRUE, 'connection', ${chatResult.message_id})
          RETURNING *
        `;

        await sql`
          INSERT INTO messages (conversation_id, direction, body, status)
          VALUES (${conv[0].id}, 'outbound', ${firstMessage}, 'sent')
        `;

        // Schedule follow-up
        await sql`
          UPDATE contacts SET
            ai_next_followup = NOW() + INTERVAL '24 hours',
            ai_followup_count = 0
          WHERE id = ${contact[0].id}
        `;

        console.log(`[contacts] Instant first-touch sent to ${phone}: "${firstMessage.substring(0, 50)}..."`);
      } catch (err) {
        console.error("[contacts] First-touch failed (contact still created):", err);
      }
    }

    return NextResponse.json({ contact: contact[0] }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
