import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { runSalesAgent, DEFAULT_CONFIG, getNextFollowUpHours, type AgentConfig, type LeadQualification, type ConversationStage } from "@/lib/ai-agent";
import { sendMessage } from "@/lib/linq/client";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/ai-agent/follow-up — process all leads due for follow-up
// Called by Vercel Cron or external scheduler
export async function POST(req: Request) {
  try {
    // Simple auth check
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find contacts due for follow-up
    const dueContacts = await sql`
      SELECT c.*, conv.id as conv_id, conv.ai_stage, conv.assigned_to as chat_id,
             w.ai_config, w.name as workspace_name, w.id as ws_id
      FROM contacts c
      JOIN conversations conv ON conv.contact_id = c.id AND conv.channel = 'sms' AND conv.ai_enabled = TRUE
      JOIN workspaces w ON w.id = c.workspace_id
      WHERE c.ai_next_followup IS NOT NULL
        AND c.ai_next_followup <= NOW()
        AND conv.status = 'open'
      LIMIT 20
    `;

    console.log(`[follow-up] Found ${dueContacts.length} contacts due for follow-up`);

    let sent = 0;
    let skipped = 0;

    for (const contact of dueContacts) {
      const config: AgentConfig = { ...DEFAULT_CONFIG, ...(contact.ai_config || {}), businessName: contact.workspace_name || "our business" };

      if (!config.enabled || !config.followUpEnabled) {
        skipped++;
        continue;
      }

      const chatId = contact.chat_id;
      if (!chatId) {
        skipped++;
        continue;
      }

      // Check if we've exceeded max follow-ups
      const maxFollowUps = (config.followUpHours || [24, 72, 168, 336]).length;
      if ((contact.ai_followup_count || 0) >= maxFollowUps) {
        // Park this lead — move to nurture
        await sql`UPDATE contacts SET ai_next_followup = NULL WHERE id = ${contact.id}`;
        await sql`UPDATE conversations SET ai_stage = 'nurture' WHERE id = ${contact.conv_id}`;
        skipped++;
        continue;
      }

      // Load recent messages for context
      const recentMessages = await sql`
        SELECT direction, body FROM messages
        WHERE conversation_id = ${contact.conv_id}
        ORDER BY created_at ASC
        LIMIT 30
      `;

      const aiMessages = recentMessages.map((m) => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: (m.body as string) || "",
      }));

      const leadName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "there";
      const qualification: LeadQualification = contact.ai_qualification || {};

      // Calculate hours since last message
      const lastMsg = await sql`
        SELECT created_at FROM messages WHERE conversation_id = ${contact.conv_id}
        ORDER BY created_at DESC LIMIT 1
      `;
      const hoursSince = lastMsg.length > 0
        ? (Date.now() - new Date(lastMsg[0].created_at).getTime()) / (1000 * 60 * 60)
        : 24;

      // Run the agent in follow-up mode
      const result = await runSalesAgent({
        config,
        contactName: leadName,
        contactPhone: contact.phone || "",
        source: contact.source || "unknown",
        qualification,
        conversationStage: (contact.ai_stage || "follow_up") as ConversationStage,
        messages: aiMessages,
        hoursSinceLastContact: hoursSince,
        followUpCount: contact.ai_followup_count || 0,
        isFollowUp: true,
      });

      // Send the follow-up message
      let msgId: string | null = null;
      let error = false;
      try {
        const sendResult = await sendMessage(chatId, result.reply);
        msgId = sendResult.message.id;
      } catch (err) {
        console.error(`[follow-up] Failed to send to ${contact.phone}:`, err);
        error = true;
      }

      if (!error) {
        // Save the message
        await sql`
          INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid, credits_used)
          VALUES (${contact.conv_id}, ${contact.ws_id}, 'outbound', 'sms', '', ${contact.phone || ''}, ${result.reply}, 'sent', 'ai', ${msgId}, 1)
        `;
        await sql`UPDATE conversations SET last_message_at = NOW(), ai_stage = ${result.updatedStage} WHERE id = ${contact.conv_id}`;

        // Schedule next follow-up
        const newFollowUpCount = (contact.ai_followup_count || 0) + 1;
        const nextHours = getNextFollowUpHours(newFollowUpCount, config);

        await sql`
          UPDATE contacts SET
            ai_qualification = ${JSON.stringify(result.updatedQualification)}::jsonb,
            lead_score = ${result.suggestedScore},
            ai_followup_count = ${newFollowUpCount},
            ai_next_followup = ${nextHours ? new Date(Date.now() + nextHours * 60 * 60 * 1000).toISOString() : null},
            last_contacted = NOW()
          WHERE id = ${contact.id}
        `;

        // Save AI note
        const aiNotes = result.updatedQualification.notes;
        if (aiNotes) {
          const dealRow = await sql`SELECT id FROM deals WHERE contact_id = ${contact.id} AND workspace_id = ${contact.ws_id} LIMIT 1`;
          if (dealRow.length > 0) {
            await sql`
              INSERT INTO deal_activity (deal_id, action, details, created_at)
              VALUES (${dealRow[0].id}, 'ai_note', ${JSON.stringify({ text: aiNotes })}::jsonb, NOW())
            `;
          }
        }

        sent++;
        console.log(`[follow-up] Sent follow-up #${newFollowUpCount} to ${leadName} (${contact.phone})`);
      }
    }

    return NextResponse.json({ processed: dueContacts.length, sent, skipped });
  } catch (err) {
    console.error("[follow-up] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
