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
  const company = (contact.company as string) || "";
  const unsubUrl = `https://thewolfpack.ai/api/outreach/unsubscribe?email=${encodeURIComponent(contact.email as string)}`;
  const companyLine = company ? ` over at ${company}` : "";

  const templates: Record<number, { subject: string; body: string }> = {
    1: {
      subject: `${firstName}, quick question about your leads`,
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
        <p>Hey ${firstName},</p>
        <p>I saw you're a licensed agent${companyLine} and wanted to ask you something real quick.</p>
        <p>When a lead comes in from one of your campaigns or your website, how fast does someone on your team respond? Most agents I talk to say 30 minutes to a few hours. Some are honest and say next day.</p>
        <p>The problem is 78% of people buy from whoever responds first. So if you're not first, you're losing most of them before the conversation even starts.</p>
        <p>We built something that fixes this. It's an AI that texts your leads back in 3 seconds, qualifies them, handles their objections, and books appointments on your calendar. It runs 24/7 through iMessage so the texts actually get delivered.</p>
        <p>Starts at $49/month. No contracts.</p>
        <p><a href="https://thewolfpack.ai" style="color: #E86A2A; font-weight: bold;">See how it works</a></p>
        <p style="color: #999; font-size: 11px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 12px;">
          Wolf Pack AI, Warren MI 48088<br>
          <a href="${unsubUrl}" style="color: #999;">Unsubscribe</a>
        </p>
      </div>`,
    },
    2: {
      subject: `The numbers on speed to lead`,
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
        <p>Hey ${firstName},</p>
        <p>Wanted to share something I thought you'd find interesting.</p>
        <p>We looked at the data across agents using our system and the ones who respond to leads in under 5 minutes convert at 3x the rate of everyone else. Not 10% better. Three times.</p>
        <p>The problem is no human can respond in under 5 minutes consistently. Especially at 2am when someone's browsing insurance quotes on their phone.</p>
        <p>That's why we built an AI sales agent specifically for insurance. It responds in seconds. It asks the right questions. It handles "I need to think about it" and "what's the price" without getting flustered. And it books the appointment right on your calendar.</p>
        <p>You can try it right now. Enter your phone number on the demo page and the AI will text you. Takes 60 seconds.</p>
        <p><a href="https://thewolfpack.ai/demo" style="color: #E86A2A; font-weight: bold;">Try the live demo</a></p>
        <p style="color: #999; font-size: 11px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 12px;">
          Wolf Pack AI, Warren MI 48088<br>
          <a href="${unsubUrl}" style="color: #999;">Unsubscribe</a>
        </p>
      </div>`,
    },
    3: {
      subject: `Last thing from me, ${firstName}`,
      body: `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
        <p>Hey ${firstName},</p>
        <p>Last email from me. I know you're busy selling policies, not reading emails from strangers.</p>
        <p>Here's the short version. If you've ever lost a deal because you didn't follow up fast enough, or had a lead go cold because life got in the way, this fixes that.</p>
        <p>An AI that texts every lead in seconds, follows up on day 1, 3, 7, and 14 with a different approach each time, and books appointments on your calendar. Through iMessage so it doesn't get filtered like green texts.</p>
        <p>$49/month. Cancel anytime. No setup fee. The AI asks you 9 questions about your business and it's live in minutes.</p>
        <p>If the timing isn't right, no hard feelings. But if you're curious what it looks like when no lead gets left behind, take a look.</p>
        <p><a href="https://thewolfpack.ai" style="color: #E86A2A; font-weight: bold;">Check it out</a></p>
        <p style="color: #999; font-size: 11px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 12px;">
          Wolf Pack AI, Warren MI 48088<br>
          <a href="${unsubUrl}" style="color: #999;">Unsubscribe</a>
        </p>
      </div>`,
    },
  };

  return templates[step] || templates[1];
}
