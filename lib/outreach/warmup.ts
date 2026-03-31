import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Day 25+ steady state: 40 cold + 10 warmup = 50/day per address
const SWITCHOVER_DAY = 25;
const STEADY_COLD = 40;
const STEADY_WARMUP = 10;

// Calculate daily limits for an address based on days since start
// Each day adds 1 cold + 1 warmup (2 more emails per day)
// Day 1: 1 cold + 1 warmup = 2 total
// Day 2: 2 cold + 2 warmup = 4 total
// Day 12: 12 cold + 12 warmup = 24 total
// Day 25+: switches to 40 cold + 10 warmup = 50 total (steady state forever)
export function getDailyLimits(daysSinceStart: number): { total: number; cold: number; warmup: number } {
  const day = Math.max(1, daysSinceStart + 1); // day 1 = first day

  if (day >= SWITCHOVER_DAY) {
    return { total: STEADY_COLD + STEADY_WARMUP, cold: STEADY_COLD, warmup: STEADY_WARMUP };
  }

  // Ramp phase: add 1 cold + 1 warmup per day
  return { total: day * 2, cold: day, warmup: day };
}

export interface WarmupAddress {
  id: string;
  email: string;
  display_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  warmup_started_at: string;
  warmup_completed: boolean;
  cold_outreach_started_at: string | null;
  is_active: boolean;
  cold_sender: boolean;
  imap_host: string | null;
  imap_port: number | null;
  last_polled_at: string | null;
}

// Register a new email address for warmup
export async function addWarmupAddress(address: {
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  coldSender?: boolean;
}): Promise<string> {
  const isColdSender = address.coldSender ?? true;
  const result = await sql`
    INSERT INTO warmup_addresses (email, display_name, smtp_host, smtp_port, smtp_user, smtp_pass, warmup_started_at, warmup_completed, is_active, cold_sender)
    VALUES (${address.email}, ${address.displayName}, ${address.smtpHost}, ${address.smtpPort}, ${address.smtpUser}, ${address.smtpPass}, NOW(), FALSE, TRUE, ${isColdSender})
    ON CONFLICT (email) DO UPDATE SET
      smtp_host = ${address.smtpHost},
      smtp_port = ${address.smtpPort},
      smtp_user = ${address.smtpUser},
      smtp_pass = ${address.smtpPass},
      cold_sender = ${isColdSender},
      is_active = TRUE
    RETURNING id
  `;
  return result[0].id;
}

// Get only addresses that are designated cold senders
export async function getColdSenderAddresses(): Promise<WarmupAddress[]> {
  return await sql`
    SELECT * FROM warmup_addresses
    WHERE is_active = TRUE AND cold_sender = TRUE
    ORDER BY warmup_started_at ASC
  ` as unknown as WarmupAddress[];
}

// Get all active warmup addresses
export async function getWarmupAddresses(): Promise<WarmupAddress[]> {
  return await sql`
    SELECT * FROM warmup_addresses WHERE is_active = TRUE ORDER BY warmup_started_at ASC
  ` as unknown as WarmupAddress[];
}

function getDaysSinceStart(address: WarmupAddress): number {
  const started = new Date(address.warmup_started_at);
  const now = new Date();
  return Math.floor((now.getTime() - started.getTime()) / (1000 * 60 * 60 * 24));
}

// Get cold email daily limit for an address
export function getColdDailyLimit(address: WarmupAddress): number {
  if (!address.cold_sender) return 0;
  const days = getDaysSinceStart(address);
  return getDailyLimits(days).cold;
}

// Get warmup email daily limit for an address
export function getWarmupDailyLimit(address: WarmupAddress): number {
  const days = getDaysSinceStart(address);
  return getDailyLimits(days).warmup;
}

// Get how many cold emails this address has sent today
export async function getTodayColdSendCount(email: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count FROM outreach_emails
    WHERE from_email = ${email}
      AND sent_at >= CURRENT_DATE
      AND email_type = 'cold'
  `;
  return parseInt(result[0].count);
}

// Get how many warmup emails this address has sent today
export async function getTodayWarmupSendCount(email: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count FROM outreach_emails
    WHERE from_email = ${email}
      AND sent_at >= CURRENT_DATE
      AND email_type IN ('warmup', 'warmup_reply')
  `;
  return parseInt(result[0].count);
}

