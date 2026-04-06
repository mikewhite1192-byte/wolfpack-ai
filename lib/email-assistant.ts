// AI Email Reply Assistant
// Reads incoming cold email replies, responds in Mike's voice, books appointments
import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { sendMessage as sendLoop } from "./loop/client";
import {
  getBusyTimes,
  getAvailableSlots,
  createCalendarEvent,
} from "./calendar";
import { refreshAccessToken } from "./gmail";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sql = neon(process.env.DATABASE_URL!);

// ── Types ───────────────────────────────────────────────────────────
export type EmailStage =
  | "new"
  | "reply_1" | "reply_2" | "reply_3"
  | "price_objection" | "busy_objection" | "not_interested" | "send_info"
  | "agreed_to_call" | "booked"
  | "no_show" | "no_show_follow_1" | "no_show_follow_2" | "no_show_follow_3"
  | "no_close" | "no_close_follow_1" | "no_close_follow_2" | "no_close_follow_3" | "no_close_follow_4"
  | "closed_won" | "closed_lost" | "re_engagement"
  | "unsubscribed" | "dead";

export interface EmailConversation {
  id: string;
  outreach_contact_id: string;
  contact_email: string;
  contact_name: string;
  business_name: string;
  city: string;
  contractor_type: string;
  review_count: number;
  stage: EmailStage;
  sender_email: string;
  last_message_id: string | null;
  nudge_count: number;
  thread_summary: string | null;
  notes: string | null;
  call_time: string | null;
  call_type: string | null;
  meet_link: string | null;
  calendar_event_id: string | null;
  booking_id: string | null;
  call_outcome: string | null;
  close_outcome: string | null;
  close_reason: string | null;
  follow_up_call_time: string | null;
  follow_up_event_id: string | null;
  crm_outcome: string;
}

