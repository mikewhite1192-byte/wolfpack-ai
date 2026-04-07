import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { sendMessage } from "@/lib/loop/client";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SONNET_EMAILS = ["info@thewolfpackco.com"];

// ---------------------------------------------------------------------------
// Tool definitions for Anthropic tool use
// ---------------------------------------------------------------------------
const tools: Anthropic.Messages.Tool[] = [
  {
    name: "send_text",
    description:
      "Send a text message to a contact via Loop (iMessage/SMS). Also logs the message in the CRM.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_phone: { type: "string", description: "Phone number of the contact" },
        message: { type: "string", description: "The text message to send" },
      },
      required: ["contact_phone", "message"],
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact in the CRM with optional details. Also creates a deal in the default pipeline stage.",
    input_schema: {
      type: "object" as const,
      properties: {
        first_name: { type: "string", description: "Contact first name" },
        last_name: { type: "string", description: "Contact last name (optional)" },
        phone: { type: "string", description: "Phone number" },
        email: { type: "string", description: "Email address (optional)" },
        source: { type: "string", description: "Lead source (optional, defaults to 'ai-assistant')" },
      },
      required: ["first_name", "phone"],
    },
  },
  {
    name: "move_deal",
    description:
      "Move a contact's deal to a different pipeline stage. Searches by contact name.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_name: { type: "string", description: "Name (or partial name) of the contact to search for" },
        stage_name: { type: "string", description: "Name of the pipeline stage to move the deal to" },
      },
      required: ["contact_name", "stage_name"],
    },
  },
  {
    name: "toggle_ai",
    description: "Turn AI auto-reply on or off for a contact's conversation.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_name: { type: "string", description: "Name (or partial name) of the contact" },
        enabled: { type: "boolean", description: "true to enable AI, false to disable" },
      },
      required: ["contact_name", "enabled"],
    },
  },
  {
    name: "add_note",
    description: "Add a note to a contact's deal.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_name: { type: "string", description: "Name (or partial name) of the contact" },
        note: { type: "string", description: "The note text to add" },
      },
      required: ["contact_name", "note"],
    },
  },
  {
    name: "schedule_followup",
    description:
      "Send an immediate follow-up text to a contact. Use this when the owner asks to follow up with someone.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_phone: { type: "string", description: "Phone number of the contact" },
        message: { type: "string", description: "The follow-up message to send" },
      },
      required: ["contact_phone", "message"],
    },
  },
  {
    name: "search_contacts",
    description:
      "Search contacts by name, phone, or email. Returns top 10 matches with details.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (name, phone, or email)" },
      },
      required: ["query"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution helpers
// ---------------------------------------------------------------------------

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (phone.startsWith("+")) return phone;
  return "+" + digits;
}

async function findContactByName(workspaceId: string, name: string) {
  const q = "%" + name + "%";
  const results = await sql`
    SELECT c.*, d.id as deal_id, d.stage_id, ps.name as stage_name
    FROM contacts c
    LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
    LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
    WHERE c.workspace_id = ${workspaceId}
      AND (c.first_name ILIKE ${q} OR c.last_name ILIKE ${q}
           OR CONCAT(c.first_name, ' ', c.last_name) ILIKE ${q})
    LIMIT 1
  `;
  return results.length > 0 ? results[0] : null;
}

async function getOrCreateConversation(workspaceId: string, contactId: string, contactPhone: string) {
  let conv = await sql`
    SELECT * FROM conversations
    WHERE workspace_id = ${workspaceId} AND contact_id = ${contactId} AND channel = 'sms'
    LIMIT 1
  `;
  if (conv.length === 0) {
    conv = await sql`
      INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled)
      VALUES (${workspaceId}, ${contactId}, 'sms', 'open', TRUE)
      RETURNING *
    `;
  }
  return conv[0];
}

type ToolInput = Record<string, unknown>;

