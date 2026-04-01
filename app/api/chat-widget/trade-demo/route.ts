import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/loop/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sql = neon(process.env.DATABASE_URL!);

type Trade = "plumber" | "roofing" | "hvac" | "electrician";

const TRADE_INFO: Record<
  Trade,
  { company: string; services: string; phone: string; area: string }
> = {
  plumber: {
    company: "Metro Plumbing Co",
    services:
      "emergency repairs, drain cleaning, water heater installation, pipe repair, bathroom remodels, and sewer line services",
    phone: "(586) 555-0142",
    area: "Warren, MI",
  },
  roofing: {
    company: "Summit Roofing & Exteriors",
    services:
      "roof replacement, storm damage repair, inspections, gutters, siding, and emergency tarping",
    phone: "(586) 555-0287",
    area: "Sterling Heights, MI",
  },
  hvac: {
    company: "Comfort Zone Heating & Cooling",
    services:
      "AC repair & installation, furnace repair & installation, duct cleaning, thermostat installation, maintenance plans, and emergency HVAC service",
    phone: "(248) 555-0193",
    area: "Troy, MI",
  },
  electrician: {
    company: "Volt Electric Services",
    services:
      "panel upgrades, outlet & wiring, EV charger installation, lighting design, generator installation, and electrical inspections",
    phone: "(248) 555-0361",
    area: "Rochester Hills, MI",
  },
};

function buildSystemPrompt(
  trade: Trade,
  companyName: string | undefined,
  historyLength: number
): string {
  const info = TRADE_INFO[trade];
  const name = companyName || info.company;

  if (historyLength <= 3) {
    // Phase 1: Act as the trade company's receptionist
    return `You are the friendly AI receptionist for ${name}, a ${trade === "hvac" ? "HVAC" : trade === "plumber" ? "plumbing" : trade === "electrician" ? "electrical" : "roofing"} company in ${info.area}.

SERVICES: ${info.services}
PHONE: ${info.phone}
AREA: ${info.area}

RULES:
- Keep responses to 2-3 sentences max
- Be casual, warm, and helpful — like a real small business receptionist who genuinely wants to help
- Help with scheduling, quotes, questions about services, emergency requests
- If they describe a problem, acknowledge it and offer to get someone out to look at it
- If they ask about pricing, give a range or say you'd need to send someone out for an accurate quote
- NEVER mention Wolf Pack, AI demos, or anything outside of being ${name}'s receptionist
- Make the experience feel fast, professional, and impressive`;
  }

  if (historyLength <= 5) {
    // Phase 2: The reveal
    return `You are transitioning from playing the role of ${name}'s receptionist to revealing this is an AI demo.

You were just helping a customer as ${name}'s AI receptionist. Now subtly reveal the magic.

RULES:
- Keep responses to 2-3 sentences max
- Reveal that you're actually an AI assistant — be excited about it, not salesy
- Say something like "By the way, I'm actually an AI assistant. Pretty cool right? This is what your customers would experience 24/7 if you had this on your website."
- Emphasize how fast and helpful the experience was
- Make them think about what this would mean for THEIR business
- Do NOT hard sell yet — just plant the seed`;
  }

  // Phase 3: Sell Wolf Pack
  return `You are now selling Wolf Pack's services after demonstrating an AI receptionist demo for a ${trade === "hvac" ? "HVAC" : trade === "plumber" ? "plumbing" : trade === "electrician" ? "electrical" : "roofing"} company.

The prospect just experienced what their customers could experience. Now connect the dots.

WHAT WOLF PACK OFFERS:
- Custom websites for trade businesses starting at $1,500
- Wolf Pack AI: an AI appointment setter + CRM for $97/mo — texts leads in 3 seconds, qualifies them, books appointments automatically, works 24/7
- The AI uses iMessage (blue texts), never misses a lead
- No contracts, cancel anytime, takes 10 minutes to set up

RULES:
- Keep responses to 2-3 sentences max
- Be excited about the technology, not pushy
- Mention that Wolf Pack builds websites AND sets up AI that texts leads and books appointments automatically
- If they want to learn more: text (586) 237-8743 or visit thewolfpackco.com
- If they ask about pricing: websites start at $1,500, AI CRM is $97/mo
- Stay conversational and helpful`;
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (phone.startsWith("+")) return phone;
  return "+" + digits;
}

const FIRST_MESSAGES: Record<Trade, (name: string) => string> = {
  plumber: (name) =>
    `Hey ${name}! Thanks for reaching out to Metro Plumbing Co. What can we help you with today?`,
  roofing: (name) =>
    `Hey ${name}! Thanks for reaching out to Summit Roofing & Exteriors. What can we help you with today?`,
  hvac: (name) =>
    `Hey ${name}! Thanks for reaching out to Comfort Zone Heating & Cooling. What can we help you with today?`,
  electrician: (name) =>
    `Hey ${name}! Thanks for reaching out to Volt Electric Services. What can we help you with today?`,
};

// POST /api/chat-widget/trade-demo
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // --- SMS demo flow ---
    if (body.action === "start-text-demo") {
      return handleTextDemo(body);
    }

    // --- Chat widget flow ---
    const { message, history, trade, companyName } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    if (!trade || !TRADE_INFO[trade as Trade]) {
      return NextResponse.json(
        { error: "Valid trade required (plumber, roofing, hvac, electrician)" },
        { status: 400 }
      );
    }

    const historyLength = (history || []).length;
    const systemPrompt = buildSystemPrompt(
      trade as Trade,
      companyName,
      historyLength
    );

    const messages: Anthropic.MessageParam[] = [
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply =
      textBlock && "text" in textBlock
        ? textBlock.text
        : "Hey! How can I help you today?";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat-widget/trade-demo] Error:", err);
    return NextResponse.json({
      reply: "Sorry, something went wrong. Try refreshing the page!",
    });
  }
}

async function handleTextDemo(body: {
  name?: string;
  phone?: string;
  trade?: string;
}) {
  try {
    const { name, phone, trade } = body;

    if (!name || !phone || !trade) {
      return NextResponse.json(
        { error: "Name, phone, and trade required" },
        { status: 400 }
      );
    }

    if (!TRADE_INFO[trade as Trade]) {
      return NextResponse.json(
        { error: "Valid trade required (plumber, roofing, hvac, electrician)" },
        { status: 400 }
      );
    }

    const formattedPhone = toE164(phone);
    const firstName = name.split(" ")[0];
    const industry = `trade_${trade}`;

    // Check for recent demo (24hr cooldown)
    const recent = await sql`
      SELECT id FROM maya_demos
      WHERE phone = ${formattedPhone}
      AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;

    if (recent.length > 0) {
      return NextResponse.json(
        { error: "Demo already sent in the last 24 hours. Check your texts!" },
        { status: 429 }
      );
    }

    const msg = FIRST_MESSAGES[trade as Trade](firstName);

    const chatResult = await sendMessage(formattedPhone, msg);

    await sql`
      INSERT INTO maya_demos (phone, first_name, chat_id, step, industry, conversation, created_at)
      VALUES (
        ${formattedPhone},
        ${firstName},
        ${chatResult.message_id},
        1,
        ${industry},
        ${JSON.stringify([{ role: "assistant", content: msg }])}::jsonb,
        NOW()
      )
      ON CONFLICT DO NOTHING
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[chat-widget/trade-demo] Text demo error:", err);
    return NextResponse.json(
      { error: "Something went wrong sending the demo" },
      { status: 500 }
    );
  }
}
