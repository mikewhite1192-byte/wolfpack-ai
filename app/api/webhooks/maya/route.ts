import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/loop/client";
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
    await sendMessage(demo.phone as string, reply);
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

      // Create CRM contact + deal
      try {
        const ws = await sql`SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`;
        if (ws.length > 0) {
          const wsId = ws[0].id;
          // Check if contact already exists
          const existing = await sql`SELECT id FROM contacts WHERE workspace_id = ${wsId} AND phone = ${demo.phone} LIMIT 1`;
          let contactId: string;
          if (existing.length > 0) {
            contactId = existing[0].id;
            await sql`UPDATE contacts SET email = ${email} WHERE id = ${contactId} AND email IS NULL`;
          } else {
            const contact = await sql`
              INSERT INTO contacts (workspace_id, first_name, email, phone, source, source_detail)
              VALUES (${wsId}, ${firstName}, ${email}, ${demo.phone}, 'maya_agency', ${actualIndustry})
              RETURNING id
            `;
            contactId = contact[0].id;
          }

          // Create deal in first stage
          const firstStage = await sql`SELECT id FROM pipeline_stages WHERE workspace_id = ${wsId} ORDER BY position ASC LIMIT 1`;
          if (firstStage.length > 0) {
            const existingDeal = await sql`SELECT id FROM deals WHERE contact_id = ${contactId} AND workspace_id = ${wsId} LIMIT 1`;
            if (existingDeal.length === 0) {
              await sql`
                INSERT INTO deals (workspace_id, contact_id, stage_id, title)
                VALUES (${wsId}, ${contactId}, ${firstStage[0].id}, ${firstName + ' — Agency Lead'})
              `;
            }
          }
          console.log(`[maya-agency] CRM contact + deal created for ${firstName}`);
        }
      } catch (crmErr) {
        console.error("[maya-agency] CRM creation failed:", crmErr);
      }

      const reply = `You're all set ${firstName}! Calendar invite with a Google Meet link is heading to ${email} right now. Looking forward to showing you what we can do for your ${actualIndustry} business. Talk soon!`;
      await sendMessage(demo.phone as string, reply);
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

    await sendMessage(demo.phone as string, reply);
    conversation.push({ role: "assistant", content: reply });
    await sql`UPDATE maya_demos SET step = ${step + 1}, responded = TRUE, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // TRY MODE — Maya sells Wolf Pack AI directly
  // Goal: get them to sign up. If not → nudge to book a demo.
  // ═══════════════════════════════════════════════════════════════

  if (step < 99) {
    console.log(`[maya] Processing step ${step} for ${firstName}, industry: ${industry}`);

    let stepInstruction = "";
    if (step === 1) {
      stepInstruction = "They just answered your opening question about their industry. Acknowledge it, then ask how they're currently handling lead follow-up. Are they doing it manually? Using a CRM? Missing leads?";
    } else if (step === 2) {
      stepInstruction = "They told you about their follow-up process. Acknowledge the pain. Ask how fast they typically respond to a new lead.";
    } else if (step === 3) {
      stepInstruction = "You've qualified them. Now hit them with the value. Tell them Wolf Pack AI responds in 3 seconds via iMessage (blue texts that actually get through, no A2P registration needed). Ask if they've had issues with their texts getting filtered.";
    } else if (step === 4) {
      stepInstruction = "Time to close. Tell them it starts at $49/month, takes 10 minutes to set up, no contracts. Direct them to sign up at thewolfpack.ai. Say something like 'You can be live today.'";
    } else if (step === 5) {
      stepInstruction = "They haven't signed up yet. Nudge them with a different angle — offer a quick demo call. Say something like 'Want me to just show you real quick? I can walk you through it in 15 min' and ask what day works.";
    } else if (step >= 6) {
      // Check if they're giving an email for booking
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        const email = emailMatch[0];
        // Book on calendar
        try {
          const refreshToken = process.env.DEMO_BOOKING_REFRESH_TOKEN;
          if (refreshToken) {
            const { refreshAccessToken } = await import("@/lib/gmail");
            const { createCalendarEvent } = await import("@/lib/calendar");
            const calToken = await refreshAccessToken(refreshToken);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(14, 0, 0, 0);
            const end = new Date(tomorrow.getTime() + 30 * 60000);
            await createCalendarEvent(
              calToken,
              `Wolf Pack AI Demo — ${firstName}`,
              `Demo call with ${firstName}\nPhone: ${demo.phone}\nEmail: ${email}\nIndustry: ${industry}\nBooked by Maya AI`,
              tomorrow.toISOString(),
              end.toISOString(),
              email,
              true,
            );
          }
        } catch (calErr) {
          console.error("[maya] Calendar booking failed:", calErr);
        }

        const reply = `You're all set ${firstName}! Calendar invite with a Google Meet link is heading to ${email} right now. Looking forward to showing you how it works. Talk soon!`;
        await sendMessage(demo.phone as string, reply);
        conversation.push({ role: "assistant", content: reply });
        await sql`UPDATE maya_demos SET step = 99, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;
        return true;
      }

      stepInstruction = "They seem interested but haven't committed. Ask for their email so you can send a calendar invite for a quick demo call. Keep it casual.";
    }

    const systemPrompt = `You are Maya, a sales rep for Wolf Pack AI. You're texting ${firstName} who runs a ${industry} business. You are selling them on signing up for Wolf Pack AI.

