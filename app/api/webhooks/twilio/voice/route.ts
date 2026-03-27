import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/webhooks/twilio/voice — handle outbound and inbound calls
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;
    const direction = formData.get("Direction") as string;
    const callSid = formData.get("CallSid") as string;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.thewolfpackco.com";

    // Outbound call from browser — "To" is the number to dial
    if (to && !to.startsWith("client:")) {
      // Browser is calling a phone number
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${process.env.TWILIO_PHONE_NUMBER}" record="record-from-answer-dual"
        recordingStatusCallback="${baseUrl}/api/webhooks/twilio/recording"
        recordingStatusCallbackMethod="POST"
        action="${baseUrl}/api/webhooks/twilio/voice-status"
        method="POST">
    <Number statusCallback="${baseUrl}/api/webhooks/twilio/voice-status"
            statusCallbackEvent="initiated ringing answered completed"
            statusCallbackMethod="POST">${to}</Number>
  </Dial>
</Response>`;

      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    // Inbound call — someone calling our Twilio number
    if (direction === "inbound" || from) {
      console.log(`[voice] Inbound call from ${from}`);

      // Look up contact
      const workspace = await sql`
        SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1
      `;

      if (workspace.length > 0) {
        // Log inbound call
        let contact = await sql`
          SELECT * FROM contacts WHERE workspace_id = ${workspace[0].id} AND phone = ${from} LIMIT 1
        `;

        if (contact.length === 0) {
          contact = await sql`
            INSERT INTO contacts (workspace_id, phone, source)
            VALUES (${workspace[0].id}, ${from}, 'phone')
            RETURNING *
          `;
        }

        await sql`
          INSERT INTO calls (workspace_id, contact_id, direction, from_number, to_number, status)
          VALUES (${workspace[0].id}, ${contact[0].id}, 'inbound', ${from}, ${to || process.env.TWILIO_PHONE_NUMBER}, 'ringing')
        `;
      }

      // Ring all connected browser clients, then voicemail
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20" record="record-from-answer-dual"
        recordingStatusCallback="${baseUrl}/api/webhooks/twilio/recording"
        recordingStatusCallbackMethod="POST"
        action="${baseUrl}/api/webhooks/twilio/voice-status"
        method="POST">
    <Client>crm-agent</Client>
  </Dial>
  <Say>Sorry, no one is available right now. Please leave a message after the beep.</Say>
  <Record maxLength="120"
          recordingStatusCallback="${baseUrl}/api/webhooks/twilio/recording"
          recordingStatusCallbackMethod="POST" />
</Response>`;

      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    // Default — empty response
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  } catch (err) {
    console.error("[voice] Webhook error:", err);
    return new Response("<Response><Say>An error occurred. Please try again later.</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
