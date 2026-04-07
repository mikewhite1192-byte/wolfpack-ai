import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getDueContacts, advanceContact } from "@/lib/outreach/sequence";
import { sendColdEmail, getTemplate, getThreadMessageId } from "@/lib/outreach/send-email";
import { getColdSenderAddresses, getColdDailyLimit, getTodayColdSendCount } from "@/lib/outreach/warmup";
import { markBounced } from "@/lib/outreach/sequence";
import { getEnabledCampaigns, getCampaignSenderEmails, getCampaignTemplate } from "@/lib/outreach/campaigns";
import type { WarmupAddress } from "@/lib/outreach/warmup";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/outreach/send — Vercel cron handler (crons always use GET)
export async function GET() {
  return handleColdSend();
}

// POST /api/outreach/send — manual trigger from dashboard
export async function POST() {
  return handleColdSend();
}

async function handleColdSend() {
  try {
    const allColdSenders = await getColdSenderAddresses();
    const senderMap = new Map<string, WarmupAddress>();
    for (const addr of allColdSenders) senderMap.set(addr.email, addr);

    let totalSent = 0;
    let totalFailed = 0;
    const perAddress: Record<string, { sent: number; limit: number; campaign: string }> = {};

    // Get all enabled campaigns
    const campaigns = await getEnabledCampaigns();

    for (const campaign of campaigns) {
      // Get sender addresses assigned to this campaign
      const campaignSenderEmails = await getCampaignSenderEmails(campaign.id);
      const campaignSenders = campaignSenderEmails
        .map(email => senderMap.get(email))
        .filter((a): a is WarmupAddress => !!a);

      if (campaignSenders.length === 0) continue;

      for (const addr of campaignSenders) {
        const dailyLimit = getColdDailyLimit(addr);
        const alreadySent = await getTodayColdSendCount(addr.email);
        const remaining = Math.max(0, dailyLimit - alreadySent);

        perAddress[addr.email] = { sent: 0, limit: dailyLimit, campaign: campaign.name };

        if (remaining === 0) continue;

        const batchSize = Math.min(remaining, 2);

        // Assign unassigned contacts IN THIS CAMPAIGN to this sender
        await sql`
          UPDATE outreach_contacts SET assigned_sender = ${addr.email}
          WHERE id IN (
            SELECT id FROM outreach_contacts
            WHERE assigned_sender IS NULL AND sequence_status = 'active'
              AND campaign_id = ${campaign.id}
            ORDER BY created_at ASC
            LIMIT ${batchSize}
          )
          AND NOT EXISTS (
            SELECT 1 FROM outreach_contacts oc2
            WHERE oc2.email = outreach_contacts.email
              AND oc2.assigned_sender IS NOT NULL
          )
        `;

        // Get due contacts for this sender
        const dueContacts = await getDueContacts(addr.email, batchSize);

        for (const contact of dueContacts) {
          const step = contact.sequence_step as number;
          const email = contact.email as string;
          const contactId = contact.id as string;

          // Try campaign-specific template first, fall back to default
          const campaignTemplate = await getCampaignTemplate(campaign.id, step, contact);
          const template = campaignTemplate || await getTemplate(step, contact);
          const emailVariant = campaignTemplate?.variant || "A";

          // Thread follow-ups
          let inReplyTo: string | undefined;
          let references: string | undefined;
          let subject = template.subject;

          if (step > 1) {
            const thread = await getThreadMessageId(contactId);
            if (thread.messageId) {
              inReplyTo = thread.messageId;
              references = thread.messageId;
              if (thread.subject) subject = thread.subject;
            }
          }

          const result = await sendColdEmail(addr, email, subject, template.body, contactId, step, inReplyTo, references, emailVariant);

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
    }

    // Also handle contacts with NO campaign (legacy/DOI contacts)
    // These use any cold sender NOT assigned to a campaign
    const assignedSenderEmails = new Set<string>();
    for (const campaign of campaigns) {
      const emails = await getCampaignSenderEmails(campaign.id);
      emails.forEach(e => assignedSenderEmails.add(e));
    }
    const unassignedSenders = allColdSenders.filter(a => !assignedSenderEmails.has(a.email));

    for (const addr of unassignedSenders) {
      const dailyLimit = getColdDailyLimit(addr);
      const alreadySent = await getTodayColdSendCount(addr.email);
      const remaining = Math.max(0, dailyLimit - alreadySent);

      perAddress[addr.email] = { sent: 0, limit: dailyLimit, campaign: "(no campaign)" };

      if (remaining === 0) continue;

      const batchSize = Math.min(remaining, 2);

      // Assign unassigned contacts with NO campaign
      await sql`
        UPDATE outreach_contacts SET assigned_sender = ${addr.email}
        WHERE id IN (
          SELECT id FROM outreach_contacts
          WHERE assigned_sender IS NULL AND sequence_status = 'active'
            AND campaign_id IS NULL
          ORDER BY created_at ASC
          LIMIT ${batchSize}
        )
        AND NOT EXISTS (
          SELECT 1 FROM outreach_contacts oc2
          WHERE oc2.email = outreach_contacts.email
            AND oc2.assigned_sender IS NOT NULL
        )
      `;

      const dueContacts = await getDueContacts(addr.email, batchSize);

      for (const contact of dueContacts) {
        const step = contact.sequence_step as number;
        const email = contact.email as string;
        const contactId = contact.id as string;

        const template = await getTemplate(step, contact);

        let inReplyTo: string | undefined;
        let references: string | undefined;
        let subject = template.subject;

        if (step > 1) {
          const thread = await getThreadMessageId(contactId);
          if (thread.messageId) {
            inReplyTo = thread.messageId;
            references = thread.messageId;
            if (thread.subject) subject = thread.subject;
          }
        }

        const result = await sendColdEmail(addr, email, subject, template.body, contactId, step, inReplyTo, references);

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
      console.log(`  ${email}: ${stats.sent}/${stats.limit} (${stats.campaign})`);
    }

    return NextResponse.json({ sent: totalSent, failed: totalFailed, perAddress });
  } catch (err) {
    console.error("[outreach] Send error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
