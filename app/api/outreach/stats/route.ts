import { NextResponse } from "next/server";
import { getSequenceStats } from "@/lib/outreach/sequence";
import { getAllEmailHealth } from "@/lib/outreach/email-health";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const stats = await getSequenceStats();

    const recentEmails = await sql`
      SELECT oe.step, oe.status, oe.sent_at, oe.from_email, oc.email, oc.first_name
      FROM outreach_emails oe
      LEFT JOIN outreach_contacts oc ON oc.id = oe.contact_id
      ORDER BY oe.sent_at DESC
      LIMIT 20
    `;

    // Get email health for all addresses
    let emailHealth: Awaited<ReturnType<typeof getAllEmailHealth>> = [];
    try {
      emailHealth = await getAllEmailHealth();
    } catch {
      // Table may not exist yet
    }

    return NextResponse.json({ stats, recentEmails, emailHealth });
  } catch (e: unknown) {
    console.error("[outreach/stats]", e);
    return NextResponse.json({ stats: { total: "0", active: "0", completed: "0", replied: "0", bounced: "0", unsubscribed: "0", converted: "0" }, recentEmails: [], emailHealth: [] });
  }
}
