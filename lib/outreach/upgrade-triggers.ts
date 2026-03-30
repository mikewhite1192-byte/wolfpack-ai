import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Activation signals we check before sending upgrade emails
export interface ActivationSignals {
  workspaceId: string;
  hasSentMessages: boolean;
  hasReceivedReplies: boolean;
  messagesSent: number;
  repliesReceived: number;
  activeConversations: number;
  daysSinceSignup: number;
  lastLoginDaysAgo: number | null;
  hasUpgraded: boolean;
  plan: string;
}

// Check all activation signals for a workspace
export async function getActivationSignals(workspaceId: string): Promise<ActivationSignals> {
  // Get workspace creation date and plan
  const ws = await sql`
    SELECT w.created_at, s.plan, s.status as sub_status
    FROM workspaces w
    LEFT JOIN subscriptions s ON s.org_id = w.org_id
    WHERE w.id = ${workspaceId}
  `;

  if (ws.length === 0) {
    return {
      workspaceId,
      hasSentMessages: false,
      hasReceivedReplies: false,
      messagesSent: 0,
      repliesReceived: 0,
      activeConversations: 0,
      daysSinceSignup: 0,
      lastLoginDaysAgo: null,
      hasUpgraded: false,
      plan: "starter",
    };
  }

  const createdAt = new Date(ws[0].created_at);
  const daysSinceSignup = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const plan = (ws[0].plan as string) || "starter";
  const hasUpgraded = plan !== "starter";

  // Count outbound messages (AI or user sent)
  const sentResult = await sql`
    SELECT COUNT(*) as count FROM messages
    WHERE workspace_id = ${workspaceId}
      AND direction = 'outbound'
  `;
  const messagesSent = parseInt(sentResult[0].count);

  // Count inbound replies
  const replyResult = await sql`
    SELECT COUNT(*) as count FROM messages
    WHERE workspace_id = ${workspaceId}
      AND direction = 'inbound'
  `;
  const repliesReceived = parseInt(replyResult[0].count);

  // Count active conversations (messages in last 7 days)
  const activeResult = await sql`
    SELECT COUNT(DISTINCT id) as count FROM conversations
    WHERE workspace_id = ${workspaceId}
      AND status = 'open'
      AND last_message_at >= NOW() - INTERVAL '7 days'
  `;
  const activeConversations = parseInt(activeResult[0].count);

  return {
    workspaceId,
    hasSentMessages: messagesSent > 0,
    hasReceivedReplies: repliesReceived > 0,
    messagesSent,
    repliesReceived,
    activeConversations,
    daysSinceSignup,
    lastLoginDaysAgo: null, // We'd need login tracking for this
    hasUpgraded,
    plan,
  };
}

// Determine which upgrade email (if any) should be sent
export type UpgradeAction =
  | { type: "none" }
  | { type: "seed"; step: 1 }
  | { type: "soft_pitch"; step: 2 }
  | { type: "stronger_push"; step: 3 }
  | { type: "close_loop"; step: 4 }
  | { type: "weekly_nudge"; step: 5 }
  | { type: "event_based"; step: 6; trigger: string };

export function determineUpgradeAction(
  signals: ActivationSignals,
  lastStepSent: number,
  lastSentDaysAgo: number | null,
): UpgradeAction {
  // Already upgraded — no more upgrade emails
  if (signals.hasUpgraded) return { type: "none" };

  const { daysSinceSignup, hasSentMessages, hasReceivedReplies, activeConversations } = signals;

  // Week 1: Time-based cadence (only if activated)
  if (daysSinceSignup <= 7) {
    // Day 0: No pitch
    if (daysSinceSignup < 1) return { type: "none" };

    // Day 1-2: Seed value (only if they've had activity)
    if (daysSinceSignup >= 1 && daysSinceSignup <= 2 && lastStepSent < 1) {
      if (!hasSentMessages) return { type: "none" }; // No activity yet — don't send
      return { type: "seed", step: 1 };
    }

    // Day 2-3: Soft pitch
    if (daysSinceSignup >= 2 && daysSinceSignup <= 3 && lastStepSent < 2) {
      if (!hasSentMessages) return { type: "none" };
      return { type: "soft_pitch", step: 2 };
    }

    // Day 4-5: Stronger push
    if (daysSinceSignup >= 4 && daysSinceSignup <= 5 && lastStepSent < 3) {
      if (!hasSentMessages) return { type: "none" };
      return { type: "stronger_push", step: 3 };
    }

    // Day 6-7: Close loop
    if (daysSinceSignup >= 6 && lastStepSent < 4) {
      return { type: "close_loop", step: 4 };
    }

    return { type: "none" };
  }

  // After week 1: Event-based + weekly nudges

  // Event-based: they just got replies and have active conversations
  if (hasReceivedReplies && activeConversations >= 2 && lastStepSent >= 4) {
    // Only fire if we haven't sent in 3+ days
    if (lastSentDaysAgo === null || lastSentDaysAgo >= 3) {
      return { type: "event_based", step: 6, trigger: "active_conversations" };
    }
  }

  // Weekly nudge: once per week after week 1
  if (lastStepSent >= 4 && (lastSentDaysAgo === null || lastSentDaysAgo >= 7)) {
    return { type: "weekly_nudge", step: 5 };
  }

  return { type: "none" };
}
