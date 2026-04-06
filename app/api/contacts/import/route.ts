import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

function toE164(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (phone.startsWith("+")) return phone;
  return "+" + digits;
}

// POST /api/contacts/import — parse CSV and preview
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const { action } = Object.fromEntries(new URL(req.url).searchParams);

    if (action === "preview") {
      // Parse CSV and return headers + sample rows for mapping
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });

      // Parse CSV (handle quoted fields)
      const parseCSVLine = (line: string): string[] => {
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
      };

      const headers = parseCSVLine(lines[0]);
      const sampleRows = lines.slice(1, 6).map(l => parseCSVLine(l));

      return NextResponse.json({ headers, sampleRows, totalRows: lines.length - 1 });
    }

    if (action === "execute") {
      // Execute import with field mapping
      const { rows, mapping, aiEnabled, listId } = await req.json();
      // mapping: { firstName: 0, lastName: 1, email: 2, phone: 3, company: 4, source: 5 }
      // rows: string[][]

      if (!rows || !mapping) return NextResponse.json({ error: "rows and mapping required" }, { status: 400 });

      const firstStage = await sql`
        SELECT id FROM pipeline_stages WHERE workspace_id = ${workspace.id} ORDER BY position ASC LIMIT 1
      `;
      const stageId = firstStage[0]?.id;

      let imported = 0;
      let skipped = 0;
      let errors = 0;
      const errorRows: Array<{ row: number; reason: string }> = [];

      for (const row of rows) {
        try {
          const firstName = mapping.firstName !== undefined ? (row[mapping.firstName] || "").trim() : null;
          const lastName = mapping.lastName !== undefined ? (row[mapping.lastName] || "").trim() : null;
          const email = mapping.email !== undefined ? (row[mapping.email] || "").trim().toLowerCase() : null;
          const rawPhone = mapping.phone !== undefined ? (row[mapping.phone] || "").trim() : null;
          const phone = rawPhone ? toE164(rawPhone) : null;
          const company = mapping.company !== undefined ? (row[mapping.company] || "").trim() : null;
          const source = mapping.source !== undefined ? (row[mapping.source] || "").trim() : "import";

          if (!firstName && !lastName && !email && !phone) { skipped++; continue; }

          // Dedup
          if (phone || email) {
            const dupe = await sql`
              SELECT id FROM contacts
              WHERE workspace_id = ${workspace.id}
                AND ((${phone}::text IS NOT NULL AND phone = ${phone}) OR (${email}::text IS NOT NULL AND email = ${email}))
              LIMIT 1
            `;
            if (dupe.length > 0) { skipped++; continue; }
          }

          const contact = await sql`
            INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, company, source, list_id)
            VALUES (${workspace.id}, ${firstName}, ${lastName}, ${email}, ${phone}, ${company}, ${source || "import"}, ${listId || null})
            RETURNING *
          `;

          // Create deal
          if (stageId) {
            await sql`
              INSERT INTO deals (workspace_id, contact_id, stage_id, title)
              VALUES (${workspace.id}, ${contact[0].id}, ${stageId}, ${(firstName || "") + " " + (lastName || "") + " — Import"})
            `;
          }

          // Create conversation + enable AI if requested
          if (phone && aiEnabled) {
            await sql`
              INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled)
              VALUES (${workspace.id}, ${contact[0].id}, 'sms', 'open', TRUE)
            `;
            await sql`
              UPDATE contacts SET ai_next_followup = NOW(), ai_followup_count = 0
              WHERE id = ${contact[0].id}
            `;
          }

          imported++;
        } catch (rowErr) {
          errors++;
          errorRows.push({ row: rows.indexOf(row) + 1, reason: rowErr instanceof Error ? rowErr.message : "Unknown error" });
        }
      }

      return NextResponse.json({ imported, skipped, errors, total: rows.length, errorRows: errorRows.slice(0, 20) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
