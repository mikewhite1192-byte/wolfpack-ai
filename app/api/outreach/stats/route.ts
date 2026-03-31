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
            COUNT(*) FILTER (WHERE sequence_status = 'completed') as completed,
            COUNT(*) FILTER (WHERE sequence_status = 'invalid') as invalid,
            COUNT(*) FILTER (WHERE sequence_status = 'unsubscribed') as unsubscribed,
            COUNT(*) FILTER (WHERE sequence_step = 1 AND sequence_status = 'active') as step1,
            COUNT(*) FILTER (WHERE sequence_step = 2 AND sequence_status = 'active') as step2,
            COUNT(*) FILTER (WHERE sequence_step = 3 AND sequence_status = 'active') as step3,
            COUNT(*) FILTER (WHERE sequence_step = 4 AND sequence_status = 'active') as step4,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as added_today
          FROM outreach_contacts WHERE campaign_id = ${c.id}
        `;
        // Today's cold sends for this campaign's senders
        const senderEmails = senders.map(s => s.email as string);
        let coldToday = 0;
        let warmupToday = 0;
        if (senderEmails.length > 0) {
          const todaySends = await sql`
            SELECT
              COUNT(*) FILTER (WHERE email_type = 'cold') as cold,
              COUNT(*) FILTER (WHERE email_type IN ('warmup', 'warmup_reply')) as warmup
            FROM outreach_emails
            WHERE from_email = ANY(${senderEmails}) AND sent_at >= CURRENT_DATE
          `;
          coldToday = parseInt(todaySends[0].cold as string || "0");
          warmupToday = parseInt(todaySends[0].warmup as string || "0");
        }
        campaigns.push({ ...c, senders, templates, stats: cStats[0], coldToday, warmupToday });
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

    // Today's totals across all senders
    let todayTotals = { cold: 0, warmup: 0 };
    try {
      const tt = await sql`
        SELECT
          COUNT(*) FILTER (WHERE email_type = 'cold') as cold,
          COUNT(*) FILTER (WHERE email_type IN ('warmup', 'warmup_reply')) as warmup
        FROM outreach_emails WHERE sent_at >= CURRENT_DATE
      `;
      todayTotals = { cold: parseInt(tt[0].cold as string || "0"), warmup: parseInt(tt[0].warmup as string || "0") };
    } catch { /* ok */ }

    // Unread replies count (per campaign)
    let unreadByCampaign: Record<string, number> = {};
    try {
      const unreadRows = await sql`
        SELECT oc.campaign_id, COUNT(*) as count
        FROM campaign_inbox ci
        JOIN outreach_contacts oc ON oc.id = ci.outreach_contact_id
        WHERE ci.is_read = FALSE AND ci.email_category = 'cold_reply'
        GROUP BY oc.campaign_id
      `;
      for (const r of unreadRows) {
        if (r.campaign_id) unreadByCampaign[r.campaign_id as string] = parseInt(r.count as string);
      }
    } catch { /* ok */ }

    return NextResponse.json({
      stats, recentEmails, emailHealth, outreachContacts,
      campaigns, scraperConfigs, scraperStats, warmupStatus,
      todayTotals, unreadByCampaign,
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
