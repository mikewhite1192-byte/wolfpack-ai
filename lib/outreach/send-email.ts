import { neon } from "@neondatabase/serverless";
import { getColdSenderAddresses, getColdDailyLimit, getTodayColdSendCount } from "./warmup";
import type { WarmupAddress } from "./warmup";

const sql = neon(process.env.DATABASE_URL!);

const SIGNATURE = "\nMike, The Wolf Pack AI";

// Rotating intros when we don't have a real first name
const INTROS = ["Hey there", "Hi", "Hey", "Quick question"];
function getIntro(contactId: string): string {
  // Use contact ID to deterministically pick an intro (same contact always gets same intro)
  let hash = 0;
  for (let i = 0; i < contactId.length; i++) {
    hash = ((hash << 5) - hash) + contactId.charCodeAt(i);
    hash |= 0;
  }
  return INTROS[Math.abs(hash) % INTROS.length];
}

// Send a cold email via SMTP from a warmup address (plain text, no HTML)
export async function sendColdEmail(
  fromAddress: WarmupAddress,
  to: string,
  subject: string,
  body: string,
  contactId: string,
  step: number,
  inReplyTo?: string,
  references?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: fromAddress.smtp_host,
      port: fromAddress.smtp_port,
      secure: fromAddress.smtp_port === 465,
      auth: {
        user: fromAddress.smtp_user,
        pass: fromAddress.smtp_pass,
      },
    });

    const mailOptions: Record<string, unknown> = {
      from: `${fromAddress.display_name} <${fromAddress.email}>`,
      to,
      subject,
      text: body, // Plain text only — no HTML
    };

    // Same-thread follow-ups
    if (inReplyTo) {
      mailOptions.inReplyTo = inReplyTo;
      mailOptions.references = references || inReplyTo;
      // Prefix subject with Re: for thread continuity
      if (!subject.startsWith("Re:")) {
        mailOptions.subject = `Re: ${subject}`;
      }
    }

    const result = await transporter.sendMail(mailOptions);
    // Normalize: strip angle brackets so SES webhook can match by bare ID
    const rawMessageId = result.messageId || null;
    const messageId = rawMessageId ? rawMessageId.replace(/^<|>$/g, "") : null;

    // Log the sent email
    await sql`
      INSERT INTO outreach_emails (from_email, contact_id, step, subject, body, ses_message_id, status, email_type, message_id_header)
      VALUES (${fromAddress.email}, ${contactId}, ${step}, ${subject}, ${body}, ${messageId}, 'sent', 'cold', ${messageId})
    `;

    return { success: true, messageId: messageId || undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[outreach] Failed to send from ${fromAddress.email} to ${to}:`, msg);

    // Log the failure
    await sql`
      INSERT INTO outreach_emails (from_email, contact_id, step, subject, body, status, email_type)
      VALUES (${fromAddress.email}, ${contactId}, ${step}, ${subject}, ${body}, 'failed', 'cold')
    `;

    return { success: false, error: msg };
  }
}

// Get the first email's Message-ID for a contact (to thread follow-ups)
export async function getThreadMessageId(contactId: string): Promise<{ messageId: string | null; subject: string | null }> {
  const result = await sql`
    SELECT message_id_header, subject FROM outreach_emails
    WHERE contact_id = ${contactId} AND step = 1 AND status = 'sent' AND message_id_header IS NOT NULL
    ORDER BY sent_at ASC LIMIT 1
  `;
  if (result.length === 0) return { messageId: null, subject: null };
  return {
    messageId: result[0].message_id_header as string,
    subject: result[0].subject as string,
  };
}

// Pick the best cold sender address (one with most remaining daily capacity)
export async function pickSenderAddress(): Promise<WarmupAddress | null> {
  const addresses = await getColdSenderAddresses();
  let best: WarmupAddress | null = null;
  let bestRemaining = 0;

  for (const addr of addresses) {

    const limit = getColdDailyLimit(addr);
    const sent = await getTodayColdSendCount(addr.email);
    const remaining = limit - sent;

    if (remaining > bestRemaining) {
      best = addr;
      bestRemaining = remaining;
    }
  }

  return best;
}

// Get email template for a step, with variable substitution (plain text)
export async function getTemplate(step: number, contact: Record<string, unknown>): Promise<{ subject: string; body: string }> {
  const templates = await sql`
    SELECT subject, body FROM outreach_templates WHERE step = ${step} LIMIT 1
  `;

  if (templates.length === 0) {
    return getDefaultTemplate(step, contact);
  }

  let { subject, body } = templates[0] as { subject: string; body: string };

  // Variable substitution
  const city = (contact.city as string) || (() => {
    const addr = (contact.address as string) || "";
    const parts = addr.split(",").map((s: string) => s.trim());
    return parts.length >= 2 ? parts[parts.length - 2] || "" : "";
  })();
  const reviewCount = String((contact.review_count as number) || "");
  const contactId = (contact.id as string) || "";
  const firstName = (contact.first_name as string) || "";
  const intro = firstName || getIntro(contactId);
  const vars: Record<string, string> = {
    "{{firstName}}": intro,
    "{{first_name}}": intro,
    "{{lastName}}": (contact.last_name as string) || "",
    "{{company}}": (contact.company as string) || "your business",
    "{{business_name}}": (contact.company as string) || "your business",
    "{{state}}": (contact.state as string) || "",
    "{{city}}": city || "your area",
    "{{review_count}}": reviewCount,
    "{{contractor_type}}": (contact.niche as string) || "contractor",
    "{{niche}}": (contact.niche as string) || "contractor",
  };

  for (const [key, val] of Object.entries(vars)) {
    subject = subject.replaceAll(key, val);
    body = body.replaceAll(key, val);
  }

  return { subject, body };
}

// 4-touch plain text sequence — no links, no HTML, short and conversational
function getDefaultTemplate(step: number, contact: Record<string, unknown>): { subject: string; body: string } {
  const contactId = (contact.id as string) || "";
  const firstName = (contact.first_name as string) || getIntro(contactId);

  const templates: Record<number, { subject: string; body: string }> = {
    // Email 1 (Day 1) — Main hook
    1: {
      subject: `quick question ${firstName}`,
      body: `Hey ${firstName},

Quick question — are your follow-ups still going through SMS or have you moved away from A2P yet?

We built something that handles lead follow-up instantly without touching A2P at all. Curious if that's even on your radar.

${SIGNATURE}`,
    },
    // Email 2 (Day 3-4) — Light bump, same thread
    2: {
      subject: `quick question ${firstName}`,
      body: `Hey ${firstName},

Just wanted to bump this — curious how you're handling follow-ups right now.

${SIGNATURE}`,
    },
    // Email 3 (Day 7-9) — New angle, same thread
    3: {
      subject: `quick question ${firstName}`,
      body: `Hey ${firstName},

Most agents we've talked to are losing deals just from slow follow-up — have you found a way around that?

${SIGNATURE}`,
    },
    // Email 4 (Day 12-15) — Pattern interrupt / close loop, same thread
    4: {
      subject: `quick question ${firstName}`,
      body: `Hey ${firstName},

Not sure if this is relevant right now — should I close this out or is follow-up something you're still trying to improve?

${SIGNATURE}`,
    },
  };

  return templates[step] || templates[1];
}
