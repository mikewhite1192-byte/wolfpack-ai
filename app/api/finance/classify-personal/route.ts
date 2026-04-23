import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { classifyUnclassifiedPersonal } from "@/lib/finance/business-classifier";

const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// POST /api/finance/classify-personal
// Body: { limit?: number }
// Runs the classifier over any personal transactions (legacy + Mercury) not
// yet classified. Safe to re-run; only processes rows with business_review_status
// null or 'unclassified'. Idempotent.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body.limit === "number" ? body.limit : 500;

  try {
    const result = await classifyUnclassifiedPersonal({ limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Classification failed";
    console.error("[finance/classify-personal]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
