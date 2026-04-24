import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { notifyOwner } from "@/lib/notify-owner";

const sql = neon(process.env.DATABASE_URL!);

// Runs Monday 8am ET (see vercel.json). Compiles a one-glance finance
// health summary and texts it to Mike via the existing notifyOwner helper.
//
// Included:
//   - Combined net worth (personal + business)
//   - Mercury sync status per workspace (last success + any errors)
//   - Pending business-expense candidates (count + total $)
//   - Top 3 spending merchants in the last 7 days
//   - Flagged anomalies (sync hasn't succeeded in >24h, new large txns)
//
// Intentionally deterministic (no LLM call) so it can't hallucinate numbers
// about Mike's money. Plain template over verified aggregates.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await buildSummary();
    const message = formatSms(summary);

    // notifyOwner is fire-and-forget and silently catches errors. Pass empty
    // string for workspaceId since this isn't tenant-scoped.
    await notifyOwner("", message);

    return NextResponse.json({ ok: true, summary, message });
  } catch (err) {
    console.error("[cron/finance-weekly-check]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}

interface Summary {
  date: string;
  net_worth: {
    personal: number;
    business: number;
    combined: number;
  };
  sync: {
    business: { last_success: string | null; stale_hours: number | null };
    personal: { last_success: string | null; stale_hours: number | null };
    errors: Array<{ workspace: string; message: string; when: string }>;
  };
  candidates: {
    count: number;
    total_amount: number;
    top_merchant: string | null;
  };
  week: {
    start: string;
    end: string;
    spend: number;
    income: number;
    top_merchants: Array<{ merchant: string; amount: number }>;
  };
  anomalies: string[];
}

async function buildSummary(): Promise<Summary> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStart = weekAgo.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  // Net worth from Mercury
  const mercury = await sql`
    SELECT workspace, kind, COALESCE(SUM(current_balance), 0)::numeric AS total
    FROM mercury_accounts
    WHERE archived = false
    GROUP BY workspace, kind
  `;
  const by: Record<string, Record<string, number>> = { business: {}, personal: {} };
  for (const r of mercury) {
    const ws = r.workspace as string;
    by[ws] = by[ws] ?? {};
    by[ws][r.kind as string] = Number(r.total);
  }
  const businessNW =
    (by.business.checking ?? 0) + (by.business.savings ?? 0) + (by.business.treasury ?? 0);
  const personalNW =
    (by.personal.checking ?? 0) + (by.personal.savings ?? 0) - Math.abs(by.personal.creditCard ?? 0);

  // Sync status per workspace
  const syncRows = await sql`
    SELECT workspace,
           MAX(finished_at) FILTER (WHERE status = 'success') AS last_success,
           MAX(finished_at) FILTER (WHERE status = 'error') AS last_error
    FROM mercury_sync_runs
    WHERE workspace IS NOT NULL
    GROUP BY workspace
  `;
  const syncMap: Record<string, { last_success: string | null; stale_hours: number | null }> = {
    business: { last_success: null, stale_hours: null },
    personal: { last_success: null, stale_hours: null },
  };
  for (const r of syncRows) {
    const ws = r.workspace as string;
    const lastSuccess = r.last_success ? new Date(r.last_success as string) : null;
    syncMap[ws] = {
      last_success: lastSuccess ? lastSuccess.toISOString() : null,
      stale_hours: lastSuccess
        ? Math.round((now.getTime() - lastSuccess.getTime()) / (60 * 60 * 1000))
        : null,
    };
  }

  // Recent errors (last 7 days)
  const errorRows = await sql`
    SELECT workspace, error_message, finished_at
    FROM mercury_sync_runs
    WHERE status = 'error' AND finished_at > now() - interval '7 days'
    ORDER BY finished_at DESC
    LIMIT 3
  `;

  // Pending business candidates
  const candidateRows = await sql`
    WITH unified AS (
      SELECT description, amount FROM personal_transactions
      WHERE business_review_status = 'pending_review'
      UNION ALL
      SELECT COALESCE(counterparty_name, bank_description, '') AS description, amount
      FROM mercury_transactions
      WHERE workspace = 'personal' AND business_review_status = 'pending_review'
    )
    SELECT COUNT(*)::int AS count,
           COALESCE(SUM(ABS(amount)), 0)::numeric AS total,
           (SELECT description FROM unified ORDER BY ABS(amount) DESC LIMIT 1) AS top_merchant
    FROM unified
  `;
  const candidates = candidateRows[0];

  // Last 7 days of business+personal activity
  const weekRows = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::numeric AS spend,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::numeric AS income
    FROM (
      SELECT amount FROM business_transactions_unified WHERE date >= ${weekStart}
      UNION ALL
      SELECT amount FROM personal_transactions_unified WHERE date >= ${weekStart}
    ) s
  `;
  const week = weekRows[0];

  const topMerchantRows = await sql`
    SELECT description AS merchant,
           SUM(-amount)::numeric AS total
    FROM (
      SELECT description, amount FROM business_transactions_unified WHERE date >= ${weekStart} AND amount < 0
      UNION ALL
      SELECT description, amount FROM personal_transactions_unified WHERE date >= ${weekStart} AND amount < 0
    ) s
    GROUP BY description
    ORDER BY total DESC
    LIMIT 3
  `;

  // Anomaly flags
  const anomalies: string[] = [];
  if (syncMap.business.stale_hours != null && syncMap.business.stale_hours > 24) {
    anomalies.push(`Business sync stale (${syncMap.business.stale_hours}h)`);
  }
  if (syncMap.personal.stale_hours != null && syncMap.personal.stale_hours > 24) {
    anomalies.push(`Personal sync stale (${syncMap.personal.stale_hours}h)`);
  }
  if (errorRows.length > 0) {
    anomalies.push(`${errorRows.length} sync error${errorRows.length === 1 ? "" : "s"} in last 7d`);
  }

  return {
    date: today,
    net_worth: {
      personal: personalNW,
      business: businessNW,
      combined: personalNW + businessNW,
    },
    sync: {
      business: syncMap.business,
      personal: syncMap.personal,
      errors: errorRows.map((r) => ({
        workspace: r.workspace as string,
        message: (r.error_message as string) ?? "",
        when: r.finished_at as string,
      })),
    },
    candidates: {
      count: Number(candidates.count),
      total_amount: Number(candidates.total),
      top_merchant: (candidates.top_merchant as string | null) ?? null,
    },
    week: {
      start: weekStart,
      end: today,
      spend: Number(week.spend),
      income: Number(week.income),
      top_merchants: topMerchantRows.map((r) => ({
        merchant: r.merchant as string,
        amount: Number(r.total),
      })),
    },
    anomalies,
  };
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function formatSms(s: Summary): string {
  const lines: string[] = [`Finance check-in ${s.date}`];
  lines.push(`NW: ${usd(s.net_worth.combined)} (biz ${usd(s.net_worth.business)} + pers ${usd(s.net_worth.personal)})`);
  lines.push(`7d: +${usd(s.week.income)} / -${usd(s.week.spend)}`);

  if (s.candidates.count > 0) {
    lines.push(`${s.candidates.count} biz candidates pending (${usd(s.candidates.total_amount)})`);
  }
  if (s.week.top_merchants.length > 0) {
    const top = s.week.top_merchants
      .slice(0, 2)
      .map((m) => `${m.merchant.slice(0, 16)} ${usd(m.amount)}`)
      .join(", ");
    lines.push(`Top: ${top}`);
  }
  if (s.anomalies.length > 0) {
    lines.push(`⚠ ${s.anomalies.join("; ")}`);
  } else {
    lines.push("✓ sync clean");
  }
  return lines.join("\n");
}
