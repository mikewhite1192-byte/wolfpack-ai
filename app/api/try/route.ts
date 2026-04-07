import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);

// Maya demo conversation state stored in DB
// POST /api/try — start the Maya demo sequence
export async function POST(req: NextRequest) {
  try {
    const { name, phone, industry } = await req.json();

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
    }

    const firstName = name.trim();
    const cleanPhone = phone.replace(/\D/g, "");
    const e164 = cleanPhone.startsWith("1") && cleanPhone.length === 11
      ? "+" + cleanPhone
      : cleanPhone.length === 10
      ? "+1" + cleanPhone
      : "+" + cleanPhone;

    // Check if already sent to this number recently (prevent spam)
    const recent = await sql`
      SELECT id FROM maya_demos WHERE phone = ${e164} AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1
    `;
    if (recent.length > 0) {
      return NextResponse.json({ error: "We already texted this number in the last 24 hours. Check your messages!" }, { status: 429 });
    }

    // Send Message 1 — sell Wolf Pack AI directly
    const msg1 = `Hey ${firstName}! This is Maya with Wolf Pack AI. I saw you were checking us out. Quick question, what kind of business are you in?`;

    let chatId: string | null = null;
    try {
      const chatResult = await sendMessage(e164, msg1);
      chatId = chatResult?.message_id || null;
      console.log(`[try] Message sent, message_id: ${chatId}, full result:`, JSON.stringify(chatResult));
    } catch (err) {
      console.error(`[try] createChat failed but continuing:`, err);
    }

    // Store the demo state — phone is the primary lookup key
    await sql`
      INSERT INTO maya_demos (phone, first_name, chat_id, step, industry, conversation, created_at)
      VALUES (${e164}, ${firstName}, ${chatId}, 1, ${industry || 'insurance'}, ${JSON.stringify([{ role: "assistant", content: msg1 }])}::jsonb, NOW())
    `;

    // Schedule the 10-minute follow-up check
    await sql`
      UPDATE maya_demos SET followup_at = NOW() + INTERVAL '10 minutes' WHERE phone = ${e164} AND step = 1
    `;

    // ── Create contact + deal in owner's pipeline ──
    try {
      const ws = await sql`SELECT id FROM workspaces WHERE owner_email = 'info@thewolfpackco.com' OR name ILIKE '%wolf%' LIMIT 1`;
      if (ws.length > 0) {
        const workspaceId = ws[0].id;
        const existing = await sql`SELECT id FROM contacts WHERE workspace_id = ${workspaceId} AND phone = ${e164} LIMIT 1`;
        if (existing.length === 0) {
          const contact = await sql`
            INSERT INTO contacts (workspace_id, first_name, phone, source, source_detail)
            VALUES (${workspaceId}, ${firstName}, ${e164}, 'landing_page', 'See It Work On You')
            RETURNING id
          `;
          const firstStage = await sql`SELECT id FROM pipeline_stages WHERE workspace_id = ${workspaceId} ORDER BY position ASC LIMIT 1`;
          if (firstStage.length > 0) {
            await sql`
              INSERT INTO deals (workspace_id, contact_id, stage_id, title)
              VALUES (${workspaceId}, ${contact[0].id}, ${firstStage[0].id}, ${`Demo Lead - ${firstName}`})
            `;
          }
        }
      }
    } catch (pipelineErr) {
      console.error("[try] Pipeline insert error (non-fatal):", pipelineErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[try]", err);
    return NextResponse.json({ error: "Failed to start demo. Try again." }, { status: 500 });
  }
}
