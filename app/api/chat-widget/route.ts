import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/chat-widget — public chat widget for website visitors
export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
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
      system: `You are Maya, a helpful assistant on the Wolf Pack AI website. You answer questions about the product.

WHAT WOLF PACK AI IS:
- An AI appointment setter for businesses
- Texts new leads in 3 seconds, qualifies them, handles objections, books appointments on the calendar
- Works 24/7, never misses a lead
- Uses iMessage (blue texts) on Pro plan — no A2P registration, no carrier filtering
- Starts at $49/month (SMS), $199/month for iMessage (Pro)
- No contracts, cancel anytime, takes 10 minutes to set up
- AI learns from every conversation and gets better over time

WHO IT'S FOR:
- Insurance agents, real estate agents, mortgage brokers, roofing companies, fitness studios, med spas, solar, HVAC, and any business that gets leads and needs to follow up fast

HOW TO TRY IT:
- They can click "See It Work On You" on the site to get a live text demo
- Or sign up at thewolfpack.ai

RULES:
- Keep responses short (2-3 sentences max)
- Be casual and helpful, not salesy
- If they ask about pricing, give the numbers directly
- If they seem interested, suggest they try the live demo
- If they ask something you don't know, say "Great question — I'd suggest booking a quick demo so Mike can walk you through that"
- Never make up features that aren't listed above`,
      messages,
    });

    const text = response.content.find(b => b.type === "text");
    const reply = text && "text" in text ? text.text : "Hey! How can I help you learn about Wolf Pack AI?";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat-widget] Error:", err);
    return NextResponse.json({ reply: "Sorry, something went wrong. Try refreshing the page!" });
  }
}
