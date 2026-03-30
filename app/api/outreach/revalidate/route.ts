import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { validateEmail } from "@/lib/outreach/validate-email";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/outreach/revalidate — re-validate all active outreach contacts
export async function POST() {
  try {
    const contacts = await sql`
      SELECT id, email FROM outreach_contacts
      WHERE sequence_status = 'active' AND bounced = FALSE
      ORDER BY created_at ASC
    `;

    let checked = 0;
    let removed = 0;
    const removedEmails: string[] = [];

    for (const c of contacts) {
      const email = c.email as string;
      const result = await validateEmail(email);
      checked++;

      if (!result.valid) {
        await sql`UPDATE outreach_contacts SET bounced = TRUE, sequence_status = 'bounced' WHERE id = ${c.id}`;
        removed++;
        removedEmails.push(email);
        console.log(`[revalidate] Removed ${email}: ${result.details}`);
      }
    }

    console.log(`[revalidate] Checked ${checked}, removed ${removed}`);

    return NextResponse.json({ checked, removed, removedEmails });
  } catch (err) {
    console.error("[revalidate] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
