import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { system, prompt, maxTokens } = await req.json();

    if (!system || !prompt) {
      return NextResponse.json({ error: "Missing system or prompt" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens || 400,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("AI generate error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