// ── AI Reply Generation ─────────────────────────────────────────────
export async function generateEmailReply(
  conv: EmailConversation,
  incomingBody: string,
  threadHistory: Array<{ direction: string; body: string; sent_at: string }>,
): Promise<{
  reply: string;
  newStage: EmailStage;
  agreedToCall: boolean;
  summary: string;
}> {
  const systemPrompt = `You are Mike from The Wolf Pack AI, replying to cold email responses from contractors. You are a real person, not a bot. Your ONLY goal is to book a 15-minute call.

YOUR VOICE & STYLE:
- Casual and conversational, like texting a friend
- Short replies, NEVER more than 3 sentences
- No dashes, no bullet points, no formal language
- Always end with a question or a CTA
- Never pitch features or price in the thread
- No emojis, no exclamation marks overload
- No signature block, no "Best regards", nothing formal

CONTRACTOR CONTEXT:
- Name: ${conv.contact_name || ""}
- Business: ${conv.business_name && conv.business_name !== "Results" ? conv.business_name : ""}
- City: ${conv.city && !conv.city.match(/^\d/) ? conv.city : ""}
- Type: ${conv.contractor_type || ""}
- Google Reviews: ${conv.review_count || ""}
- Current conversation stage: ${conv.stage}

IMPORTANT DATA RULES:
- If any field above is empty, DO NOT reference it in your reply. Just skip it naturally.
- NEVER use a street address in your reply. Only use city names.
- If Business is empty, don't mention their business name at all.
- If Name is empty, don't use a name, just start talking.
- If City is empty, say "your area" instead.
- If Type is empty, say "contractor" instead.

WHAT YOU DO:
You build websites for contractors — roofers, plumbers, HVAC, electricians etc. $500 one time. You're selling to contractors with bad websites and under 20 Google reviews. But NEVER mention price or features in email. Only goal is to get them on a call.

THE REPLY FRAMEWORK (adapt naturally based on what data you have):
Reply 1 — Find the pain:
"We help [type] contractors show up on Google when someone in [city] is searching for a [type]. How are most of your jobs coming in right now?"

Reply 2 — Agitate and connect:
"Referrals are great but they dry up. [type] contractors in [city] with a solid online presence are pulling in jobs they never had to ask for. That's what we set up."

Reply 3 — Book the call:
"Worth a quick 15 minutes this week? I can show you exactly what it looks like for [type] companies in [city]."

Replace [type] with their contractor type if known, otherwise just say "contractors".
Replace [city] with their city if known, otherwise say "your area".
If you don't have their business name, don't reference it. Keep it natural.

COMMON REPLY HANDLERS:
If they ask price: "Depends on what you need. Can I ask what your current setup looks like online?"
If they say busy: "That's good to hear. What does a slow month look like for you?"
If not interested: "No worries at all. What would have to change for something like this to make sense?"
If they say send more info: "Easier to just show you — got 15 minutes this week?"
If they agree to a call: Confirm the time. Say you'll send a calendar invite with a Google Meet link. If they can't do video, say a phone call works too.

TONE EXAMPLES:
TOO FORMAL (never do this): "Thank you for your response. I would love to schedule a call to discuss how our services can help your business grow online."
YOUR STYLE (always like this): "Referrals are great but they dry up. Roofers in Dallas with a solid online presence are pulling in jobs they never had to ask for. Worth a quick call this week?"

THREAD HISTORY:
${threadHistory.map(m => `[${m.direction}] ${m.body}`).join("\n\n")}

LATEST REPLY FROM CONTRACTOR:
${incomingBody}

RESPOND WITH JSON ONLY:
{
  "thinking": "What stage are they at, what's their intent, what should I say next",
  "reply": "Your email reply text — short, casual, ends with a question or CTA",
  "stage": "The new conversation stage after this reply",
  "agreedToCall": true/false,
  "preferredTime": "If they mentioned a specific time, extract it here, otherwise null",
  "summary": "One sentence summary of where this conversation stands"
}

STAGE OPTIONS: reply_1, reply_2, reply_3, price_objection, busy_objection, not_interested, send_info, agreed_to_call
Use agreed_to_call ONLY if they explicitly said yes to a call or asked about scheduling.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: "user", content: "Generate the reply." }],
  });

  const textBlock = response.content.find(b => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`[email-assistant] Thinking: ${parsed.thinking}`);
    console.log(`[email-assistant] Stage: ${parsed.stage} | Agreed: ${parsed.agreedToCall}`);

    return {
      reply: parsed.reply || "Hey, got your message. Worth a quick call this week?",
      newStage: parsed.stage || "reply_1",
      agreedToCall: parsed.agreedToCall === true,
      summary: parsed.summary || "Conversation in progress",
    };
  } catch {
    console.error("[email-assistant] Failed to parse AI response:", raw);
    return {
      reply: "Hey, got your message. Worth a quick call this week?",
      newStage: "reply_1",
      agreedToCall: false,
      summary: "AI parse error, sent default reply",
    };
  }
}

// ── Process New Inbox Reply ─────────────────────────────────────────
export async function processInboxReply(inboxReply: {
  id: string;
  from_email: string;
  from_name: string;
  to_address: string;
  subject: string;
  body: string;
  outreach_contact_id: string;
  message_id: string | null;
  in_reply_to: string | null;
}): Promise<{ action: string; reply?: string }> {

  // Get outreach contact data
  const contacts = await sql`
    SELECT oc.*, sb.name as biz_name, sb.category as biz_category
    FROM outreach_contacts oc
    LEFT JOIN scraped_businesses sb ON sb.email = oc.email
    WHERE oc.id = ${inboxReply.outreach_contact_id}
  `;
  if (contacts.length === 0) return { action: "skip_no_contact" };
  const contact = contacts[0];

  // Check for unsubscribe
  const bodyLower = inboxReply.body.toLowerCase().trim();
  if (/^(stop|unsubscribe|remove me|remove|opt out|take me off|cancel)$/i.test(bodyLower)
    || bodyLower.includes("unsubscribe me")
    || bodyLower.includes("remove me from")
    || bodyLower.includes("stop emailing")) {
    // Already handled by campaign-inbox.ts, just mark processed
    await sql`UPDATE campaign_inbox SET ai_processed = TRUE WHERE id = ${inboxReply.id}`;
    return { action: "unsubscribed" };
  }

  // Find or create email assistant conversation
  let convRows = await sql`
    SELECT * FROM email_assistant_conversations
    WHERE outreach_contact_id = ${inboxReply.outreach_contact_id}
    ORDER BY created_at DESC LIMIT 1
  `;

  const contactName = (contact.first_name as string) || (contact.name as string)?.split(" ")[0] || inboxReply.from_name?.split(" ")[0] || "";
  const businessName = (contact.company as string) || (contact.biz_name as string) || "";
  const city = (contact.city as string) || "";
  const contractorType = (contact.niche as string) || (contact.biz_category as string) || "";
  const reviewCount = (contact.review_count as number) || 0;

  if (convRows.length === 0) {
    // Create new conversation
    convRows = await sql`
      INSERT INTO email_assistant_conversations (
        outreach_contact_id, campaign_inbox_id, contact_email, contact_name,
        business_name, city, contractor_type, review_count,
        stage, sender_email, last_message_id
      ) VALUES (
        ${inboxReply.outreach_contact_id}, ${inboxReply.id}, ${inboxReply.from_email},
        ${contactName}, ${businessName}, ${city}, ${contractorType}, ${reviewCount},
        'new', ${inboxReply.to_address}, ${inboxReply.message_id}
      ) RETURNING *
    `;
  }

  const conv = convRows[0] as unknown as EmailConversation;

  // Skip if conversation is in a terminal state
  if (["closed_won", "closed_lost", "unsubscribed", "dead"].includes(conv.stage)) {
    await sql`UPDATE campaign_inbox SET ai_processed = TRUE WHERE id = ${inboxReply.id}`;
    return { action: "skip_terminal_stage" };
  }

  // Log inbound message
  await sql`
    INSERT INTO email_assistant_messages (conversation_id, direction, channel, body, subject, message_id)
    VALUES (${conv.id}, 'inbound', 'email', ${inboxReply.body}, ${inboxReply.subject}, ${inboxReply.message_id})
  `;

  // Get thread history
  const history = await sql`
    SELECT direction, body, sent_at FROM email_assistant_messages
    WHERE conversation_id = ${conv.id}
    ORDER BY sent_at ASC
  `;

  // Also get original cold emails sent to this contact
  const coldEmails = await sql`
    SELECT body, sent_at FROM outreach_emails
    WHERE contact_id = ${inboxReply.outreach_contact_id} AND status = 'sent'
    ORDER BY sent_at ASC
  `;

  // Build full thread with cold emails first, then assistant messages
  const fullThread = [
    ...coldEmails.map(e => ({ direction: "outbound", body: e.body as string, sent_at: e.sent_at as string })),
    ...history.map(h => ({ direction: h.direction as string, body: h.body as string, sent_at: h.sent_at as string })),
  ].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

  // Generate AI reply
  const result = await generateEmailReply(conv, inboxReply.body, fullThread);

  // If they agreed to a call, handle booking flow
  if (result.agreedToCall || result.newStage === "agreed_to_call") {
    const bookingResult = await handleCallBooking(conv, result.reply);

    if (bookingResult.booked) {
      // Send the reply with time confirmation
      await sendReplyEmail(conv, bookingResult.reply, inboxReply.message_id);

      // Update conversation
      await sql`
        UPDATE email_assistant_conversations SET
          stage = 'booked',
          crm_outcome = 'booked',
          call_time = ${bookingResult.callTime},
          call_type = ${bookingResult.callType},
          meet_link = ${bookingResult.meetLink},
          calendar_event_id = ${bookingResult.eventId},
          thread_summary = ${result.summary},
          next_action_at = ${new Date(new Date(bookingResult.callTime!).getTime() - 30 * 60000).toISOString()},
          next_action_type = 'reminder_30min',
          updated_at = NOW()
        WHERE id = ${conv.id}
      `;

      // Send iMessage to Mike
      await notifyMikeBooking(conv, bookingResult.callTime!, bookingResult.callType!, fullThread);

      await sql`UPDATE campaign_inbox SET ai_processed = TRUE WHERE id = ${inboxReply.id}`;
      return { action: "booked", reply: bookingResult.reply };
    }

    // Couldn't book yet — send reply asking for time preference
    const fallbackReply = `${result.reply}\n\nWhat day works best for you this week?`;
    await sendReplyEmail(conv, fallbackReply, inboxReply.message_id);

    await sql`
      UPDATE email_assistant_conversations SET
        stage = 'agreed_to_call',
        crm_outcome = 'interested',
        thread_summary = ${result.summary},
        updated_at = NOW()
      WHERE id = ${conv.id}
    `;

    await sql`UPDATE campaign_inbox SET ai_processed = TRUE WHERE id = ${inboxReply.id}`;
    return { action: "agreed_needs_time", reply: fallbackReply };
  }

  // Normal reply flow
  await sendReplyEmail(conv, result.reply, inboxReply.message_id);

  // Update conversation state
  const crmOutcome = result.newStage === "not_interested" ? "lost" : "interested";
  await sql`
    UPDATE email_assistant_conversations SET
      stage = ${result.newStage},
      crm_outcome = ${crmOutcome},
      thread_summary = ${result.summary},
      nudge_count = nudge_count + 1,
      updated_at = NOW()
    WHERE id = ${conv.id}
  `;

  await sql`UPDATE campaign_inbox SET ai_processed = TRUE WHERE id = ${inboxReply.id}`;

  return { action: "replied", reply: result.reply };
}

// ── Send Reply Email via SMTP ───────────────────────────────────────
async function sendReplyEmail(
  conv: EmailConversation,
  body: string,
  inReplyToMessageId: string | null,
): Promise<string | null> {
  // Get SMTP credentials for the sender
  const addrs = await sql`
    SELECT * FROM warmup_addresses WHERE email = ${conv.sender_email} AND is_active = TRUE LIMIT 1
  `;
  if (addrs.length === 0) {
    console.error(`[email-assistant] No SMTP creds for ${conv.sender_email}`);
    return null;
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

  // Get the original subject from the first cold email
  const origEmail = await sql`
    SELECT subject FROM outreach_emails
    WHERE contact_id = ${conv.outreach_contact_id} AND step = 1 AND status = 'sent'
    LIMIT 1
  `;
  let subject = origEmail[0]?.subject as string || "Quick question";
  if (!subject.startsWith("Re:")) subject = `Re: ${subject}`;

  const mailOptions: Record<string, unknown> = {
    from: `${addr.display_name || "Mike"} <${conv.sender_email}>`,
    to: conv.contact_email,
    subject,
    text: body,
  };

  // Thread the reply
  if (inReplyToMessageId) {
    mailOptions.inReplyTo = inReplyToMessageId;
    mailOptions.references = inReplyToMessageId;
  } else if (conv.last_message_id) {
    mailOptions.inReplyTo = conv.last_message_id;
    mailOptions.references = conv.last_message_id;
  }

  try {
    const result = await transporter.sendMail(mailOptions);
    const messageId = result.messageId || null;

    // Log outbound message
    await sql`
      INSERT INTO email_assistant_messages (conversation_id, direction, channel, body, subject, message_id)
      VALUES (${conv.id}, 'outbound', 'email', ${body}, ${subject}, ${messageId})
    `;

    // Also log in campaign_inbox so it shows in the inbox UI
    await sql`
      INSERT INTO campaign_inbox (
        from_email, from_name, to_address, subject, body,
        received_at, message_id, in_reply_to,
        outreach_contact_id, email_category, is_read, ai_processed
      ) VALUES (
        ${conv.sender_email}, ${addr.display_name as string || "Mike"}, ${conv.contact_email},
        ${subject}, ${body}, NOW(), ${messageId}, ${inReplyToMessageId},
        ${conv.outreach_contact_id}, 'cold_reply', TRUE, TRUE
      )
    `;

    // Update last message ID for threading
    await sql`
      UPDATE email_assistant_conversations SET last_message_id = ${messageId}, updated_at = NOW()
      WHERE id = ${conv.id}
    `;

    console.log(`[email-assistant] Sent reply to ${conv.contact_email}: ${body.substring(0, 80)}...`);
    return messageId;
  } catch (err) {
    console.error(`[email-assistant] Failed to send reply to ${conv.contact_email}:`, err);
    return null;
  }
}

// ── Calendar Booking ────────────────────────────────────────────────
async function handleCallBooking(
  conv: EmailConversation,
  aiReply: string,
): Promise<{
  booked: boolean;
  reply: string;
  callTime?: string;
  callType?: string;
  meetLink?: string;
  eventId?: string;
}> {
  try {
    // Get the specific workspace's Gmail token (not a random one)
    // Use owner workspace for email assistant calendar access
    const ownerEmail = process.env.OWNER_EMAIL || "info@thewolfpackco.com";
    const workspaces = await sql`
      SELECT id, gmail_refresh_token FROM workspaces
      WHERE gmail_connected = TRUE AND gmail_refresh_token IS NOT NULL
        AND (owner_email = ${ownerEmail} OR gmail_email = ${ownerEmail})
      LIMIT 1
    `;
    if (workspaces.length === 0) {
      console.error("[email-assistant] No workspace with Gmail connected for owner");
      return { booked: false, reply: aiReply };
    }

    const token = await refreshAccessToken(workspaces[0].gmail_refresh_token as string);

    // Get next 5 business days of availability
    const slots: Array<{ start: string; end: string; display: string }> = [];
    const now = new Date();

    for (let d = 0; d < 7 && slots.length < 6; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split("T")[0];

      const busyTimes = await getBusyTimes(
        token,
        `${dateStr}T00:00:00-05:00`,
        `${dateStr}T23:59:59-05:00`,
      );

      const daySlots = getAvailableSlots(dateStr, busyTimes, 15, 15, 9, 17, "America/New_York");
      slots.push(...daySlots);
    }

    if (slots.length === 0) {
      return {
        booked: false,
        reply: "Schedule is tight this week. What day next week works best for you?",
      };
    }

    // Pick the next available slot
    const slot = slots[0];
    const callType = "google_meet"; // default preference
    const contactName = conv.contact_name || conv.contact_email.split("@")[0];

    // Create calendar event with Google Meet
    const event = await createCalendarEvent(
      token,
      `Wolf Pack x ${conv.business_name || contactName} — Website Call`,
      `15-min website call with ${contactName} from ${conv.business_name || ""}.\n${conv.contractor_type || "Contractor"} in ${conv.city || ""}.\n${conv.review_count || 0} Google reviews.\n\nIf you can't do video, the call will work over phone too.`,
      slot.start,
      slot.end,
      conv.contact_email,
      true, // add Google Meet
    );

    const eventAny = event as unknown as Record<string, unknown>;
    const confData = eventAny.conferenceData as Record<string, unknown> | undefined;
    const entryPoints = confData?.entryPoints as Array<Record<string, string>> | undefined;
    const meetLink = (eventAny.hangoutLink as string)
      || entryPoints?.[0]?.uri
      || null;

    // Format the time nicely
    const callDate = new Date(slot.start);
    const dayName = callDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" });
    const timeStr = callDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

    const confirmReply = `${dayName} at ${timeStr} ET works. Sending you a calendar invite now with a Google Meet link. If you'd rather just do a phone call that works too.`;

    return {
      booked: true,
      reply: confirmReply,
      callTime: slot.start,
      callType: meetLink ? "google_meet" : "phone",
      meetLink: meetLink || undefined,
      eventId: eventAny.id as string,
    };
  } catch (err) {
    console.error("[email-assistant] Booking error:", err);
    return {
      booked: false,
      reply: aiReply + "\n\nWhat day works best for you this week?",
    };
  }
}

