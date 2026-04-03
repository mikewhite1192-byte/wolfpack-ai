import { NextResponse } from "next/server";
import { getGbpAuthUrl } from "@/lib/gbp";
import { getOrCreateWorkspace } from "@/lib/workspace";

// GET /api/gbp/connect — redirect to Google OAuth for GBP
export async function GET() {
  const workspace = await getOrCreateWorkspace();
  const url = getGbpAuthUrl(workspace.id);
  return NextResponse.redirect(url);
}
