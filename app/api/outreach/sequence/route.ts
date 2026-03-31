import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/outreach/sequence?contactId=xxx — get contact detail with email thread
export async function GET(req: NextRequest) {
  const contactId = new URL(req.url).searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

  try {
    const contact = await sql`SELECT * FROM outreach_contacts WHERE id = ${contactId} LIMIT 1`;
    if (contact.length === 0) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const emails = await sql`
      SELECT from_email, step, subject, body, status, email_type, sent_at, message_id_header
      FROM outreach_emails
      WHERE contact_id = ${contactId}
      ORDER BY sent_at ASC
    `;

    // Get any replies from campaign_inbox
    const replies = await sql`
      SELECT from_email, from_name, subject, body, received_at
      FROM campaign_inbox
      WHERE outreach_contact_id = ${contactId}
      ORDER BY received_at ASC
    `;

    return NextResponse.json({ contact: contact[0], emails, replies });
  } catch (err) {
    console.error("[sequence]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/outreach/sequence — actions: pause, resume, unsubscribe
export async function POST(req: NextRequest) {
  try {
    const { action, contactId, email } = await req.json();

    if (action === "pause") {
      await sql`UPDATE outreach_contacts SET sequence_status = 'paused' WHERE id = ${contactId}`;
      return NextResponse.json({ message: "Contact paused" });
    }

    if (action === "resume") {
      await sql`
        UPDATE outreach_contacts SET sequence_status = 'active', next_email_at = NOW()
        WHERE id = ${contactId} AND sequence_status = 'paused'
      `;
      return NextResponse.json({ message: "Contact resumed" });
    }

    if (action === "unsubscribe") {
      const target = contactId || email;
      if (contactId) {
        await sql`UPDATE outreach_contacts SET sequence_status = 'unsubscribed', unsubscribed = TRUE, unsubscribed_at = NOW() WHERE id = ${contactId}`;
      } else if (email) {
        await sql`UPDATE outreach_contacts SET sequence_status = 'unsubscribed', unsubscribed = TRUE, unsubscribed_at = NOW() WHERE email = ${email.toLowerCase()}`;
      }
      return NextResponse.json({ message: "Contact unsubscribed" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[sequence]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
