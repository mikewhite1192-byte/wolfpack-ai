import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/settings — load all settings
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();

    const pipelines = await sql`
      SELECT * FROM pipelines WHERE workspace_id = ${workspace.id} ORDER BY created_at ASC
    `;

    const stages = await sql`
      SELECT * FROM pipeline_stages
      WHERE workspace_id = ${workspace.id}
      ORDER BY position ASC
    `;

    const templates = await sql`
      SELECT * FROM templates
      WHERE workspace_id = ${workspace.id}
      ORDER BY created_at ASC
    `;

    // GBP connections
    const gbpConnections = await sql`
      SELECT id, connected_email, connected, location_name, auto_post_enabled, auto_review_reply_enabled, monthly_report_enabled, report_phone
      FROM gbp_connections WHERE workspace_id = ${workspace.id}
    `;

    return NextResponse.json({
      workspace,
      pipelines,
      stages,
      gbpConnections,
      smsTemplates: templates.filter(t => t.type === "sms"),
      emailTemplates: templates.filter(t => t.type === "email"),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/settings — update settings
export async function PATCH(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const body = await req.json();
    const { section } = body;

    if (section === "account") {
      const { name, ownerName, phone, email } = body;
      await sql`
        UPDATE workspaces SET
          name = COALESCE(${name ?? null}, name),
          branding = jsonb_set(
            COALESCE(branding, '{}'::jsonb),
            '{ownerName}',
            ${JSON.stringify(ownerName || "")}::jsonb
          )
        WHERE id = ${workspace.id}
      `;
      // Store phone/email in branding jsonb
      await sql`
        UPDATE workspaces SET
          branding = jsonb_set(
            jsonb_set(
              COALESCE(branding, '{}'::jsonb),
              '{phone}',
              ${JSON.stringify(phone || "")}::jsonb
            ),
            '{email}',
            ${JSON.stringify(email || "")}::jsonb
          )
        WHERE id = ${workspace.id}
      `;
      return NextResponse.json({ ok: true });
    }

    if (section === "stages") {
      const { stages, pipelineId } = body; // [{name, color, isWon, isLost}], pipelineId

      if (!pipelineId) {
        return NextResponse.json({ error: "pipelineId required" }, { status: 400 });
      }

      // Delete existing stages for this specific pipeline
      await sql`DELETE FROM pipeline_stages WHERE workspace_id = ${workspace.id} AND pipeline_id = ${pipelineId}`;

      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        await sql`
          INSERT INTO pipeline_stages (workspace_id, pipeline_id, name, position, color, is_won, is_lost)
          VALUES (${workspace.id}, ${pipelineId}, ${s.name}, ${i}, ${s.color || "#3498db"}, ${s.isWon || false}, ${s.isLost || false})
        `;
      }
      return NextResponse.json({ ok: true });
    }

    if (section === "renamePipeline") {
      const { pipelineId, name } = body;
      await sql`UPDATE pipelines SET name = ${name} WHERE id = ${pipelineId} AND workspace_id = ${workspace.id}`;
      return NextResponse.json({ ok: true });
    }

    if (section === "smsTemplates" || section === "emailTemplates") {
      const type = section === "smsTemplates" ? "sms" : "email";
      const { templates } = body; // [{name, subject?, body}]

      // Delete existing templates of this type
      await sql`DELETE FROM templates WHERE workspace_id = ${workspace.id} AND type = ${type}`;

      for (const t of templates) {
        if (t.body?.trim()) {
          await sql`
            INSERT INTO templates (workspace_id, type, name, subject, body)
            VALUES (${workspace.id}, ${type}, ${t.name}, ${t.subject || null}, ${t.body})
          `;
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (section === "aiAgent") {
      const { aiConfig } = body;
      await sql`UPDATE workspaces SET ai_config = ${JSON.stringify(aiConfig)}::jsonb WHERE id = ${workspace.id}`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
