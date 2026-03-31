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
      await setCampaignTemplate(body.campaignId, body.step, body.subject, body.body);
      const campaign = await getCampaignWithDetails(body.campaignId);
      return NextResponse.json({ campaign, message: `Step ${body.step} template set` });
    }

    // ── Set all 4 templates at once ──
    if (action === "set-templates") {
      await setCampaignTemplates(body.campaignId, body.templates);
      const campaign = await getCampaignWithDetails(body.campaignId);
      return NextResponse.json({ campaign, message: "All templates set" });
    }

    // ── Link a scraper config to this campaign ──
    if (action === "link-scraper") {
      await linkScraperToCampaign(body.scraperConfigId, body.campaignId);
      return NextResponse.json({ message: "Scraper linked to campaign" });
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