// ── iMessage Notifications ──────────────────────────────────────────
async function notifyMikeBooking(
  conv: EmailConversation,
  callTime: string,
  callType: string,
  threadHistory: Array<{ direction: string; body: string }>,
): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE;
  if (!ownerPhone) {
    console.error("[email-assistant] OWNER_PHONE not set, skipping iMessage");
    return;
  }

  const callDate = new Date(callTime);
  const dayName = callDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" });
  const timeStr = callDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

  // Summarize the thread for context
  const lastFewMessages = threadHistory.slice(-4).map(m =>
    `${m.direction === "inbound" ? "Them" : "You"}: ${m.body.substring(0, 150)}`
  ).join("\n");

  const msg = `${conv.contact_name || "Someone"} from ${conv.city || "unknown city"} booked for ${dayName} at ${timeStr} ET. They're a ${conv.contractor_type || "contractor"} with ${conv.review_count || "unknown"} reviews. Here's what to know going in: ${conv.thread_summary || lastFewMessages}`;

  try {
    await sendLoop(ownerPhone, msg);
    console.log(`[email-assistant] Sent booking iMessage to owner`);
  } catch (err) {
    console.error("[email-assistant] Failed to send booking iMessage:", err);
  }
}

// Send 1-hour pre-call reminder to the contractor (via text if we have their phone)
export async function sendClientCallReminder(conv: EmailConversation): Promise<void> {
  const contactPhone = await getContactPhone(conv.outreach_contact_id);
  if (!contactPhone) {
    console.log(`[email-assistant] No phone for ${conv.contact_name}, skipping client reminder`);
    return;
  }

  const firstName = conv.contact_name || "there";
  const callDate = new Date(conv.call_time!);
  const timeStr = callDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

  let msg = `Hey ${firstName}, looking forward to chatting today at ${timeStr} ET about ${conv.business_name || "your business"}`;
  if (conv.meet_link) {
    msg += `. Here's the link when you're ready: ${conv.meet_link}`;
  }

  try {
    await sendLoop(contactPhone, msg);
    console.log(`[email-assistant] Sent client call reminder to ${contactPhone}`);
  } catch (err) {
    console.error("[email-assistant] Failed to send client reminder:", err);
  }
}

