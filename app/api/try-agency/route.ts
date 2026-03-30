import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);
const FROM_NUMBER = process.env.LINQ_PHONE_NUMBER || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/try-agency — start Maya as agency sales rep
export async function POST(req: NextRequest) {
  try {
    const { name, phone, businessType } = await req.json();

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "Name and phone required" }, { status: 400, headers: corsHeaders });
    }

    const firstName = name.trim();
    const cleanPhone = phone.replace(/\D/g, "");
    const e164 = cleanPhone.startsWith("1") && cleanPhone.length === 11
      ? "+" + cleanPhone
      : cleanPhone.length === 10
      ? "+1" + cleanPhone
      : "+" + cleanPhone;

    // Rate limit
    const recent = await sql`
      SELECT id FROM maya_demos WHERE phone = ${e164} AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1
    `;
    if (recent.length > 0) {
      return NextResponse.json({ error: "We already texted this number in the last 24 hours. Check your messages!" }, { status: 429 });
    }

    const industry = businessType || "business";

    // Maya as agency sales rep — opening message
    const msg1 = `Hey ${firstName}! This is Maya with The Wolf Pack Co. I saw you checked out what we do. Quick question, how are you currently getting leads for your ${industry === "business" ? "business" : industry + " business"}?`;

    let chatId: string | null = null;
    try {
      const chatResult = await sendMessage(e164, msg1);
      chatId = chatResult?.message_id || null;
      console.log(`[try-agency] Message sent, message_id: ${chatId}`);
    } catch (err) {
      console.error(`[try-agency] createChat failed:`, err);
      return NextResponse.json({ error: "Failed to send text. Try again." }, { status: 500 });
    }

    await sql`
      INSERT INTO maya_demos (phone, first_name, chat_id, step, industry, conversation, created_at)
      VALUES (${e164}, ${firstName}, ${chatId}, 1, ${"agency_" + industry}, ${JSON.stringify([{ role: "assistant", content: msg1 }])}::jsonb, NOW())
    `;

    await sql`
      UPDATE maya_demos SET followup_at = NOW() + INTERVAL '10 minutes' WHERE phone = ${e164} AND step = 1
    `;

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[try-agency]", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500, headers: corsHeaders });
  }
}
