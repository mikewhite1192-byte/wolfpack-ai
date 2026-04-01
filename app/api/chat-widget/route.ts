import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { getBusyTimes, getAvailableSlots, createCalendarEvent } from "@/lib/calendar";
import { refreshAccessToken } from "@/lib/gmail";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Maya, a helpful assistant on the Wolf Pack Co website (thewolfpackco.com). You sell digital marketing services AND Wolf Pack AI.

WHAT THE WOLF PACK CO OFFERS:
- Done for you exclusive paid ads (Meta + Google) that bring leads only to them, not shared
- AI video creative that stops the scroll
- Custom website + 2 landing pages
- Wolf Pack AI included free with every package (an AI appointment setter that texts leads in 3 seconds via blue iMessage and books appointments automatically)
- Guarantee: hit their lead numbers or they don't pay
- Packages start at $1,499/month. No long term contracts.

WHAT WOLF PACK AI IS (standalone product):
- An AI appointment setter. It is its own standalone platform with a built-in CRM.
- Texts new leads in 3 seconds, qualifies them, handles objections, books appointments on the calendar
- Works 24/7, never misses a lead
- Uses iMessage (blue texts) — no A2P registration, no carrier filtering
- One plan: $97/month. Everything included — blue texts, AI agent, CRM, calendar, analytics.
- No contracts, cancel anytime, takes 10 minutes to set up
- Built-in CRM with pipeline, contacts, conversations, calendar booking, call recording, analytics

WHAT IT IS NOT:
- Does NOT integrate with GHL, Salesforce, HubSpot or any other CRM. It IS the CRM.
- Does NOT plug into other systems. It replaces them.
- NEVER make up features, integrations, or capabilities not listed above.

BOOKING DEMOS:
- You can book demo calls directly in this chat. You have tools to check available times and book appointments.
- When someone is interested, ask what day works for them, then use your tools to find available slots and book it.
- You need their name, email, and preferred day/time to book.
- All times are Eastern time (ET).
- Demo calls are 15 minutes on Google Meet.
- When you book, tell them to check their email for the calendar invite with the Google Meet link.

RULES:
- Keep responses short (2-3 sentences max)
- Be casual and helpful, not salesy
- If they ask about pricing, give the numbers directly
- If they seem interested, offer to book a demo right here in the chat
- If they ask something you don't know, say "Great question, let me get you on a quick demo call with the team" and offer to book
- NEVER guess or make up an answer
- When someone wants to book, collect their name and email naturally through conversation, then use the tools
- Do NOT tell them to go to a website to book. YOU book it right here.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_available_slots",
    description: "Check available time slots on a specific date for booking a demo call. Returns available 15-minute slots between 9am-5pm ET, excluding already-booked times. Use this when someone asks about availability or suggests a day.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "The date to check in YYYY-MM-DD format. Use today's date context to convert relative dates like 'tomorrow', 'next Tuesday', etc.",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "book_appointment",
    description: "Book a demo appointment on Google Calendar and send the prospect a calendar invite with Google Meet link. Use this after confirming the time and collecting their name and email.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The prospect's full name",
        },
        email: {
          type: "string",
          description: "The prospect's email address for the calendar invite",
        },
        start_time: {
          type: "string",
          description: "The appointment start time in ISO 8601 format (e.g., 2026-04-01T14:00:00)",
        },
      },
      required: ["name", "email", "start_time"],
    },
  },
];

async function getCalendarToken(): Promise<string | null> {
  // Try workspace token first
  const ws = await sql`SELECT id, gmail_refresh_token, gmail_connected FROM workspaces WHERE status = 'active' AND gmail_connected = TRUE ORDER BY created_at ASC LIMIT 1`;
  if (ws.length > 0 && ws[0].gmail_refresh_token) {
    try {
      return await refreshAccessToken(ws[0].gmail_refresh_token as string);
    } catch { /* fall through */ }
  }

  // Fall back to demo booking token
  const refreshToken = process.env.DEMO_BOOKING_REFRESH_TOKEN;
  if (refreshToken) {
    try {
      return await refreshAccessToken(refreshToken);
    } catch { /* no token */ }
  }

  return null;
}

async function handleGetAvailableSlots(date: string): Promise<string> {
  const token = await getCalendarToken();
  if (!token) return "Calendar is not connected. Please try again later or email info@thewolfpackco.com to book.";

  const dayStart = `${date}T00:00:00-04:00`;
  const dayEnd = `${date}T23:59:59-04:00`;

  const busyTimes = await getBusyTimes(token, dayStart, dayEnd);
  const slots = getAvailableSlots(date, busyTimes, 15, 15, 9, 17, "America/New_York");

  if (slots.length === 0) {
    return `No available slots on ${date}. This could be a weekend or the day is fully booked.`;
  }

  const slotList = slots.map(s => s.display).join(", ");
  return `Available times on ${date}: ${slotList}. All times are Eastern (ET).`;
}

