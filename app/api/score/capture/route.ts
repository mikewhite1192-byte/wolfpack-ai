import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { email, name, phone, url, score, grade, type } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Create table if it doesn't exist (self-migrating)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS score_leads (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        url TEXT,
        score INTEGER,
        grade TEXT,
        type TEXT DEFAULT 'website',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Insert lead
    await db.execute(sql`
      INSERT INTO score_leads (email, name, phone, url, score, grade, type)
      VALUES (${email}, ${name || null}, ${phone || null}, ${url || null}, ${score || null}, ${grade || null}, ${type || "website"})
    `);

    // ── Create contact + deal in owner's pipeline ──
    try {
      const ws = await db.execute(sql`SELECT id FROM workspaces WHERE owner_email = 'info@thewolfpackco.com' OR name ILIKE '%wolf%' LIMIT 1`);
      if (ws.rows.length > 0) {
        const workspaceId = ws.rows[0].id as string;
        const firstName = name ? name.split(" ")[0] : null;
        const lastName = name ? name.split(" ").slice(1).join(" ") || null : null;
        const cleanPhone = phone ? (phone.replace(/\D/g, "").length === 10 ? "+1" + phone.replace(/\D/g, "") : "+" + phone.replace(/\D/g, "")) : null;
        const sourceDetail = type === "gbp" ? `GBP Score: ${grade} (${score}/100)` : `Website Score: ${grade} (${score}/100)`;

        const existing = await db.execute(sql`
          SELECT id FROM contacts WHERE workspace_id = ${workspaceId} AND email = ${email} LIMIT 1
        `);

        if (existing.rows.length === 0) {
          const contact = await db.execute(sql`
            INSERT INTO contacts (workspace_id, first_name, last_name, email, phone, source, source_detail)
            VALUES (${workspaceId}, ${firstName}, ${lastName}, ${email}, ${cleanPhone}, 'landing_page', ${sourceDetail})
            RETURNING id
          `);
          const firstStage = await db.execute(sql`SELECT id FROM pipeline_stages WHERE workspace_id = ${workspaceId} ORDER BY position ASC LIMIT 1`);
          if (firstStage.rows.length > 0 && contact.rows.length > 0) {
            await db.execute(sql`
              INSERT INTO deals (workspace_id, contact_id, stage_id, title)
              VALUES (${workspaceId}, ${contact.rows[0].id}, ${firstStage.rows[0].id}, ${`${type === "gbp" ? "GBP" : "Website"} Score Lead - ${name || email}`})
            `);
          }
        }
      }
    } catch (pipelineErr) {
      console.error("[score/capture] Pipeline insert error (non-fatal):", pipelineErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
