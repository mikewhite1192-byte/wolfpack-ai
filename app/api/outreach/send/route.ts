import { NextResponse } from "next/server";
import { getDueContacts, advanceContact, getTodaySendCount, markBounced } from "@/lib/outreach/sequence";
import { sendEmail, getTemplate } from "@/lib/outreach/send-email";

// Daily send limit ramp (configurable)
const DAILY_LIMIT = parseInt(process.env.OUTREACH_DAILY_LIMIT || "30");

// POST /api/outreach/send — process sequence and send emails (cron)
export async function POST() {
  try {
    const todaySent = await getTodaySendCount();
    const remaining = Math.max(0, DAILY_LIMIT - todaySent);

    if (remaining === 0) {
      return NextResponse.json({ message: "Daily limit reached", sent: 0 });
    }

    const dueContacts = await getDueContacts(remaining);
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const contact of dueContacts) {
      const step = contact.sequence_step as number;
      const email = contact.email as string;
      const contactId = contact.id as string;

      // Get template for this step
      const template = await getTemplate(step, contact);

      // Send
      const result = await sendEmail(email, template.subject, template.body, contactId, step);

      if (result.success) {
        await advanceContact(contactId, step);
        sent++;
      } else {
        // Check if it's a bounce
        if (result.error?.includes("bounce") || result.error?.includes("rejected") || result.error?.includes("invalid")) {
          await markBounced(email);
        }
        failed++;
      }
    }

    console.log(`[outreach] Sent: ${sent}, Failed: ${failed}, Skipped: ${skipped}, Today total: ${todaySent + sent}`);

    return NextResponse.json({
      sent,
      failed,
      skipped,
      todayTotal: todaySent + sent,
      dailyLimit: DAILY_LIMIT,
    });
  } catch (err) {
    console.error("[outreach] Send error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