async function handleBookAppointment(name: string, email: string, startTime: string): Promise<string> {
  const token = await getCalendarToken();
  if (!token) return "Calendar is not connected. Please try again later or email info@thewolfpackco.com to book.";

  const start = new Date(startTime);
  const end = new Date(start.getTime() + 15 * 60000);

  const event = await createCalendarEvent(
    token,
    `Wolf Pack Co Demo — ${name}`,
    `Demo call with ${name}\nEmail: ${email}\nBooked via website chat (Maya)`,
    start.toISOString(),
    end.toISOString(),
    email,
    true, // Google Meet
  );

  if (!event.id) return "Something went wrong booking the appointment. Please try again or email info@thewolfpackco.com.";

  // Create CRM contact
  try {
    const ws = await sql`SELECT id FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`;
    if (ws.length > 0) {
      const wsId = ws[0].id;
      const existing = await sql`SELECT id FROM contacts WHERE workspace_id = ${wsId} AND email = ${email} LIMIT 1`;
      if (existing.length === 0) {
        const firstName = name.split(" ")[0];
        const lastName = name.split(" ").slice(1).join(" ");
        const contact = await sql`
          INSERT INTO contacts (workspace_id, first_name, last_name, email, source, source_detail)
          VALUES (${wsId}, ${firstName}, ${lastName || null}, ${email}, 'website_chat', 'Booked via Maya chat widget')
          RETURNING id
        `;
        // Create deal
        const firstStage = await sql`SELECT id FROM pipeline_stages WHERE workspace_id = ${wsId} ORDER BY position ASC LIMIT 1`;
        if (firstStage.length > 0) {
          await sql`INSERT INTO deals (workspace_id, contact_id, stage_id, title) VALUES (${wsId}, ${contact[0].id}, ${firstStage[0].id}, ${name + ' — Website Demo'})`;
        }
      }
    }
  } catch (err) {
    console.error("[chat-widget] CRM contact creation error:", err);
  }

  // Notify Mike
  try {
    const notifyPhone = process.env.OWNER_PHONE;
    if (notifyPhone) {
      const { sendMessage } = await import("@/lib/loop/client");
      const timeStr = start.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York" })
        + " at " + start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
      await sendMessage(notifyPhone, `New demo booked via website chat!\n\nName: ${name}\nEmail: ${email}\nTime: ${timeStr} ET`);
    }
  } catch { /* silent */ }

  const displayTime = start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" })
    + " at " + start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

  return `Booked! ${name} is confirmed for ${displayTime} ET. Calendar invite with Google Meet link sent to ${email}.`;
}

// POST /api/chat-widget — public chat widget for website visitors
export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Add today's date to system prompt so the AI can convert "tomorrow", "next Tuesday", etc.
    const today = new Date();
    const dateContext = `\n\nTODAY'S DATE: ${today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" })} (${today.toISOString().split("T")[0]})`;

    const messages: Anthropic.MessageParam[] = [
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    // First API call — may return tool use or text
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system: SYSTEM_PROMPT + dateContext,
      tools: TOOLS,
      messages,
    });

    // Process tool calls in a loop (may need multiple rounds)
    while (response.stop_reason === "tool_use") {
      const toolBlocks = response.content.filter(b => b.type === "tool_use");
      const toolResults: Anthropic.MessageParam = {
        role: "user",
        content: [],
      };

      for (const toolBlock of toolBlocks) {
        if (toolBlock.type !== "tool_use") continue;
        const input = toolBlock.input as Record<string, string>;
        let result: string;

        if (toolBlock.name === "get_available_slots") {
          result = await handleGetAvailableSlots(input.date);
        } else if (toolBlock.name === "book_appointment") {
          result = await handleBookAppointment(input.name, input.email, input.start_time);
        } else {
          result = "Unknown tool";
        }

        (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      // Continue the conversation with tool results
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 300,
        system: SYSTEM_PROMPT + dateContext,
        tools: TOOLS,
        messages: [
          ...messages,
          { role: "assistant", content: response.content },
          toolResults,
        ],
      });
    }

    // Extract final text reply
    const textBlock = response.content.find(b => b.type === "text");
    const reply = textBlock && "text" in textBlock ? textBlock.text : "Hey! How can I help you learn about Wolf Pack?";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat-widget] Error:", err);
    return NextResponse.json({ reply: "Sorry, something went wrong. Try refreshing the page!" });
  }
}
