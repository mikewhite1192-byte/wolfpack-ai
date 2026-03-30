import { neon } from "@neondatabase/serverless";
import { getActivationSignals, determineUpgradeAction } from "./upgrade-triggers";
import type { WarmupAddress } from "./warmup";

const sql = neon(process.env.DATABASE_URL!);

const SIGNATURE = "\nMike, The Wolf Pack AI";

// Plain text upgrade emails — no links, no HTML, conversational
function getUpgradeEmail(step: number, signals: { repliesReceived: number; activeConversations: number }): { subject: string; body: string } | null {
  switch (step) {
    // Day 1-2: Seed value
    case 1:
      return {
        subject: "you should start seeing replies",
        body: `Hey,

You should start seeing replies coming in — this is where most agents start realizing how much follow-up they were missing.

Let me know if you have any questions about what you're seeing so far.

${SIGNATURE}`,
      };

    // Day 2-3: Soft pitch iMessage
    case 2:
      return {
        subject: "Re: you should start seeing replies",
        body: `Quick thought — we've seen way higher response rates when this runs through iMessage instead of SMS.

Happy to show you how that works if you want.

${SIGNATURE}`,
      };

    // Day 4-5: Stronger push
    case 3:
      return {
        subject: "Re: you should start seeing replies",
        body: `Just wanted to follow up on this — most people switch to iMessage once they see this working.

Response rates are noticeably higher. If you want I can walk you through the switch, takes about 2 minutes.

${SIGNATURE}`,
      };

    // Day 6-7: Close loop
    case 4:
      return {
        subject: "Re: you should start seeing replies",
        body: `Not sure if you've looked into iMessage yet — want me to walk you through it or keep you on SMS for now?

Either way works, just want to make sure you're getting the most out of this.

${SIGNATURE}`,
      };

    // Weekly nudge (after week 1) — rotate through these
    case 5:
      const nudges = [
        {
          subject: "quick iMessage win",
          body: `One agent switched to iMessage last week and started getting responses from leads that were dead for months.

Just thought you'd want to know. Let me know if you want to try it.

${SIGNATURE}`,
        },
        {
          subject: "something I noticed",
          body: `Been looking at the numbers — agents on iMessage are seeing about 3x the response rates compared to SMS.

The switch is quick if you ever want to test it out.

${SIGNATURE}`,
        },
        {
          subject: "quick question about your setup",
          body: `Curious — are you happy with the response rates you're getting on SMS right now?

Most agents who switch to iMessage see a pretty big jump. Happy to show you the difference if you want.

${SIGNATURE}`,
        },
      ];
      // Pick based on time to rotate
      const weekNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
      return nudges[weekNum % nudges.length];

    // Event-based: active conversations happening
    case 6:
      return {
        subject: "your conversations are picking up",
        body: `You've got ${signals.activeConversations} active conversations going — this is exactly where iMessage tends to perform best.

The leads that are already engaged respond even faster through iMessage. Want me to show you how to switch?

${SIGNATURE}`,
      };

    default:
      return null;
  }
}

// Get the user's email for a workspace (to send upgrade emails to)
async function getWorkspaceOwnerEmail(workspaceId: string): Promise<string | null> {
  // Check workspace members for the owner
  const members = await sql`
    SELECT wm.user_id FROM workspace_members wm
    WHERE wm.workspace_id = ${workspaceId} AND wm.role = 'owner'
    LIMIT 1
  `;

  if (members.length === 0) return null;

  // Get portal user email as fallback
  const portal = await sql`
    SELECT email FROM portal_users
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at ASC LIMIT 1
  `;

  return portal.length > 0 ? (portal[0].email as string) : null;
}

// Get the warmup address that originally acquired this workspace
// Falls back to first available cold sender address
async function getOriginatingAddress(workspaceId: string): Promise<WarmupAddress | null> {
  // Check upgrade_sequence for the originating sender
  const state = await sql`
    SELECT originating_sender FROM upgrade_sequence
    WHERE workspace_id = ${workspaceId}
    LIMIT 1
  `;

  if (state.length > 0 && state[0].originating_sender) {
    const addr = await sql`
      SELECT * FROM warmup_addresses
      WHERE email = ${state[0].originating_sender} AND is_active = TRUE
      LIMIT 1
    `;
    if (addr.length > 0) return addr[0] as unknown as WarmupAddress;
  }

  // Check if this workspace came through a cold outreach contact that replied
  const outreachOrigin = await sql`
    SELECT oe.from_email FROM outreach_emails oe
    JOIN outreach_contacts oc ON oc.id = oe.contact_id
    JOIN contacts c ON c.email = oc.email
    WHERE c.workspace_id = ${workspaceId}
      AND oe.from_email IS NOT NULL
    ORDER BY oe.sent_at ASC LIMIT 1
  `;

  if (outreachOrigin.length > 0) {
    const addr = await sql`
      SELECT * FROM warmup_addresses
      WHERE email = ${outreachOrigin[0].from_email} AND is_active = TRUE
      LIMIT 1
    `;
    if (addr.length > 0) return addr[0] as unknown as WarmupAddress;
  }

  // Fallback: first active cold sender
  const fallback = await sql`
    SELECT * FROM warmup_addresses
    WHERE is_active = TRUE AND cold_sender = TRUE
    ORDER BY warmup_started_at ASC LIMIT 1
  `;

  return fallback.length > 0 ? (fallback[0] as unknown as WarmupAddress) : null;
}

