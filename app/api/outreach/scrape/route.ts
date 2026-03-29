import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { validateEmails } from "@/lib/outreach/validate-email";
import { addToSequence } from "@/lib/outreach/sequence";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/outreach/scrape — scrape NIPR for insurance agent emails
export async function POST(req: NextRequest) {
  try {
    const { count = 30 } = await req.json();

    // TODO: Implement full NIPR scraper
    // For now, this is a placeholder that accepts manual CSV upload or returns empty
    // The full scraper will:
    // 1. Hit NIPR.com state lookup pages
    // 2. Extract agent names, license numbers, emails
    // 3. Validate emails
    // 4. Add to sequence

    console.log(`[outreach/scrape] Scrape requested for ${count} contacts (NIPR scraper not yet connected)`);

    return NextResponse.json({
      found: 0,
      valid: 0,
      added: 0,
      message: "NIPR scraper pending setup. Use CSV upload on the outreach page to add contacts manually.",
    });
  } catch (err) {
    console.error("[outreach/scrape]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
