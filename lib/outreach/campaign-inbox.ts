import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface CampaignReply {
  id: string;
  from_email: string;
  from_name: string;
  to_address: string; // which of our addresses received it
  subject: string;
  body: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  contact_id: string | null;
  outreach_contact_id: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  email_category: "cold_reply" | "warmup" | "other"; // categorize for filtering
}

// Fetch new emails from cold sender addresses only via IMAP
export async function pollAllInboxes(): Promise<{ fetched: number; errors: number }> {
  const addresses = await sql`
    SELECT * FROM warmup_addresses WHERE is_active = TRUE AND cold_sender = TRUE
  `;

  let fetched = 0;
  let errors = 0;

  for (const addr of addresses) {
    try {
      const count = await pollInbox(
        addr.email as string,
        addr.imap_host as string || (addr.smtp_host as string).replace("smtp.", "imap."),
        (addr.imap_port as number) || 993,
        addr.smtp_user as string,
        addr.smtp_pass as string,
      );
      fetched += count;
    } catch (err) {
      console.error(`[inbox] Failed to poll ${addr.email}:`, err);
      errors++;
    }
  }

  return { fetched, errors };
}

// Poll a single inbox via IMAP
async function pollInbox(
  address: string,
  imapHost: string,
  imapPort: number,
  user: string,
  pass: string,
): Promise<number> {
  const { ImapFlow } = await import("imapflow");

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();

  let fetched = 0;

  // Check both INBOX and All Mail (in case emails were read/archived in Gmail)
  const foldersToCheck = ["INBOX", "[Gmail]/All Mail"];

  for (const folder of foldersToCheck) {
    let lock;
    try {
      lock = await client.getMailboxLock(folder);
    } catch (err) {
      console.log(`[inbox] Folder ${folder} not available for ${address}:`, err instanceof Error ? err.message : err);
      continue;
    }

  try {
    // Always look back at least 3 days to catch replies we might have missed
    // The dedup check (message_id) prevents storing duplicates
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    console.log(`[inbox] Polling ${address} folder=${folder} since=${since.toISOString()}`);

    // Search for messages since last poll
    const messages = client.fetch(
      { since },
      {
        envelope: true,
        source: true,
        uid: true,
      },
    );

    for await (const msg of messages) {
      const envelope = msg.envelope;
      if (!envelope) continue;

      const fromAddr = envelope.from?.[0]?.address || "";
      const fromName = envelope.from?.[0]?.name || fromAddr.split("@")[0];
      const subject = envelope.subject || "(no subject)";
      const messageId = envelope.messageId || null;
      const inReplyTo = envelope.inReplyTo || null;
      const date = envelope.date || new Date();

      // Skip emails from our own addresses (warmup emails between ourselves)
      const ourAddresses = await sql`SELECT email FROM warmup_addresses WHERE is_active = TRUE`;
      const ourEmails = ourAddresses.map(a => (a.email as string).toLowerCase());
      if (ourEmails.includes(fromAddr.toLowerCase())) {
        continue;
      }

      console.log(`[inbox] Found email in ${folder}: from=${fromAddr} subject="${subject}" date=${new Date(date).toISOString()}`);

      // Check if already stored
      const existing = await sql`
        SELECT id FROM campaign_inbox WHERE message_id = ${messageId} AND to_address = ${address}
        LIMIT 1
      `;
      if (existing.length > 0) continue;

      // Parse body from source
      let body = "";
      if (msg.source) {
        const { simpleParser } = await import("mailparser");
        const parsed = await simpleParser(msg.source);
        body = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");
      }

      // Try to match to an outreach contact
      const outreachContact = await sql`
        SELECT id FROM outreach_contacts WHERE email = ${fromAddr.toLowerCase()} LIMIT 1
      `;

      // Try to match to a CRM contact
      const crmContact = await sql`
        SELECT id FROM contacts WHERE email = ${fromAddr.toLowerCase()} LIMIT 1
      `;

      // Categorize: warmup (from our own addresses) vs cold reply vs other
      // Note: warmup emails from our addresses are already filtered out above,
      // but this catches any edge cases and tags outreach replies correctly
      const category = outreachContact.length > 0 ? "cold_reply" : "other";

      // Store
      await sql`
        INSERT INTO campaign_inbox (
          from_email, from_name, to_address, subject, body,
          received_at, message_id, in_reply_to,
          outreach_contact_id, contact_id, email_category
        ) VALUES (
          ${fromAddr}, ${fromName}, ${address}, ${subject}, ${body},
          ${new Date(date).toISOString()}, ${messageId}, ${inReplyTo},
          ${outreachContact[0]?.id || null}, ${crmContact[0]?.id || null}, ${category}
        )
      `;

      // Auto-detect replies and unsubscribes
      if (outreachContact.length > 0) {
        const bodyLower = body.toLowerCase().trim();
        const isUnsub = /^(stop|unsubscribe|remove me|remove|opt out|take me off|cancel)$/i.test(bodyLower)
          || bodyLower.includes("unsubscribe me")
          || bodyLower.includes("remove me from")
          || bodyLower.includes("stop emailing");

        if (isUnsub) {
          await sql`
            UPDATE outreach_contacts SET sequence_status = 'unsubscribed', unsubscribed = TRUE, unsubscribed_at = NOW()
            WHERE id = ${outreachContact[0].id} AND unsubscribed = FALSE
          `;
          console.log(`[inbox] Auto-unsubscribed ${fromAddr} (detected stop/unsubscribe)`);
        } else {
          // Mark as replied (stops further cold emails)
          await sql`
            UPDATE outreach_contacts SET replied = TRUE, replied_at = NOW(), sequence_status = 'replied'
            WHERE id = ${outreachContact[0].id} AND replied = FALSE
          `;
        }
      }

      fetched++;
    }

  } finally {
    lock.release();
  }
  } // end folder loop

  // Update last polled time
  await sql`UPDATE warmup_addresses SET last_polled_at = NOW() WHERE email = ${address}`;

  await client.logout();

  if (fetched > 0) {
    console.log(`[inbox] Fetched ${fetched} new replies from ${address}`);
  }

  return fetched;
}

