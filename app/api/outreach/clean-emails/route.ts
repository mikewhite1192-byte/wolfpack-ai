import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cleanEmails } from "@/lib/outreach/validate-email";

// dns/net need the Node runtime; give the DNS pass room on big lists.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_EMAILS = 5000;

// POST /api/outreach/clean-emails
// Body: { emails: string[] }  (raw cell values are fine — we extract addresses)
// Returns: { total, valid, invalid, results: [{ email, valid, reason }] }
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const emails: string[] = Array.isArray(body?.emails) ? body.emails : [];
    if (emails.length === 0) {
      return NextResponse.json({ error: "No emails found in the file." }, { status: 400 });
    }
    if (emails.length > MAX_EMAILS) {
      return NextResponse.json(
        { error: `That's ${emails.length.toLocaleString()} emails. Please split into files of ${MAX_EMAILS.toLocaleString()} or fewer.` },
        { status: 400 }
      );
    }

    const results = await cleanEmails(emails);
    const valid = results.filter(r => r.valid).length;

    return NextResponse.json({
      total: results.length,
      valid,
      invalid: results.length - valid,
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to clean emails" }, { status: 500 });
  }
}