// Send 30-minute pre-call reminder to Mike
export async function sendPreCallReminder(conv: EmailConversation): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE;
  if (!ownerPhone) return;

  const callDate = new Date(conv.call_time!);
  const timeStr = callDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

  // Get thread for context
  const messages = await sql`
    SELECT direction, body FROM email_assistant_messages
    WHERE conversation_id = ${conv.id}
    ORDER BY sent_at ASC
  `;

  // Find the main pain point from their messages
  const theirMessages = messages.filter(m => m.direction === "inbound").map(m => m.body as string).join(" ");
  const painSummary = conv.thread_summary || theirMessages.substring(0, 200);

  const msg = `Heads up — ${conv.contact_name || "contractor"} call in 30 minutes. Their main pain point was ${painSummary}. Goal is close the $500 website.`;

  try {
    await sendLoop(ownerPhone, msg);
    console.log(`[email-assistant] Sent pre-call reminder to owner`);
  } catch (err) {
    console.error("[email-assistant] Failed to send pre-call reminder:", err);
  }
}

// ── Post-Call Flows ─────────────────────────────────────────────────

// No-show handler
export async function handleNoShow(conv: EmailConversation): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE;
  const contactPhone = await getContactPhone(conv.outreach_contact_id);
  const firstName = conv.contact_name || "there";

  if (conv.stage === "booked" || conv.stage === "no_show") {
    // First no-show text (immediately when they don't join within 5 min)
    if (contactPhone) {
      await sendLoop(contactPhone,
        `Hey ${firstName}, looks like we missed each other — still want to connect about ${conv.business_name || "your"} online presence? I've got time ${getNextTwoDays()}`
      );
    }
    await updateConvState(conv.id, "no_show_follow_1", "no_show", 24, "no_show_text_2");
  }
  else if (conv.stage === "no_show_follow_1") {
    // 24 hours later
    if (contactPhone) {
      await sendLoop(contactPhone,
        `Hey ${firstName} — still happy to chat whenever works for you. Just let me know`
      );
    }
    await updateConvState(conv.id, "no_show_follow_2", "no_show", 48, "no_show_email_3");
  }
  else if (conv.stage === "no_show_follow_2") {
    // 48 hours later — drop back to email
    await sendReplyEmail(conv,
      `Tried to connect a couple times — no worries if timing is off. Still here if you want to talk about getting ${conv.business_name || "your business"} showing up online`,
      conv.last_message_id,
    );
    await updateConvState(conv.id, "no_show_follow_3", "lost", null, null);
    // Log as no show in CRM
    await sql`
      UPDATE email_assistant_conversations SET crm_outcome = 'no_show', call_outcome = 'no_show', updated_at = NOW()
      WHERE id = ${conv.id}
    `;
  }
}

