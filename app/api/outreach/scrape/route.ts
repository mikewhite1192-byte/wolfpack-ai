import { NextRequest, NextResponse } from "next/server";
import { validateEmails } from "@/lib/outreach/validate-email";
import { addToSequence } from "@/lib/outreach/sequence";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Florida DOI bulk download URL
const FL_INDIVIDUAL_CSV = "https://www.myfloridacfo.com/downloads/AAS/LicenseeSearch/AllValidLicensesIndividual.csv";

// License types we want (insurance agents, not adjusters)
const TARGET_LICENSE_TYPES = [
  "GENERAL LINES (PROP & CAS)",
  "LIFE INCL VAR ANNUITY & HEALTH",
  "LIFE INCLUDING VARIABLE ANNUITY",
  "HEALTH",
  "PERSONAL LINES",
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

// POST /api/outreach/scrape — pull insurance agents from Florida DOI
export async function POST(req: NextRequest) {
  try {
    const { count = 30, state = "FL" } = await req.json();

    console.log(`[scrape] Starting Florida DOI scrape for ${count} contacts`);

    // Download the CSV (stream it, don't load 318MB into memory)
    const response = await fetch(FL_INDIVIDUAL_CSV);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to download Florida DOI data" }, { status: 500 });
    }

    const text = await response.text();
    const lines = text.split("\n");
    const headers = parseCSVLine(lines[0]);

    // Find column indices
    const colIdx = {
      firstName: headers.indexOf("First Name"),
      lastName: headers.indexOf("Last Name"),
      email: headers.indexOf("Email Address"),
      phone: headers.indexOf("Business Phone"),
      company: headers.indexOf("Business Address1"),
      city: headers.indexOf("Business City"),
      state: headers.indexOf("Business State"),
      licenseType: headers.indexOf("License TYCL Desc"),
      licenseNumber: headers.indexOf("License Number"),
    };

    // Get existing emails to avoid re-processing
    const existing = await sql`SELECT email FROM outreach_contacts`;
    const existingEmails = new Set(existing.map(r => (r.email as string).toLowerCase()));

    // Process lines, filter for target license types, dedupe
    const candidates: { email: string; firstName: string; lastName: string; company: string; state: string; licenseNumber: string }[] = [];
    const seenEmails = new Set<string>();

    for (let i = 1; i < lines.length && candidates.length < count * 3; i++) {
      if (!lines[i].trim()) continue;
      const row = parseCSVLine(lines[i]);

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
    }

    console.log(`[scrape] Found ${candidates.length} candidates after filtering`);

    // Validate emails
    const emailsToValidate = candidates.slice(0, count * 2).map(c => c.email);
    const validationResults = await validateEmails(emailsToValidate);

    // Filter to valid only, take up to `count`
    const validContacts = candidates
      .filter(c => validationResults.get(c.email)?.valid)
      .slice(0, count);

    console.log(`[scrape] ${validContacts.length} valid emails out of ${emailsToValidate.length} checked`);

    // Add to sequence
    const { added, skipped } = await addToSequence(validContacts);

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
