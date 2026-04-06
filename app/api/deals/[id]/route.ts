import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { sendMessage } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);

// PATCH /api/deals/[id] — update deal (move stage, update value, etc.)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { id } = await params;
    const body = await req.json();
    const { stageId, value, title, notes, assignedTo } = body;

    // Get current deal for activity logging
    const current = await sql`
      SELECT * FROM deals WHERE id = ${id} AND workspace_id = ${workspace.id}
    `;
    if (current.length === 0) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const deal = await sql`
      UPDATE deals SET
        stage_id = COALESCE(${stageId ?? null}, stage_id),
        value = COALESCE(${value ?? null}, value),
        title = COALESCE(${title ?? null}, title),
        notes = COALESCE(${notes ?? null}, notes),
        assigned_to = COALESCE(${assignedTo ?? null}, assigned_to),
        updated_at = NOW()
      WHERE id = ${id} AND workspace_id = ${workspace.id}
      RETURNING *
    `;

    // Log stage change activity
    if (stageId && stageId !== current[0].stage_id) {
      const oldStage = await sql`SELECT name FROM pipeline_stages WHERE id = ${current[0].stage_id}`;
      const newStage = await sql`SELECT name, is_won, is_lost FROM pipeline_stages WHERE id = ${stageId}`;

      await sql`
        INSERT INTO deal_activity (deal_id, workspace_id, action, details)
        VALUES (${id}, ${workspace.id}, 'stage_changed', ${JSON.stringify({
          from: oldStage[0]?.name,
          to: newStage[0]?.name,
        })})
      `;

      // If moved to won/lost stage, set closed_at + trigger AI learning
      if (newStage[0]?.is_won || newStage[0]?.is_lost) {
        await sql`UPDATE deals SET closed_at = NOW() WHERE id = ${id}`;

        // Trigger AI learning in the background
        const conv = await sql`
          SELECT id FROM conversations
          WHERE workspace_id = ${workspace.id} AND contact_id = ${current[0].contact_id} AND channel = 'sms'
          LIMIT 1
        `;
        if (conv.length > 0) {
          const outcome = newStage[0].is_won ? "won" : "lost";
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/ai-agent/learn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: conv[0].id, outcome }),
          }).catch(() => {});

          // If WON → send review request + start GBP review nudges
          if (newStage[0].is_won) {
            // Start GBP review nudge sequence
            try {
              const { startReviewNudges } = await import("@/lib/gbp");
              const gbpConn = await sql`SELECT id FROM gbp_connections WHERE workspace_id = ${workspace.id} AND connected = TRUE LIMIT 1`;
              const wsConfig = await sql`SELECT ai_config, name FROM workspaces WHERE id = ${workspace.id}`;
              const reviewLink = (wsConfig[0]?.ai_config as Record<string, string>)?.googleReviewLink || "";
              const nudgeContact = await sql`SELECT phone, first_name FROM contacts WHERE id = ${current[0].contact_id}`;
              if (nudgeContact.length > 0 && nudgeContact[0].phone && reviewLink) {
                await startReviewNudges(
                  gbpConn.length > 0 ? (gbpConn[0].id as string) : null,
                  nudgeContact[0].phone as string,
                  (nudgeContact[0].first_name as string) || "there",
                  (wsConfig[0]?.name as string) || "our business",
                  reviewLink,
                );
              }
            } catch (nudgeErr) {
              console.error("[deals] Failed to start review nudges:", nudgeErr);
            }

            const contact = await sql`SELECT * FROM contacts WHERE id = ${current[0].contact_id}`;
            if (contact.length > 0 && contact[0].phone) {
              // Schedule review request (set followup for 24h from now)
              await sql`
                UPDATE contacts SET
                  ai_next_followup = NOW() + INTERVAL '24 hours',
                  ai_followup_count = 0,
                  ai_qualification = jsonb_set(
                    COALESCE(ai_qualification, '{}'::jsonb),
                    '{reviewRequested}',
                    'true'::jsonb
                  )
                WHERE id = ${contact[0].id}
              `;
              // Update conversation stage so AI knows to ask for review
              await sql`UPDATE conversations SET ai_stage = 'booked' WHERE id = ${conv[0].id}`;

              // Send immediate thank you
              const chatId = contact[0].phone;
              const name = contact[0].first_name || "there";
              const wsData = await sql`SELECT name, ai_config FROM workspaces WHERE id = ${workspace.id}`;
              const bizName = wsData[0]?.name || "us";
              const googleLink = (wsData[0]?.ai_config as Record<string, string>)?.googleReviewLink || "";

              const thankYou = `Hey ${name}! Thank you so much for choosing ${bizName}. We really appreciate your business! How was your experience with us?`;

              if (chatId) {
                try {
                  const result = await sendMessage(chatId, thankYou);
                  await sql`
                    INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid)
                    VALUES (${conv[0].id}, ${workspace.id}, 'outbound', 'sms', '', ${contact[0].phone}, ${thankYou}, 'sent', 'ai', ${result.message_id})
                  `;
                  await sql`UPDATE conversations SET last_message_at = NOW() WHERE id = ${conv[0].id}`;
                } catch { /* silent */ }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ deal: deal[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
