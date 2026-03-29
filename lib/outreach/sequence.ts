import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Sequence schedule: step -> days after entry
const SEQUENCE_SCHEDULE: Record<number, number> = {
  1: 0, // Day 1: immediate
  2: 2, // Day 3: 2 days after first
  3: 6, // Day 7: 6 days after first
};

const MAX_STEPS = 3;

// Add new contacts to sequence
export async function addToSequence(contacts: {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  state?: string;
  licenseNumber?: string;
}[]): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const c of contacts) {
    const email = c.email.trim().toLowerCase();

    // Check if already exists (completed, active, or unsubscribed)
    const existing = await sql`
      SELECT id FROM outreach_contacts WHERE email = ${email} LIMIT 1
    `;
    if (existing.length > 0) { skipped++; continue; }

    await sql`
      INSERT INTO outreach_contacts (email, first_name, last_name, company, state, license_number, sequence_status, sequence_step, next_email_at)
      VALUES (${email}, ${c.firstName || null}, ${c.lastName || null}, ${c.company || null}, ${c.state || null}, ${c.licenseNumber || null}, 'active', 1, NOW())
    `;
    added++;
  }

  return { added, skipped };
}

// Get contacts due for their next email
export async function getDueContacts(limit: number = 100): Promise<Record<string, unknown>[]> {
  return sql`
    SELECT * FROM outreach_contacts
    WHERE sequence_status = 'active'
      AND next_email_at <= NOW()
      AND replied = FALSE
      AND bounced = FALSE
      AND unsubscribed = FALSE
      AND sequence_step <= ${MAX_STEPS}
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
  const nextDate = new Date(Date.now() + daysUntilNext * 24 * 60 * 60 * 1000);

  await sql`
    UPDATE outreach_contacts SET
      sequence_step = ${nextStep},
      next_email_at = ${nextDate.toISOString()},
      last_email_sent_at = NOW()
    WHERE id = ${contactId}
  `;
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
      COUNT(*) FILTER (WHERE sequence_status = 'unsubscribed') as unsubscribed,
      COUNT(*) FILTER (WHERE converted = TRUE) as converted
    FROM outreach_contacts
  `;
  return stats[0];
}

// Get daily send count (for rate limiting)
export async function getTodaySendCount(): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count FROM outreach_emails
    WHERE sent_at >= CURRENT_DATE
  `;
  return parseInt(result[0].count);
}
