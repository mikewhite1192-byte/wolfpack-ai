import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/linq/client";

const sql = neon(process.env.DATABASE_URL!);

// This function is called from the main Linq webhook when a message comes in
// from a known Maya demo chat_id
export async function handleMayaReply(chatId: string, from: string, text: string) {
  // Find the demo session
  const demos = await sql`
    SELECT * FROM maya_demos WHERE chat_id = ${chatId} ORDER BY created_at DESC LIMIT 1
  `;
  if (demos.length === 0) return false;

  const demo = demos[0];
  const firstName = demo.first_name;
  const step = demo.step as number;

  // Check if they're asking "is this real?" before reveal
  const isRealQuestion = /real person|is this ai|are you (a |an )?ai|are you real|bot|automated/i.test(text);

  if (isRealQuestion && !demo.revealed) {
    await sendMessage(chatId, `Ha. Great question. I'll tell you in just a second after one more question. Are you the primary decision maker on this?`);
    // Don't advance step, wait for their answer then go to reveal
    await sql`UPDATE maya_demos SET step = 3, responded = TRUE WHERE id = ${demo.id}`;
    return true;
  }

  // Check for negative/not interested
  const isNegative = /not interested|no thanks|stop|unsubscribe|remove me|leave me alone/i.test(text);
  if (isNegative) {
    await sendMessage(chatId, `No worries at all! Appreciate you giving it a try. If you ever want to see how it could work for your business, we're at thewolfpack.ai. Have a great day ${firstName}!`);
    await sql`UPDATE maya_demos SET step = 99, responded = TRUE WHERE id = ${demo.id}`;
    return true;
  }

  // Scripted responses based on step
  if (step === 1) {
    // They responded to "life, auto, or health?"
    await sendMessage(chatId, `Got it! And are you looking for new coverage or trying to find better rates than what you have now?`);
    await sql`UPDATE maya_demos SET step = 2, responded = TRUE WHERE id = ${demo.id}`;
    return true;
  }

  if (step === 2) {
    // They responded to "new coverage or better rates?"
    await sendMessage(chatId, `Perfect. Last question. Are you the primary decision maker on this or is there a spouse or partner involved?`);
    await sql`UPDATE maya_demos SET step = 3, responded = TRUE WHERE id = ${demo.id}`;
    return true;
  }

  if (step === 3) {
    // They responded to "decision maker?" — THE REVEAL
    const reveal = `Okay I have to come clean with you 😄\n\nYou were just texted by an AI. Not a real person. That entire conversation happened automatically in real time.\n\nThat's Wolf Pack AI. An AI sales agent that responds to your leads in seconds, qualifies them, handles objections, and books appointments on your calendar. 24/7. Even while you sleep.\n\nImagine that working on YOUR leads right now.`;
    await sendMessage(chatId, reveal);
    await sql`UPDATE maya_demos SET step = 4, revealed = TRUE WHERE id = ${demo.id}`;

    // Send the pitch 30 seconds later
    setTimeout(async () => {
      try {
        const pitch = `Agents and brokers using Wolf Pack AI never miss a lead again. First to respond wins and your AI never sleeps.\n\nStart free for 14 days → thewolfpack.ai\n\nNo credit card needed. Takes 10 minutes to set up.`;
        await sendMessage(chatId, pitch);
        await sql`UPDATE maya_demos SET step = 5 WHERE id = ${demo.id}`;
      } catch (err) {
        console.error("[maya] Failed to send pitch:", err);
      }
    }, 30000);

    return true;
  }

  // After reveal, any response gets a friendly close
  if (step >= 4) {
    if (!demo.revealed) return true; // shouldn't happen but safety
    // They replied after the reveal — they're interested or just chatting
    const interested = /interested|how|tell me more|sign up|try|cool|wow|amazing|impressive/i.test(text);
    if (interested) {
      await sendMessage(chatId, `Awesome! Head to thewolfpack.ai and you can be live in about 10 minutes. The AI asks you a few questions about your business and starts working right away. Let me know if you have any questions!`);
    }
    await sql`UPDATE maya_demos SET step = 99 WHERE id = ${demo.id}`;
    return true;
  }

  return false;
}

// Cron handler for follow-ups (10 min and 24 hour)
export async function POST() {
  try {
    // 10-minute follow-up for non-responders
    const tenMinDue = await sql`
      SELECT * FROM maya_demos
      WHERE responded = FALSE
        AND step = 1
        AND followup_at IS NOT NULL
        AND followup_at <= NOW()
        AND created_at > NOW() - INTERVAL '24 hours'
    `;

    for (const demo of tenMinDue) {
      try {
        await sendMessage(demo.chat_id, `Just checking in. Did you have a chance to see my last message? Only takes a second to answer 😊`);
        await sql`UPDATE maya_demos SET followup_at = NOW() + INTERVAL '14 hours' WHERE id = ${demo.id}`;
      } catch (err) {
        console.error("[maya-followup]", err);
      }
    }

    // 24-hour last touch for non-responders
    const lastTouch = await sql`
      SELECT * FROM maya_demos
      WHERE responded = FALSE
        AND step = 1
        AND created_at < NOW() - INTERVAL '23 hours'
        AND created_at > NOW() - INTERVAL '48 hours'
        AND followup_at IS NOT NULL
        AND followup_at <= NOW()
    `;

    for (const demo of lastTouch) {
      try {
        const msg = `Hey ${demo.first_name}. I'll be honest, I'm not actually an insurance agent 😄 I'm an AI built to respond to leads instantly like this.\n\nIf you're tired of losing leads to slow response times, check out what we built:\nthewolfpack.ai\n\nEither way, hope your day is great.`;
        await sendMessage(demo.chat_id, msg);
        await sql`UPDATE maya_demos SET step = 99, revealed = TRUE WHERE id = ${demo.id}`;
      } catch (err) {
        console.error("[maya-lasttouch]", err);
      }
    }

    return NextResponse.json({ tenMin: tenMinDue.length, lastTouch: lastTouch.length });
  } catch (err) {
    console.error("[maya-cron]", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
