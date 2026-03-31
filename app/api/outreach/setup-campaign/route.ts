import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createCampaign, setCampaignTemplates, assignSenderToCampaign } from "@/lib/outreach/campaigns";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/outreach/setup-campaign — one-time setup for FL Insurance campaign
export async function POST() {
  try {
    // Check if campaign already exists
    const existing = await sql`SELECT id FROM campaigns WHERE name = 'FL Life Insurance' LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ message: "Campaign already exists", campaignId: existing[0].id });
    }

    // 1. Create campaign
    const campaignId = await createCampaign({
      name: "FL Life Insurance",
      niche: "insurance",
      enabled: true,
    });

    // 2. Set the 4-step templates
    await setCampaignTemplates(campaignId, [
      {
        step: 1,
        subject: "quick question {{firstName}}",
        body: `Hey {{firstName}},

Quick question — are your follow-ups still going through SMS or have you moved away from A2P yet?

We built something that handles lead follow-up instantly without touching A2P at all. Curious if that's even on your radar.

Mike, The Wolf Pack AI`,
      },
      {
        step: 2,
        subject: "quick question {{firstName}}",
        body: `Hey {{firstName}},

Just wanted to bump this — curious how you're handling follow-ups right now.

Mike, The Wolf Pack AI`,
      },
      {
        step: 3,
        subject: "quick question {{firstName}}",
        body: `Hey {{firstName}},

Most agents we've talked to are losing deals just from slow follow-up — have you found a way around that?

Mike, The Wolf Pack AI`,
      },
      {
        step: 4,
        subject: "quick question {{firstName}}",
        body: `Hey {{firstName}},

Not sure if this is relevant right now — should I close this out or is follow-up something you're still trying to improve?

Mike, The Wolf Pack AI`,
      },
    ]);

    // 3. Assign all cold sender addresses to this campaign
    const coldSenders = await sql`
      SELECT id FROM warmup_addresses WHERE is_active = TRUE AND cold_sender = TRUE
    `;
    for (const sender of coldSenders) {
      await assignSenderToCampaign(campaignId, sender.id as string);
    }

    // 4. Migrate ALL existing contacts into this campaign
    const migrated = await sql`
      UPDATE outreach_contacts SET campaign_id = ${campaignId}
      WHERE campaign_id IS NULL
    `;

    // 5. Link the DOI scraper to this campaign (if scraper_config exists)
    try {
      await sql`
        UPDATE scraper_config SET campaign_id = ${campaignId}
        WHERE campaign_id IS NULL AND source = 'google_maps'
      `;
    } catch { /* table might not have data */ }

    const contactCount = await sql`SELECT COUNT(*) as count FROM outreach_contacts WHERE campaign_id = ${campaignId}`;
    const senderCount = coldSenders.length;

    return NextResponse.json({
      campaignId,
      message: "FL Life Insurance campaign created",
      senders: senderCount,
      contacts: parseInt(contactCount[0].count as string),
      templates: 4,
    });
  } catch (err) {
    console.error("[setup-campaign]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
