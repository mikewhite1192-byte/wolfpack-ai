import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { syncAllConfigured, syncWorkspace } from "@/lib/finance/mercury/sync";
import type { MercuryWorkspace } from "@/lib/finance/mercury/types";

const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

// POST /api/finance/mercury/sync
// Body: { workspace?: 'business' | 'personal' | 'all', trigger?: 'initial' | 'manual', sinceDays?: number }
// Triggers a manual sync. On the first run use `trigger: 'initial'` to pull
// the full available history (sinceDays defaults to 730).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const workspace = (body.workspace ?? "all") as MercuryWorkspace | "all";
  const trigger = (body.trigger ?? "manual") as "initial" | "manual";
  const sinceDays = typeof body.sinceDays === "number" ? body.sinceDays : undefined;

  if (workspace === "all") {
    const results = await syncAllConfigured({ trigger, sinceDays });
    return NextResponse.json({ ok: true, results });
  }

  const result = await syncWorkspace(workspace, { trigger, sinceDays });
  return NextResponse.json({ ok: true, result });
}
