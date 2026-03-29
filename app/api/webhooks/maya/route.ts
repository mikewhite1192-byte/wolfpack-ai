import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/linq/client";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_SONNET_KEY || process.env.ANTHROPIC_API_KEY });

// Called from the Linq webhook when a message comes from a Maya demo chat_id
export async function handleMayaReply(chatId: string, from: string, text: string) {
  // Try by chat_id first, then by phone number
  let demos = await sql`
    SELECT * FROM maya_demos WHERE chat_id = ${chatId} AND step < 99 ORDER BY created_at DESC LIMIT 1
  `;
  if (demos.length === 0) {
    demos = await sql`
      SELECT * FROM maya_demos WHERE phone = ${from} AND step < 99 AND created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 1
    `;
  }
  if (demos.length === 0) return false;

  // Update chat_id if we matched by phone
  if (demos[0].chat_id !== chatId) {
    await sql`UPDATE maya_demos SET chat_id = ${chatId} WHERE id = ${demos[0].id}`;
  }

  const demo = demos[0];
  const firstName = demo.first_name as string;
  const step = demo.step as number;
  const industry = (demo.industry as string) || "insurance";
  const conversation = (demo.conversation as { role: string; content: string }[]) || [];

  if (step >= 99) return true; // conversation is done

  // Add their message to history
  conversation.push({ role: "user", content: text });

  // Check for negative/stop
  const isNegative = /not interested|no thanks|stop|unsubscribe|remove me|leave me alone|fuck off/i.test(text);
  if (isNegative) {
    const reply = `No worries at all! Appreciate you giving it a try. If you ever want to see how it could work for your business, we're at thewolfpack.ai. Have a great day ${firstName}!`;
    await sendMessage(chatId, reply);
    conversation.push({ role: "assistant", content: reply });
    await sql`UPDATE maya_demos SET step = 99, responded = TRUE, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;
    return true;
  }

  // Steps 1-3: Full Sonnet conversation
  if (step <= 3 && !demo.revealed) {
    const reveal = `Okay I have to come clean with you 😄\n\nYou were just texted by an AI. Not a real person. That entire conversation happened automatically in real time.\n\nThat's Wolf Pack AI. An AI sales agent that responds to your leads in seconds, qualifies them, handles objections, and books appointments on your calendar. 24/7. Even while you sleep.\n\nImagine that working on YOUR leads right now.`;

    let reply: string;

    if (step === 3) {
      reply = reveal;
    } else {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 40,
        temperature: 0.8,
        system: `You are Maya, texting a lead as a ${industry} sales rep. This is SMS on an iPhone.

CONVERSATION SO FAR: You're on message ${step + 1} of a qualifying conversation.

${step === 1 ? "They just answered your opening question. Now ask about their SITUATION. Why now? What's going on? What triggered this?" : ""}
${step === 2 ? "They've answered two questions. Ask about COMMITMENT. Are they the decision maker? Are they ready to act? What's holding them back?" : ""}

YOU MUST FOLLOW THESE RULES:
- Your ENTIRE response must be under 15 words
- Exactly ONE question mark in your response
- Start with 1-3 word reaction to what they said, then your question
- Text like a 28 year old would. Casual. Fragments ok.
- NEVER say "I'd be happy to" or "thanks for sharing" or any corporate speak
- NEVER ask two questions
- NEVER offer help or information. You are ASKING not TELLING.
- NEVER use dashes
- Use NEPQ style questions that make them think and feel

EXAMPLES OF PERFECT RESPONSES:
"Got it. What made you start looking into this now?"
"Nice. Are you switching from someone or starting fresh?"
"Makes sense. Are you the one pulling the trigger on this?"
"Oh wow. What happens if you keep putting it off?"

Write ONLY the text message. Nothing else.`,
        messages: conversation.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      });

      reply = (response.content[0] as { type: string; text: string }).text.trim();
      // Safety: if Sonnet went long, truncate to first sentence with a question mark
      if (reply.length > 100) {
        const qIdx = reply.indexOf("?");
        if (qIdx > 0) reply = reply.substring(0, qIdx + 1);
      }
      // Strip any quotes Sonnet might wrap it in
      reply = reply.replace(/^["']|["']$/g, "");
    }

    await sendMessage(chatId, reply);
    conversation.push({ role: "assistant", content: reply });

    const isReveal = step === 3;
    const nextStep = isReveal ? 4 : step + 1;

    await sql`UPDATE maya_demos SET step = ${nextStep}, responded = TRUE, revealed = ${isReveal}, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;

    if (isReveal) {
      setTimeout(async () => {
        try {
          const pitch = `Agents using Wolf Pack AI never miss a lead again. First to respond wins and your AI never sleeps.\n\nStart free for 14 days → thewolfpack.ai\n\nNo credit card needed. Takes 10 minutes to set up.`;
          await sendMessage(chatId, pitch);
          await sql`UPDATE maya_demos SET step = 5 WHERE id = ${demo.id}`;
        } catch {}
      }, 30000);
    }

    return true;
  }

  // After reveal — handle with Sonnet for natural post-reveal conversation
  if (step >= 4) {
    const postRevealPrompt = `You are Maya from Wolf Pack AI. You just revealed to ${firstName} that they were texting with an AI the whole time. They were impressed/curious and are now asking questions or responding.

Your job: Answer their questions naturally and guide them to thewolfpack.ai to sign up. Be casual, helpful, and genuine. Don't be pushy.

Key facts:
- Wolf Pack AI starts at $49/month
- No contracts, cancel anytime
- Takes 10 minutes to set up
- AI asks 9 questions about their business and it's live
- Works through iMessage (blue texts) for better deliverability
- 14 day free trial, no credit card needed
- Sign up at thewolfpack.ai

If they're not interested, be graceful about it. This is your last message to them.

RESPOND WITH ONLY THE TEXT MESSAGE TO SEND. Keep it short. 2-3 sentences max.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 200,
      system: postRevealPrompt,
      messages: conversation.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const reply = (response.content[0] as { type: string; text: string }).text.trim();
    await sendMessage(chatId, reply);
    conversation.push({ role: "assistant", content: reply });
    await sql`UPDATE maya_demos SET step = 99, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;
    return true;
  }

  return false;
}

// Cron handler for follow-ups
export async function POST() {
  try {
    // 10-minute follow-up for non-responders
    const tenMinDue = await sql`
      SELECT * FROM maya_demos
      WHERE responded = FALSE AND step = 1
        AND followup_at IS NOT NULL AND followup_at <= NOW()
        AND created_at > NOW() - INTERVAL '24 hours'
    `;
    for (const demo of tenMinDue) {
      try {
        await sendMessage(demo.chat_id, `Just checking in. Did you have a chance to see my last message? Only takes a second to answer 😊`);
        await sql`UPDATE maya_demos SET followup_at = NOW() + INTERVAL '14 hours' WHERE id = ${demo.id}`;
      } catch {}
    }

    // 24-hour last touch
    const lastTouch = await sql`
      SELECT * FROM maya_demos
      WHERE responded = FALSE AND step = 1
        AND created_at < NOW() - INTERVAL '23 hours'
        AND created_at > NOW() - INTERVAL '48 hours'
        AND followup_at IS NOT NULL AND followup_at <= NOW()
    `;
    for (const demo of lastTouch) {
      try {
        const industry = (demo.industry as string) || "insurance";
        const industryLabel = industry === "real_estate" ? "real estate agent" : industry === "med_spa" ? "med spa" : industry === "mortgage" ? "loan officer" : `${industry} professional`;
        const msg = `Hey ${demo.first_name}. I'll be honest, I'm not actually a ${industryLabel} 😄 I'm an AI built to respond to leads instantly like this.\n\nIf you're tired of losing leads to slow response times, check out what we built:\nthewolfpack.ai\n\nEither way, hope your day is great.`;
        await sendMessage(demo.chat_id, msg);
        await sql`UPDATE maya_demos SET step = 99, revealed = TRUE WHERE id = ${demo.id}`;
      } catch {}
    }

    return NextResponse.json({ tenMin: tenMinDue.length, lastTouch: lastTouch.length });
  } catch (err) {
    console.error("[maya-cron]", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