// Generate warmup email content using Haiku
async function generateWarmupEmail(fromName: string, toName: string, isReply: boolean, previousBody?: string): Promise<{ subject: string; body: string }> {
  try {
    const prompt = isReply
      ? `You are ${fromName} replying to a casual work email from ${toName}. Here's what they said:\n\n"${previousBody}"\n\nWrite a short, natural reply (1-3 sentences). Sound like a real person texting a coworker. No emojis. End with just your first name, no signature block.\n\nReturn ONLY the reply text, nothing else.`
      : `You are ${fromName} sending a casual work email to ${toName}. Write a short, natural email (2-4 sentences) about a random everyday work topic — project updates, meeting times, quick questions, sharing an article, weekend plans, etc. Make it sound like two real coworkers chatting. No emojis. No links. End with just your first name.\n\nAlso generate a short casual subject line (2-4 words).\n\nFormat:\nSUBJECT: <subject>\nBODY: <body>`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.find(b => b.type === "text");
    const raw = text && "text" in text ? text.text : "";

    if (isReply) {
      return { subject: "", body: raw.trim() };
    }

    const subjectMatch = raw.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = raw.match(/BODY:\s*([\s\S]+)/i);

    return {
      subject: subjectMatch?.[1]?.trim() || WARMUP_SUBJECTS[Math.floor(Math.random() * WARMUP_SUBJECTS.length)],
      body: bodyMatch?.[1]?.trim() || WARMUP_BODIES[Math.floor(Math.random() * WARMUP_BODIES.length)],
    };
  } catch (err) {
    console.error("[warmup] Haiku generation failed, using static fallback:", err);
    return getWarmupEmail();
  }
}

// Static fallback subjects/bodies
const WARMUP_SUBJECTS = [
  "Quick question", "Thoughts on this?", "Following up", "Hey, real quick",
  "One more thing", "Checking in", "Did you see this?", "Re: our conversation",
  "Meeting notes", "Update on the project", "Heads up", "Touching base",
  "Can you take a look?", "FYI", "Just wanted to share", "Running behind today",
  "Thanks for earlier", "About tomorrow", "Quick update", "Got a sec?",
];

const WARMUP_BODIES = [
  "Hey, just wanted to check in and see how things are going on your end. Let me know if you need anything.\n\nMike",
  "Quick question — did you get a chance to look at that thing I mentioned? No rush, just curious.\n\nMike",
  "Wanted to follow up on our last conversation. I think we're on the right track. What do you think?\n\nMike",
  "Hey, hope your week is going well. Just touching base — anything new on your end?\n\nMike",
  "Got your message. Makes sense to me. Let's circle back on this tomorrow if you're free.\n\nMike",
  "Thanks for the heads up on that. I'll take a look and get back to you.\n\nMike",
  "Just saw your note. Good call on that approach. Let me know how it goes.\n\nMike",
  "Hey — running a bit behind today but wanted to make sure I responded. I'll have more details later this afternoon.\n\nMike",
  "Appreciate you sending that over. I'll review it and follow up with any questions.\n\nMike",
  "Sounds good to me. Let's plan on touching base again next week.\n\nMike",
  "Just wanted to loop back on this. Have you had any updates since we last talked?\n\nMike",
  "Good point. I hadn't thought of it that way. Let me think on it and get back to you.\n\nMike",
  "Hey, just a quick note — I'll be out of pocket for a bit this afternoon but will catch up later tonight.\n\nMike",
  "That works for me. I'll block off some time on my end. Talk soon.\n\nMike",
  "Quick update on my end — things are moving along. I'll send you a more detailed update soon.\n\nMike",
];

export function getWarmupEmail(): { subject: string; body: string } {
  const subject = WARMUP_SUBJECTS[Math.floor(Math.random() * WARMUP_SUBJECTS.length)];
  const body = WARMUP_BODIES[Math.floor(Math.random() * WARMUP_BODIES.length)];
  return { subject, body };
}