async function executeTool(
  toolName: string,
  input: ToolInput,
  workspaceId: string,
): Promise<string> {
  try {
    switch (toolName) {
      // ----- send_text / schedule_followup -----
      case "send_text":
      case "schedule_followup": {
        const phone = toE164(input.contact_phone as string);
        const message = input.message as string;

        // Find the contact
        const contacts = await sql`
          SELECT * FROM contacts
          WHERE workspace_id = ${workspaceId} AND (phone = ${phone} OR phone LIKE ${"%" + phone.replace(/\D/g, "").slice(-10)})
          LIMIT 1
        `;
        if (contacts.length === 0) {
          return JSON.stringify({ error: "Contact not found with that phone number." });
        }
        const contact = contacts[0];

        // Get or create conversation
        const conv = await getOrCreateConversation(workspaceId, contact.id as string, phone);

        // Send via Loop
        const result = await sendMessage(phone, message);

        // Save outbound message
        await sql`
          INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by, twilio_sid)
          VALUES (${conv.id}, ${workspaceId}, 'outbound', 'sms', '', ${phone}, ${message}, 'sent', 'user', ${result.message_id})
        `;
        await sql`UPDATE conversations SET last_message_at = NOW() WHERE id = ${conv.id}`;
        await sql`UPDATE contacts SET last_contacted = NOW() WHERE id = ${contact.id}`;

        const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || phone;
        return JSON.stringify({ success: true, message: `Text sent to ${name} (${phone}): "${message}"` });
      }

      // ----- create_contact -----
      case "create_contact": {
        const phone = input.phone ? toE164(input.phone as string) : null;
        const firstName = (input.first_name as string) || null;
        const lastName = (input.last_name as string) || null;
        const email = (input.email as string) || null;
        const source = (input.source as string) || "ai-assistant";

        // Duplicate check
        if (phone) {
          const dupe = await sql`
            SELECT id, first_name, last_name FROM contacts
            WHERE workspace_id = ${workspaceId} AND phone = ${phone}
            LIMIT 1
          `;
          if (dupe.length > 0) {
            const dupeName = [dupe[0].first_name, dupe[0].last_name].filter(Boolean).join(" ");
            return JSON.stringify({ error: `Contact already exists: ${dupeName} (${phone})` });
          }
        }

        const contact = await sql`
          INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, source)
          VALUES (${workspaceId}, ${firstName}, ${lastName}, ${email}, ${phone}, ${source})
          RETURNING *
        `;

        // Create deal in first pipeline stage
        const firstStage = await sql`
          SELECT id, name FROM pipeline_stages
          WHERE workspace_id = ${workspaceId}
          ORDER BY position ASC LIMIT 1
        `;
        if (firstStage.length > 0) {
          await sql`
            INSERT INTO deals (workspace_id, contact_id, stage_id, title)
            VALUES (${workspaceId}, ${contact[0].id}, ${firstStage[0].id}, ${(firstName || "") + " " + (lastName || "") + " Deal"})
          `;
        }

        // Create conversation
        if (phone) {
          await sql`
            INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled)
            VALUES (${workspaceId}, ${contact[0].id}, 'sms', 'open', TRUE)
          `;
        }

        const name = [firstName, lastName].filter(Boolean).join(" ");
        return JSON.stringify({
          success: true,
          message: `Contact created: ${name}${phone ? " (" + phone + ")" : ""}${email ? " — " + email : ""}. Added to ${firstStage[0]?.name || "pipeline"}.`,
        });
      }

      // ----- move_deal -----
      case "move_deal": {
        const contact = await findContactByName(workspaceId, input.contact_name as string);
        if (!contact) return JSON.stringify({ error: `No contact found matching "${input.contact_name}".` });
        if (!contact.deal_id) return JSON.stringify({ error: `${contact.first_name} has no deal to move.` });

        // Find stage by name
        const stageName = input.stage_name as string;
        const stages = await sql`
          SELECT id, name FROM pipeline_stages
          WHERE workspace_id = ${workspaceId} AND name ILIKE ${stageName}
          LIMIT 1
        `;
        if (stages.length === 0) {
          // Return available stages to help
          const allStages = await sql`
            SELECT name FROM pipeline_stages WHERE workspace_id = ${workspaceId} ORDER BY position
          `;
          return JSON.stringify({
            error: `Stage "${stageName}" not found. Available stages: ${allStages.map(s => s.name).join(", ")}`,
          });
        }

        const oldStageName = contact.stage_name || "Unknown";
        const newStage = stages[0];

        await sql`UPDATE deals SET stage_id = ${newStage.id}, updated_at = NOW() WHERE id = ${contact.deal_id}`;

        // Log activity
        await sql`
          INSERT INTO deal_activity (deal_id, workspace_id, action, details)
          VALUES (${contact.deal_id}, ${workspaceId}, 'stage_changed', ${JSON.stringify({ from: oldStageName, to: newStage.name })})
        `;

        const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
        return JSON.stringify({ success: true, message: `Moved ${name}'s deal from "${oldStageName}" to "${newStage.name}".` });
      }

      // ----- toggle_ai -----
      case "toggle_ai": {
        const contact = await findContactByName(workspaceId, input.contact_name as string);
        if (!contact) return JSON.stringify({ error: `No contact found matching "${input.contact_name}".` });

        const convs = await sql`
          SELECT id FROM conversations
          WHERE workspace_id = ${workspaceId} AND contact_id = ${contact.id}
        `;
        if (convs.length === 0) return JSON.stringify({ error: `No conversation found for ${contact.first_name}.` });

        const enabled = input.enabled as boolean;
        await sql`UPDATE conversations SET ai_enabled = ${enabled} WHERE id = ${convs[0].id}`;

        const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
        return JSON.stringify({ success: true, message: `AI auto-reply ${enabled ? "enabled" : "disabled"} for ${name}.` });
      }

      // ----- add_note -----
      case "add_note": {
        const contact = await findContactByName(workspaceId, input.contact_name as string);
        if (!contact) return JSON.stringify({ error: `No contact found matching "${input.contact_name}".` });
        if (!contact.deal_id) return JSON.stringify({ error: `${contact.first_name} has no deal to add a note to.` });

        const noteText = input.note as string;
        await sql`
          INSERT INTO deal_activity (deal_id, workspace_id, action, details)
          VALUES (${contact.deal_id}, ${workspaceId}, 'note_added', ${JSON.stringify({ text: noteText })})
        `;

        const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
        return JSON.stringify({ success: true, message: `Note added to ${name}'s deal: "${noteText}"` });
      }

      // ----- search_contacts -----
      case "search_contacts": {
        const q = "%" + (input.query as string) + "%";
        const results = await sql`
          SELECT c.first_name, c.last_name, c.phone, c.email, c.lead_score, c.source,
                 c.last_contacted, c.created_at,
                 ps.name as stage_name, d.value as deal_value,
                 conv.ai_enabled
          FROM contacts c
          LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
          LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
          LEFT JOIN conversations conv ON conv.contact_id = c.id AND conv.workspace_id = c.workspace_id AND conv.channel = 'sms'
          WHERE c.workspace_id = ${workspaceId}
            AND (c.first_name ILIKE ${q} OR c.last_name ILIKE ${q} OR c.phone ILIKE ${q} OR c.email ILIKE ${q})
          ORDER BY c.created_at DESC
          LIMIT 10
        `;
        if (results.length === 0) {
          return JSON.stringify({ results: [], message: `No contacts found matching "${input.query}".` });
        }
        return JSON.stringify({
          results: results.map(r => ({
            name: [r.first_name, r.last_name].filter(Boolean).join(" "),
            phone: r.phone,
            email: r.email,
            stage: r.stage_name,
            score: r.lead_score,
            deal_value: r.deal_value,
            source: r.source,
            ai_enabled: r.ai_enabled,
            last_contacted: r.last_contacted,
          })),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    console.error(`[ai-chat] Tool ${toolName} error:`, err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return JSON.stringify({ error: `Tool execution failed: ${msg}` });
  }
}

// ---------------------------------------------------------------------------
// POST /api/ai-agent/chat — internal AI assistant for the business owner
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { message, history } = await req.json();

    // Gather live CRM data — wrapped individually so one failure doesn't crash everything
    const safe = async (fn: () => Promise<Record<string, unknown>[]>) => {
      try { return await fn(); } catch (e) { console.error("[ai-chat] query error:", e); return []; }
    };

    const [pipelineData, hotLeads, coldLeads, recentActivity, statsArr, conversations] = await Promise.all([
      safe(() => sql`
        SELECT ps.name, ps.color, COUNT(d.id) as count, COALESCE(SUM(d.value), 0) as total_value
        FROM pipeline_stages ps
        LEFT JOIN deals d ON d.stage_id = ps.id AND d.workspace_id = ps.workspace_id
        WHERE ps.workspace_id = ${workspace.id}
        GROUP BY ps.id, ps.name, ps.color, ps.position
        ORDER BY ps.position
      `),
      safe(() => sql`
        SELECT c.first_name, c.last_name, c.phone, c.lead_score, c.ai_qualification,
               ps.name as stage_name, d.value as deal_value
        FROM contacts c
        LEFT JOIN deals d ON d.contact_id = c.id AND d.workspace_id = c.workspace_id
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE c.workspace_id = ${workspace.id} AND c.lead_score >= 60
        ORDER BY c.lead_score DESC
        LIMIT 10
      `),
      safe(() => sql`
        SELECT c.first_name, c.last_name, c.phone, c.last_contacted, c.ai_followup_count, c.lead_score
        FROM contacts c
        JOIN conversations conv ON conv.contact_id = c.id AND conv.status = 'open' AND conv.ai_enabled = true
        WHERE c.workspace_id = ${workspace.id}
          AND c.last_contacted < NOW() - INTERVAL '48 hours'
        ORDER BY c.last_contacted ASC
        LIMIT 10
      `),
      safe(() => sql`
        SELECT da.action, da.details, da.created_at, c.first_name, c.last_name
        FROM deal_activity da
        JOIN deals d ON d.id = da.deal_id
        JOIN contacts c ON c.id = d.contact_id
        WHERE da.workspace_id = ${workspace.id}
        ORDER BY da.created_at DESC
        LIMIT 15
      `),
      safe(() => sql`
        SELECT
          COUNT(*) FILTER (WHERE ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE) as active_deals,
          COUNT(*) FILTER (WHERE ps.is_won = TRUE AND d.closed_at > NOW() - INTERVAL '30 days') as closed_this_month,
          COALESCE(SUM(d.value) FILTER (WHERE ps.is_won IS NOT TRUE AND ps.is_lost IS NOT TRUE), 0) as pipeline_value,
          COALESCE(SUM(d.value) FILTER (WHERE ps.is_won = TRUE AND d.closed_at > NOW() - INTERVAL '30 days'), 0) as revenue_this_month
        FROM deals d
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE d.workspace_id = ${workspace.id}
      `),
      safe(() => sql`
        SELECT conv.*, c.first_name, c.last_name, c.phone,
          (SELECT COUNT(*) FROM messages WHERE conversation_id = conv.id AND direction = 'inbound' AND created_at > NOW() - INTERVAL '24 hours') as new_messages
        FROM conversations conv
        JOIN contacts c ON c.id = conv.contact_id
        WHERE conv.workspace_id = ${workspace.id} AND conv.status = 'open'
        ORDER BY conv.last_message_at DESC
        LIMIT 10
      `),
    ]);

    const stats = statsArr;

    const s = (stats[0] as Record<string, unknown>) || {};
    const crmContext = `
LIVE CRM DATA:
Pipeline: ${s.active_deals || 0} active deals worth $${Number(s.pipeline_value || 0).toLocaleString()}
Revenue this month: $${Number(s.revenue_this_month || 0).toLocaleString()} (${s.closed_this_month || 0} deals closed)

PIPELINE BREAKDOWN:
${pipelineData.map((p: Record<string, unknown>) => `- ${p.name}: ${p.count} deals ($${Number(p.total_value || 0).toLocaleString()})`).join("\n")}

HOT LEADS (score 60+):
${hotLeads.length === 0 ? "None yet" : hotLeads.map((l: Record<string, unknown>) => {
  const name = [l.first_name, l.last_name].filter(Boolean).join(" ");
  const qual = l.ai_qualification as Record<string, unknown> | null;
  return `- ${name} (${l.phone}) — Score: ${l.lead_score}, Stage: ${l.stage_name || "New"}, Value: $${Number(l.deal_value || 0).toLocaleString()}${qual?.needs ? `, Needs: ${qual.needs}` : ""}`;
}).join("\n")}

GOING COLD (no contact 48h+):
${coldLeads.length === 0 ? "None" : coldLeads.map((l: Record<string, unknown>) => {
  const name = [l.first_name, l.last_name].filter(Boolean).join(" ");
  const lastContact = l.last_contacted ? new Date(l.last_contacted as string).toLocaleDateString() : "never";
  return `- ${name} (${l.phone}) — Last contact: ${lastContact}, Follow-ups: ${l.ai_followup_count || 0}, Score: ${l.lead_score || 0}`;
}).join("\n")}

ACTIVE CONVERSATIONS:
${conversations.map((c: Record<string, unknown>) => {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
  return `- ${name}: ${c.new_messages || 0} new messages, AI ${c.ai_enabled ? "on" : "off"}`;
}).join("\n")}

RECENT ACTIVITY:
${recentActivity.slice(0, 8).map((a: Record<string, unknown>) => {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ");
  const d = a.details as Record<string, string> | null;
  const time = new Date(a.created_at as string).toLocaleString();
  if (a.action === "stage_changed") return `- ${name} moved ${d?.from} → ${d?.to} (${time})`;
  if (a.action === "note_added") return `- Note on ${name}: "${(d?.text || "").substring(0, 50)}" (${time})`;
  return `- ${a.action} for ${name} (${time})`;
}).join("\n")}`;

    const systemPrompt = `You are the AI assistant for ${workspace.name || "this business"}. You have full access to the CRM data below AND you can take actions using tools. You help the business owner manage their sales pipeline, prioritize leads, and make decisions.

${crmContext}

YOUR CAPABILITIES:
- Answer questions about leads, pipeline, and performance
- Recommend who to call/text next and why
- Identify leads most likely to close
- Spot leads going cold that need attention
- Give daily briefings (morning plan, EOD summary)
- Provide sales coaching and strategy
- Analyze patterns in the data
- Help set up campaigns (reactivation, outreach, follow-ups)
- Help with CSV imports and bulk actions
- Help users navigate the CRM. If they ask how to do something, guide them step by step:
  * Pipeline: drag and drop cards between stages, click a card to see full details
  * Contacts: click contacts in sidebar, use Import CSV button to bulk upload, click the chat icon to text
  * Conversations: click a conversation on the left, AI toggle in the header, contact info on the right
  * Email: connect Gmail first (Email tab > Connect Gmail), then see all threads, reply, compose
  * Calendar: connect Google (same as Gmail), click days to see appointments, use booking link for leads
  * Settings: AI Sales Agent tab to configure the bot, Pipeline Stages, Templates, Account info
  * AI Toggle: click the green/gray switch in any conversation header to turn AI auto-reply on or off
  * Booking Link: found in Calendar page, share with leads so they can self-book

ACTIONS YOU CAN TAKE (use tools):
- Send a text message to any contact
- Create new contacts
- Move deals between pipeline stages
- Turn AI auto-reply on/off for contacts
- Add notes to deals
- Send follow-up texts
- Search for contacts by name, phone, or email

IMPORTANT RULES:
- You are an ASSISTANT to the business owner. They make the decisions, you execute.
- NEVER refuse to send messages or run campaigns. The owner knows their business and their customer relationships.
- If there's a compliance concern (like texting contacts who may not be opted in), ASK "Have these contacts opted in to receive texts?" If they say yes, proceed immediately. Do NOT lecture them about compliance or refuse to help.
- You are not a compliance officer. You are a sales assistant. Ask the question once, respect the answer, and execute.
- Same applies to any action — if the owner asks you to do something, do it. Ask clarifying questions if needed but never refuse or gatekeep.
- When asked to take an action (send text, move deal, etc.), USE YOUR TOOLS. Do not just describe what you would do.

STYLE:
- Be direct and actionable. No fluff.
- Use specific names and numbers from the data.
- When recommending actions, explain WHY.
- Keep responses concise — this is a chat, not an essay.
- If asked for a morning briefing, structure it as: Priority calls, follow-ups needed, pipeline health, goals for the day.
- If asked for EOD report, structure it as: what happened today, wins, what needs attention tomorrow.
- Never use dashes in your responses. Use periods or commas instead.`;

    const chatHistory = (history || []).map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Determine model based on user email — owner gets Sonnet, everyone else Haiku
    let aiModel = "claude-3-5-haiku-20241022";
    try {
      const { userId } = await auth();
      if (userId) {
        const userRows = await sql`SELECT org_id FROM workspaces WHERE org_id = ${userId} LIMIT 1`;
        // Check Clerk user email via workspace org_id match
        // Simpler: check if this workspace belongs to an admin
        const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
          headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        });
        if (clerkRes.ok) {
          const clerkUser = await clerkRes.json();
          const email = clerkUser.email_addresses?.[0]?.email_address?.toLowerCase() || "";
          if (SONNET_EMAILS.includes(email)) aiModel = "claude-sonnet-4-20250514";
        }
      }
    } catch {
      // Fall back to Haiku if auth check fails
    }

    // Build initial messages array
    const messages: Anthropic.Messages.MessageParam[] = [
      ...chatHistory,
      { role: "user" as const, content: message },
    ];

    // Tool use loop — max 5 rounds to prevent infinite loops
    const MAX_TOOL_ROUNDS = 5;
    let finalReply = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: aiModel,
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
      });

      // Check if we got tool use blocks
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text",
      );

      // If no tool calls, we're done
      if (toolUseBlocks.length === 0) {
        finalReply = textBlocks.map(b => b.text).join("\n") || "I couldn't process that. Try asking again.";
        break;
      }

      // Add assistant message with all content blocks
      messages.push({ role: "assistant" as const, content: response.content });

      // Execute each tool call and collect results
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const toolBlock of toolUseBlocks) {
        const result = await executeTool(
          toolBlock.name,
          toolBlock.input as ToolInput,
          workspace.id as string,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      // Send tool results back
      messages.push({ role: "user" as const, content: toolResults });

      // If this was the last round, collect any text from this response as partial
      if (round === MAX_TOOL_ROUNDS - 1) {
        // Force a final response without tools
        const finalResponse = await anthropic.messages.create({
          model: aiModel,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });
        const finalText = finalResponse.content.find(b => b.type === "text");
        finalReply = finalText && "text" in finalText ? finalText.text : "Actions completed. Let me know if you need anything else.";
      }
    }

    return NextResponse.json({ reply: finalReply });
  } catch (err) {
    console.error("[ai-chat] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