// No close — no follow-up appointment set
export async function handleNoClose(conv: EmailConversation): Promise<void> {
  const contactPhone = await getContactPhone(conv.outreach_contact_id);
  const firstName = conv.contact_name || "there";

  if (conv.stage === "no_close") {
    // 24 hours after call
    if (contactPhone) {
      await sendLoop(contactPhone,
        `Hey ${firstName}, good talking earlier. Had a chance to think about it?`
      );
    }
    await updateConvState(conv.id, "no_close_follow_1", "no_close", 4 * 24, "no_close_text_2");
  }
  else if (conv.stage === "no_close_follow_1") {
    // 4 days
    if (contactPhone) {
      await sendLoop(contactPhone,
        `Hey ${firstName} — still thinking about what we talked about for ${conv.business_name || "your business"}. Timing still work?`
      );
    }
    await updateConvState(conv.id, "no_close_follow_2", "no_close", 7 * 24, "no_close_text_3");
  }
  else if (conv.stage === "no_close_follow_2") {
    // 7 days
    if (contactPhone) {
      await sendLoop(contactPhone,
        `Last nudge from me ${firstName}. Contractors in ${conv.city || "your area"} are moving fast online right now — happy to pick back up whenever you're ready`
      );
    }
    await updateConvState(conv.id, "no_close_follow_3", "no_close", 14 * 24, "no_close_text_4");
  }
  else if (conv.stage === "no_close_follow_3") {
    // 14 days — final
    if (contactPhone) {
      await sendLoop(contactPhone,
        `Hey ${firstName} — circling back one last time. If ${conv.business_name || "your business"} ever wants to show up when someone in ${conv.city || "your area"} searches for a ${conv.contractor_type || "contractor"}, I'm here. Good luck out there`
      );
    }
    await updateConvState(conv.id, "no_close_follow_4", "lost", null, null);
  }
}

