import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/calls/initiate — log an outbound call
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { contactId, toNumber } = await req.json();

    if (!toNumber) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    // Create call record
    const call = await sql`
      INSERT INTO calls (workspace_id, contact_id, direction, from_number, to_number, status, called_by)
      VALUES (${workspace.id}, ${contactId || null}, 'outbound', ${process.env.TWILIO_PHONE_NUMBER}, ${toNumber}, 'ringing', 'user')
      RETURNING *
    `;

    return NextResponse.json({ call: call[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
