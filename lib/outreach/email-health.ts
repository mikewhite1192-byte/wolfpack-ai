import { neon } from "@neondatabase/serverless";
import { getDailyLimits } from "./warmup";

const sql = neon(process.env.DATABASE_URL!);

export interface EmailHealth {
  address: string;
  role: "cold_sender" | "warmup_only";
  displayName: string;
  daysInWarmup: number;
  warmupComplete: boolean;
  isActive: boolean;

  // Sending stats
  coldDailyLimit: number;
  coldSentToday: number;
  warmupSentToday: number;

  // Health metrics (last 7 days)
  sent7d: number;
  delivered7d: number;
  bounced7d: number;
  replied7d: number;
  complained7d: number;

  // Rates
  bounceRate: number;   // should be < 3%
  replyRate: number;    // ideally > 3%
  complaintRate: number; // must be < 0.1%

  // Health score: 0-100
  healthScore: number;
  healthStatus: "healthy" | "warning" | "danger" | "new";
  healthIssues: string[];

  // All-time
  totalSent: number;
  totalBounced: number;
  totalReplied: number;
}

// Calculate health score from metrics
function calculateHealth(metrics: {
  sent7d: number;
  bounceRate: number;
  replyRate: number;
  complaintRate: number;
  daysInWarmup: number;
  warmupComplete: boolean;
}): { score: number; status: "healthy" | "warning" | "danger" | "new"; issues: string[] } {
  const issues: string[] = [];

  // Too new to assess
  if (metrics.sent7d < 10 && metrics.daysInWarmup < 7) {
    return { score: 50, status: "new", issues: ["Too early to assess — still warming up"] };
  }

  let score = 100;

  // Bounce rate (critical)
  if (metrics.bounceRate > 5) {
    score -= 40;
    issues.push(`Bounce rate ${metrics.bounceRate.toFixed(1)}% — way too high (should be < 3%)`);
  } else if (metrics.bounceRate > 3) {
    score -= 20;
    issues.push(`Bounce rate ${metrics.bounceRate.toFixed(1)}% — getting high (should be < 3%)`);
  } else if (metrics.bounceRate > 1) {
    score -= 5;
  }

  // Complaint rate (critical — must be < 0.1%)
  if (metrics.complaintRate > 0.3) {
    score -= 40;
    issues.push(`Complaint rate ${metrics.complaintRate.toFixed(2)}% — STOP sending, inbox is in danger`);
  } else if (metrics.complaintRate > 0.1) {
    score -= 25;
    issues.push(`Complaint rate ${metrics.complaintRate.toFixed(2)}% — too high (must be < 0.1%)`);
  }

  // Reply rate (important for reputation)
  if (metrics.sent7d >= 20) {
    if (metrics.replyRate < 1) {
      score -= 15;
      issues.push(`Reply rate ${metrics.replyRate.toFixed(1)}% — very low, emails may be landing in spam`);
    } else if (metrics.replyRate < 3) {
      score -= 5;
      issues.push(`Reply rate ${metrics.replyRate.toFixed(1)}% — could be better (target 3%+)`);
    }
  }

  // Volume check — too much too fast during warmup
  if (!metrics.warmupComplete && metrics.sent7d > 50) {
    score -= 15;
    issues.push("High volume during warmup — slow down to avoid getting flagged");
  }

  const status = score >= 80 ? "healthy" : score >= 50 ? "warning" : "danger";
  return { score: Math.max(0, score), status, issues };
}

