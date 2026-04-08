import { NextRequest, NextResponse } from "next/server";
import { getNextLead } from "@/lib/caller/lead-queue";

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const token = process.env.CALLER_API_TOKEN;
  if (!token) return false;
  return auth === `Bearer ${token}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { lead, reason } = await getNextLead();

    if (!lead) {
      const messages: Record<string, string> = {
        spacing: "Too soon — wait at least 5 minutes between calls",
        outside_hours: "Outside calling window (8am-5pm local time)",
        empty: "No pending leads in queue",
      };
      return NextResponse.json(
        { error: messages[reason ?? "empty"], reason },
        { status: 204 }
      );
    }

    return NextResponse.json({ lead });
  } catch (err) {
    console.error("[caller/leads/next] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