// No close — follow-up appointment set (second call)
export async function handleFollowUpCall(conv: EmailConversation): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE;
  const contactPhone = await getContactPhone(conv.outreach_contact_id);
  const firstName = conv.contact_name || "there";

  // 1 hour before: reminder to contractor
  if (contactPhone && conv.follow_up_call_time) {
    await sendLoop(contactPhone,
      `Hey ${firstName}, looking forward to chatting today about ${conv.business_name || "your business"}`
    );
  }

  // 30 min before: reminder to Mike with context
  if (ownerPhone && conv.follow_up_call_time) {
    await sendLoop(ownerPhone,
      `Second call with ${firstName} from ${conv.business_name || "unknown"} in 30 minutes. They didn't close last time because ${conv.close_reason || "unknown reason"}. Focus on ${conv.thread_summary || "their pain points"} today`
    );
  }
}

// Closed Won
export async function handleClosedWon(conv: EmailConversation): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE;
  const contactPhone = await getContactPhone(conv.outreach_contact_id);
  const firstName = conv.contact_name || "there";

  // iMessage to Mike
  if (ownerPhone) {
    await sendLoop(ownerPhone,
      `${firstName} from ${conv.business_name || "unknown"} closed. $500 website. Add to onboarding pipeline`
    );
  }

  // Text to contractor
  if (contactPhone) {
    await sendLoop(contactPhone,
      `Excited to work with you ${firstName}. I'm going to send over an email with the things we need to get started on ${conv.business_name || "your"} site. Once we get everything back, your website will be live within 2 business days. After that we'll do a quick call to go over any revisions, connect your domain, and get your CRM set up`
    );
  }

  // Send onboarding email collecting everything we need
  await sendOnboardingEmail(conv);

  // Create deal in the Client Onboarding pipeline (Waiting on Assets stage)
  await createOnboardingDeal(conv);

  // Schedule long-term client check-ins
  await scheduleClientCheckins(conv, contactPhone);

  await sql`
    UPDATE email_assistant_conversations SET
      stage = 'closed_won', crm_outcome = 'closed_won', close_outcome = 'closed_won',
      updated_at = NOW()
    WHERE id = ${conv.id}
  `;
}

