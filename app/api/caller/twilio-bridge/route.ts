import { NextResponse } from "next/server";

// POST /api/caller/twilio-bridge — Twilio webhook for inbound bridge calls
// When the Android app dials the Twilio bridge number, Twilio hits this endpoint.
// We respond with TwiML that connects the call to a WebSocket stream for Retell AI.

const BACKEND_WS_URL = process.env.CALLER_WS_URL || "wss://thewolfpack.ai/api/caller/ws";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;

    console.log(`[twilio-bridge] Incoming bridge call: ${callSid} from=${from} to=${to}`);

    // Respond with TwiML that streams audio to our WebSocket backend
    // This connects the Twilio leg to the Retell AI processing pipeline
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${BACKEND_WS_URL}">
      <Parameter name="callSid" value="${callSid}" />
    </Stream>
  </Connect>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[twilio-bridge] Error:", err);
    // Return a simple TwiML response that keeps the call alive
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please hold.</Say>
  <Pause length="60" />
</Response>`;
    return new NextResponse(fallback, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
