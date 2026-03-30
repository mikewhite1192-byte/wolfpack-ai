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

    // Send Message 1 — sell Wolf Pack AI directly
    const msg1 = `Hey ${firstName}! This is Maya with Wolf Pack AI. I saw you were checking us out. Quick question, what kind of business are you in?`;

    let chatId: string | null = null;
    try {
      const chatResult = await createChat(FROM_NUMBER, e164, msg1);
      chatId = chatResult?.chat_id || (chatResult as unknown as Record<string, Record<string, string>>)?.chat?.id || null;
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
