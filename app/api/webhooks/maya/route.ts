import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/loop/client";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_SONNET_KEY || process.env.ANTHROPIC_API_KEY });

// Sync completed Maya demo conversation to CRM so it shows in dashboard
async function syncMayaToCRM(phone: string, firstName: string, email: string | null, industry: string, conversation: { role: string; content: string }[]) {
  const ws = await sql`SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`;
  if (ws.length === 0) return;
  const wsId = ws[0].id;

  // Check if contact already exists
  const existing = await sql`SELECT id FROM contacts WHERE workspace_id = ${wsId} AND phone = ${phone} LIMIT 1`;
  let contactId: string;

  if (existing.length > 0) {
    contactId = existing[0].id as string;
    if (email) await sql`UPDATE contacts SET email = ${email} WHERE id = ${contactId} AND email IS NULL`;
  } else {
    const contact = await sql`
      INSERT INTO contacts (workspace_id, first_name, email, phone, source, source_detail)
      VALUES (${wsId}, ${firstName}, ${email}, ${phone}, 'maya_demo', ${industry})
      RETURNING id
    `;
    contactId = contact[0].id as string;

    // Create deal
    const firstStage = await sql`SELECT id FROM pipeline_stages WHERE workspace_id = ${wsId} ORDER BY position ASC LIMIT 1`;
    if (firstStage.length > 0) {
      await sql`INSERT INTO deals (workspace_id, contact_id, stage_id, title) VALUES (${wsId}, ${contactId}, ${firstStage[0].id}, ${firstName + ' — Demo Booked'})`;
    }
  }

  // Create or find conversation
  let conv = await sql`SELECT id FROM conversations WHERE workspace_id = ${wsId} AND contact_id = ${contactId} AND channel = 'sms' LIMIT 1`;
  if (conv.length === 0) {
    conv = await sql`
      INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled, ai_stage)
      VALUES (${wsId}, ${contactId}, 'sms', 'open', FALSE, 'booked')
      RETURNING id
    `;
  } else {
    // Disable AI on existing conversation so CRM agent doesn't take over
    await sql`UPDATE conversations SET ai_enabled = FALSE, ai_stage = 'booked' WHERE id = ${conv[0].id}`;
  }
  const convId = conv[0].id as string;

  // Sync all messages from the Maya conversation
  for (const msg of conversation) {
    await sql`
      INSERT INTO messages (conversation_id, workspace_id, direction, channel, sender, recipient, body, status, sent_by)
      VALUES (${convId}, ${wsId}, ${msg.role === "user" ? "inbound" : "outbound"}, 'imessage', ${msg.role === "user" ? phone : ""}, ${msg.role === "user" ? "" : phone}, ${msg.content}, 'sent', ${msg.role === "user" ? "contact" : "ai"})
    `;
  }

  await sql`UPDATE conversations SET last_message_at = NOW() WHERE id = ${convId}`;
  console.log(`[maya] Synced ${conversation.length} messages to CRM for ${firstName} (${phone})`);
}

