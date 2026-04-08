import { NextRequest, NextResponse } from "next/server";
import { importLeads } from "@/lib/caller/lead-queue";

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const callerToken = process.env.CALLER_API_TOKEN;
  const cronSecret = process.env.CRON_SECRET;

  if (callerToken && auth === `Bearer ${callerToken}`) return true;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { leads } = body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "leads array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate each lead has a phone number
    for (const lead of leads) {
      if (!lead.phone) {
        return NextResponse.json(
          { error: "Each lead must have a phone number" },
          { status: 400 }
        );
      }
    }

    const result = await importLeads(leads);

    return NextResponse.json({
      success: true,
      imported: result.imported,
      total: result.total,
    });
  } catch (err) {
    console.error("[caller/leads/import] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
