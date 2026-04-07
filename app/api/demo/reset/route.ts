import { NextResponse } from "next/server";

// Demo reset is DISABLED — this endpoint previously wiped all workspace data
// on sign-out, which caused production data loss. Removed permanently.
export async function POST() {
  return NextResponse.json({ success: true, message: "Demo reset disabled" });
}
