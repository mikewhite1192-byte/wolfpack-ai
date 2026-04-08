// Confirmation triggers — fires when a demo is booked via AI cold caller
import { neon } from "@neondatabase/serverless";
import { sendMessage as sendLoop } from "@/lib/loop/client";
import type { CallerLead } from "./retell-tools";
import { syncCallerLeadToCRM } from "./sync-to-crm";

const sql = neon(process.env.DATABASE_URL!);

const MIKE_PHONE = process.env.OWNER_PHONE || "";

// ── Send Demo Confirmations ─────────────────────────────────────────
export async function sendDemoConfirmations(
  lead: CallerLead,
  demoTime: string,
): Promise<void> {
  const callDate = new Date(demoTime);
  const dayName = callDate.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  });
  const timeStr = callDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

  const firstName = lead.contact_name?.split(" ")[0] || "there";
  const businessName = lead.business_name || "your business";

  // 1. Send confirmation email to contractor (if we have their email)
  if (lead.email) {
    await sendConfirmationEmail(lead, dayName, timeStr);
  }

  // 2. Send confirmation email to Mike
  await sendMikeConfirmationEmail(lead, dayName, timeStr);

  // 3. iMessage to contractor via Loop
  if (lead.phone) {
    const contractorMsg = `Hey ${firstName}, just confirming your call with Mike ${dayName} at ${timeStr} ET. He'll call from ${MIKE_PHONE || "his number"}.`;
    try {
      await sendLoop(lead.phone, contractorMsg);
      console.log(`[caller-confirm] Sent contractor iMessage to ${lead.phone}`);
    } catch (err) {
      console.error("[caller-confirm] Failed to send contractor iMessage:", err);
    }
  }

  // 4. iMessage to Mike via Loop
  if (MIKE_PHONE) {
    const mikeMsg = `Demo booked: ${businessName} (${lead.contractor_type || "contractor"}), ${lead.city || "unknown"} — ${dayName} at ${timeStr} ET. Their number: ${lead.phone}`;
    try {
      await sendLoop(MIKE_PHONE, mikeMsg);
      console.log("[caller-confirm] Sent Mike iMessage");
    } catch (err) {
      console.error("[caller-confirm] Failed to send Mike iMessage:", err);
    }
  }

  // 5. Sync lead into CRM (contact + deal + conversation)
  if (lead.id) {
    try {
      const result = await syncCallerLeadToCRM(lead.id);
      if (result) {
        console.log(`[caller-confirm] Synced to CRM — contact=${result.contactId}, deal=${result.dealId}`);
      }
    } catch (err) {
      console.error("[caller-confirm] Failed to sync to CRM:", err);
    }
  }
}

// ── Email to Contractor ─────────────────────────────────────────────
async function sendConfirmationEmail(
  lead: CallerLead,
  dayName: string,
  timeStr: string,
): Promise<void> {
  try {
    // Use the same SMTP pattern as email-assistant: look up warmup address
    const addrs = await sql`
      SELECT * FROM warmup_addresses
      WHERE is_active = TRUE
      ORDER BY created_at ASC LIMIT 1
    `;
    if (addrs.length === 0) {
      console.log("[caller-confirm] No SMTP address available, skipping contractor email");
      return;
    }

    const addr = addrs[0];
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: addr.smtp_host as string,
      port: addr.smtp_port as number,
      secure: (addr.smtp_port as number) === 465,
      auth: {
        user: addr.smtp_user as string,
        pass: addr.smtp_pass as string,
      },
    });

    const firstName = lead.contact_name?.split(" ")[0] || "there";

    await transporter.sendMail({
      from: `${(addr.display_name as string) || "Mike"} <${addr.email as string}>`,
      to: lead.email!,
      subject: `Confirmed: Call ${dayName} at ${timeStr} ET`,
      text: `Hey ${firstName},\n\nJust confirming our call ${dayName} at ${timeStr} ET. I'll give you a call at ${lead.phone}.\n\nTalk soon,\nMike\nThe Wolf Pack AI`,
    });

    console.log(`[caller-confirm] Sent confirmation email to ${lead.email}`);
  } catch (err) {
    console.error("[caller-confirm] Failed to send contractor email:", err);
  }
}

// ── Email to Mike ───────────────────────────────────────────────────
async function sendMikeConfirmationEmail(
  lead: CallerLead,
  dayName: string,
  timeStr: string,
): Promise<void> {
  try {
    const ownerEmail = process.env.OWNER_EMAIL || "info@thewolfpackco.com";

    const addrs = await sql`
      SELECT * FROM warmup_addresses
      WHERE is_active = TRUE
      ORDER BY created_at ASC LIMIT 1
    `;
    if (addrs.length === 0) return;

    const addr = addrs[0];
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: addr.smtp_host as string,
      port: addr.smtp_port as number,
      secure: (addr.smtp_port as number) === 465,
      auth: {
        user: addr.smtp_user as string,
        pass: addr.smtp_pass as string,
      },
    });

    await transporter.sendMail({
      from: `Wolf Pack AI Caller <${addr.email as string}>`,
      to: ownerEmail,
      subject: `Demo Booked: ${lead.business_name || lead.contact_name || "Unknown"} — ${dayName} ${timeStr} ET`,
      text: [
        `Demo booked via AI Cold Caller`,
        ``,
        `Business: ${lead.business_name || "N/A"}`,
        `Contact: ${lead.contact_name || "N/A"}`,
        `Type: ${lead.contractor_type || "N/A"}`,
        `City: ${lead.city || "N/A"}`,
        `Phone: ${lead.phone}`,
        `Email: ${lead.email || "N/A"}`,
        `Reviews: ${lead.review_count || 0}`,
        ``,
        `Call: ${dayName} at ${timeStr} ET`,
      ].join("\n"),
    });

    console.log("[caller-confirm] Sent Mike confirmation email");
  } catch (err) {
    console.error("[caller-confirm] Failed to send Mike email:", err);
  }
}
