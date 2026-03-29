import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const SES_REGION = process.env.AWS_SES_REGION || "us-east-1";
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "";
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const FROM_EMAIL = process.env.OUTREACH_FROM_EMAIL || "hello@getwolfpack.com";
const FROM_NAME = process.env.OUTREACH_FROM_NAME || "Wolf Pack AI";

// Send email via AWS SES v2 API
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  contactId: string,
  step: number,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Use AWS SDK
    const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2");

    const client = new SESv2Client({
      region: SES_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_KEY,
      },
    });

    const command = new SendEmailCommand({
      FromEmailAddress: `${FROM_NAME} <${FROM_EMAIL}>`,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: htmlBody, Charset: "UTF-8" },
          },
        },
      },
    });

    const result = await client.send(command);
    const messageId = result.MessageId || null;

    // Log the sent email
    await sql`
      INSERT INTO outreach_emails (contact_id, step, subject, body, ses_message_id, status)
      VALUES (${contactId}, ${step}, ${subject}, ${htmlBody}, ${messageId}, 'sent')
    `;

    return { success: true, messageId: messageId || undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[outreach] Failed to send to ${to}:`, msg);

    // Log the failure
    await sql`
      INSERT INTO outreach_emails (contact_id, step, subject, body, status)
      VALUES (${contactId}, ${step}, ${subject}, ${htmlBody}, 'failed')
    `;

    return { success: false, error: msg };
  }
}

// Get email template for a step, with variable substitution
export async function getTemplate(step: number, contact: Record<string, unknown>): Promise<{ subject: string; body: string }> {
  const templates = await sql`
    SELECT subject, body FROM outreach_templates WHERE step = ${step} LIMIT 1
  `;

  if (templates.length === 0) {
    return getDefaultTemplate(step, contact);
  }

  let { subject, body } = templates[0] as { subject: string; body: string };

  // Variable substitution
  const vars: Record<string, string> = {
    "{{firstName}}": (contact.first_name as string) || "there",
    "{{lastName}}": (contact.last_name as string) || "",
    "{{company}}": (contact.company as string) || "your agency",
    "{{state}}": (contact.state as string) || "",
    "{{unsubscribeUrl}}": `https://thewolfpack.ai/api/outreach/unsubscribe?email=${encodeURIComponent(contact.email as string)}`,
  };

  for (const [key, val] of Object.entries(vars)) {
    subject = subject.replaceAll(key, val);
    body = body.replaceAll(key, val);
  }

  return { subject, body };
}

function getDefaultTemplate(step: number, contact: Record<string, unknown>): { subject: string; body: string } {
  const firstName = (contact.first_name as string) || "there";
  const unsubUrl = `https://thewolfpack.ai/api/outreach/unsubscribe?email=${encodeURIComponent(contact.email as string)}`;

  const templates: Record<number, { subject: string; body: string }> = {
    1: {
      subject: "Your leads are texting back in 3 seconds",
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
        <p>Hey ${firstName},</p>
        <p>Quick question. When a lead comes in from one of your campaigns, how long does it take someone on your team to respond?</p>
        <p>Most agents I talk to say anywhere from 30 minutes to a few hours. Some are honest and say "next day."</p>
        <p>We built an AI sales agent that texts your leads back in 3 seconds. It qualifies them, handles objections, and books appointments on your calendar. All through iMessage so it actually gets delivered.</p>
        <p>It runs 24/7. It never forgets a follow-up. And it costs less than a part-time assistant.</p>
        <p><a href="https://thewolfpack.ai" style="color: #E86A2A; font-weight: bold;">See how it works →</a></p>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Wolf Pack AI | <a href="${unsubUrl}" style="color: #999;">Unsubscribe</a>
        </p>
      </div>`,
    },
    2: {
      subject: "The math on missed leads",
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
        <p>Hey ${firstName},</p>
        <p>78% of customers buy from whoever responds first.</p>
        <p>If you're responding to leads in 30+ minutes, you're losing 4 out of 5 before you even start the conversation.</p>
        <p>Our AI responds in seconds. Not minutes. Seconds. And it doesn't just say "thanks for reaching out." It runs a full sales conversation, qualifies the lead, handles their objections, and books them on your calendar.</p>
        <p>Insurance agents using it are booking 3x more appointments without hiring anyone.</p>
        <p><a href="https://thewolfpack.ai/demo" style="color: #E86A2A; font-weight: bold;">Try the live demo (it'll text you) →</a></p>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Wolf Pack AI | <a href="${unsubUrl}" style="color: #999;">Unsubscribe</a>
        </p>
      </div>`,
    },
    3: {
      subject: "Last one from me",
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
        <p>Hey ${firstName},</p>
        <p>I know you're busy so I'll keep this short. This is my last email.</p>
        <p>If you've ever lost a lead because you didn't respond fast enough, or had a prospect go cold because nobody followed up, Wolf Pack AI fixes that.</p>
        <p>It starts at $49/month. No contracts. Cancel anytime.</p>
        <p>If the timing isn't right, no hard feelings. But if you want to see what it looks like when every lead gets a response in 3 seconds, the demo takes 60 seconds.</p>
        <p><a href="https://thewolfpack.ai" style="color: #E86A2A; font-weight: bold;">Check it out →</a></p>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          Wolf Pack AI | <a href="${unsubUrl}" style="color: #999;">Unsubscribe</a>
        </p>
      </div>`,
    },
  };

  return templates[step] || templates[1];
}
