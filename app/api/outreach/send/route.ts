import { NextRequest, NextResponse } from "next/server";
import { getDueContacts, advanceContact } from "@/lib/outreach/sequence";
import { sendColdEmail, getTemplate, getThreadMessageId, pickSenderAddress } from "@/lib/outreach/send-email";
import { getColdSenderAddresses, getColdDailyLimit, getTodayColdSendCount } from "@/lib/outreach/warmup";
import { markBounced } from "@/lib/outreach/sequence";

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

      // Get contacts due for this sender
      const dueContacts = await getDueContacts(addr.email, remaining);

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
