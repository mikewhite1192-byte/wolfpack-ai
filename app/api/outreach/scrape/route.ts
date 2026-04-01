import { NextRequest, NextResponse } from "next/server";
import { validateEmails } from "@/lib/outreach/validate-email";
import { addToSequence } from "@/lib/outreach/sequence";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Florida DOI bulk download URL
const FL_INDIVIDUAL_CSV = "https://www.myfloridacfo.com/downloads/AAS/LicenseeSearch/AllValidLicensesIndividual.csv";

// License types we want (insurance agents, not adjusters)
// Target life insurance agents only
const TARGET_LICENSE_TYPES = [
  "LIFE INCL VAR ANNUITY & HEALTH",
  "LIFE INCLUDING VARIABLE ANNUITY",
  "LIFE",
];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// GET /api/outreach/scrape — Vercel cron handler (crons always use GET)
export async function GET() {
  return handleScrape(15);
}

// POST /api/outreach/scrape — manual trigger with custom count
export async function POST(req: NextRequest) {
  let count = 15;
  try {
    const body = await req.json();
    count = body.count || 15;
  } catch {
    // No body — default to 15
  }
  return handleScrape(count);
}

async function handleScrape(count: number) {
  try {

    console.log(`[scrape] Starting Florida DOI scrape for ${count} contacts`);

    // Track where we left off so each scrape gets fresh contacts
    const offsetResult = await sql`
      SELECT COALESCE(MAX(scrape_offset), 0) as offset FROM outreach_scrape_state WHERE source = 'FL_DOI'
    `.catch(() => [{ offset: 0 }]);
    const startOffset = parseInt(offsetResult[0]?.offset as string || "0");

    // Stream the CSV — only read enough lines to find our contacts
    const response = await fetch(FL_INDIVIDUAL_CSV);
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "Failed to download Florida DOI data" }, { status: 500 });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let headers: string[] = [];
    let lineNumber = 0;
    let headersParsed = false;

    const colIdx = {
      firstName: -1, lastName: -1, email: -1, phone: -1,
      company: -1, city: -1, state: -1, licenseType: -1, licenseNumber: -1,
    };

    // Get existing emails to avoid re-processing
    const existing = await sql`SELECT email FROM outreach_contacts`;
    const existingEmails = new Set(existing.map(r => (r.email as string).toLowerCase()));

    const candidates: { email: string; firstName: string; lastName: string; company: string; state: string; licenseNumber: string }[] = [];
    const seenEmails = new Set<string>();
    const neededCandidates = count * 3;

    // Read chunks until we have enough candidates
    let done = false;
    while (!done && candidates.length < neededCandidates) {
      const chunk = await reader.read();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete last line

      for (const line of lines) {
        lineNumber++;

        if (!headersParsed) {
          headers = parseCSVLine(line);
          colIdx.firstName = headers.indexOf("First Name");
          colIdx.lastName = headers.indexOf("Last Name");
          colIdx.email = headers.indexOf("Email Address");
          colIdx.phone = headers.indexOf("Business Phone");
          colIdx.company = headers.indexOf("Business Address1");
          colIdx.city = headers.indexOf("Business City");
          colIdx.state = headers.indexOf("Business State");
          colIdx.licenseType = headers.indexOf("License TYCL Desc");
          colIdx.licenseNumber = headers.indexOf("License Number");
          headersParsed = true;
          continue;
        }

        // Skip lines we've already processed
        if (lineNumber <= startOffset) continue;

        if (!line.trim()) continue;
        const row = parseCSVLine(line);

        const licenseType = row[colIdx.licenseType] || "";
        if (!TARGET_LICENSE_TYPES.some(t => licenseType.includes(t))) continue;

        const email = (row[colIdx.email] || "").trim().toLowerCase();
        if (!email || email.length < 5) continue;
        if (seenEmails.has(email) || existingEmails.has(email)) continue;
        seenEmails.add(email);

        candidates.push({
          email,
          firstName: row[colIdx.firstName] || "",
          lastName: row[colIdx.lastName] || "",
          company: row[colIdx.company] || "",
          state: row[colIdx.state] || "FL",
          licenseNumber: (row[colIdx.licenseNumber] || "").replace(/=/g, "").replace(/"/g, ""),
        });

        if (candidates.length >= neededCandidates) { done = true; break; }
      }
    }

    // Cancel the remaining download
    reader.cancel().catch(() => {});

    // Save where we left off for next scrape
    await sql`
      INSERT INTO outreach_scrape_state (source, scrape_offset) VALUES ('FL_DOI', ${lineNumber})
      ON CONFLICT (source) DO UPDATE SET scrape_offset = ${lineNumber}, updated_at = NOW()
    `.catch(() => {});

    console.log(`[scrape] Found ${candidates.length} candidates after filtering`);

    // Validate emails
    const emailsToValidate = candidates.slice(0, count * 2).map(c => c.email);
    const validationResults = await validateEmails(emailsToValidate);

    // Filter to valid only, take up to `count`
    const validContacts = candidates
      .filter(c => validationResults.get(c.email)?.valid)
      .slice(0, count);

    console.log(`[scrape] ${validContacts.length} valid emails out of ${emailsToValidate.length} checked`);

    // Find the campaign to assign contacts to (first enabled campaign, or FL Insurance)
    let campaignId: string | undefined;
    try {
      const campaign = await sql`
        SELECT id FROM campaigns WHERE enabled = TRUE ORDER BY created_at ASC LIMIT 1
      `;
      if (campaign.length > 0) campaignId = campaign[0].id as string;
    } catch { /* campaigns table may not exist */ }

    // Add to sequence with campaign assignment
    const { added, skipped } = await addToSequence(validContacts, undefined, campaignId);

    console.log(`[scrape] Added ${added}, skipped ${skipped}`);

    return NextResponse.json({
      found: candidates.length,
      validated: emailsToValidate.length,
      valid: validContacts.length,
      added,
      skipped,
      state: "FL",
    });
  } catch (err) {
    console.error("[scrape]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
