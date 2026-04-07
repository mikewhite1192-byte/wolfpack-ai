import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/leads — public endpoint for website contact forms
// Creates a contact + deal in the CRM pipeline
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 30 requests per minute per IP
    const ip = getClientIp(req.headers);
    const { success } = rateLimit(`leads:${ip}`, 30, 60_000);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { firstName, lastName, email, phone, source, sourceDetail, notes } = body;

    if (!email && !phone) {
      return NextResponse.json({ error: "Email or phone required" }, { status: 400 });
    }

    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Validate phone (at least 10 digits)
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
      }
    }

    // Sanitize input lengths
    if ((firstName && firstName.length > 100) || (lastName && lastName.length > 100) || (email && email.length > 254) || (notes && notes.length > 2000)) {
      return NextResponse.json({ error: "Input too long" }, { status: 400 });
    }

    // Get the first active workspace
    const ws = await sql`SELECT id FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`;
    if (ws.length === 0) {
      return NextResponse.json({ error: "No workspace" }, { status: 500 });
    }
    const wsId = ws[0].id;

    // Check for duplicate by email or phone
    let contactId: string | null = null;
    if (email) {
      const existing = await sql`SELECT id FROM contacts WHERE workspace_id = ${wsId} AND email = ${email.toLowerCase()} LIMIT 1`;
      if (existing.length > 0) contactId = existing[0].id as string;
    }
    if (!contactId && phone) {
      const existing = await sql`SELECT id FROM contacts WHERE workspace_id = ${wsId} AND phone = ${phone} LIMIT 1`;
      if (existing.length > 0) contactId = existing[0].id as string;
    }

    if (contactId) {
      // Update existing contact with any new info
      if (notes) {
        await sql`UPDATE contacts SET source_detail = ${sourceDetail || source || "website"} WHERE id = ${contactId}`;
      }
      return NextResponse.json({ id: contactId, existing: true });
    }

    // Create new contact
    const contact = await sql`
      INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, source, source_detail)
      VALUES (${wsId}, ${firstName || null}, ${lastName || null}, ${email?.toLowerCase() || null}, ${phone || null}, ${source || "website"}, ${sourceDetail || null})
      RETURNING id
    `;
    contactId = contact[0].id as string;

    // Create deal in first pipeline stage
    const firstStage = await sql`SELECT id FROM pipeline_stages WHERE workspace_id = ${wsId} ORDER BY position ASC LIMIT 1`;
    if (firstStage.length > 0) {
      const dealTitle = [firstName, lastName].filter(Boolean).join(" ") || email || phone || "New Lead";
      await sql`
        INSERT INTO deals (workspace_id, contact_id, stage_id, title)
        VALUES (${wsId}, ${contactId}, ${firstStage[0].id}, ${dealTitle + " — Website Lead"})
      `;
    }

    console.log(`[leads] New lead from ${source || "website"}: ${email || phone}`);

    // Notify owner
    try {
      const notifyPhone = process.env.OWNER_PHONE;
      if (notifyPhone) {
        const { sendMessage } = await import("@/lib/loop/client");
        await sendMessage(notifyPhone, `New lead from ${sourceDetail || source || "website"}!\n\nName: ${[firstName, lastName].filter(Boolean).join(" ") || "N/A"}\nEmail: ${email || "N/A"}\nPhone: ${phone || "N/A"}${notes ? `\nMessage: ${notes}` : ""}`);
      }
    } catch { /* silent */ }

    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "https://thewolfpack.ai,https://www.thewolfpack.ai,https://thewolfpackco.com,https://www.thewolfpackco.com").split(",");
    const origin = req.headers.get("origin") || "";
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    return NextResponse.json({ id: contactId, existing: false }, { headers: { "Access-Control-Allow-Origin": corsOrigin } });
  } catch (err) {
    console.error("[leads] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// Handle CORS preflight
export async function OPTIONS(req: NextRequest) {
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "https://thewolfpack.ai,https://www.thewolfpack.ai,https://thewolfpackco.com,https://www.thewolfpackco.com").split(",");
  const origin = req.headers.get("origin") || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
