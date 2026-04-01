import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/leads — public endpoint for website contact forms
// Creates a contact + deal in the CRM pipeline
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, source, sourceDetail, notes } = body;

    if (!email && !phone) {
      return NextResponse.json({ error: "Email or phone required" }, { status: 400 });
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

    return NextResponse.json({ id: contactId, existing: false }, { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    console.error("[leads] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
