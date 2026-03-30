import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { validateEmail } from "@/lib/outreach/validate-email";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/outreach/revalidate — re-validate active outreach contacts in batches of 15
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const batchSize = 15;

    const contacts = await sql`
      SELECT id, email FROM outreach_contacts
      WHERE sequence_status = 'active' AND bounced = FALSE
      ORDER BY created_at ASC
      LIMIT ${batchSize} OFFSET ${offset}
    `;

    // Count total remaining
    const totalResult = await sql`
      SELECT COUNT(*) as count FROM outreach_contacts
      WHERE sequence_status = 'active' AND bounced = FALSE
    `;
    const totalRemaining = parseInt(totalResult[0].count as string);

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

    const hasMore = offset + batchSize < totalRemaining;

    console.log(`[revalidate] Batch at offset ${offset}: checked ${checked}, removed ${removed}, hasMore: ${hasMore}`);

    return NextResponse.json({ checked, removed, removedEmails, hasMore, nextOffset: offset + batchSize, totalRemaining });
  } catch (err) {
    console.error("[revalidate] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
