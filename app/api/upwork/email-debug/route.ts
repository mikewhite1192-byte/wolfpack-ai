import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { debugIngestUpworkEmails } from "@/lib/upwork/email-ingest";

const ADMIN_EMAILS = ["info@thewolfpackco.com"];

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) return null;
  return email;
}

// GET /api/upwork/email-debug — admin-only diagnostic for the Upwork email ingest pipeline.
// Returns counts at each stage (workspace/token/label/messages/ids/parsed/inserted)
// so we can tell where a "0 new jobs" result is coming from.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const debug = await debugIngestUpworkEmails();
  return NextResponse.json(debug);
}
