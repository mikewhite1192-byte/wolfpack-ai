import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/settings — load all settings
export async function GET() {
  try {
    const workspace = await getOrCreateWorkspace();

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

    return NextResponse.json({
      workspace,
      stages,
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
      const { stages } = body; // [{name, color, isWon, isLost}]

      // Delete existing stages (cascade will be handled separately when deals exist)
      // For now, delete and recreate
      await sql`DELETE FROM pipeline_stages WHERE workspace_id = ${workspace.id}`;

      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        await sql`
          INSERT INTO pipeline_stages (workspace_id, name, position, color, is_won, is_lost)
          VALUES (${workspace.id}, ${s.name}, ${i}, ${s.color || "#3498db"}, ${s.isWon || false}, ${s.isLost || false})
        `;
      }
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
