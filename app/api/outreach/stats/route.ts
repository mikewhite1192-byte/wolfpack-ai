import { NextRequest, NextResponse } from "next/server";
import { getSequenceStats } from "@/lib/outreach/sequence";
import { getAllEmailHealth } from "@/lib/outreach/email-health";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() || "";

    const stats = await getSequenceStats();

    const recentEmails = await sql`
      SELECT oe.step, oe.status, oe.sent_at, oe.from_email, oc.email, oc.first_name
      FROM outreach_emails oe
      LEFT JOIN outreach_contacts oc ON oc.id = oe.contact_id
      ORDER BY oe.sent_at DESC
      LIMIT 20
    `;

    let emailHealth: Awaited<ReturnType<typeof getAllEmailHealth>> = [];
    try {
      emailHealth = await getAllEmailHealth();
    } catch { /* table may not exist */ }

    // Outreach contacts — with search support
    let outreachContacts;
    if (search) {
      outreachContacts = await sql`
        SELECT id, email, first_name, last_name, company, state, sequence_status, sequence_step,
               assigned_sender, replied, bounced, unsubscribed, created_at, last_email_sent_at, campaign_id
        FROM outreach_contacts
        WHERE email ILIKE ${"%" + search + "%"}
          OR first_name ILIKE ${"%" + search + "%"}
          OR last_name ILIKE ${"%" + search + "%"}
          OR company ILIKE ${"%" + search + "%"}
        ORDER BY created_at DESC
        LIMIT 200
      `;
    } else {
      outreachContacts = await sql`
        SELECT id, email, first_name, last_name, company, state, sequence_status, sequence_step,
               assigned_sender, replied, bounced, unsubscribed, created_at, last_email_sent_at, campaign_id
        FROM outreach_contacts
        ORDER BY created_at DESC
        LIMIT 200
      `;
    }

    // Campaign data
    let campaigns: unknown[] = [];
    try {
      const campaignRows = await sql`SELECT * FROM campaigns ORDER BY created_at ASC`;
      for (const c of campaignRows) {
        const senders = await sql`
          SELECT w.id, w.email, w.display_name FROM campaign_senders cs
          JOIN warmup_addresses w ON w.id = cs.warmup_address_id
          WHERE cs.campaign_id = ${c.id}
        `;
        const templates = await sql`
          SELECT step, subject, body FROM campaign_templates WHERE campaign_id = ${c.id} ORDER BY step
        `;
        const cStats = await sql`
          SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE sequence_status = 'active') as active,
            COUNT(*) FILTER (WHERE sequence_status = 'replied') as replied,
            COUNT(*) FILTER (WHERE sequence_status = 'bounced') as bounced,
            COUNT(*) FILTER (WHERE sequence_status = 'completed') as completed
          FROM outreach_contacts WHERE campaign_id = ${c.id}
        `;
        campaigns.push({ ...c, senders, templates, stats: cStats[0] });
      }
    } catch { /* tables may not exist */ }

    // Scraper data
    let scraperConfigs: unknown[] = [];
    let scraperStats = null;
    try {
      scraperConfigs = await sql`SELECT * FROM scraper_config ORDER BY created_at ASC`;
      const sStats = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE email_status = 'pending') as pending,
          COUNT(*) FILTER (WHERE email_status = 'found') as found,
          COUNT(*) FILTER (WHERE email_status = 'not_found') as not_found,
          COUNT(*) FILTER (WHERE email_status = 'verified') as verified,
          COUNT(*) FILTER (WHERE email_status = 'invalid') as invalid,
          COUNT(*) FILTER (WHERE email_status = 'added') as added
        FROM scraped_businesses
      `;
      scraperStats = sStats[0];
    } catch { /* tables may not exist */ }

    // Warmup status
    let warmupStatus: unknown[] = [];
    try {
      const { getWarmupStatus } = await import("@/lib/outreach/warmup");
      warmupStatus = await getWarmupStatus();
    } catch { /* ok */ }

    return NextResponse.json({
      stats, recentEmails, emailHealth, outreachContacts,
      campaigns, scraperConfigs, scraperStats, warmupStatus,
    });
  } catch (e: unknown) {
    console.error("[outreach/stats]", e);
    return NextResponse.json({
      stats: { total: "0", active: "0", completed: "0", replied: "0", bounced: "0", unsubscribed: "0", converted: "0" },
      recentEmails: [], emailHealth: [], outreachContacts: [],
      campaigns: [], scraperConfigs: [], scraperStats: null, warmupStatus: [],
    });
  }
}
