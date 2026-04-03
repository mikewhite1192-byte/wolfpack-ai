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

// Fetch new emails from ONE cold sender address via IMAP
// Pass batch number to rotate through addresses (one per cron call to avoid timeouts)
export async function pollAllInboxes(batch?: number): Promise<{ fetched: number; errors: number }> {
  const addresses = await sql`
    SELECT * FROM warmup_addresses WHERE is_active = TRUE AND cold_sender = TRUE
    ORDER BY email ASC
  `;

  if (addresses.length === 0) return { fetched: 0, errors: 0 };

  // If batch specified, poll just that one address. Otherwise poll all (for manual triggers, one at a time)
  let fetched = 0;
  let errors = 0;

  const toPoll = batch != null
    ? [addresses[batch % addresses.length]]
    : addresses;

  for (const addr of toPoll) {
    const email = addr.email as string;
    const imapHost = addr.imap_host as string || (addr.smtp_host as string).replace("smtp.", "imap.");
    console.log(`[inbox] Polling ${email} via ${imapHost}:993`);
    try {
      const count = await pollInbox(
        email,
        imapHost,
        (addr.imap_port as number) || 993,
        addr.smtp_user as string,
        addr.smtp_pass as string,
      );
      fetched += count;
      console.log(`[inbox] ${email}: fetched ${count}`);
    } catch (err) {
      console.error(`[inbox] Failed to poll ${email}:`, err instanceof Error ? err.message : err);
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

  // Check INBOX only — All Mail is too slow and causes timeouts
  const foldersToCheck = ["INBOX"];

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

    // Debug: count total messages in folder
    let msgCount = 0;

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

      msgCount++;
      console.log(`[inbox] Found email in ${folder}: from=${fromAddr} subject="${subject}" date=${new Date(date).toISOString()}`);

      // Check if already stored
      if (messageId) {
        const existing = await sql`
          SELECT id FROM campaign_inbox WHERE message_id = ${messageId} AND to_address = ${address}
          LIMIT 1
        `;
        if (existing.length > 0) {
          console.log(`[inbox] Skipping ${fromAddr} — already stored (messageId: ${messageId})`);
          continue;
        }
      }

      // Parse body from source
      let body = "";
      try {
        if (msg.source) {
          const { simpleParser } = await import("mailparser");
          const parsed = await simpleParser(msg.source);
          body = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");
        }
      } catch (parseErr) {
        console.error(`[inbox] Failed to parse email from ${fromAddr}:`, parseErr);
      }

      // Try to match to an outreach contact
      const outreachContact = await sql`
        SELECT id FROM outreach_contacts WHERE email = ${fromAddr.toLowerCase()} LIMIT 1
      `;
      console.log(`[inbox] Processing ${fromAddr}: body=${body.length}chars, outreachMatch=${outreachContact.length > 0}, messageId=${messageId}`);

      // Try to match to a CRM contact
      const crmContact = await sql`
        SELECT id FROM contacts WHERE email = ${fromAddr.toLowerCase()} LIMIT 1
      `;

      // Categorize: warmup (from our own addresses) vs cold reply vs other
      // Note: warmup emails from our addresses are already filtered out above,
      // but this catches any edge cases and tags outreach replies correctly
      const category = outreachContact.length > 0 ? "cold_reply" : "other";

      // Store
      try {
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
        console.log(`[inbox] Stored reply from ${fromAddr} (${category})`);
      } catch (insertErr) {
        console.error(`[inbox] Failed to store reply from ${fromAddr}:`, insertErr instanceof Error ? insertErr.message : insertErr);
        continue;
      }

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

    console.log(`[inbox] ${address} ${folder}: scanned ${msgCount} messages, stored ${fetched} new replies`);
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
      WHERE to_address = ${opts.toAddress} AND email_category = 'cold_reply'
      ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
      ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
      ORDER BY received_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countResult = await sql`
      SELECT COUNT(*) as count FROM campaign_inbox
      WHERE to_address = ${opts.toAddress} AND email_category = 'cold_reply'
      ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
      ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
    `;
    return { replies: replies as unknown as CampaignReply[], total: parseInt(countResult[0].count as string) };
  }

  // Filter by multiple addresses (campaign filter)
  if (opts.toAddresses && opts.toAddresses.length > 0) {
    const replies = await sql`
      SELECT * FROM campaign_inbox
      WHERE to_address = ANY(${opts.toAddresses}) AND email_category = 'cold_reply'
      ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
      ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
      ORDER BY received_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countResult = await sql`
      SELECT COUNT(*) as count FROM campaign_inbox
      WHERE to_address = ANY(${opts.toAddresses}) AND email_category = 'cold_reply'
      ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
      ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
    `;
    return { replies: replies as unknown as CampaignReply[], total: parseInt(countResult[0].count as string) };
  }

  // Default: only show cold replies (not Google notifications, warmup, etc.)
  const replies = await sql`
    SELECT * FROM campaign_inbox
    WHERE email_category = 'cold_reply'
    ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
    ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
    ORDER BY received_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countResult = await sql`
    SELECT COUNT(*) as count FROM campaign_inbox
    WHERE email_category = 'cold_reply'
    ${opts.unreadOnly ? sql`AND is_read = FALSE` : sql``}
    ${opts.starredOnly ? sql`AND is_starred = TRUE` : sql``}
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
  const result = await sql`SELECT COUNT(*) as count FROM campaign_inbox WHERE is_read = FALSE AND email_category = 'cold_reply'`;
  return parseInt(result[0].count as string);
}

// Get the full conversation thread for a reply (all emails sent to and received from this contact)
export async function getConversationThread(replyId: string): Promise<Array<{ direction: string; from: string; body: string; subject: string; sent_at: string }>> {
  // Get the reply to find the contact
  const reply = await sql`SELECT from_email, to_address, outreach_contact_id FROM campaign_inbox WHERE id = ${replyId}`;
  if (reply.length === 0) return [];

  const contactEmail = reply[0].from_email as string;
  const outreachContactId = reply[0].outreach_contact_id as string | null;

  // Get all cold emails we sent to this contact
  const sentEmails: Array<{ direction: string; from: string; body: string; subject: string; sent_at: string }> = [];

  if (outreachContactId) {
    const sent = await sql`
      SELECT from_email, subject, body, sent_at FROM outreach_emails
      WHERE contact_id = ${outreachContactId} AND status = 'sent'
      ORDER BY sent_at ASC
    `;
    for (const s of sent) {
      sentEmails.push({
        direction: "outbound",
        from: (s.from_email as string) || "us",
        body: (s.body as string) || "",
        subject: (s.subject as string) || "",
        sent_at: (s.sent_at as string) || "",
      });
    }
  }

  // Get all inbox messages involving this contact (both their replies and our replies)
  const inboxMessages = await sql`
    SELECT from_email, to_address, subject, body, received_at
    FROM campaign_inbox
    WHERE (from_email = ${contactEmail} OR to_address = ${contactEmail})
      AND email_category = 'cold_reply'
    ORDER BY received_at ASC
  `;

  const received: Array<{ direction: string; from: string; body: string; subject: string; sent_at: string }> = [];
  for (const m of inboxMessages) {
    const isFromUs = (m.from_email as string) !== contactEmail;
    received.push({
      direction: isFromUs ? "outbound" : "inbound",
      from: (m.from_email as string) || "",
      body: (m.body as string) || "",
      subject: (m.subject as string) || "",
      sent_at: (m.received_at as string) || "",
    });
  }

  // Also check email_assistant_messages if they exist
  if (outreachContactId) {
    const assistantMsgs = await sql`
      SELECT eam.direction, eam.body, eam.subject, eam.sent_at
      FROM email_assistant_messages eam
      JOIN email_assistant_conversations eac ON eac.id = eam.conversation_id
      WHERE eac.outreach_contact_id = ${outreachContactId}
      ORDER BY eam.sent_at ASC
    `;
    for (const m of assistantMsgs) {
      received.push({
        direction: m.direction as string,
        from: (m.direction as string) === "outbound" ? "AI Assistant" : contactEmail,
        body: (m.body as string) || "",
        subject: (m.subject as string) || "",
        sent_at: (m.sent_at as string) || "",
      });
    }
  }

  // Merge and deduplicate by timestamp + body (avoid showing the same message twice)
  const all = [...sentEmails, ...received];
  const seen = new Set<string>();
  const deduped = all.filter(m => {
    const key = `${m.sent_at}|${m.body.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by time
  deduped.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

  return deduped;
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
    const result = await transporter.sendMail(mailOptions);
    const messageId = result.messageId || null;

    // Log in campaign_inbox so it shows in the inbox thread
    await sql`
      INSERT INTO campaign_inbox (
        from_email, from_name, to_address, subject, body,
        received_at, message_id, in_reply_to,
        outreach_contact_id, contact_id, email_category, is_read
      ) VALUES (
        ${toAddress}, ${addr[0].display_name as string || "Mike"}, ${reply.from_email as string}, ${subject}, ${body},
        NOW(), ${messageId}, ${reply.message_id || null},
        ${reply.outreach_contact_id || null}, ${reply.contact_id || null}, 'cold_reply', TRUE
      )
    `;

    // Log in outreach_emails so it shows in contact detail panel
    if (reply.outreach_contact_id) {
      await sql`
        INSERT INTO outreach_emails (from_email, contact_id, step, subject, body, status, email_type, ses_message_id, message_id_header)
        VALUES (${toAddress}, ${reply.outreach_contact_id}, 0, ${subject}, ${body}, 'sent', 'cold', ${messageId}, ${messageId})
      `;
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}