// Send the onboarding email to collect site assets
async function sendOnboardingEmail(conv: EmailConversation): Promise<void> {
  const firstName = conv.contact_name || "there";
  const businessName = conv.business_name || "your business";

  const body = `Hey ${firstName},

Excited to get started on ${businessName}'s new site. Here's what I need from you to build it out:

1. Your logo (any format works, if you don't have one no worries we'll work with what you've got)
2. Business info (phone number, address, email you want on the site, hours of operation)
3. Color scheme (any colors you like or your current brand colors, otherwise I'll put something together)
4. Any photos you want on the site (jobsite pics, finished projects, your truck, team photos, anything)
5. The main cities/areas you service
6. Your main services (just list them out however makes sense)

Just reply to this email with everything whenever you've got it. No rush but the sooner I get it, the sooner your site goes live.

Once I have everything your site will be live within 2 business days. After that we'll do a quick call to go over any revisions you want, connect your domain, and get your CRM set up. Once you're live I'll also get your Google Business page dialed in so you start showing up in local searches.

Talk soon,
Mike`;

  await sendReplyEmail(conv, body, conv.last_message_id);
  console.log(`[email-assistant] Sent onboarding email to ${conv.contact_email}`);
}

// Create a deal in the Client Onboarding pipeline
async function createOnboardingDeal(conv: EmailConversation): Promise<void> {
  try {
    // Get the first workspace
    const workspaces = await sql`SELECT id FROM workspaces WHERE status = 'active' LIMIT 1`;
    if (workspaces.length === 0) return;
    const workspaceId = workspaces[0].id as string;

    // Find or create the "Client Onboarding" pipeline
    let pipeline = await sql`
      SELECT id FROM pipelines WHERE workspace_id = ${workspaceId} AND name = 'Client Onboarding' LIMIT 1
    `;

    if (pipeline.length === 0) {
      // Create the pipeline and its stages
      pipeline = await sql`
        INSERT INTO pipelines (workspace_id, name, is_default) VALUES (${workspaceId}, 'Client Onboarding', FALSE) RETURNING id
      `;
      const pipelineId = pipeline[0].id as string;

      await sql`
        INSERT INTO pipeline_stages (workspace_id, pipeline_id, name, position, color) VALUES
          (${workspaceId}, ${pipelineId}, 'Waiting on Assets', 1, '#F59E0B'),
          (${workspaceId}, ${pipelineId}, 'Building', 2, '#3B82F6'),
          (${workspaceId}, ${pipelineId}, 'Setup Call Scheduled', 3, '#8B5CF6'),
          (${workspaceId}, ${pipelineId}, 'Live Client', 4, '#10B981')
      `;

      // Also create the Closed Deals pipeline
      const closedPipeline = await sql`
        INSERT INTO pipelines (workspace_id, name, is_default) VALUES (${workspaceId}, 'Closed Deals', FALSE) RETURNING id
      `;
      await sql`
        INSERT INTO pipeline_stages (workspace_id, pipeline_id, name, position, color, is_won) VALUES
          (${workspaceId}, ${closedPipeline[0].id}, 'Closed', 1, '#10B981', TRUE)
      `;

      console.log(`[email-assistant] Created Client Onboarding + Closed Deals pipelines`);
    }

    const pipelineId = pipeline[0].id as string;

    // Get the "Waiting on Assets" stage
    const stages = await sql`
      SELECT id FROM pipeline_stages WHERE pipeline_id = ${pipelineId} AND name = 'Waiting on Assets' LIMIT 1
    `;
    if (stages.length === 0) return;

    // Find or create a CRM contact for this outreach contact
    let crmContact = await sql`
      SELECT id FROM contacts WHERE email = ${conv.contact_email} AND workspace_id = ${workspaceId} LIMIT 1
    `;

    if (crmContact.length === 0) {
      const nameParts = (conv.contact_name || "").split(" ");
      crmContact = await sql`
        INSERT INTO contacts (workspace_id, first_name, last_name, email, company, source, tags)
        VALUES (
          ${workspaceId},
          ${nameParts[0] || null},
          ${nameParts.slice(1).join(" ") || null},
          ${conv.contact_email},
          ${conv.business_name || null},
          'cold_email',
          ${["closed-won", conv.contractor_type || "contractor"]}
        ) RETURNING id
      `;
    }

    const contactId = crmContact[0].id as string;

    // Create the deal
    await sql`
      INSERT INTO deals (workspace_id, contact_id, stage_id, title, value, notes)
      VALUES (
        ${workspaceId},
        ${contactId},
        ${stages[0].id},
        ${`${conv.business_name || conv.contact_name} — Website`},
        ${500},
        ${`${conv.contractor_type || "Contractor"} in ${conv.city || "unknown"}. ${conv.review_count || 0} reviews. Onboarding email sent.`}
      )
    `;

    console.log(`[email-assistant] Created onboarding deal for ${conv.contact_name}`);
  } catch (err) {
    console.error("[email-assistant] Failed to create onboarding deal:", err);
  }
}