// Send a warmup email via SMTP (nodemailer)
export async function sendWarmupEmail(
  from: WarmupAddress,
  toEmail: string,
  subject: string,
  body: string,
  inReplyTo?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: from.smtp_host,
      port: from.smtp_port,
      secure: from.smtp_port === 465,
      auth: {
        user: from.smtp_user,
        pass: from.smtp_pass,
      },
    });

    const mailOptions: Record<string, unknown> = {
      from: `${from.display_name} <${from.email}>`,
      to: toEmail,
      subject,
      text: body,
    };

    if (inReplyTo) {
      mailOptions.inReplyTo = inReplyTo;
      mailOptions.references = inReplyTo;
    }

    const result = await transporter.sendMail(mailOptions);
    const messageId = result.messageId || null;

    await sql`
      INSERT INTO outreach_emails (from_email, contact_id, step, subject, body, status, email_type, ses_message_id)
      VALUES (${from.email}, ${null}, ${0}, ${subject}, ${body}, 'sent', 'warmup', ${messageId})
    `;

    return { success: true, messageId: messageId || undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[warmup] Failed to send from ${from.email} to ${toEmail}:`, msg);
    return { success: false, error: msg };
  }
}

// Run warmup SEND cycle: each address in the batch sends up to 3 warmup emails
// Multiple cron calls per day spread these out naturally
export async function runWarmupSend(batch: number = 0, batchSize: number = 3): Promise<{ sent: number; errors: number }> {
  const allAddresses = await getWarmupAddresses();
  const start = batch * batchSize;
  const addresses = allAddresses.slice(start, start + batchSize);
  let sent = 0;
  let errors = 0;

  const otherAddresses = allAddresses.filter(a => !addresses.find(b => b.email === a.email));
  if (otherAddresses.length === 0 && allAddresses.length > 1) return { sent: 0, errors: 0 };

  for (const addr of addresses) {
    const warmupLimit = getWarmupDailyLimit(addr);
    const todayCount = await getTodayWarmupSendCount(addr.email);
    const remaining = warmupLimit - todayCount;
    if (remaining <= 0) continue;

    // Send up to 3 per cycle (keeps each cron call under 60s)
    const toSend = Math.min(remaining, 3);
    const targets = allAddresses.filter(a => a.email !== addr.email);

    for (let i = 0; i < toSend; i++) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      if (!target) break;

      const fromName = addr.display_name || addr.email.split("@")[0];
      const toName = target.display_name || target.email.split("@")[0];

      const { subject, body } = await generateWarmupEmail(fromName, toName, false);
      const result = await sendWarmupEmail(addr, target.email, subject, body);

      if (result.success) { sent++; } else { errors++; }
    }
  }

  console.log(`[warmup] Send batch ${batch}: ${sent} sent, ${errors} errors`);
  return { sent, errors };
}

// Run warmup REPLY cycle: check ONE address for incoming warmup emails and auto-reply
// Also performs engagement simulation: mark read, mark important, reply
export async function runWarmupReply(batch: number = 0): Promise<{ replied: number; rescued: number; errors: number }> {
  const addresses = await getWarmupAddresses();
  if (batch >= addresses.length) return { replied: 0, rescued: 0, errors: 0 };

  const addr = addresses[batch];
  let replied = 0;
  let rescued = 0;
  let errors = 0;

  try {
    const ourEmails = addresses.map(a => a.email.toLowerCase());
    const { ImapFlow } = await import("imapflow");
    const imapHost = addr.imap_host || addr.smtp_host.replace("smtp.", "imap.");
    const imapPort = addr.imap_port || 993;

    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: addr.smtp_user, pass: addr.smtp_pass },
      logger: false,
    });

    await client.connect();

    // SPAM RESCUE: check spam/junk folder for warmup emails and move to inbox
    try {
      const spamFolders = ["[Gmail]/Spam", "Junk", "INBOX.Junk", "Spam"];
      for (const folder of spamFolders) {
        try {
          const lock = await client.getMailboxLock(folder);
          try {
            const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const messages = client.fetch({ since }, { envelope: true, uid: true });

            for await (const msg of messages) {
              const fromAddr = msg.envelope?.from?.[0]?.address?.toLowerCase() || "";
              // If it's from one of our warmup addresses, rescue it
              if (ourEmails.includes(fromAddr) && fromAddr !== addr.email.toLowerCase()) {
                try {
                  // Mark as read + important
                  await client.messageFlagsAdd(msg.uid, ["\\Seen", "\\Flagged"], { uid: true });
                  // Move to inbox
                  await client.messageMove(msg.uid, "INBOX", { uid: true });
                  rescued++;
                  console.log(`[warmup] Rescued warmup email from ${fromAddr} out of spam for ${addr.email}`);
                } catch { /* folder might not exist */ }
              }
            }
          } finally {
            lock.release();
          }
          break; // Found a spam folder that works
        } catch { /* folder doesn't exist, try next */ }
      }
    } catch (err) {
      console.error(`[warmup] Spam rescue error for ${addr.email}:`, err);
    }

    // INBOX engagement: read, mark important, reply to warmup emails
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const messages = client.fetch({ since }, { envelope: true, source: true, uid: true });

      for await (const msg of messages) {
        const envelope = msg.envelope;
        if (!envelope) continue;

        const fromAddr = envelope.from?.[0]?.address?.toLowerCase() || "";
        const fromName = envelope.from?.[0]?.name || fromAddr.split("@")[0];
        const messageId = envelope.messageId || null;
        const subject = envelope.subject || "";

        if (!ourEmails.includes(fromAddr) || fromAddr === addr.email.toLowerCase()) continue;

        // ENGAGEMENT SIMULATION:
        // 1. Mark as read (always)
        try {
          await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true });
        } catch { /* ok */ }

        // 2. Mark as important/starred (~30% chance)
        if (Math.random() < 0.3) {
          try {
            await client.messageFlagsAdd(msg.uid, ["\\Flagged"], { uid: true });
          } catch { /* ok */ }
        }

        // 3. Archive (move out of inbox to simulate real user behavior)
        try {
          await client.messageMove(msg.uid, "[Gmail]/All Mail", { uid: true });
        } catch { /* ok */ }

        // Check if already replied
        if (messageId) {
          const alreadyReplied = await sql`
            SELECT id FROM outreach_emails
            WHERE email_type = 'warmup_reply' AND ses_message_id = ${messageId} AND from_email = ${addr.email}
            LIMIT 1
          `;
          if (alreadyReplied.length > 0) continue;
        }

        // Parse body
        let originalBody = "";
        if (msg.source) {
          const { simpleParser } = await import("mailparser");
          const parsed = await simpleParser(msg.source);
          originalBody = parsed.text || "";
        }
        if (!originalBody.trim()) continue;

        // ~50% chance to reply (natural behavior)
        if (Math.random() > 0.5) continue;

        const displayName = addr.display_name || addr.email.split("@")[0];
        const reply = await generateWarmupEmail(displayName, fromName, true, originalBody);

        const result = await sendWarmupEmail(
          addr,
          fromAddr,
          subject.startsWith("Re:") ? subject : `Re: ${subject}`,
          reply.body,
          messageId || undefined,
        );

        if (result.success) {
          if (messageId) {
            await sql`
              INSERT INTO outreach_emails (from_email, contact_id, step, subject, body, status, email_type, ses_message_id)
              VALUES (${addr.email}, ${null}, ${0}, ${subject}, ${reply.body}, 'sent', 'warmup_reply', ${messageId})
            `;
          }
          replied++;
        } else {
          errors++;
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error(`[warmup] Reply error for ${addr.email}:`, err);
    errors++;
  }

  if (replied > 0 || rescued > 0) {
    console.log(`[warmup] ${addr.email}: ${replied} replied, ${rescued} rescued from spam`);
  }
  return { replied, rescued, errors };
}

// Legacy wrapper for manual triggers from dashboard
export async function runWarmupCycle(): Promise<{ sent: number; errors: number; replied: number }> {
  const allAddresses = await getWarmupAddresses();
  const batchCount = Math.ceil(allAddresses.length / 3);
  let totalSent = 0;
  let totalErrors = 0;

  for (let i = 0; i < batchCount; i++) {
    const result = await runWarmupSend(i, 3);
    totalSent += result.sent;
    totalErrors += result.errors;
  }

  return { sent: totalSent, errors: totalErrors, replied: 0 };
}

// Scan one cold sender inbox for bounce-back emails and auto-mark contacts as bounced
export async function scanForBounces(batch: number = 0): Promise<{ bounced: number }> {
  const coldSenders = await getColdSenderAddresses();
  if (batch >= coldSenders.length) return { bounced: 0 };

  const addr = coldSenders[batch];
  let bounced = 0;

  try {
    const { ImapFlow } = await import("imapflow");
    const imapHost = addr.imap_host || addr.smtp_host.replace("smtp.", "imap.");
    const imapPort = addr.imap_port || 993;

    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: addr.smtp_user, pass: addr.smtp_pass },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const messages = client.fetch({ since }, { envelope: true, source: true, uid: true });

      for await (const msg of messages) {
        const envelope = msg.envelope;
        if (!envelope) continue;

        const fromAddr = envelope.from?.[0]?.address?.toLowerCase() || "";
        const subject = (envelope.subject || "").toLowerCase();

        if (!fromAddr.includes("mailer-daemon") && !fromAddr.includes("postmaster")) continue;
        if (!subject.includes("deliver") && !subject.includes("failure") && !subject.includes("returned") && !subject.includes("undeliver")) continue;

        if (!msg.source) continue;
        const { simpleParser } = await import("mailparser");
        const parsed = await simpleParser(msg.source);
        const body = parsed.text || parsed.html || "";

        const emailMatches = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];

        for (const bouncedEmail of emailMatches) {
          const lower = bouncedEmail.toLowerCase();
          if (lower === addr.email.toLowerCase()) continue;
          if (lower.includes("mailer-daemon") || lower.includes("postmaster")) continue;

          const result = await sql`
            UPDATE outreach_contacts SET bounced = TRUE, sequence_status = 'bounced'
            WHERE email = ${lower} AND bounced = FALSE
          `;
          if (result && (result as unknown as { count?: number }).count) {
            bounced++;
            console.log(`[bounce-scan] Marked ${lower} as bounced (from ${addr.email})`);
          }
        }

        try {
          await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true });
          await client.messageMove(msg.uid, "[Gmail]/All Mail", { uid: true });
        } catch { /* ok */ }
      }
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err) {
    console.error(`[bounce-scan] Error for ${addr.email}:`, err);
  }

  if (bounced > 0) console.log(`[bounce-scan] Found ${bounced} bounced emails from ${addr.email}`);
  return { bounced };
}

// Get warmup status for all addresses
export async function getWarmupStatus(): Promise<{
  id: string;
  address: string;
  role: "cold_sender" | "warmup_only";
  daysActive: number;
  dailyLimits: { total: number; cold: number; warmup: number };
  coldSentToday: number;
  warmupSentToday: number;
}[]> {
  const addresses = await getWarmupAddresses();
  const statuses = [];

  for (const addr of addresses) {
    const days = getDaysSinceStart(addr);
    const limits = addr.cold_sender
      ? getDailyLimits(days)
      : { total: getWarmupDailyLimit(addr), cold: 0, warmup: getWarmupDailyLimit(addr) };
    const coldSentToday = await getTodayColdSendCount(addr.email);
    const warmupSentToday = await getTodayWarmupSendCount(addr.email);

    statuses.push({
      id: addr.id,
      address: addr.email,
      role: (addr.cold_sender ? "cold_sender" : "warmup_only") as "cold_sender" | "warmup_only",
      daysActive: days,
      dailyLimits: limits,
      coldSentToday,
      warmupSentToday,
    });
  }

  return statuses;
}
