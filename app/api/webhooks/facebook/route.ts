import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || "wolfpack_verify_token";

// GET — Facebook webhook verification (required for setup)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[fb-webhook] Verified!");
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST — Receive Facebook Lead Ad webhooks
// URL per client: https://thewolfpack.ai/api/webhooks/facebook?ws=WORKSPACE_ID
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("ws");
    if (!workspaceId) {
      console.error("[fb-webhook] No workspace ID provided");
      return NextResponse.json({ error: "Missing ws parameter" }, { status: 400 });
    }

    const body = await req.json();
    console.log("[fb-webhook] Received:", JSON.stringify(body, null, 2));

    // Facebook sends: { object: "page", entry: [{ id, time, changes: [{ field: "leadgen", value: { ... } }] }] }
    if (body.object !== "page") {
      return NextResponse.json({ received: true });
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === "leadgen") {
          const leadgenId = change.value?.leadgen_id;
          const pageId = change.value?.page_id;
          const formId = change.value?.form_id;
          const adId = change.value?.ad_id;
          const createdTime = change.value?.created_time;

          console.log(`[fb-webhook] New lead! leadgen_id=${leadgenId} page=${pageId} form=${formId} ad=${adId}`);

          // Fetch the actual lead data from Facebook Graph API
          const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
          if (!accessToken) {
            console.error("[fb-webhook] No FB_PAGE_ACCESS_TOKEN set — can't fetch lead data");
            // Still store what we have
            await createLeadFromWebhook(workspaceId, {
              source: "facebook",
              sourceDetail: `form:${formId} ad:${adId}`,
              fbLeadgenId: leadgenId,
              createdTime,
            });
            continue;
          }

          // Fetch lead details from Graph API
          try {
            const leadRes = await fetch(
              `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${accessToken}`
            );
            const leadData = await leadRes.json();

            if (leadData.error) {
              console.error("[fb-webhook] Graph API error:", leadData.error);
              await createLeadFromWebhook(workspaceId, {
                source: "facebook",
                sourceDetail: `form:${formId} ad:${adId}`,
                fbLeadgenId: leadgenId,
                createdTime,
              });
              continue;
            }

            // Parse field_data: [{ name: "email", values: ["..."] }, { name: "full_name", values: ["..."] }]
            const fields: Record<string, string> = {};
            for (const field of leadData.field_data || []) {
              fields[field.name] = field.values?.[0] || "";
            }

            console.log("[fb-webhook] Lead fields:", fields);

            // Map Facebook form fields to our contact fields
            const firstName = fields.first_name || fields.full_name?.split(" ")[0] || "";
            const lastName = fields.last_name || fields.full_name?.split(" ").slice(1).join(" ") || "";
            const email = fields.email || "";
            const phone = fields.phone_number || fields.phone || "";

            await createLeadFromWebhook(workspaceId, {
              firstName,
              lastName,
              email,
              phone,
              source: "facebook",
              sourceDetail: `form:${formId} ad:${adId}`,
              fbLeadgenId: leadgenId,
              createdTime,
            });
          } catch (err) {
            console.error("[fb-webhook] Failed to fetch lead from Graph API:", err);
            await createLeadFromWebhook(workspaceId, {
              source: "facebook",
              sourceDetail: `form:${formId} ad:${adId}`,
              fbLeadgenId: leadgenId,
              createdTime,
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[fb-webhook] Error:", err);
    return NextResponse.json({ received: true });
  }
}

// Ensure phone is E.164
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
  fbLeadgenId?: string;
  createdTime?: number;
}

async function createLeadFromWebhook(workspaceId: string, lead: LeadInput) {
  try {
    const workspace = await sql`
      SELECT * FROM workspaces WHERE id = ${workspaceId} AND status = 'active' LIMIT 1
    `;
    if (workspace.length === 0) {
      console.error(`[fb-webhook] Workspace ${workspaceId} not found`);
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
        console.log(`[fb-webhook] Duplicate lead, skipping: ${phone || lead.email}`);
        return;
      }
    }

    // Create contact
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
        VALUES (${ws.id}, ${contact[0].id}, ${firstStage[0].id}, ${(lead.firstName || "") + " " + (lead.lastName || "") + " — Facebook Lead"})
      `;
    }

    // Create conversation + enable AI
    if (phone) {
      const conv = await sql`
        INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled)
        VALUES (${ws.id}, ${contact[0].id}, 'sms', 'open', TRUE)
        RETURNING *
      `;

      // Fire off first touch from AI agent (async, don't wait)
      // The AI will text them when the follow-up cron runs, or we can trigger immediately
      await sql`
        UPDATE contacts SET
          ai_next_followup = NOW(),
          ai_followup_count = 0
        WHERE id = ${contact[0].id}
      `;

      console.log(`[fb-webhook] Created contact ${contact[0].id}, conversation ${conv[0].id} — AI will text shortly`);
    } else {
      console.log(`[fb-webhook] Created contact ${contact[0].id} — no phone, can't text`);
    }
  } catch (err) {
    console.error("[fb-webhook] createLeadFromWebhook error:", err);
  }
}
