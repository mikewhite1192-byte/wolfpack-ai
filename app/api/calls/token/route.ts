import { NextResponse } from "next/server";
import twilio from "twilio";
import { getOrCreateWorkspace } from "@/lib/workspace";

// GET /api/calls/token — generate Twilio Voice capability token for browser
export async function GET() {
  try {
    // Require authenticated workspace (Clerk auth via middleware)
    const workspace = await getOrCreateWorkspace();
    const userId = workspace.id;

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity: userId }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    return NextResponse.json({ token: token.toJwt() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
