/**
 * SNS Webhook for Amazon SES bounce/complaint/delivery notifications
 *
 * Setup:
 * 1. In SES console, create a Configuration Set with SNS destination for Bounce, Complaint, Delivery events
 * 2. Create SNS topic (e.g. "ses-notifications") and subscribe this endpoint URL to it
 * 3. Set SES_SNS_TOPIC_ARN env var to the topic ARN
 * 4. SNS will send a SubscriptionConfirmation — this endpoint auto-confirms it
 *
 * Data cleanup SQL — run once to mark contacts with invalid emails:
 * ---------------------------------------------------------------
 * UPDATE outreach_contacts SET
 *   bounced = TRUE,
 *   bounced_at = NOW(),
 *   sequence_status = 'bounced'
 * WHERE email ~ '%[0-9a-fA-F]{2}'
 *    OR email ~ '\s'
 *    OR email LIKE '% %';
 * ---------------------------------------------------------------
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { markBounced, markUnsubscribed } from "@/lib/outreach/sequence";
import { recordBounce, recordComplaint, autoProtect } from "@/lib/outreach/email-health";

const sql = neon(process.env.DATABASE_URL!);

const EXPECTED_TOPIC_ARN = process.env.SES_SNS_TOPIC_ARN || "";

// SNS sends POST requests
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const snsMessage = JSON.parse(body);

    // Validate TopicArn if configured
    if (EXPECTED_TOPIC_ARN && snsMessage.TopicArn && snsMessage.TopicArn !== EXPECTED_TOPIC_ARN) {
      console.warn("[ses-webhook] Rejected — unexpected TopicArn:", snsMessage.TopicArn);
      return NextResponse.json({ error: "Invalid TopicArn" }, { status: 403 });
    }

    const messageType = snsMessage.Type;

    // --- Handle SubscriptionConfirmation ---
    if (messageType === "SubscriptionConfirmation") {
      const subscribeUrl = snsMessage.SubscribeURL;
      console.log("[ses-webhook] Confirming SNS subscription:", subscribeUrl);
      await fetch(subscribeUrl);
      return NextResponse.json({ status: "subscription_confirmed" });
    }

    // --- Handle UnsubscribeConfirmation ---
    if (messageType === "UnsubscribeConfirmation") {
      console.log("[ses-webhook] SNS unsubscribe confirmation received");
      return NextResponse.json({ status: "unsubscribe_noted" });
    }

    // --- Handle Notification ---
    if (messageType === "Notification") {
      // The Message field is a JSON string inside the SNS envelope
      const sesEvent = JSON.parse(snsMessage.Message);
      const notificationType = sesEvent.notificationType || sesEvent.eventType;

      console.log(`[ses-webhook] SES event: ${notificationType}`);

      if (notificationType === "Bounce") {
        await handleBounce(sesEvent);
      } else if (notificationType === "Complaint") {
        await handleComplaint(sesEvent);
      } else if (notificationType === "Delivery") {
        await handleDelivery(sesEvent);
      } else {
        console.log(`[ses-webhook] Unhandled event type: ${notificationType}`);
      }

      return NextResponse.json({ status: "processed", type: notificationType });
    }

    console.warn("[ses-webhook] Unknown SNS message type:", messageType);
    return NextResponse.json({ status: "ignored" });
  } catch (err) {
    console.error("[ses-webhook] Error processing SNS message:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// --- Bounce handler ---
async function handleBounce(sesEvent: Record<string, unknown>) {
  const bounce = sesEvent.bounce as Record<string, unknown>;
  const mail = sesEvent.mail as Record<string, unknown>;

  if (!bounce || !mail) {
    console.warn("[ses-webhook] Malformed bounce event — missing bounce or mail field");
    return;
  }

  const bounceType = bounce.bounceType as string; // "Permanent" or "Transient"
  const messageId = mail.messageId as string;
  const source = mail.source as string; // the from address
  const recipients = (bounce.bouncedRecipients as Array<Record<string, string>>) || [];

  console.log(`[ses-webhook] Bounce: type=${bounceType}, messageId=${messageId}, from=${source}, recipients=${recipients.map(r => r.emailAddress).join(",")}`);

  // Only process hard bounces (Permanent) — transient bounces are temporary
  if (bounceType !== "Permanent") {
    console.log(`[ses-webhook] Skipping transient bounce for messageId=${messageId}`);
    return;
  }

  for (const recipient of recipients) {
    const recipientEmail = recipient.emailAddress;
    if (!recipientEmail) continue;

    // Mark the contact as bounced
    await markBounced(recipientEmail);

    // Update the specific email record via message ID
    // SES messageId may or may not have angle brackets — match flexibly
    await sql`
      UPDATE outreach_emails SET status = 'bounced'
      WHERE (ses_message_id = ${messageId} OR message_id_header = ${messageId}
        OR ses_message_id = ${'<' + messageId + '>'} OR message_id_header = ${'<' + messageId + '>'})
        AND status != 'bounced'
    `;

    // Record bounce in health tracking
    await recordBounce(source || "", recipientEmail, messageId || "");
  }

  // Auto-protect: check if sender should be paused
  const paused = await autoProtect();
  if (paused.length > 0) {
    console.log(`[ses-webhook] Auto-paused senders after bounce: ${paused.join(", ")}`);
  }
}

// --- Complaint handler ---
async function handleComplaint(sesEvent: Record<string, unknown>) {
  const complaint = sesEvent.complaint as Record<string, unknown>;
  const mail = sesEvent.mail as Record<string, unknown>;

  if (!complaint || !mail) {
    console.warn("[ses-webhook] Malformed complaint event — missing complaint or mail field");
    return;
  }

  const messageId = mail.messageId as string;
  const source = mail.source as string;
  const recipients = (complaint.complainedRecipients as Array<Record<string, string>>) || [];

  console.log(`[ses-webhook] Complaint: messageId=${messageId}, from=${source}, recipients=${recipients.map(r => r.emailAddress).join(",")}`);

  for (const recipient of recipients) {
    const recipientEmail = recipient.emailAddress;
    if (!recipientEmail) continue;

    // Mark contact as unsubscribed (spam complaint = permanent removal)
    await markUnsubscribed(recipientEmail);

    // Update the specific email record
    await sql`
      UPDATE outreach_emails SET status = 'complained'
      WHERE (ses_message_id = ${messageId} OR message_id_header = ${messageId}
        OR ses_message_id = ${'<' + messageId + '>'} OR message_id_header = ${'<' + messageId + '>'})
        AND status != 'complained'
    `;

    // Record complaint in health tracking
    await recordComplaint(source || "", messageId || "");
  }

  // Auto-protect: complaints are severe
  const paused = await autoProtect();
  if (paused.length > 0) {
    console.log(`[ses-webhook] Auto-paused senders after complaint: ${paused.join(", ")}`);
  }
}

// --- Delivery handler ---
async function handleDelivery(sesEvent: Record<string, unknown>) {
  const mail = sesEvent.mail as Record<string, unknown>;

  if (!mail) {
    console.warn("[ses-webhook] Malformed delivery event — missing mail field");
    return;
  }

  const messageId = mail.messageId as string;

  console.log(`[ses-webhook] Delivery confirmed: messageId=${messageId}`);

  // Update status to delivered
  await sql`
    UPDATE outreach_emails SET status = 'delivered'
    WHERE (ses_message_id = ${messageId} OR message_id_header = ${messageId}
      OR ses_message_id = ${'<' + messageId + '>'} OR message_id_header = ${'<' + messageId + '>'})
      AND status = 'sent'
  `;
}