// Schedule 1 month, 6 month, 1 year check-in texts
async function scheduleClientCheckins(conv: EmailConversation, contactPhone: string | null): Promise<void> {
  if (!contactPhone) return;

  const now = Date.now();
  const checkins = [
    { type: "1_month", offsetMs: 30 * 24 * 60 * 60 * 1000 },
    { type: "6_month", offsetMs: 180 * 24 * 60 * 60 * 1000 },
    { type: "1_year", offsetMs: 365 * 24 * 60 * 60 * 1000 },
  ];

  for (const c of checkins) {
    await sql`
      INSERT INTO client_checkins (conversation_id, outreach_contact_id, contact_name, business_name, contact_phone, checkin_type, due_at)
      VALUES (${conv.id}, ${conv.outreach_contact_id}, ${conv.contact_name}, ${conv.business_name}, ${contactPhone}, ${c.type}, ${new Date(now + c.offsetMs).toISOString()})
    `;
  }

  console.log(`[email-assistant] Scheduled 3 check-ins for ${conv.contact_name}`);
}

// Send a scheduled client check-in text
export async function sendClientCheckin(checkin: {
  id: string;
  contact_name: string;
  business_name: string;
  contact_phone: string;
  checkin_type: string;
}): Promise<void> {
  const firstName = checkin.contact_name || "there";
  const businessName = checkin.business_name || "your business";

  const messages: Record<string, string> = {
    "1_month": `Hey ${firstName}, it's been about a month since we got ${businessName}'s site live. How's everything going? Getting any leads from it yet?`,
    "6_month": `Hey ${firstName}, just checking in on ${businessName}. Can't believe it's been 6 months already. How's the site treating you? Anything you want to update or add?`,
    "1_year": `Hey ${firstName}, happy one year with the site! How's ${businessName} doing? If you ever want to refresh anything or add new services just let me know`,
  };

  const msg = messages[checkin.checkin_type];
  if (!msg) return;

  try {
    await sendLoop(checkin.contact_phone, msg);
    await sql`UPDATE client_checkins SET status = 'sent', sent_at = NOW() WHERE id = ${checkin.id}`;
    console.log(`[email-assistant] Sent ${checkin.checkin_type} check-in to ${firstName}`);
  } catch (err) {
    console.error(`[email-assistant] Failed to send check-in to ${firstName}:`, err);
  }
}

// Closed Lost
export async function handleClosedLost(conv: EmailConversation, reason?: string): Promise<void> {
  await sql`
    UPDATE email_assistant_conversations SET
      stage = 'closed_lost', crm_outcome = 'closed_lost', close_outcome = 'closed_lost',
      close_reason = ${reason || null},
      next_action_at = ${new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()},
      next_action_type = 're_engagement_90d',
      updated_at = NOW()
    WHERE id = ${conv.id}
  `;
}

// 90-day re-engagement
export async function handleReEngagement(conv: EmailConversation): Promise<void> {
  const contactPhone = await getContactPhone(conv.outreach_contact_id);
  const firstName = conv.contact_name || "there";

  if (contactPhone) {
    await sendLoop(contactPhone,
      `Hey ${firstName} — checking in on ${conv.business_name || "your business"}. Things pick up or slow down since we talked?`
    );
  }

  await sql`
    UPDATE email_assistant_conversations SET
      stage = 're_engagement', next_action_at = NULL, next_action_type = NULL, updated_at = NOW()
    WHERE id = ${conv.id}
  `;
}

// ── Helpers ─────────────────────────────────────────────────────────
async function getContactPhone(outreachContactId: string): Promise<string | null> {
  // Try outreach_contacts phone first, then scraped_businesses
  const result = await sql`
    SELECT oc.phone, sb.phone as biz_phone
    FROM outreach_contacts oc
    LEFT JOIN scraped_businesses sb ON sb.email = oc.email
    WHERE oc.id = ${outreachContactId}
  `;
  return (result[0]?.phone as string) || (result[0]?.biz_phone as string) || null;
}

async function updateConvState(
  convId: string,
  newStage: string,
  crmOutcome: string,
  nextActionHours: number | null,
  nextActionType: string | null,
): Promise<void> {
  const nextActionAt = nextActionHours
    ? new Date(Date.now() + nextActionHours * 60 * 60 * 1000).toISOString()
    : null;

  await sql`
    UPDATE email_assistant_conversations SET
      stage = ${newStage},
      crm_outcome = ${crmOutcome},
      nudge_count = nudge_count + 1,
      next_action_at = ${nextActionAt},
      next_action_type = ${nextActionType},
      updated_at = NOW()
    WHERE id = ${convId}
  `;
}

function getNextTwoDays(): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const now = new Date();
  const d1 = new Date(now);
  const d2 = new Date(now);

  // Skip to next business days
  let offset = 1;
  while (true) {
    d1.setDate(now.getDate() + offset);
    if (d1.getDay() !== 0 && d1.getDay() !== 6) break;
    offset++;
  }
  offset++;
  while (true) {
    d2.setDate(now.getDate() + offset);
    if (d2.getDay() !== 0 && d2.getDay() !== 6) break;
    offset++;
  }

  return `${days[d1.getDay()]} or ${days[d2.getDay()]} this week`;
}
