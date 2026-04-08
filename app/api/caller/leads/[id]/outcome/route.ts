import { NextRequest, NextResponse } from "next/server";
import { reportOutcome } from "@/lib/caller/lead-queue";

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const token = process.env.CALLER_API_TOKEN;
  if (!token) return false;
  return auth === `Bearer ${token}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { outcome, durationSeconds, transcript, demoTime, retellCallId } = body;

    if (!outcome) {
      return NextResponse.json(
        { error: "outcome is required" },
        { status: 400 }
      );
    }

    const validOutcomes = [
      "demo_booked",
      "not_interested",
      "voicemail",
      "hung_up",
      "no_answer",
      "callback",
      "error",
    ];
    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(", ")}` },
        { status: 400 }
      );
    }

    await reportOutcome(id, outcome, {
      durationSeconds,
      transcript,
      demoTime,
      retellCallId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[caller/leads/outcome] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
