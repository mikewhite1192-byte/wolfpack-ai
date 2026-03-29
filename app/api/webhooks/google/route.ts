import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Google Ads lead form extensions send a webhook POST with lead data
// URL per client: https://thewolfpack.ai/api/webhooks/google?ws=WORKSPACE_ID
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("ws");
    if (!workspaceId) {
      console.error("[google-webhook] No workspace ID provided");
      return NextResponse.json({ error: "Missing ws parameter" }, { status: 400 });
    }

    const body = await req.json();
    console.log("[google-webhook] Received:", JSON.stringify(body, null, 2));

    // Google Ads webhook payload:
    // { lead_id, campaign_id, form_id, adgroup_id, creative_id, gcl_id,
    //   user_column_data: [{ column_id, string_value, column_name }] }
    const leadId = body.lead_id || body.google_key;
    const campaignId = body.campaign_id || "";
    const formId = body.form_id || "";
    const adGroupId = body.adgroup_id || body.ad_group_id || "";

    // Parse user data from column format
    const fields: Record<string, string> = {};
    for (const col of body.user_column_data || []) {
      const name = (col.column_name || col.column_id || "").toLowerCase();
      fields[name] = col.string_value || "";
    }

    // Also handle flat format (some integrations send it this way)
    if (body.email) fields.email = body.email;
    if (body.phone_number || body.phone) fields.phone_number = body.phone_number || body.phone;
    if (body.full_name) fields.full_name = body.full_name;
    if (body.first_name) fields.first_name = body.first_name;
    if (body.last_name) fields.last_name = body.last_name;

    const firstName = fields.first_name || fields.full_name?.split(" ")[0] || "";
    const lastName = fields.last_name || fields.full_name?.split(" ").slice(1).join(" ") || "";
    const email = fields.email || "";
    const phone = fields.phone_number || fields.phone || "";

    console.log(`[google-webhook] Lead: ${firstName} ${lastName}, ${email}, ${phone}, campaign=${campaignId}`);

    await createLeadFromWebhook(workspaceId, {
      firstName,
      lastName,
      email,
      phone,
      source: "google",
      sourceDetail: `campaign:${campaignId} form:${formId} adgroup:${adGroupId}`,
      googleLeadId: leadId,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[google-webhook] Error:", err);
    return NextResponse.json({ received: true });
  }
}

function toE164(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (phone.startsWith("+")) return phone;
  return "+" + digits;
}

interface LeadInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source: string;
  sourceDetail: string;
  googleLeadId?: string;
}

async function createLeadFromWebhook(workspaceId: string, lead: LeadInput) {
  try {
    const workspace = await sql`
      SELECT * FROM workspaces WHERE id = ${workspaceId} AND status = 'active' LIMIT 1
    `;
    if (workspace.length === 0) {
      console.error(`[google-webhook] Workspace ${workspaceId} not found`);
      return;
    }
    const ws = workspace[0];

    const phone = lead.phone ? toE164(lead.phone) : null;

    // Dedup check
    if (phone || lead.email) {
      const existing = await sql`
        SELECT id FROM contacts
        WHERE workspace_id = ${ws.id}
          AND (
            (${phone}::text IS NOT NULL AND phone = ${phone})
            OR (${lead.email || null}::text IS NOT NULL AND email = ${lead.email || null})
          )
        LIMIT 1
      `;
      if (existing.length > 0) {
        console.log(`[google-webhook] Duplicate lead, skipping: ${phone || lead.email}`);
        return;
      }
    }

    const contact = await sql`
      INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, source, source_detail)
      VALUES (${ws.id}, ${lead.firstName || null}, ${lead.lastName || null}, ${lead.email || null}, ${phone}, ${lead.source}, ${lead.sourceDetail})
      RETURNING *
    `;

    // Auto-create deal in first pipeline stage
    const firstStage = await sql`
      SELECT id FROM pipeline_stages WHERE workspace_id = ${ws.id} ORDER BY position ASC LIMIT 1
    `;
    if (firstStage.length > 0) {
      await sql`
        INSERT INTO deals (workspace_id, contact_id, stage_id, title)
        VALUES (${ws.id}, ${contact[0].id}, ${firstStage[0].id}, ${(lead.firstName || "") + " " + (lead.lastName || "") + " — Google Lead"})
      `;
    }

    // Create conversation + enable AI
    if (phone) {
      const conv = await sql`
        INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled)
        VALUES (${ws.id}, ${contact[0].id}, 'sms', 'open', TRUE)
        RETURNING *
      `;

      await sql`
        UPDATE contacts SET
          ai_next_followup = NOW(),
          ai_followup_count = 0
        WHERE id = ${contact[0].id}
      `;

      console.log(`[google-webhook] Created contact ${contact[0].id}, conversation ${conv[0].id} — AI will text shortly`);
    } else {
      console.log(`[google-webhook] Created contact ${contact[0].id} — no phone, can't text`);
    }
  } catch (err) {
    console.error("[google-webhook] createLeadFromWebhook error:", err);
  }
}
