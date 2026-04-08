import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com"];

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) return null;
  return email;
}

// Ensure the settings table exists (lightweight — runs on first call)
async function ensureSettingsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS upwork_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

// GET /api/upwork/settings
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureSettingsTable();

  const rows = await sql`SELECT key, value FROM upwork_settings`;
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({
    feed_urls: settings.feed_urls ? JSON.parse(settings.feed_urls) : [],
    auto_poll: settings.auto_poll === "true",
    min_score_threshold: parseInt(settings.min_score_threshold || "7"),
  });
}

// PATCH /api/upwork/settings
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureSettingsTable();

  const body = await req.json();

  if (body.feed_urls !== undefined) {
    const urls = Array.isArray(body.feed_urls) ? body.feed_urls : [];
    await sql`
      INSERT INTO upwork_settings (key, value, updated_at)
      VALUES ('feed_urls', ${JSON.stringify(urls)}, now())
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(urls)}, updated_at = now()
    `;
  }

  if (body.auto_poll !== undefined) {
    await sql`
      INSERT INTO upwork_settings (key, value, updated_at)
      VALUES ('auto_poll', ${String(body.auto_poll)}, now())
      ON CONFLICT (key) DO UPDATE SET value = ${String(body.auto_poll)}, updated_at = now()
    `;
  }

  if (body.min_score_threshold !== undefined) {
    await sql`
      INSERT INTO upwork_settings (key, value, updated_at)
      VALUES ('min_score_threshold', ${String(body.min_score_threshold)}, now())
      ON CONFLICT (key) DO UPDATE SET value = ${String(body.min_score_threshold)}, updated_at = now()
    `;
  }

  return NextResponse.json({ ok: true });
}
