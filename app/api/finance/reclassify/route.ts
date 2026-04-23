import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { reclassifyPersonalToBusiness } from "@/lib/finance/business-classifier";

const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// POST /api/finance/reclassify
// Body: { source: 'legacy'|'mercury', personalId: uuid, category: string,
//         subcategory?: string, deductionPct: number, irsReference?: string, notes?: string }
// Inserts a biz_transactions row linked to the personal row; personal row
// stays intact but is marked confirmed_business.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { source, personalId, category, subcategory, deductionPct, irsReference, notes } = body;

  if (!source || !personalId || !category || typeof deductionPct !== "number") {
    return NextResponse.json(
      { error: "Missing required fields: source, personalId, category, deductionPct" },
      { status: 400 },
    );
  }

  if (source !== "legacy" && source !== "mercury") {
    return NextResponse.json({ error: "source must be 'legacy' or 'mercury'" }, { status: 400 });
  }

  try {
    const result = await reclassifyPersonalToBusiness({
      source,
      personalId,
      category,
      subcategory,
      deductionPct,
      irsReference,
      notes,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reclassification failed";
    console.error("[finance/reclassify]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
