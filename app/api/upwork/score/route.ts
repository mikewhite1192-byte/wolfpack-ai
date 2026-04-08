import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { scoreAndDraftProposal, scoreAllUnscored } from "@/lib/upwork/scorer";

const ADMIN_EMAILS = ["info@thewolfpackco.com"];

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) return null;
  return email;
}

// POST /api/upwork/score — score a specific job or all unscored
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { jobId } = body;

  if (jobId) {
    const result = await scoreAndDraftProposal(jobId);
    return NextResponse.json(result);
  }

  const scored = await scoreAllUnscored();
  return NextResponse.json({ scored });
}
