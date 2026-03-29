import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createChat, sendMessage } from "@/lib/linq/client";

const sql = neon(process.env.DATABASE_URL!);
const FROM_NUMBER = process.env.LINQ_PHONE_NUMBER || "";

// Maya demo conversation state stored in DB
// POST /api/try — start the Maya demo sequence
export async function POST(req: NextRequest) {
  try {
    const { name, phone, industry } = await req.json();

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
    }

    const firstName = name.trim();
    const cleanPhone = phone.replace(/\D/g, "");
    const e164 = cleanPhone.startsWith("1") && cleanPhone.length === 11
      ? "+" + cleanPhone
      : cleanPhone.length === 10
      ? "+1" + cleanPhone
      : "+" + cleanPhone;

    // Check if already sent to this number recently (prevent spam)
    const recent = await sql`
      SELECT id FROM maya_demos WHERE phone = ${e164} AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1
    `;
    if (recent.length > 0) {
      return NextResponse.json({ error: "We already texted this number in the last 24 hours. Check your messages!" }, { status: 429 });
    }

    // Send Message 1 — the opening (industry-specific)
    const openers: Record<string, string> = {
      insurance: `Hey ${firstName}! This is Maya with Wolf Pack. Thanks for reaching out. Quick question, are you currently looking for life, auto, or health insurance coverage?`,
      real_estate: `Hey ${firstName}! This is Maya with Wolf Pack. Thanks for reaching out. Quick question, are you looking to buy, sell, or just exploring the market right now?`,
      mortgage: `Hey ${firstName}! This is Maya with Wolf Pack. Thanks for reaching out. Quick question, are you looking to purchase a new home or refinance your current mortgage?`,
      roofing: `Hey ${firstName}! This is Maya with Wolf Pack. Thanks for reaching out. Quick question, what's going on with your roof? Are you dealing with damage or just looking for an inspection?`,
      fitness: `Hey ${firstName}! This is Maya with Wolf Pack. Thanks for reaching out. Quick question, are you looking to get started with a membership or checking out personal training?`,
      med_spa: `Hey ${firstName}! This is Maya with Wolf Pack. Thanks for reaching out. Quick question, are you interested in a specific treatment or just exploring what we offer?`,
      solar: `Hey ${firstName}! This is Maya with Wolf Pack. Thanks for reaching out. Quick question, have you looked into solar before or is this your first time exploring it?`,
      other: `Hey ${firstName}! This is Maya with Wolf Pack. Thanks for reaching out. Quick question, what can I help you with today?`,
    };
    const msg1 = openers[industry || "insurance"] || openers.other;

    let chatId: string | null = null;
    try {
      const chatResult = await createChat(FROM_NUMBER, e164, msg1);
      chatId = chatResult?.chat_id || null;
      console.log(`[try] Chat created, chat_id: ${chatId}, full result:`, JSON.stringify(chatResult));
    } catch (err) {
      console.error(`[try] createChat failed but continuing:`, err);
    }

    // Store the demo state — phone is the primary lookup key
    await sql`
      INSERT INTO maya_demos (phone, first_name, chat_id, step, industry, conversation, created_at)
      VALUES (${e164}, ${firstName}, ${chatId}, 1, ${industry || 'insurance'}, ${JSON.stringify([{ role: "assistant", content: msg1 }])}::jsonb, NOW())
    `;

    // Schedule the 10-minute follow-up check
    await sql`
      UPDATE maya_demos SET followup_at = NOW() + INTERVAL '10 minutes' WHERE phone = ${e164} AND step = 1
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[try]", err);
    return NextResponse.json({ error: "Failed to start demo. Try again." }, { status: 500 });
  }
}
