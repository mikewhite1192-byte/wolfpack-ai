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

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