// Get upgrade sequence state for a workspace
async function getUpgradeState(workspaceId: string): Promise<{ lastStep: number; lastSentAt: string | null }> {
  const state = await sql`
    SELECT last_step, last_sent_at FROM upgrade_sequence
    WHERE workspace_id = ${workspaceId}
    LIMIT 1
  `;

  if (state.length === 0) return { lastStep: 0, lastSentAt: null };
  return {
    lastStep: state[0].last_step as number,
    lastSentAt: state[0].last_sent_at as string | null,
  };
}

// Update upgrade sequence state, track which address is sending
async function updateUpgradeState(workspaceId: string, step: number, fromEmail: string) {
  await sql`
    INSERT INTO upgrade_sequence (workspace_id, last_step, last_sent_at, emails_sent, originating_sender)
    VALUES (${workspaceId}, ${step}, NOW(), 1, ${fromEmail})
    ON CONFLICT (workspace_id) DO UPDATE SET
      last_step = ${step},
      last_sent_at = NOW(),
      emails_sent = upgrade_sequence.emails_sent + 1,
      originating_sender = COALESCE(upgrade_sequence.originating_sender, ${fromEmail})
  `;
}

// Send an upgrade email using the originating warmup address's SMTP
async function sendUpgradeEmail(
  fromAddress: WarmupAddress,
  toEmail: string,
  subject: string,
  body: string,
  workspaceId: string,
  step: number,
): Promise<boolean> {
  try {
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: fromAddress.smtp_host,
      port: fromAddress.smtp_port,
      secure: fromAddress.smtp_port === 465,
      auth: {
        user: fromAddress.smtp_user,
        pass: fromAddress.smtp_pass,
      },
    });

    await transporter.sendMail({
      from: `${fromAddress.display_name} <${fromAddress.email}>`,
      to: toEmail,
      subject,
      text: body, // Plain text only
    });

    // Log
    await sql`
      INSERT INTO upgrade_emails_log (workspace_id, to_email, from_email, step, subject, body)
      VALUES (${workspaceId}, ${toEmail}, ${fromAddress.email}, ${step}, ${subject}, ${body})
    `;

    return true;
  } catch (err) {
    console.error(`[upgrade] Failed to send from ${fromAddress.email} to ${toEmail}:`, err);
    return false;
  }
}

// Process all workspaces for upgrade emails
export async function processUpgradeSequences(): Promise<{ sent: number; skipped: number; errors: number }> {
  // Get all active, non-upgraded workspaces
  const workspaces = await sql`
    SELECT w.id, w.org_id FROM workspaces w
    LEFT JOIN subscriptions s ON s.org_id = w.org_id
    WHERE w.status = 'active'
      AND (s.plan IS NULL OR s.plan = 'starter')
  `;

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const ws of workspaces) {
    const workspaceId = ws.id as string;

    // Get activation signals
    const signals = await getActivationSignals(workspaceId);

    // Get current upgrade state
    const state = await getUpgradeState(workspaceId);

    // How many days since last upgrade email
    let lastSentDaysAgo: number | null = null;
    if (state.lastSentAt) {
      lastSentDaysAgo = Math.floor((Date.now() - new Date(state.lastSentAt).getTime()) / (1000 * 60 * 60 * 24));
    }

    // Determine action
    const action = determineUpgradeAction(signals, state.lastStep, lastSentDaysAgo);

    if (action.type === "none") {
      skipped++;
      continue;
    }

    // Get the email content
    const email = getUpgradeEmail(action.step, signals);
    if (!email) {
      skipped++;
      continue;
    }

    // Get workspace owner email (recipient)
    const ownerEmail = await getWorkspaceOwnerEmail(workspaceId);
    if (!ownerEmail) {
      skipped++;
      continue;
    }

    // Get the originating sender address (send FROM the email they came through)
    const fromAddress = await getOriginatingAddress(workspaceId);
    if (!fromAddress) {
      skipped++;
      continue;
    }

    // Send from the same address they originally interacted with
    const success = await sendUpgradeEmail(fromAddress, ownerEmail, email.subject, email.body, workspaceId, action.step);

    if (success) {
      await updateUpgradeState(workspaceId, action.step, fromAddress.email);
      sent++;
      console.log(`[upgrade] Sent step ${action.step} (${action.type}) from ${fromAddress.email} to ${ownerEmail} for workspace ${workspaceId}`);
    } else {
      errors++;
    }
  }

  return { sent, skipped, errors };
}

// Manually trigger an event-based upgrade check for a specific workspace
// Call this when a workspace gets a reply or has notable activity
export async function checkUpgradeEvent(workspaceId: string, event: string): Promise<boolean> {
  const signals = await getActivationSignals(workspaceId);
  if (signals.hasUpgraded) return false;

  const state = await getUpgradeState(workspaceId);
  let lastSentDaysAgo: number | null = null;
  if (state.lastSentAt) {
    lastSentDaysAgo = Math.floor((Date.now() - new Date(state.lastSentAt).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Only fire event-based if we've completed week 1 cadence and haven't sent recently
  if (state.lastStep < 4 || (lastSentDaysAgo !== null && lastSentDaysAgo < 3)) return false;

  const email = getUpgradeEmail(6, signals);
  if (!email) return false;

  const ownerEmail = await getWorkspaceOwnerEmail(workspaceId);
  if (!ownerEmail) return false;

  const fromAddress = await getOriginatingAddress(workspaceId);
  if (!fromAddress) return false;

  const success = await sendUpgradeEmail(fromAddress, ownerEmail, email.subject, email.body, workspaceId, 6);
  if (success) {
    await updateUpgradeState(workspaceId, 6, fromAddress.email);
    console.log(`[upgrade] Event-based (${event}) from ${fromAddress.email} to ${ownerEmail} for workspace ${workspaceId}`);
  }
  return success;
}
