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

  const signature = `
    <table cellpadding="0" cellspacing="0" style="margin-top: 28px; border-top: 1px solid #eee; padding-top: 16px;">
      <tr>
        <td style="padding-right: 14px; vertical-align: top;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #F97316, #E86A2A); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 18px; font-family: Arial, sans-serif; text-align: center; line-height: 48px;">M</div>
        </td>
        <td style="vertical-align: top;">
          <div style="font-weight: 700; color: #222; font-size: 14px; font-family: Arial, sans-serif;">Michael White</div>
          <div style="color: #888; font-size: 12px; font-family: Arial, sans-serif;">Founder, Wolf Pack AI</div>
          <div style="margin-top: 4px;">
            <a href="https://thewolfpack.ai" style="color: #E86A2A; font-size: 12px; font-family: Arial, sans-serif; text-decoration: none;">thewolfpack.ai</a>
          </div>
        </td>
      </tr>
    </table>`;

  const footer = `
    <p style="color: #bbb; font-size: 10px; margin-top: 32px; line-height: 1.5; font-family: Arial, sans-serif;">
      Wolf Pack AI, 1950 S Rochester Rd #1217, Rochester Hills MI 48307<br>
      <a href="${unsubUrl}" style="color: #bbb; text-decoration: underline;">Unsubscribe</a>
    </p>`;

  const wrap = (content: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.7; font-size: 14px;">
      ${content}
      ${signature}
      ${footer}
    </div>`;

  const templates: Record<number, { subject: string; body: string }> = {
    1: {
      subject: `can I show you something weird ${firstName}?`,
      body: wrap(`
        <p>Hey ${firstName},</p>
        <p>I want to show you something weird.</p>
        <p>Go to this link and enter your phone number:</p>
        <p><a href="https://thewolfpack.ai/try" style="color: #E86A2A; font-weight: bold; font-size: 15px;">thewolfpack.ai/try</a></p>
        <p>An AI is going to text you pretending to be an insurance agent. Play along for 60 seconds.</p>
        <p>I promise it's worth it.</p>
      `),
    },
    2: {
      subject: `did you try it ${firstName}?`,
      body: wrap(`
        <p>Hey ${firstName},</p>
        <p>Following up. Did you get a chance to try it?</p>
        <p>Here's what happens when you enter your number at <a href="https://thewolfpack.ai/try" style="color: #E86A2A; font-weight: bold;">thewolfpack.ai/try</a>:</p>
        <p>An AI texts you back in 3 seconds pretending to be an insurance agent. It qualifies you, handles your responses, and feels completely real.</p>
        <p>Then it reveals itself.</p>
        <p>That reveal moment is what your leads would experience. Except instead of selling them on Wolf Pack AI, it's selling them on your business. 24/7. Without you lifting a finger.</p>
        <p>Insurance agents, mortgage brokers, and real estate agents are using it right now to never miss a lead again.</p>
        <p><a href="https://thewolfpack.ai/try" style="color: #E86A2A; font-weight: bold;">30 seconds to see it</a></p>
      `),
    },
    3: {
      subject: `closing your file ${firstName}`,
      body: wrap(`
        <p>Hey ${firstName},</p>
        <p>Last one from me.</p>
        <p>I'll be straight with you. I built an AI that texts your leads in 3 seconds, qualifies them like a real agent would, and books appointments on your calendar while you sleep.</p>
        <p>The best way to understand it isn't to read about it.</p>
        <p>It's to experience it yourself.</p>
        <p>Enter your number, play along for 60 seconds, and see exactly what your leads would feel the moment they reach out to you.</p>
        <p><a href="https://thewolfpack.ai/try" style="color: #E86A2A; font-weight: bold; font-size: 15px;">thewolfpack.ai/try</a></p>
        <p>No signup. No credit card. Just your phone number.</p>
        <p>Either way, good luck out there ${firstName}.</p>
      `),
    },
  };

  return templates[step] || templates[1];
}
