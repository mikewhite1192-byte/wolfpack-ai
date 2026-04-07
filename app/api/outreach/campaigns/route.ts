import { NextRequest, NextResponse } from "next/server";
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getAllCampaignsWithDetails,
  getCampaignWithDetails,
  assignSenderToCampaign,
  removeSenderFromCampaign,
  setCampaignTemplates,
  setCampaignTemplate,
  linkScraperToCampaign,
} from "@/lib/outreach/campaigns";

// GET /api/outreach/campaigns — list all campaigns with details
export async function GET() {
  try {
    const campaigns = await getAllCampaignsWithDetails();
    return NextResponse.json({ campaigns });
  } catch (err) {
    console.error("[campaigns] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/outreach/campaigns — campaign management
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    // ── Create a new campaign ──
    if (action === "create") {
      const id = await createCampaign({
        name: body.name,
        niche: body.niche,
        enabled: body.enabled,
      });

      // Optionally assign senders in the same call
      if (body.senderIds && Array.isArray(body.senderIds)) {
        for (const senderId of body.senderIds) {
          await assignSenderToCampaign(id, senderId);
        }
      }

      // Optionally set templates in the same call
      if (body.templates && Array.isArray(body.templates)) {
        await setCampaignTemplates(id, body.templates);
      }

      // Optionally link a scraper config
      if (body.scraperConfigId) {
        await linkScraperToCampaign(body.scraperConfigId, id);
      }

      const campaign = await getCampaignWithDetails(id);
      return NextResponse.json({ campaign, message: "Campaign created" });
    }

    // ── Update campaign settings ──
    if (action === "update") {
      await updateCampaign(body.id, {
        name: body.name,
        niche: body.niche,
        enabled: body.enabled,
      });
      const campaign = await getCampaignWithDetails(body.id);
      return NextResponse.json({ campaign, message: "Campaign updated" });
    }

    // ── Delete a campaign ──
    if (action === "delete") {
      await deleteCampaign(body.id);
      return NextResponse.json({ message: "Campaign deleted" });
    }

    // ── Stop all active contacts in a campaign (or legacy/unassigned) ──
    if (action === "stop-contacts") {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      let result;
      if (body.campaignId) {
        result = await sql`UPDATE outreach_contacts SET sequence_status = 'completed' WHERE campaign_id = ${body.campaignId} AND sequence_status = 'active'`;
      } else {
        result = await sql`UPDATE outreach_contacts SET sequence_status = 'completed' WHERE campaign_id IS NULL AND sequence_status = 'active'`;
      }
      return NextResponse.json({ message: "Contacts stopped", count: result.length });
    }

    // ── Move outreach contact to CRM ──
    if (action === "move-to-crm") {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const contactId = body.contactId;
      if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

      // Get the outreach contact
      const contacts = await sql`SELECT * FROM outreach_contacts WHERE id = ${contactId} LIMIT 1`;
      if (contacts.length === 0) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      const oc = contacts[0];

      // Get workspace
      const ws = await sql`SELECT id FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`;
      if (ws.length === 0) return NextResponse.json({ error: "No active workspace" }, { status: 400 });
      const wsId = ws[0].id;

      // Check if already in CRM
      const existing = await sql`SELECT id FROM contacts WHERE workspace_id = ${wsId} AND email = ${oc.email} LIMIT 1`;
      let crmContactId: string;

      if (existing.length > 0) {
        crmContactId = existing[0].id as string;
      } else {
        const newContact = await sql`
          INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, company, source, source_detail)
          VALUES (${wsId}, ${oc.first_name}, ${oc.last_name}, ${oc.email}, ${null}, ${oc.company}, 'cold_outreach', 'Moved from outreach campaign')
          RETURNING id
        `;
        crmContactId = newContact[0].id as string;
      }

      // Create deal in first pipeline stage
      const existingDeal = await sql`SELECT id FROM deals WHERE contact_id = ${crmContactId} AND workspace_id = ${wsId} LIMIT 1`;
      if (existingDeal.length === 0) {
        const firstStage = await sql`SELECT id FROM pipeline_stages WHERE workspace_id = ${wsId} ORDER BY position ASC LIMIT 1`;
        if (firstStage.length > 0) {
          const dealTitle = [oc.first_name, oc.last_name].filter(Boolean).join(" ") || oc.email;
          await sql`INSERT INTO deals (workspace_id, contact_id, stage_id, title) VALUES (${wsId}, ${crmContactId}, ${firstStage[0].id}, ${dealTitle + ' — Web Dev Lead'})`;
        }
      }

      // Mark as converted in outreach
      await sql`UPDATE outreach_contacts SET converted = TRUE WHERE id = ${contactId}`;

      return NextResponse.json({ message: "Moved to CRM", crmContactId });
    }

    // ── Assign a sender email address to a campaign ──
    if (action === "assign-sender") {
      await assignSenderToCampaign(body.campaignId, body.senderId);
      const campaign = await getCampaignWithDetails(body.campaignId);
      return NextResponse.json({ campaign, message: "Sender assigned" });
    }

    // ── Remove a sender from a campaign ──
    if (action === "remove-sender") {
      await removeSenderFromCampaign(body.campaignId, body.senderId);
      const campaign = await getCampaignWithDetails(body.campaignId);
      return NextResponse.json({ campaign, message: "Sender removed" });
    }

    // ── Set a single template step ──
    if (action === "set-template") {
      await setCampaignTemplate(body.campaignId, body.step, body.subject, body.body, body.variant || "A");
      const campaign = await getCampaignWithDetails(body.campaignId);
      return NextResponse.json({ campaign, message: `Step ${body.step} variant ${body.variant || "A"} template set` });
    }

    // ── Set all 4 templates at once (supports variants) ──
    if (action === "set-templates") {
      await setCampaignTemplates(body.campaignId, body.templates);
      const campaign = await getCampaignWithDetails(body.campaignId);
      return NextResponse.json({ campaign, message: "All templates set" });
    }

    // ── Delete variant templates for a campaign ──
    if (action === "delete-variant") {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      await sql`DELETE FROM campaign_templates WHERE campaign_id = ${body.campaignId} AND variant = ${body.variant}`;
      const campaign = await getCampaignWithDetails(body.campaignId);
      return NextResponse.json({ campaign, message: `Variant ${body.variant} deleted` });
    }

    // ── Link a scraper config to this campaign ──
    if (action === "link-scraper") {
      await linkScraperToCampaign(body.scraperConfigId, body.campaignId);
      return NextResponse.json({ message: "Scraper linked to campaign" });
    }

    // ── Move all unassigned contacts into this campaign ──
    if (action === "migrate-contacts") {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const result = await sql`
        UPDATE outreach_contacts SET campaign_id = ${body.campaignId}
        WHERE campaign_id IS NULL
      `;
      const count = (result as unknown as { count?: number }).count || 0;
      return NextResponse.json({ migrated: count, message: `${count} contacts moved to campaign` });
    }

    // ── Get single campaign details ──
    if (action === "get") {
      const campaign = await getCampaignWithDetails(body.id);
      if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      return NextResponse.json({ campaign });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[campaigns] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