// Called from the Loop webhook when a message comes from a Maya demo
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
  // Only bail if they're clearly telling US to stop — not if they mention the word "stop" in conversation
  const isNegative = /^(stop|unsubscribe|remove me|leave me alone|fuck off|not interested|no thanks)$/i.test(text.trim()) || /^stop$/i.test(text.trim());
  if (isNegative) {
    const reply = `No worries at all! Appreciate you giving it a try. If you ever want to see how it could work for your business, we're at thewolfpack.ai. Have a great day ${firstName}!`;
    await sendMessage(demo.phone as string, reply);
    conversation.push({ role: "assistant", content: reply });
    await sql`UPDATE maya_demos SET step = 99, responded = TRUE, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // TRADE DEMO MODE — AI acts as the trade company, then pivots to Wolf Pack
  // ═══════════════════════════════════════════════════════════════
  const isTradeMode = (industry as string).startsWith("trade_");

  if (isTradeMode && step < 99) {
    const tradeType = (industry as string).replace("trade_", "");
    console.log(`[maya-trade] Step ${step} for ${firstName}, trade: ${tradeType}`);

    const tradeInfo: Record<string, { company: string; services: string; area: string }> = {
      plumber: { company: "Metro Plumbing Co", services: "emergency repairs, drain cleaning, water heater installation, pipe repair, bathroom remodels, sewer line services", area: "Warren, MI" },
      roofing: { company: "Summit Roofing & Exteriors", services: "roof replacement, storm damage repair, inspections, gutters, siding, emergency tarping", area: "Sterling Heights, MI" },
      hvac: { company: "Comfort Zone Heating & Cooling", services: "AC repair/install, furnace repair/install, duct cleaning, thermostat install, maintenance plans, emergency HVAC", area: "Troy, MI" },
      electrician: { company: "Volt Electric Services", services: "panel upgrades, outlet & wiring, EV charger install, lighting design, generator install, inspections", area: "Rochester Hills, MI" },
    };

    const info = tradeInfo[tradeType] || tradeInfo.plumber;
    let systemPrompt: string;

    if (step <= 3) {
      systemPrompt = `You are the AI receptionist for ${info.company}, a ${tradeType} company in ${info.area}. You're texting ${firstName} who just reached out for help.

SERVICES: ${info.services}

RULES:
- MAX 2 SHORT SENTENCES. This is texting.
- Be warm, helpful, and professional like a real receptionist
- Help them with scheduling, quotes, questions
- If they describe a problem, acknowledge it and offer to send someone out
- NEVER mention Wolf Pack, AI demos, or anything outside of being ${info.company}
- Make the experience feel incredibly responsive and helpful`;
    } else if (step <= 5) {
      systemPrompt = `You were acting as ${info.company}'s AI receptionist for ${firstName}. Now reveal the magic.

RULES:
- MAX 2 SHORT SENTENCES. This is texting.
- Reveal you're an AI assistant demo. Be excited, not salesy.
- Say something like "Quick heads up, I'm actually an AI. This is what your customers would experience 24/7. Pretty wild right?"
- Make them think about what this would mean for THEIR business
- Don't hard sell yet`;
    } else {
      systemPrompt = `You revealed yourself as an AI demo to ${firstName} (a ${tradeType} business owner). Now sell Wolf Pack.

WHAT WOLF PACK OFFERS:
- Custom websites for trade businesses starting at $1,500
- Wolf Pack AI: AI appointment setter + CRM for $97/mo
- Texts leads in 3 seconds via blue iMessage, qualifies them, books appointments automatically
- No contracts, cancel anytime

RULES:
- MAX 2 SHORT SENTENCES. This is texting.
- Be excited about the tech, not pushy
- If they want to learn more: text (586) 237-8743 or visit thewolfpackco.com
- If they seem interested, try to get them on a quick demo call`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 120,
      temperature: 0.8,
      system: systemPrompt,
      messages: conversation.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const reply = ((response.content[0] as { type: string; text: string }).text || "").trim().replace(/^["']|["']$/g, "");
    console.log(`[maya-trade] Reply: "${reply}"`);

    await sendMessage(demo.phone as string, reply);
    conversation.push({ role: "assistant", content: reply });
    await sql`UPDATE maya_demos SET step = ${step + 1}, responded = TRUE, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;
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
        const { createCalendarEvent, getTzOffset } = await import("@/lib/calendar");
        const ws = await sql`SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`;
        if (ws.length > 0) {
          const calToken = await getGmailToken(ws[0].id);
          if (calToken) {
            // Book for next available — tomorrow at 2pm ET (DST-aware)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split("T")[0];
            const offset = getTzOffset("America/New_York", tomorrow);
            const startDt = new Date(`${tomorrowStr}T14:00:00${offset}`);
            const endDt = new Date(startDt.getTime() + 30 * 60000);

            const calEvent = await createCalendarEvent(
              calToken,
              `Wolf Pack Co — ${firstName}`,
              `Agency demo call with ${firstName}\nPhone: ${demo.phone}\nEmail: ${email}\nIndustry: ${actualIndustry}\nBooked by Maya AI`,
              startDt.toISOString(),
              endDt.toISOString(),
              email,
              true,
            );
            // Store event ID for rescheduling
            await sql`UPDATE maya_demos SET calendar_event_id = ${calEvent.id} WHERE id = ${demo.id}`;
            console.log(`[maya-agency] Calendar event created for ${firstName}: ${calEvent.id}`);
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

      // Notify Mike
      const notifyPhone = process.env.OWNER_PHONE;
      if (notifyPhone) {
        try {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(14, 0, 0, 0);
          const timeStr = tomorrow.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) + " at 2:00 PM";
          await sendMessage(notifyPhone, `New demo booked by Maya!\n\nName: ${firstName}\nEmail: ${email}\nPhone: ${demo.phone}\nIndustry: ${actualIndustry}\nTime: ${timeStr}\n\nThey came through The Wolf Pack Co.`);
        } catch { /* silent */ }
      }

      return true;
    }

    // Build system prompt for agency sales
    let agencyStepInstruction = "";
    if (step <= 2) {
      agencyStepInstruction = "You're still qualifying. Ask about their current lead generation, what's working, what's not. NEPQ style. One question at a time.";
    } else if (step === 3) {
      agencyStepInstruction = "You've qualified them. Now create urgency. Help them feel the cost of their current situation. How many deals are they losing because leads are shared or stale?";
    } else if (step === 4) {
      agencyStepInstruction = "VALUE DROP 1: Tell them you run exclusive Meta and Google ads that bring leads only to THEM. No shared leads, no vendors selling to 5 agents. Ask if that would change things for them.";
    } else if (step === 5) {
      agencyStepInstruction = "VALUE DROP 2: Tell them you also create AI generated video ads for their campaigns. Most agents run boring static ads. You create scroll stopping video creative using AI that performs way better. Ask if they're running any video ads right now.";
    } else if (step === 6) {
      agencyStepInstruction = "VALUE DROP 3: Tell them every client also gets Wolf Pack AI included free. It's an AI that texts their leads in 3 seconds through blue iMessage texts, qualifies them, and books appointments on their calendar automatically while they sleep. Ask if they've ever had something respond to leads that fast.";
    } else if (step === 7) {
      agencyStepInstruction = "VALUE DROP 4: Tell them you guarantee you hit their lead numbers or they don't pay. No long term contracts. Ask if they want to hop on a quick 15 min call to see how it would work for their business.";
    } else if (step >= 8 && timeMatch) {
      agencyStepInstruction = "They suggested a time. Confirm it, mention it's Eastern time and ask if that works for their time zone, and ask for their email to send the calendar invite.";
    } else if (step >= 8) {
      agencyStepInstruction = "They haven't committed yet. Try a softer approach. No pressure, just ask what day works best this week for a quick call.";
    }

    systemPrompt = `You are Maya, a sales rep for The Wolf Pack Co, a digital marketing agency. You're texting ${firstName} who runs a ${actualIndustry} business. Your goal is to get them booked on a demo call BUT you need to deliver value first.

WHAT YOU SELL (ONLY talk about these):
- Done for you exclusive paid ads (Meta + Google) that bring leads only to them, not shared
- AI video creative that stops the scroll
- Custom website + 2 landing pages
- Wolf Pack AI included free with every package (an AI appointment setter that texts leads in 3 seconds via blue iMessage and books appointments automatically)
- Guarantee: you hit their lead numbers or they don't pay
- Packages start at $1,499/month. No long term contracts.

WHAT YOU DO NOT SELL OR CLAIM:
- Do NOT claim integration with GHL or any other CRM
- Do NOT make up features or capabilities
- Wolf Pack AI IS its own CRM, it does not plug into anything

CONVERSATION STATE: Message ${step}

${agencyStepInstruction}

RULES:
- MAX 2 SHORT SENTENCES. This is texting, not email. Keep it tight.
- Sound like a real 28 year old sales rep. Casual but professional.
- NEPQ: ask questions that make them feel, never pitch features
- Acknowledge what they said with genuine empathy before your question
- ONE question per message. Only ONE question mark allowed in your entire response.
- ABSOLUTELY NO DASHES. No em dashes, no hyphens between words, no bullet points. Zero dashes.
- NEVER say "I'd be happy to" or corporate speak
- WHENEVER you mention price ($1,499/month), ALWAYS mention the guarantee in the same message: "and we guarantee we hit your lead numbers or you don't pay"
- If they object on price, reframe: "Most of our clients make back their investment in the first month from the leads alone, and we guarantee your lead numbers or you don't pay"
- If they say not interested, be graceful
- NEVER guess or make up an answer. If you don't know, push for a call.
- Do NOT push for a demo call until you've delivered at least 3 value drops (exclusive leads, AI video, Wolf Pack AI)

Write ONLY the text message. Nothing else.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 120,
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
      stepInstruction = "They just answered your opening question about their industry. Acknowledge it, then ask if they're happy with how many appointments they're booking right now or if leads are slipping through.";
    } else if (step === 2) {
      stepInstruction = "They told you about their situation. Acknowledge the pain. Ask how fast they typically respond to a new lead because speed is everything and most agents lose deals just from being too slow.";
    } else if (step === 3) {
      stepInstruction = "NOW DELIVER THE VALUE. Tell them what Wolf Pack AI actually does. Say something like: 'So Wolf Pack AI sends blue iMessage texts to your leads in 3 seconds and books appointments on your calendar automatically. No more chasing, no more filtered texts.' Then ask if that's something they'd want running on their leads.";
    } else if (step === 4) {
      stepInstruction = "They showed interest in the value. Now hit the second angle they haven't heard yet. If you talked about blue texts, now mention the AI books appointments while they sleep. If you talked about appointments, mention the blue iMessage texts that don't get filtered. Then ask if they want to see it in action on a quick call.";
    } else if (step === 5) {
      stepInstruction = "Time to close for the demo. Keep it simple: 'Want me to get you on a quick 15 min call so we can show you how it works?' ONE question only.";
    } else if (step === 6) {
      stepInstruction = "They haven't committed to a demo yet. Try a softer angle: 'No pressure at all. Most people just want to see it work first. What day works best for you this week?'";
    } else if (step >= 7) {
      // Check if they're giving an email for booking
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        const email = emailMatch[0];
        // Book on calendar
        try {
          const refreshToken = process.env.DEMO_BOOKING_REFRESH_TOKEN;
          if (refreshToken) {
            const { refreshAccessToken } = await import("@/lib/gmail");
            const { createCalendarEvent, getTzOffset } = await import("@/lib/calendar");
            const calToken = await refreshAccessToken(refreshToken);
            if (!calToken) throw new Error("Token refresh returned empty");
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tmrStr = tomorrow.toISOString().split("T")[0];
            const offset = getTzOffset("America/New_York", tomorrow);
            const startDt = new Date(`${tmrStr}T14:00:00${offset}`);
            const endDt = new Date(startDt.getTime() + 30 * 60000);
            const calEvent = await createCalendarEvent(
              calToken,
              `Wolf Pack AI Demo — ${firstName}`,
              `Demo call with ${firstName}\nPhone: ${demo.phone}\nEmail: ${email}\nIndustry: ${industry}\nBooked by Maya AI`,
              startDt.toISOString(),
              endDt.toISOString(),
              email,
              true,
            );
            await sql`UPDATE maya_demos SET calendar_event_id = ${calEvent.id} WHERE id = ${demo.id}`;
          }
        } catch (calErr) {
          console.error("[maya] Calendar booking failed:", calErr);
        }

        const reply = `You're all set ${firstName}! Calendar invite with a Google Meet link is heading to ${email} right now. Looking forward to showing you how it works. Talk soon!`;
        await sendMessage(demo.phone as string, reply);
        conversation.push({ role: "assistant", content: reply });
        await sql`UPDATE maya_demos SET step = 99, conversation = ${JSON.stringify(conversation)}::jsonb WHERE id = ${demo.id}`;

        // Sync full Maya conversation to CRM
        try {
          await syncMayaToCRM(demo.phone as string, firstName, email, industry, conversation);
        } catch (syncErr) {
          console.error("[maya] CRM sync failed:", syncErr);
        }

        // Notify Mike via text that a demo was booked
        const notifyPhone = process.env.OWNER_PHONE;
        if (notifyPhone) {
          try {
            const tomorrow2 = new Date();
            tomorrow2.setDate(tomorrow2.getDate() + 1);
            const timeStr = tomorrow2.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York" }) + " at 2:00 PM ET";
            await sendMessage(notifyPhone, `New demo booked by Maya!\n\nName: ${firstName}\nEmail: ${email}\nPhone: ${demo.phone}\nIndustry: ${industry}\nTime: ${timeStr}\n\nThey came through the Wolf Pack AI demo.`);
          } catch { /* silent */ }
        }

        return true;
      }

      stepInstruction = "They seem interested but haven't committed. Ask for their email so you can send a calendar invite for a quick demo call. Keep it casual.";
    }

    const systemPrompt = `You are Maya, a sales rep for Wolf Pack AI. You're texting ${firstName} who runs a ${industry} business. You are selling them on signing up for Wolf Pack AI.

WHAT WOLF PACK AI IS (ONLY talk about these features — nothing else):
- An AI APPOINTMENT SETTER. This is the #1 thing it does. It books appointments on your calendar automatically while you sleep.
- It texts new leads in 3 seconds, qualifies them, handles objections, and BOOKS THE APPOINTMENT on their calendar. You just show up and close.
- It sends BLUE iMessage texts (not green SMS). Blue texts don't get filtered by carriers. No A2P registration needed. Your leads actually see and respond to your messages. This is a massive advantage over every other tool.
- It is its own standalone platform with a built-in CRM.
- One plan: $97/month. Everything included — blue iMessage texts, AI agent, CRM, calendar, analytics. No contracts.
- No contracts, cancel anytime, 10 minutes to set up
- Sign up at thewolfpack.ai
- Built-in CRM with pipeline, contacts, conversations, calendar booking, call recording, analytics
- AI learns from every conversation and gets better over time

ALWAYS LEAD WITH THESE TWO THINGS:
1. It SETS APPOINTMENTS automatically — your calendar fills itself
2. It uses BLUE iMESSAGE TEXTS that actually get through — not green filtered SMS

WHAT WOLF PACK AI IS NOT (NEVER claim these):
- It does NOT integrate with GHL, Salesforce, HubSpot, or any other CRM. It IS the CRM.
- It does NOT plug into other systems. It replaces them.
- It is NOT just a texting tool or add-on. It's a full platform.
- Do NOT make up features, integrations, or capabilities that aren't listed above.
- Do NOT claim it works with any specific third party tool or software.

CONVERSATION STATE: Message ${step}

${stepInstruction}

RULES:
- MAX 2 SHORT SENTENCES. This is texting, not email. Keep it tight. If your message is more than 2 sentences, cut it down.
- Sound like a real 28 year old sales rep. Casual but professional.
- NEPQ: ask questions that make them feel, never pitch features
- Acknowledge what they said with genuine empathy before your question
- ONE question per message. Only ONE question mark allowed in your entire response. If you have two question marks, delete one of the questions.
- ABSOLUTELY NO DASHES. No em dashes (—), no hyphens between words, no bullet points. Zero dashes in any message. This is critical.
- NEVER say "I'd be happy to" or corporate speak
- If they ask about price: "$97/month. Everything included — blue iMessage texts, AI agent, CRM, the works. No contracts, cancel anytime."
- If they ask about integrations: "Wolf Pack AI is its own platform — CRM, AI appointment setting, calendar, everything built in. No need to connect anything else."
- If they object, reframe around appointments: "Most agents using this are waking up to appointments already booked on their calendar. The AI does the follow-up through blue texts that actually get through."
- Always tie back to APPOINTMENTS and BLUE TEXTS. These are the two things that matter.
- If you don't know the answer to something, say "Great question, let me get you on a quick call with The Wolf Pack team so they can walk you through that" and ask for their email
- NEVER guess or make up an answer
- Primary goal: BOOK A DEMO CALL. Get their email so you can send a calendar invite. That's the win.
- Don't push them to sign up on the website. Push them to get on a quick 15 min demo call with The Wolf Pack team.
- Be genuine, not pushy
- When booking a time, always confirm it's Eastern time: "I'll book you for [day] at [time] Eastern, does that work for your time zone?"
- If someone asks to reschedule or cancel, tell them "No problem! Just text back the new day and time and I'll get it switched for you."
- CRITICAL: Short answers like "no", "nah", "not really", "nope" are just ANSWERS to your question, NOT rejections of the conversation. Keep going. Ask a follow-up. "No" to "are you happy with your appointments?" means they're NOT happy, which is an opportunity. Only bail if they explicitly say "stop", "not interested", "leave me alone", or "unsubscribe".
- NEVER end the conversation early. Keep selling unless they explicitly tell you to stop.
- If they say they're busy or not available, DON'T keep pushing. Say something like "No worries at all, when's a better time this week? I'll follow up then." Be cool about it.
- If they give a time like "tomorrow" or "next week", confirm it and say you'll reach back out then
- Never make them feel pressured. If they need space, give it.

Write ONLY the text message. Nothing else.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 120,
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
