import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

interface Recommendation {
  type: "urgent" | "opportunity" | "insight";
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
  contactId?: string;
}

export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();
    const wsId = workspace.id;
    const recommendations: Recommendation[] = [];

    // 1. Leads that haven't been contacted in 48+ hours (urgent)
    const coldLeads = await sql`
      SELECT c.id, c.first_name, c.last_name, c.phone,
             MAX(m.created_at) as last_message
      FROM contacts c
      LEFT JOIN conversations conv ON conv.contact_id = c.id AND conv.workspace_id = c.workspace_id
      LEFT JOIN messages m ON m.conversation_id = conv.id
      JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE c.workspace_id = ${wsId}
        AND ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE
      GROUP BY c.id, c.first_name, c.last_name, c.phone
      HAVING MAX(m.created_at) < NOW() - INTERVAL '48 hours'
         OR MAX(m.created_at) IS NULL
      LIMIT 5
    `;

    for (const lead of coldLeads) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
      recommendations.push({
        type: "urgent",
        title: `${name} hasn't been contacted in 48+ hours`,
        description: "This lead is going cold. Reach out before they go with a competitor.",
        action: "View Lead",
        actionHref: "/dashboard/contacts",
        contactId: lead.id,
      });
    }

    // 2. Leads that re-engaged after going cold (opportunity)
    const reEngaged = await sql`
      SELECT c.first_name, c.last_name, c.id,
             conv.ai_stage
      FROM contacts c
      JOIN conversations conv ON conv.contact_id = c.id AND conv.workspace_id = c.workspace_id
      JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE c.workspace_id = ${wsId}
        AND ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE
        AND c.ai_followup_count >= 2
        AND conv.status = 'open'
      ORDER BY c.updated_at DESC
      LIMIT 3
    `;

    for (const lead of reEngaged) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
      recommendations.push({
        type: "opportunity",
        title: `${name} is re-engaging after follow-ups`,
        description: "AI has been following up. They're showing interest again. Good time to jump in personally.",
        action: "View Conversation",
        actionHref: "/dashboard/conversations",
        contactId: lead.id,
      });
    }

    // 3. Appointments coming up today (insight)
    const todayAppts = await sql`
      SELECT COUNT(*) as count FROM bookings
      WHERE workspace_id = ${wsId}
        AND start_time >= NOW()
        AND start_time < NOW() + INTERVAL '24 hours'
    `;
    const apptCount = parseInt(todayAppts[0]?.count || "0");
    if (apptCount > 0) {
      recommendations.push({
        type: "insight",
        title: `You have ${apptCount} appointment${apptCount > 1 ? "s" : ""} in the next 24 hours`,
        description: "Check your calendar to prepare. Review AI notes on each lead before the call.",
        action: "View Calendar",
        actionHref: "/dashboard/calendar",
      });
    }

    // 4. Pipeline health insight
    const pipelineStats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE ps.is_won = TRUE AND d.updated_at >= NOW() - INTERVAL '30 days') as won_30d,
        COUNT(*) FILTER (WHERE ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE) as active
      FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE d.workspace_id = ${wsId}
    `;
    const won = parseInt(pipelineStats[0]?.won_30d || "0");
    const active = parseInt(pipelineStats[0]?.active || "0");
    if (active > 0 && won > 0) {
      const rate = Math.round((won / (won + active)) * 100);
      recommendations.push({
        type: "insight",
        title: `Your close rate this month is ${rate}%`,
        description: active > 5
          ? `${active} leads still in your pipeline. Keep following up to move them forward.`
          : "Solid conversion. Keep the momentum going.",
        action: "View Pipeline",
        actionHref: "/dashboard/pipeline",
      });
    }

    // 5. New leads with no conversation (urgent)
    const noConvo = await sql`
      SELECT c.first_name, c.last_name, c.id
      FROM contacts c
      LEFT JOIN conversations conv ON conv.contact_id = c.id
      WHERE c.workspace_id = ${wsId}
        AND conv.id IS NULL
        AND c.phone IS NOT NULL
        AND c.created_at >= NOW() - INTERVAL '7 days'
      LIMIT 3
    `;
    for (const lead of noConvo) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
      recommendations.push({
        type: "urgent",
        title: `${name} has a phone number but no conversation started`,
        description: "This lead came in recently but the AI hasn't texted them yet. Check their profile.",
        action: "View Contact",
        actionHref: "/dashboard/contacts",
        contactId: lead.id,
      });
    }

    return NextResponse.json({ recommendations });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[recommendations]", msg);
    return NextResponse.json({ recommendations: [] });
  }
}
