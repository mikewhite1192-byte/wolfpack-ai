import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendSMS(to: string, body: string, from?: string): Promise<string | null> {
  try {
    const message = await client.messages.create({
      to,
      from: from || process.env.TWILIO_PHONE_NUMBER!,
      body,
    });
    return message.sid;
  } catch (err) {
    console.error("[twilio] Send SMS error:", err);
    return null;
  }
}

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean {
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  );
}
