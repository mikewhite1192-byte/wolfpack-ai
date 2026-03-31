import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// 4-touch sequence over 12-16 days
// step -> days after entry
const SEQUENCE_SCHEDULE: Record<number, number> = {
  1: 0,   // Day 1: immediate
  2: 3,   // Day 3-4: light bump (same thread)
  3: 7,   // Day 7-9: new angle (same thread)
  4: 12,  // Day 12-15: close loop (same thread)
};

const MAX_STEPS = 4;

// Add new contacts to sequence, optionally assigned to a specific sender and campaign
export async function addToSequence(contacts: {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  state?: string;
  licenseNumber?: string;
}[], assignedSender?: string, campaignId?: string): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const c of contacts) {
    const email = c.email.trim().toLowerCase();

    // Check if already exists
    const existing = await sql`
      SELECT id FROM outreach_contacts WHERE email = ${email} LIMIT 1
    `;
    if (existing.length > 0) { skipped++; continue; }

    await sql`
      INSERT INTO outreach_contacts (email, first_name, last_name, company, state, license_number, sequence_status, sequence_step, next_email_at, assigned_sender, campaign_id)
      VALUES (${email}, ${c.firstName || null}, ${c.lastName || null}, ${c.company || null}, ${c.state || null}, ${c.licenseNumber || null}, 'active', 1, NOW(), ${assignedSender || null}, ${campaignId || null})
    `;
    added++;
  }

  return { added, skipped };
}

// Get contacts due for their next email, filtered by sender address
export async function getDueContacts(senderEmail: string, limit: number = 100): Promise<Record<string, unknown>[]> {
  return sql`
    SELECT * FROM outreach_contacts
    WHERE sequence_status = 'active'
      AND next_email_at <= NOW()
      AND replied = FALSE
      AND bounced = FALSE
      AND unsubscribed = FALSE
      AND sequence_step <= ${MAX_STEPS}
      AND assigned_sender = ${senderEmail}
    ORDER BY next_email_at ASC
    LIMIT ${limit}
  `;
}

// Advance a contact to their next step after sending
export async function advanceContact(contactId: string, currentStep: number) {
  const nextStep = currentStep + 1;

  if (nextStep > MAX_STEPS) {
    // Sequence complete
    await sql`
      UPDATE outreach_contacts SET
        sequence_status = 'completed',
        last_email_sent_at = NOW()
      WHERE id = ${contactId}
    `;
    return;
  }

  const daysUntilNext = SEQUENCE_SCHEDULE[nextStep] - SEQUENCE_SCHEDULE[currentStep];
  // Add some randomness (+-1 day) to look natural
  const jitterHours = Math.floor(Math.random() * 48) - 24;
  const nextDate = new Date(Date.now() + daysUntilNext * 24 * 60 * 60 * 1000 + jitterHours * 60 * 60 * 1000);

  await sql`
    UPDATE outreach_contacts SET
      sequence_step = ${nextStep},
      next_email_at = ${nextDate.toISOString()},
      last_email_sent_at = NOW()
    WHERE id = ${contactId}
  `;
}

// Assign unassigned contacts to a sender (round-robin across available senders)
export async function assignContactsToSender(senderEmail: string, limit: number): Promise<number> {
  const result = await sql`
    UPDATE outreach_contacts SET assigned_sender = ${senderEmail}
    WHERE id IN (
      SELECT id FROM outreach_contacts
      WHERE assigned_sender IS NULL
        AND sequence_status = 'active'
      ORDER BY created_at ASC
      LIMIT ${limit}
    )
  `;
  return (result as unknown as { count?: number }).count || 0;
}

// Mark contact as replied
export async function markReplied(email: string) {
  await sql`
    UPDATE outreach_contacts SET
      replied = TRUE,
      replied_at = NOW(),
      sequence_status = 'replied'
    WHERE email = ${email.toLowerCase()} AND replied = FALSE
  `;
}

// Mark contact as bounced
export async function markBounced(email: string) {
  await sql`
    UPDATE outreach_contacts SET
      bounced = TRUE,
      bounced_at = NOW(),
      sequence_status = 'bounced'
    WHERE email = ${email.toLowerCase()}
  `;
}

// Mark contact as unsubscribed
export async function markUnsubscribed(email: string) {
  await sql`
    UPDATE outreach_contacts SET
      unsubscribed = TRUE,
      unsubscribed_at = NOW(),
      sequence_status = 'unsubscribed'
    WHERE email = ${email.toLowerCase()}
  `;
}

// Get sequence stats
export async function getSequenceStats() {
  const stats = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE sequence_status = 'active') as active,
      COUNT(*) FILTER (WHERE sequence_status = 'completed') as completed,
      COUNT(*) FILTER (WHERE sequence_status = 'replied') as replied,
      COUNT(*) FILTER (WHERE sequence_status = 'bounced') as bounced,
      COUNT(*) FILTER (WHERE sequence_status = 'invalid') as invalid,
      COUNT(*) FILTER (WHERE sequence_status = 'unsubscribed') as unsubscribed,
      COUNT(*) FILTER (WHERE converted = TRUE) as converted
    FROM outreach_contacts
  `;
  return stats[0];
}

// Get daily send count for a specific sender
export async function getTodaySendCount(senderEmail?: string): Promise<number> {
  if (senderEmail) {
    const result = await sql`
      SELECT COUNT(*) as count FROM outreach_emails
      WHERE from_email = ${senderEmail}
        AND sent_at >= CURRENT_DATE
        AND email_type = 'cold'
    `;
    return parseInt(result[0].count);
  }
  const result = await sql`
    SELECT COUNT(*) as count FROM outreach_emails
    WHERE sent_at >= CURRENT_DATE AND email_type = 'cold'
  `;
  return parseInt(result[0].count);
}
