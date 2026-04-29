import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { parseStatementWithClaude } from "@/lib/finance/pdf-parser-claude";

const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// POST /api/finance/parse-only
// Parses a PDF statement and returns transactions without writing anything to
// the DB. Used by the Smart Scan flow, which needs to AI-classify before save.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file || !file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "PDF file required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseStatementWithClaude(buffer, file.name);

    return NextResponse.json({
      institution: parsed.institution,
      month: parsed.month,
      transactions: parsed.transactions.map(tx => ({
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
      })),
    });
  } catch (err) {
    console.error("[finance/parse-only]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse failed" },
      { status: 500 },
    );
  }
}