// Get campaign inbox replies (paginated)
export async function getInboxReplies(opts: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  starredOnly?: boolean;
  toAddress?: string;
  toAddresses?: string[];
}): Promise<{ replies: CampaignReply[]; total: number }> {
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  // Filter by single address
  if (opts.toAddress) {
    const replies = await sql`
      SELECT * FROM campaign_inbox
      WHERE to_address = ${opts.toAddress}
      ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
      ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
      ORDER BY received_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countResult = await sql`
      SELECT COUNT(*) as count FROM campaign_inbox
      WHERE to_address = ${opts.toAddress}
      ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
      ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
    `;
    return { replies: replies as unknown as CampaignReply[], total: parseInt(countResult[0].count as string) };
  }

  // Filter by multiple addresses (campaign filter)
  if (opts.toAddresses && opts.toAddresses.length > 0) {
    const replies = await sql`
      SELECT * FROM campaign_inbox
      WHERE to_address = ANY(${opts.toAddresses})
      ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
      ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
      ORDER BY received_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countResult = await sql`
      SELECT COUNT(*) as count FROM campaign_inbox
      WHERE to_address = ANY(${opts.toAddresses})
      ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
      ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
    `;
    return { replies: replies as unknown as CampaignReply[], total: parseInt(countResult[0].count as string) };
  }

  const replies = await sql`
    SELECT * FROM campaign_inbox
    ${opts.unreadOnly ? sql`WHERE is_read = FALSE` : opts.starredOnly ? sql`WHERE is_starred = TRUE` : sql``}
    ORDER BY received_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countResult = await sql`
    SELECT COUNT(*) as count FROM campaign_inbox
    ${opts.unreadOnly ? sql`WHERE is_read = FALSE` : opts.starredOnly ? sql`WHERE is_starred = TRUE` : sql``}
  `;

  return { replies: replies as unknown as CampaignReply[], total: parseInt(countResult[0].count as string) };
}

// Mark a reply as read
export async function markRead(replyId: string) {
  await sql`UPDATE campaign_inbox SET is_read = TRUE WHERE id = ${replyId}`;
}

// Toggle star on a reply
export async function toggleStar(replyId: string) {
  await sql`UPDATE campaign_inbox SET is_starred = NOT is_starred WHERE id = ${replyId}`;
}

// Get unread count
export async function getUnreadCount(): Promise<number> {
  const result = await sql`SELECT COUNT(*) as count FROM campaign_inbox WHERE is_read = FALSE`;
  return parseInt(result[0].count as string);
}

// Reply to a campaign email (sends from the address it was received on)
export async function replyCampaignEmail(
  replyId: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  // Get the original reply
  const original = await sql`SELECT * FROM campaign_inbox WHERE id = ${replyId}`;
  if (original.length === 0) return { success: false, error: "Reply not found" };

  const reply = original[0];
  const toAddress = reply.to_address as string;

  // Get SMTP credentials for this address
  const addr = await sql`
    SELECT * FROM warmup_addresses WHERE email = ${toAddress} AND is_active = TRUE LIMIT 1
  `;
  if (addr.length === 0) return { success: false, error: "Sending address not found" };

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: addr[0].smtp_host as string,
    port: addr[0].smtp_port as number,
    secure: (addr[0].smtp_port as number) === 465,
    auth: {
      user: addr[0].smtp_user as string,
      pass: addr[0].smtp_pass as string,
    },
  });

  const subject = (reply.subject as string).startsWith("Re:") ? reply.subject as string : `Re: ${reply.subject}`;

  const mailOptions: Record<string, unknown> = {
    from: `${addr[0].display_name} <${toAddress}>`,
    to: reply.from_email as string,
    subject,
    text: body + "\n\nMike, The Wolf Pack AI",
  };

  if (reply.message_id) {
    mailOptions.inReplyTo = reply.message_id;
    mailOptions.references = reply.message_id;
  }

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}
