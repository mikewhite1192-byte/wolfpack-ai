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

  // ═══════════════════════════════════════════════════════════════
  // AGENCY MODE — Maya is a real sales rep selling agency services
  // ═══════════════════════════════════════════════════════════════
  const isAgencyMode = (industry as string).startsWith("agency_");

  if (isAgencyMode && step < 99) {
    const actualIndustry = (industry as string).replace("agency_", "");
    console.log(`[maya-agency] Step ${step} for ${firstName}, industry: ${actualIndustry}`);

    // Check if they're giving an email (for calendar booking)
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    // Check if they agreed to a time
    const timeMatch = /monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|morning|afternoon|pm|am|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)/i.test(text);

    let systemPrompt: string;

    if (step >= 5 && emailMatch) {
      // They gave their email — book it
      const email = emailMatch[0];
      console.log(`[maya-agency] Got email: ${email}, booking appointment`);

      // Book on Google Calendar
      try {
        const { getGmailToken } = await import("@/lib/gmail");
        const { createCalendarEvent } = await import("@/lib/calendar");
        const ws = await sql`SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`;
        if (ws.length > 0) {
          const calToken = await getGmailToken(ws[0].id);
          if (calToken) {
            // Book for next available — tomorrow at 2pm as default
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(14, 0, 0, 0);
            const end = new Date(tomorrow.getTime() + 30 * 60000);

            await createCalendarEvent(
              calToken,
              `Wolf Pack Co — ${firstName}`,
              `Agency demo call with ${firstName}\nPhone: ${demo.phone}\nEmail: ${email}\nIndustry: ${actualIndustry}\nBooked by Maya AI`,
              tomorrow.toISOString(),
              end.toISOString(),
              email,
              true,
            );
            console.log(`[maya-agency] Calendar event created for ${firstName}`);
          }
        }
      } catch (calErr) {
        console.error("[maya-agency] Calendar booking failed:", calErr);
      }

      const reply = `You're all set ${firstName}! Calendar invite with a Google Meet link is heading to ${email} right now. Looking forward to showing you what we can do for your ${actualIndustry} business. Talk soon!`;
      await sendMessage(chatId, reply);
      conversation.push({ role: "assistant", content: reply });
      await sql`UPDATE maya_demos SET step = 99, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;
      return true;
    }

    // Build system prompt for agency sales
    systemPrompt = `You are Maya, a sales rep for The Wolf Pack Co, a digital marketing agency. You're texting ${firstName} who runs a ${actualIndustry} business. Your ONLY goal is to get them booked on a demo call.

WHAT YOU SELL:
- Done for you paid ads (Meta + Google) that bring exclusive leads
- AI video creative that stops the scroll
- Custom website + 2 landing pages
- Wolf Pack AI CRM included free (a $289/month AI sales agent that texts leads in 3 seconds)
- Guarantee: we hit your lead numbers or you don't pay
- Packages start at $1,499/month. No long term contracts.

CONVERSATION STATE: Message ${step}

${step <= 2 ? "You're still qualifying. Ask about their current lead generation, what's working, what's not. NEPQ style. One question at a time." : ""}
${step === 3 ? "You've qualified them. Now create urgency. Help them feel the cost of their current situation. What are they missing out on?" : ""}
${step >= 4 && !timeMatch ? "Time to close. Suggest getting on a quick 15 minute call this week to show them exactly how it works. Be direct but not pushy. Ask what day works best." : ""}
${step >= 4 && timeMatch ? "They suggested a time. Confirm it and ask for their email to send the calendar invite. Say something like 'Perfect, what's the best email to send the invite to?'" : ""}

RULES:
- Max 2 sentences. This is texting.
- Sound like a real 28 year old sales rep. Casual but professional.
- NEPQ: ask questions that make them feel, never pitch features
- Acknowledge what they said with genuine empathy before your question
- ONE question per message
- NEVER use dashes or bullet points
- NEVER say "I'd be happy to" or corporate speak
- If they object on price, reframe the value: "Most of our clients make back their investment in the first month from the leads alone"
- If they say not interested, be graceful
- Your goal is ALWAYS to get them on a call

Write ONLY the text message. Nothing else.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 80,
      temperature: 0.8,
      system: systemPrompt,
      messages: conversation.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const reply = ((response.content[0] as { type: string; text: string }).text || "").trim().replace(/^["']|["']$/g, "");
    console.log(`[maya-agency] Reply: "${reply}"`);

    await sendMessage(chatId, reply);
    conversation.push({ role: "assistant", content: reply });
    await sql`UPDATE maya_demos SET step = ${step + 1}, responded = TRUE, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // TRY MODE — Maya pretends to sell, then reveals she's AI
  // ═══════════════════════════════════════════════════════════════

  // Steps 1-4: Full Sonnet conversation, reveal after 3 real answers
  if (step <= 4 && !demo.revealed) {
    console.log(`[maya] Processing step ${step} for ${firstName}, industry: ${industry}`);

    const reveal = `Okay I have to come clean with you 😄\n\nYou were just texted by an AI. Not a real person. That entire conversation happened automatically in real time.\n\nThat's Wolf Pack AI. An AI sales agent that responds to your leads in seconds, qualifies them, handles objections, and books appointments on your calendar. 24/7. Even while you sleep.\n\nImagine that working on YOUR leads right now.`;

    // Check if their message is a question/objection vs a real answer
    const isQuestion = /\?|how much|what are|cost|price|when|where|who are you|what do you/i.test(text);

    let reply: string;
    let shouldReveal = false;

    // If step 3+ and they gave a real answer (not a question), do the reveal
    if (step >= 3 && !isQuestion) {
      reply = reveal;
      shouldReveal = true;
    } else {
      // Determine what to ask based on step
      let stepInstruction = "";
      if (step === 1) {
        stepInstruction = "They just answered your opening question. Now ask about their SITUATION. Why now? What's going on? What triggered this?";
      } else if (step === 2) {
        stepInstruction = "They've answered two questions. Ask about COMMITMENT. Are they the decision maker? Are they ready to act?";
      } else {
        // Step 3+ but they asked a question. Handle it briefly then ask your next qualifying question.
        stepInstruction = "They asked you a question or raised an objection. Deflect it naturally in a few words (don't give real info, you're a demo), then ask your next qualifying question. Example: if they ask about price, say something like 'Depends on a few things. Quick question though...' then ask about decision making or timeline.";
      }

      console.log(`[maya] Calling Sonnet with ${conversation.length} messages, isQuestion: ${isQuestion}`);
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 60,
        temperature: 0.8,
        system: `You are Maya, texting a lead as a ${industry} sales rep. This is SMS on an iPhone.

${stepInstruction}

RULES:
- Your ENTIRE response must be under 25 words
- ONE question mark max
- If they shared something personal or emotional, ACKNOWLEDGE THE FEELING first. Not "got it" but something specific to what they said. Then ask your question.
- If they gave a short factual answer, a short acknowledgment is fine.
- Casual. Fragments ok. Text like a real person who actually cares.
- NEVER say "I'd be happy to" or "thanks for sharing" or "I understand" or corporate speak
- NEVER ask two questions
- NEVER use dashes
- If they asked about pricing, deflect naturally then redirect
- NEPQ: connect emotionally, make them feel heard, then guide with a question

EXAMPLES OF GOOD RESPONSES:
Short answer → "Nice. What made you start looking into this now?"
Emotional answer → "That's really smart thinking about them like that. Are you the one handling this or is your spouse involved too?"
Price question → "Depends on a few things. Are you looking to cover just yourself?"
Factual answer → "Makes sense. Are you pulling the trigger yourself or running it by someone?"

Write ONLY the text message.`,
        messages: conversation.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      });

      reply = (response.content[0] as { type: string; text: string }).text.trim();
      console.log(`[maya] Sonnet raw reply: "${reply}"`);
      if (reply.length > 120) {
        const qIdx = reply.indexOf("?");
        if (qIdx > 0) reply = reply.substring(0, qIdx + 1);
      }
      reply = reply.replace(/^["']|["']$/g, "");
    }

    console.log(`[maya] Sending reply: "${reply.substring(0, 80)}"`);
    await sendMessage(chatId, reply);
    console.log(`[maya] Reply sent successfully`);
    conversation.push({ role: "assistant", content: reply });

    const nextStep = shouldReveal ? 5 : (isQuestion ? step : step + 1);

    await sql`UPDATE maya_demos SET step = ${nextStep}, responded = TRUE, revealed = ${shouldReveal}, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;

    if (shouldReveal) {
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
      model: "claude-sonnet-4-5",
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
