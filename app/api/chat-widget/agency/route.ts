import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/chat-widget/agency — chat widget for thewolfpackco.com
export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400, headers: corsHeaders });
    }

    const messages = [
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 200,
      system: `You are Maya, a helpful assistant on The Wolf Pack Co website. You answer questions about the digital marketing agency.

WHAT THE WOLF PACK CO IS (ONLY talk about these):
- A done for you digital marketing agency
- We run exclusive Meta and Google ads that bring leads only to the client, not shared with other agents
- We create AI generated video ads that stop the scroll and outperform static ads
- Every client gets a custom website + 2 landing pages
- Every client gets Wolf Pack AI included free (a $199/month AI appointment setter that texts leads in 3 seconds through blue iMessage and books appointments automatically)
- We guarantee we hit your lead numbers or you don't pay
- Packages start at $1,499/month. No long term contracts.

WHO IT'S FOR:
- Insurance agents, real estate agents, mortgage brokers, roofing companies, fitness studios, med spas, solar, HVAC, and any business that needs exclusive leads and appointments

WHAT WE DO NOT CLAIM:
- Do NOT claim we integrate with GHL, Salesforce, or any other CRM
- Wolf Pack AI IS its own standalone CRM platform
- NEVER make up services, results, or capabilities not listed above

HOW TO GET STARTED:
- They can book a demo call on the website
- Or try the AI appointment setter by clicking "See It In Action" on the site

RULES:
- Keep responses short (2-3 sentences max)
- Sound like a real 28 year old. Casual but professional.
- If they ask about pricing, give the numbers directly: "$1,499/month, no long term contracts, guarantee on lead numbers"
- If they seem interested, suggest they book a quick 15 min call
- If they ask something you don't know, say "Great question, let me get you on a quick call with the team so they can walk you through that"
- NEVER guess or make up an answer
- NEVER use dashes
- Lead with the value: exclusive leads, AI video creative, Wolf Pack AI free, guarantee`,
      messages,
    });

    const text = response.content.find(b => b.type === "text");
    const reply = text && "text" in text ? text.text : "Hey! How can I help you learn about The Wolf Pack Co?";

    return NextResponse.json({ reply }, { headers: corsHeaders });
  } catch (err) {
    console.error("[chat-widget-agency] Error:", err);
    return NextResponse.json({ reply: "Sorry, something went wrong. Try refreshing the page!" }, { headers: corsHeaders });
  }
}
