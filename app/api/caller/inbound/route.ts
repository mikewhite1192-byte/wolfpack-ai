import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import type { CallerLead } from "@/lib/caller/retell-tools";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/caller/inbound — handle inbound callbacks from contractors
// Triggered by the Android app when it detects an inbound call
export async function POST(req: Request) {
  try {
    const { phone, businessName } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    console.log(`[inbound] Callback from ${phone}`);

    // Normalize phone for lookup (strip formatting)
    const digits = phone.replace(/\D/g, "");
    const phoneVariants = [
      phone,
      `+1${digits.slice(-10)}`,
      `+${digits}`,
      digits,
      digits.slice(-10),
    ];

    // Look up contractor in caller_leads by phone
    let leads = await sql`
      SELECT * FROM caller_leads
      WHERE phone = ANY(${phoneVariants})
      ORDER BY created_at DESC LIMIT 1
    `;

    let lead: CallerLead | null = null;

    if (leads.length > 0) {
      lead = leads[0] as unknown as CallerLead;

      // Update status to callback
      await sql`
        UPDATE caller_leads SET
          status = 'callback',
          direction = 'inbound',
          updated_at = NOW()
        WHERE id = ${lead.id}
      `;

      console.log(`[inbound] Found existing lead: ${lead.id} — ${lead.business_name}`);
    } else {
      // New caller — create a record
      leads = await sql`
        INSERT INTO caller_leads (
          phone, business_name, status, direction, source
        ) VALUES (
          ${phone}, ${businessName || null}, 'callback', 'inbound', 'inbound_callback'
        ) RETURNING *
      `;
      lead = leads[0] as unknown as CallerLead;
      console.log(`[inbound] Created new lead for callback: ${lead.id}`);
    }

    // Return lead context so the AI knows who's calling
    return NextResponse.json({
      lead_id: lead.id,
      phone: lead.phone,
      business_name: lead.business_name,
      contact_name: lead.contact_name,
      contractor_type: lead.contractor_type,
      city: lead.city,
      review_count: lead.review_count,
      previous_status: leads.length > 0 ? (leads[0] as unknown as CallerLead).status : null,
      context: lead.business_name
        ? `This is ${lead.contact_name || "a contractor"} from ${lead.business_name}${lead.city ? ` in ${lead.city}` : ""}. They're a${lead.contractor_type ? ` ${lead.contractor_type}` : " contractor"} calling back after a previous outreach attempt.`
        : "New inbound caller — no previous context available.",
    });
  } catch (err) {
    console.error("[inbound] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