// Get health for all warmup addresses
export async function getAllEmailHealth(): Promise<EmailHealth[]> {
  const addresses = await sql`
    SELECT * FROM warmup_addresses WHERE is_active = TRUE ORDER BY warmup_started_at ASC
  `;

  const healths: EmailHealth[] = [];

  for (const addr of addresses) {
    const email = addr.email as string;
    const started = new Date(addr.warmup_started_at as string);
    const daysInWarmup = Math.floor((Date.now() - started.getTime()) / (1000 * 60 * 60 * 24));

    // 7-day stats
    const stats7d = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE status = 'complained') as complained
      FROM outreach_emails
      WHERE from_email = ${email}
        AND sent_at >= NOW() - INTERVAL '7 days'
    `;

    // 7-day reply count (contacts who replied to emails from this address)
    const replies7d = await sql`
      SELECT COUNT(*) as count FROM outreach_contacts
      WHERE assigned_sender = ${email}
        AND replied = TRUE
        AND replied_at >= NOW() - INTERVAL '7 days'
    `;

    // Today's counts
    const todayCold = await sql`
      SELECT COUNT(*) as count FROM outreach_emails
      WHERE from_email = ${email} AND sent_at >= CURRENT_DATE AND email_type = 'cold'
    `;
    const todayWarmup = await sql`
      SELECT COUNT(*) as count FROM outreach_emails
      WHERE from_email = ${email} AND sent_at >= CURRENT_DATE AND email_type = 'warmup'
    `;

    // All-time stats
    const allTime = await sql`
      SELECT
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE status = 'bounced') as total_bounced
      FROM outreach_emails
      WHERE from_email = ${email}
    `;
    const allTimeReplied = await sql`
      SELECT COUNT(*) as count FROM outreach_contacts
      WHERE assigned_sender = ${email} AND replied = TRUE
    `;

    const sent7d = parseInt(stats7d[0].sent || "0");
    const bounced7d = parseInt(stats7d[0].bounced || "0");
    const replied7d = parseInt(replies7d[0].count || "0");
    const complained7d = parseInt(stats7d[0].complained || "0");

    const bounceRate = sent7d > 0 ? (bounced7d / sent7d) * 100 : 0;
    const replyRate = sent7d > 0 ? (replied7d / sent7d) * 100 : 0;
    const complaintRate = sent7d > 0 ? (complained7d / sent7d) * 100 : 0;

    const warmupComplete = (addr.warmup_completed as boolean) || daysInWarmup >= 30;
    const coldSender = addr.cold_sender as boolean;

    // Calculate daily limits using the combined ramp system
    const limits = getDailyLimits(daysInWarmup);
    const coldDailyLimit = coldSender ? limits.cold : 0;

    const { score, status, issues } = calculateHealth({
      sent7d,
      bounceRate,
      replyRate,
      complaintRate,
      daysInWarmup,
      warmupComplete,
    });

    healths.push({
      address: email,
      role: coldSender ? "cold_sender" : "warmup_only",
      displayName: addr.display_name as string,
      daysInWarmup,
      warmupComplete,
      isActive: addr.is_active as boolean,
      coldDailyLimit,
      coldSentToday: parseInt(todayCold[0].count || "0"),
      warmupSentToday: parseInt(todayWarmup[0].count || "0"),
      sent7d,
      delivered7d: parseInt(stats7d[0].delivered || "0"),
      bounced7d,
      replied7d,
      complained7d,
      bounceRate,
      replyRate,
      complaintRate,
      healthScore: score,
      healthStatus: status,
      healthIssues: issues,
      totalSent: parseInt(allTime[0].total_sent || "0"),
      totalBounced: parseInt(allTime[0].total_bounced || "0"),
      totalReplied: parseInt(allTimeReplied[0].count || "0"),
    });
  }

  return healths;
}

// Record a bounce for an address
export async function recordBounce(fromEmail: string, contactEmail: string, messageId: string) {
  await sql`
    UPDATE outreach_emails SET status = 'bounced'
    WHERE from_email = ${fromEmail} AND ses_message_id = ${messageId}
  `;
  console.log(`[health] Bounce recorded for ${fromEmail} -> ${contactEmail}`);
}

// Record a spam complaint for an address
export async function recordComplaint(fromEmail: string, messageId: string) {
  await sql`
    UPDATE outreach_emails SET status = 'complained'
    WHERE from_email = ${fromEmail} AND ses_message_id = ${messageId}
  `;
  console.log(`[health] Spam complaint recorded for ${fromEmail}`);
}

// Pause an address if health is critical
export async function autoProtect(): Promise<string[]> {
  const healths = await getAllEmailHealth();
  const paused: string[] = [];

  for (const h of healths) {
    if (h.healthStatus === "danger" && h.sent7d > 20) {
      await sql`UPDATE warmup_addresses SET is_active = FALSE WHERE email = ${h.address}`;
      paused.push(h.address);
      console.log(`[health] AUTO-PAUSED ${h.address} — health score: ${h.healthScore}, issues: ${h.healthIssues.join("; ")}`);
    }
  }

  return paused;
}
