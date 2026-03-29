import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

interface Rec {
  type: "urgent" | "warning" | "insight" | "positive";
  key: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  contactId?: string;
}

// GET — serve cached recommendations (max 10, sorted by priority)
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();
    const recs = await sql`
      SELECT * FROM recommendations
      WHERE workspace_id = ${workspace.id} AND dismissed = FALSE
      ORDER BY
        CASE type WHEN 'urgent' THEN 0 WHEN 'warning' THEN 1 WHEN 'insight' THEN 2 WHEN 'positive' THEN 3 END,
        created_at DESC
      LIMIT 10
    `;
    return NextResponse.json({ recommendations: recs });
  } catch {
    return NextResponse.json({ recommendations: [] });
  }
}

// POST — regenerate recommendations (called by cron or on-demand)
export async function POST() {
  try {
    const workspace = await getOrCreateWorkspace();
    const wsId = workspace.id;
    const recs: Rec[] = [];

    // ═══════════════════════════════════════════
    // URGENT — Red
    // ═══════════════════════════════════════════

    // 1. New lead, no contact (15+ min)
    const noContact = await sql`
      SELECT c.id, c.first_name, c.last_name, c.source, c.created_at
      FROM contacts c
      LEFT JOIN conversations conv ON conv.contact_id = c.id
      WHERE c.workspace_id = ${wsId}
        AND c.phone IS NOT NULL
        AND conv.id IS NULL
        AND c.created_at < NOW() - INTERVAL '15 minutes'
        AND c.created_at > NOW() - INTERVAL '7 days'
      LIMIT 5
    `;
    for (const lead of noContact) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
      const mins = Math.round((Date.now() - new Date(lead.created_at).getTime()) / 60000);
      const timeStr = mins < 60 ? `${mins} minutes` : `${Math.round(mins / 60)} hours`;
      recs.push({
        type: "urgent", key: `no-contact-${lead.id}`,
        title: `${name} came in ${timeStr} ago from ${lead.source || "unknown"} and hasn't been texted yet`,
        description: "This lead has a phone number but no conversation has been started.",
        actionLabel: "View Contact", actionHref: "/dashboard/contacts", contactId: lead.id,
      });
    }

    // 2. Lead replied, AI hasn't responded (10+ min)
    const noResponse = await sql`
      SELECT c.id, c.first_name, c.last_name, m.created_at as msg_time
      FROM messages m
      JOIN conversations conv ON conv.id = m.conversation_id
      JOIN contacts c ON c.id = conv.contact_id
      WHERE conv.workspace_id = ${wsId}
        AND m.direction = 'inbound'
        AND m.created_at > NOW() - INTERVAL '24 hours'
        AND m.created_at < NOW() - INTERVAL '10 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM messages m2
          WHERE m2.conversation_id = m.conversation_id
            AND m2.direction = 'outbound'
            AND m2.created_at > m.created_at
        )
      LIMIT 5
    `;
    for (const lead of noResponse) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
      const mins = Math.round((Date.now() - new Date(lead.msg_time).getTime()) / 60000);
      recs.push({
        type: "urgent", key: `no-response-${lead.id}`,
        title: `${name} replied ${mins} minutes ago and is waiting for a response`,
        description: "They're engaged right now. Every minute you wait, the chance of booking drops.",
        actionLabel: "View Conversation", actionHref: "/dashboard/conversations", contactId: lead.id,
      });
    }

    // 3. Interested lead, no follow-up (qualified + 48h silence)
    const qualifiedNoFollowup = await sql`
      SELECT c.id, c.first_name, c.last_name, c.updated_at
      FROM contacts c
      JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE c.workspace_id = ${wsId}
        AND ps.name ILIKE '%qualif%'
        AND c.last_contacted < NOW() - INTERVAL '48 hours'
        AND ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE
      LIMIT 3
    `;
    for (const lead of qualifiedNoFollowup) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
      const days = Math.round((Date.now() - new Date(lead.updated_at).getTime()) / 86400000);
      recs.push({
        type: "urgent", key: `qualified-stale-${lead.id}`,
        title: `${name} was qualified ${days} days ago but hasn't been followed up with`,
        description: "This lead showed interest. Don't let them go cold.",
        actionLabel: "View Contact", actionHref: "/dashboard/contacts", contactId: lead.id,
      });
    }

    // 4. Deal stuck in stage (7+ days)
    const stuckDeals = await sql`
      SELECT c.id, c.first_name, c.last_name, ps.name as stage_name, d.updated_at
      FROM deals d
      JOIN contacts c ON c.id = d.contact_id
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wsId}
        AND ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE
        AND d.updated_at < NOW() - INTERVAL '7 days'
      ORDER BY d.updated_at ASC
      LIMIT 3
    `;
    for (const deal of stuckDeals) {
      const name = [deal.first_name, deal.last_name].filter(Boolean).join(" ") || "Unknown";
      const days = Math.round((Date.now() - new Date(deal.updated_at).getTime()) / 86400000);
      recs.push({
        type: "urgent", key: `stuck-${deal.id}`,
        title: `${name} has been in ${deal.stage_name} for ${days} days with no movement`,
        description: "This deal might need a push or should be marked dead.",
        actionLabel: "View Pipeline", actionHref: "/dashboard/pipeline",
      });
    }

    // ═══════════════════════════════════════════
    // WARNING — Yellow
    // ═══════════════════════════════════════════

    // 5. Upcoming appointment, no reminder (within 24h)
    const noReminder = await sql`
      SELECT c.id, c.first_name, c.last_name, b.start_time
      FROM bookings b
      JOIN contacts c ON c.id = b.contact_id
      WHERE b.workspace_id = ${wsId}
        AND b.start_time > NOW()
        AND b.start_time < NOW() + INTERVAL '24 hours'
      LIMIT 3
    `;
    for (const appt of noReminder) {
      const name = [appt.first_name, appt.last_name].filter(Boolean).join(" ") || "Unknown";
      const time = new Date(appt.start_time).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
      recs.push({
        type: "warning", key: `appt-reminder-${appt.id}`,
        title: `${name}'s appointment is coming up at ${time}`,
        description: "Make sure you're prepared. Review AI notes on this lead before the call.",
        actionLabel: "View Calendar", actionHref: "/dashboard/calendar",
      });
    }

    // 6. No new leads in 48 hours
    const recentLeadCount = await sql`
      SELECT COUNT(*) as count FROM contacts
      WHERE workspace_id = ${wsId} AND created_at > NOW() - INTERVAL '48 hours'
    `;
    if (parseInt(recentLeadCount[0].count) === 0) {
      recs.push({
        type: "warning", key: "no-new-leads",
        title: "No new leads in 48 hours",
        description: "Check if your ad campaigns are running and your webhook URLs are correct.",
        actionLabel: "View Analytics", actionHref: "/dashboard/analytics",
      });
    }

    // 7. Dropping close rate
    const thisWeekClose = await sql`
      SELECT
        COUNT(*) FILTER (WHERE ps.is_won = TRUE) as won,
        COUNT(*) FILTER (WHERE ps.is_won = TRUE OR ps.is_lost = TRUE) as total
      FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wsId} AND d.updated_at > NOW() - INTERVAL '7 days'
    `;
    const lastWeekClose = await sql`
      SELECT
        COUNT(*) FILTER (WHERE ps.is_won = TRUE) as won,
        COUNT(*) FILTER (WHERE ps.is_won = TRUE OR ps.is_lost = TRUE) as total
      FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wsId}
        AND d.updated_at > NOW() - INTERVAL '14 days'
        AND d.updated_at <= NOW() - INTERVAL '7 days'
    `;
    const twTotal = parseInt(thisWeekClose[0].total);
    const lwTotal = parseInt(lastWeekClose[0].total);
    if (twTotal > 0 && lwTotal > 0) {
      const twRate = Math.round((parseInt(thisWeekClose[0].won) / twTotal) * 100);
      const lwRate = Math.round((parseInt(lastWeekClose[0].won) / lwTotal) * 100);
      if (lwRate > 0 && twRate < lwRate * 0.8) {
        recs.push({
          type: "warning", key: "close-rate-drop",
          title: `Your close rate dropped from ${lwRate}% to ${twRate}% this week`,
          description: "Review your pipeline and follow-up strategy. Something changed.",
          actionLabel: "View Analytics", actionHref: "/dashboard/analytics",
        });
      } else if (twRate > lwRate) {
        recs.push({
          type: "positive", key: "close-rate-up",
          title: `Close rate up from ${lwRate}% to ${twRate}% this week`,
          description: "Whatever you're doing is working. Keep it up.",
        });
      }
    }

    // ═══════════════════════════════════════════
    // INSIGHT — Blue
    // ═══════════════════════════════════════════

    // 8. Best lead source
    const sourcesData = await sql`
      SELECT c.source,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ps.is_won = TRUE) as won
      FROM contacts c
      LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
      LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE c.workspace_id = ${wsId}
        AND c.source IS NOT NULL AND c.source != 'manual'
        AND c.created_at > NOW() - INTERVAL '30 days'
      GROUP BY c.source
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) FILTER (WHERE ps.is_won = TRUE)::float / COUNT(*) DESC
      LIMIT 1
    `;
    if (sourcesData.length > 0 && parseInt(sourcesData[0].won) > 0) {
      const rate = Math.round((parseInt(sourcesData[0].won) / parseInt(sourcesData[0].total)) * 100);
      recs.push({
        type: "insight", key: "best-source",
        title: `Leads from ${sourcesData[0].source} are converting at ${rate}%`,
        description: "Your best channel this month. Consider increasing spend here.",
      });
    }

    // 9. Bottleneck stage
    const bottleneck = await sql`
      SELECT ps.name, COUNT(*) as count
      FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wsId}
        AND ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE
        AND d.updated_at < NOW() - INTERVAL '3 days'
      GROUP BY ps.name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `;
    if (bottleneck.length > 0 && parseInt(bottleneck[0].count) >= 3) {
      recs.push({
        type: "insight", key: "bottleneck",
        title: `Leads are going cold most often at ${bottleneck[0].name}`,
        description: `${bottleneck[0].count} leads stuck there right now. Consider adjusting your approach at this stage.`,
        actionLabel: "View Pipeline", actionHref: "/dashboard/pipeline",
      });
    }

    // ═══════════════════════════════════════════
    // POSITIVE — Green
    // ═══════════════════════════════════════════

    // 10. Recent appointments booked
    const recentAppts = await sql`
      SELECT c.first_name, c.last_name, b.start_time
      FROM bookings b
      JOIN contacts c ON c.id = b.contact_id
      WHERE b.workspace_id = ${wsId}
        AND b.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY b.created_at DESC
      LIMIT 2
    `;
    for (const appt of recentAppts) {
      const name = [appt.first_name, appt.last_name].filter(Boolean).join(" ") || "Unknown";
      const time = new Date(appt.start_time).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      recs.push({
        type: "positive", key: `appt-booked-${appt.start_time}`,
        title: `${name} just booked an appointment for ${time}`,
        description: "Calendar invite sent. You just show up.",
        actionLabel: "View Calendar", actionHref: "/dashboard/calendar",
      });
    }

    // 11. Cold lead re-engaged
    const reEngaged = await sql`
      SELECT c.id, c.first_name, c.last_name, c.ai_followup_count
      FROM contacts c
      JOIN conversations conv ON conv.contact_id = c.id AND conv.workspace_id = c.workspace_id
      JOIN messages m ON m.conversation_id = conv.id AND m.direction = 'inbound'
      WHERE c.workspace_id = ${wsId}
        AND c.ai_followup_count >= 2
        AND m.created_at > NOW() - INTERVAL '24 hours'
      LIMIT 2
    `;
    for (const lead of reEngaged) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
      recs.push({
        type: "positive", key: `re-engaged-${lead.id}`,
        title: `${name} went cold and just replied`,
        description: `AI followed up ${lead.ai_followup_count} times. They're back. Consider jumping in personally.`,
        actionLabel: "View Conversation", actionHref: "/dashboard/conversations",
      });
    }

    // ═══════════════════════════════════════════
    // Save to DB — clear old non-dismissed, insert new
    // ═══════════════════════════════════════════
    await sql`DELETE FROM recommendations WHERE workspace_id = ${wsId} AND dismissed = FALSE`;

    for (const rec of recs) {
      // Don't re-add if this key was previously dismissed (and condition hasn't reset)
      const wasDismissed = await sql`
        SELECT id FROM recommendations
        WHERE workspace_id = ${wsId} AND key = ${rec.key} AND dismissed = TRUE
        AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `;
      if (wasDismissed.length > 0) continue;

      await sql`
        INSERT INTO recommendations (workspace_id, type, key, title, description, action_label, action_href, contact_id)
        VALUES (${wsId}, ${rec.type}, ${rec.key}, ${rec.title}, ${rec.description}, ${rec.actionLabel || null}, ${rec.actionHref || null}, ${rec.contactId || null})
      `;
    }

    return NextResponse.json({ generated: recs.length });
  } catch (e: unknown) {
    console.error("[recommendations]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

// PATCH — dismiss a recommendation
export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json();
    await sql`UPDATE recommendations SET dismissed = TRUE WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
