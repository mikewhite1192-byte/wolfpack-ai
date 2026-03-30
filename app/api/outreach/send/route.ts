import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getDueContacts, advanceContact } from "@/lib/outreach/sequence";
import { sendColdEmail, getTemplate, getThreadMessageId, pickSenderAddress } from "@/lib/outreach/send-email";
import { getColdSenderAddresses, getColdDailyLimit, getTodayColdSendCount } from "@/lib/outreach/warmup";
import { markBounced } from "@/lib/outreach/sequence";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/outreach/send — process sequence and send cold emails (cron or admin)
export async function POST(req: NextRequest) {
  try {

    // Only use addresses flagged as cold senders (already filtered to warmup-complete)
    const addresses = await getColdSenderAddresses();
    let totalSent = 0;
    let totalFailed = 0;
    const perAddress: Record<string, { sent: number; limit: number }> = {};

    for (const addr of addresses) {

      const dailyLimit = getColdDailyLimit(addr);
      const alreadySent = await getTodayColdSendCount(addr.email);
      const remaining = Math.max(0, dailyLimit - alreadySent);

      perAddress[addr.email] = { sent: 0, limit: dailyLimit };

      if (remaining === 0) continue;

      // Send max 2 per address per cron call — scattered across multiple calls throughout the day
      const batchSize = Math.min(remaining, 2);

      // Assign unassigned contacts to this sender (round-robin across senders)
      await sql`
        UPDATE outreach_contacts SET assigned_sender = ${addr.email}
        WHERE id IN (
          SELECT id FROM outreach_contacts
          WHERE assigned_sender IS NULL AND sequence_status = 'active'
          ORDER BY created_at ASC
          LIMIT ${batchSize}
        )
        AND NOT EXISTS (
          SELECT 1 FROM outreach_contacts oc2
          WHERE oc2.email = outreach_contacts.email
            AND oc2.assigned_sender IS NOT NULL
        )
      `;

      // Get contacts due for this sender ONLY (no more unassigned pickup)
      const dueContacts = await getDueContacts(addr.email, batchSize);

      for (const contact of dueContacts) {
        const step = contact.sequence_step as number;
        const email = contact.email as string;
        const contactId = contact.id as string;

        // Get template for this step
        const template = await getTemplate(step, contact);

        // For steps 2-4, send in the same thread as step 1
        let inReplyTo: string | undefined;
        let references: string | undefined;
        let subject = template.subject;

        if (step > 1) {
          const thread = await getThreadMessageId(contactId);
          if (thread.messageId) {
            inReplyTo = thread.messageId;
            references = thread.messageId;
            // Use original subject for thread continuity
            if (thread.subject) {
              subject = thread.subject;
            }
          }
        }

        // Send plain text email
        const result = await sendColdEmail(
          addr,
          email,
          subject,
          template.body,
          contactId,
          step,
          inReplyTo,
          references,
        );

        if (result.success) {
          await advanceContact(contactId, step);
          totalSent++;
          perAddress[addr.email].sent++;
        } else {
          if (result.error?.includes("bounce") || result.error?.includes("rejected") || result.error?.includes("invalid")) {
            await markBounced(email);
          }
          totalFailed++;
        }
      }
    }

    console.log(`[outreach] Cold sends complete: ${totalSent} sent, ${totalFailed} failed`);
    for (const [email, stats] of Object.entries(perAddress)) {
      console.log(`  ${email}: ${stats.sent}/${stats.limit}`);
    }

    return NextResponse.json({
      sent: totalSent,
      failed: totalFailed,
      perAddress,
    });
  } catch (err) {
    console.error("[outreach] Send error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