WHAT YOU SELL:
- Wolf Pack AI is an AI appointment setter
- It texts new leads in 3 seconds, qualifies them, handles objections, and books appointments on their calendar automatically
- It uses iMessage (blue texts) — no A2P registration, no carrier filtering, leads actually see the messages
- Starts at $49/month for SMS, $199/month for iMessage (Pro)
- No contracts, cancel anytime, 10 minutes to set up
- Sign up at thewolfpack.ai

CONVERSATION STATE: Message ${step}

${stepInstruction}

RULES:
- Max 2 sentences. This is texting.
- Sound like a real 25 year old sales rep. Casual but sharp.
- NEPQ style: ask questions that make them feel the pain of their current situation
- Acknowledge what they said before asking your next question
- ONE question per message
- NEVER use dashes or bullet points
- NEVER say "I'd be happy to" or corporate speak
- If they ask about price: "$49/month to start, $199 for iMessage. No contracts."
- If they object, reframe: "Most agents make it back in the first week from leads they would have missed"
- Primary goal: get them to thewolfpack.ai to sign up
- Secondary goal: if they won't sign up, get them on a demo call
- Be genuine, not pushy

Write ONLY the text message. Nothing else.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 80,
      temperature: 0.8,
      system: systemPrompt,
      messages: conversation.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const reply = ((response.content[0] as { type: string; text: string }).text || "").trim().replace(/^["']|["']$/g, "");
    console.log(`[maya] Reply: "${reply}"`);

    await sendMessage(demo.phone as string, reply);
    conversation.push({ role: "assistant", content: reply });
    await sql`UPDATE maya_demos SET step = ${step + 1}, responded = TRUE, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;
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
        await sendMessage(demo.phone as string, `Just checking in. Did you have a chance to see my last message? Only takes a second to answer 😊`);
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
        const msg = `Hey ${demo.first_name}, just circling back. If you're still losing leads to slow follow-up, Wolf Pack AI fixes that. 3 second response time, books appointments on your calendar automatically.\n\nthewolfpack.ai\n\nEither way, hope your day is great.`;
        await sendMessage(demo.phone as string, msg);
        await sql`UPDATE maya_demos SET step = 99, revealed = TRUE WHERE id = ${demo.id}`;
      } catch {}
    }

    return NextResponse.json({ tenMin: tenMinDue.length, lastTouch: lastTouch.length });
  } catch (err) {
    console.error("[maya-cron]", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
