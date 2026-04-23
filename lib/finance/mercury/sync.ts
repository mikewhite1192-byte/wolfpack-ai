import { neon } from "@neondatabase/serverless";
import { MercuryClient, MercuryApiError, mercuryConfigured } from "./client";
import type {
  MercuryAccount,
  MercuryTransaction,
  MercuryWorkspace,
} from "./types";

const sql = neon(process.env.DATABASE_URL!);

export interface SyncResult {
  workspace: MercuryWorkspace;
  organizationId: string | null;
  accountsSynced: number;
  transactionsInserted: number;
  transactionsUpdated: number;
  durationMs: number;
  error?: string;
}

export interface SyncOptions {
  trigger: "initial" | "cron" | "manual";
  // How far back to look for transactions on this run. On cron runs we only
  // need to catch up ~30 days to handle late-posting / status changes; on
  // initial run we pull as much as Mercury has.
  sinceDays?: number;
}

const DEFAULT_CRON_WINDOW_DAYS = 30;
const INITIAL_WINDOW_DAYS = 730; // 2 years; Mercury account is only 4 days old so real cap is internal

export async function syncWorkspace(
  workspace: MercuryWorkspace,
  opts: SyncOptions,
): Promise<SyncResult> {
  const started = Date.now();
  const runId = await openSyncRun(workspace, opts.trigger);

  const result: SyncResult = {
    workspace,
    organizationId: null,
    accountsSynced: 0,
    transactionsInserted: 0,
    transactionsUpdated: 0,
    durationMs: 0,
  };

  try {
    const client = new MercuryClient(workspace);
    const org = await client.getOrganization();
    result.organizationId = org.id;

    const accounts = await client.listAccounts();
    for (const acct of accounts) {
      await upsertAccount(workspace, org.id, acct);
      result.accountsSynced += 1;
    }

    const sinceDays =
      opts.sinceDays ??
      (opts.trigger === "initial" ? INITIAL_WINDOW_DAYS : DEFAULT_CRON_WINDOW_DAYS);
    const start = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    for (const acct of accounts) {
      const txns = await client.listTransactions(acct.id, { start });
      const { inserted, updated } = await upsertTransactions(workspace, acct.id, txns);
      result.transactionsInserted += inserted;
      result.transactionsUpdated += updated;
    }

    result.durationMs = Date.now() - started;
    await closeSyncRun(runId, "success", result);
    return result;
  } catch (err) {
    const message =
      err instanceof MercuryApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    result.error = message;
    result.durationMs = Date.now() - started;
    await closeSyncRun(runId, "error", result);
    return result;
  }
}

// Syncs every workspace that has a token configured. Used by the cron.
export async function syncAllConfigured(
  opts: SyncOptions,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const ws of ["business", "personal"] as const) {
    if (mercuryConfigured(ws)) {
      results.push(await syncWorkspace(ws, opts));
    }
  }
  return results;
}

async function upsertAccount(
  workspace: MercuryWorkspace,
  orgId: string,
  acct: MercuryAccount,
): Promise<void> {
  await sql`
    INSERT INTO mercury_accounts (
      id, workspace, organization_id, account_number, routing_number, name,
      legal_business_name, status, type, kind, available_balance, current_balance,
      dashboard_link, created_at, synced_at
    ) VALUES (
      ${acct.id}, ${workspace}, ${orgId}, ${acct.accountNumber}, ${acct.routingNumber},
      ${acct.name}, ${acct.legalBusinessName ?? null}, ${acct.status}, ${acct.type},
      ${acct.kind}, ${acct.availableBalance}, ${acct.currentBalance},
      ${acct.dashboardLink ?? null}, ${acct.createdAt}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      kind = EXCLUDED.kind,
      available_balance = EXCLUDED.available_balance,
      current_balance = EXCLUDED.current_balance,
      legal_business_name = EXCLUDED.legal_business_name,
      dashboard_link = EXCLUDED.dashboard_link,
      synced_at = now()
  `;
}

async function upsertTransactions(
  workspace: MercuryWorkspace,
  accountId: string,
  txns: MercuryTransaction[],
): Promise<{ inserted: number; updated: number }> {
  if (txns.length === 0) return { inserted: 0, updated: 0 };

  // Pull existing rows for this account so we can count inserts vs updates
  // accurately (RETURNING xmax = 0 is PG-specific and awkward through the
  // neon tagged template). A single SELECT is fine — these sets are small.
  const ids = txns.map((t) => t.id);
  const existing = await sql`
    SELECT id FROM mercury_transactions WHERE id = ANY(${ids}::uuid[])
  `;
  const existingIds = new Set(existing.map((r) => r.id as string));

  let inserted = 0;
  let updated = 0;

  for (const t of txns) {
    const rules = await applyCategoryRules(workspace, t);
    await sql`
      INSERT INTO mercury_transactions (
        id, workspace, account_id, amount, status, kind, bank_description,
        counterparty_id, counterparty_name, counterparty_nickname, mercury_category,
        merchant_category_code, merchant_id, note, external_memo, check_number,
        tracking_number, fee_id, request_id, reason_for_failure, dashboard_link,
        created_at, posted_at, estimated_delivery_date, failed_at, raw,
        our_category, our_subcategory, is_deductible, deduction_pct, irs_reference,
        synced_at, updated_at
      ) VALUES (
        ${t.id}, ${workspace}, ${accountId}, ${t.amount}, ${t.status}, ${t.kind},
        ${t.bankDescription}, ${t.counterpartyId}, ${t.counterpartyName},
        ${t.counterpartyNickname}, ${t.mercuryCategory},
        ${t.merchant?.categoryCode ?? null}, ${t.merchant?.id ?? null},
        ${t.note}, ${t.externalMemo}, ${t.checkNumber}, ${t.trackingNumber},
        ${t.feeId}, ${t.requestId}, ${t.reasonForFailure}, ${t.dashboardLink},
        ${t.createdAt}, ${t.postedAt}, ${t.estimatedDeliveryDate}, ${t.failedAt},
        ${JSON.stringify(t)}::jsonb,
        ${rules?.our_category ?? null}, ${rules?.our_subcategory ?? null},
        ${rules?.is_deductible ?? null}, ${rules?.deduction_pct ?? null},
        ${rules?.irs_reference ?? null},
        now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        status = EXCLUDED.status,
        posted_at = EXCLUDED.posted_at,
        bank_description = EXCLUDED.bank_description,
        note = EXCLUDED.note,
        external_memo = EXCLUDED.external_memo,
        mercury_category = EXCLUDED.mercury_category,
        reason_for_failure = EXCLUDED.reason_for_failure,
        failed_at = EXCLUDED.failed_at,
        raw = EXCLUDED.raw,
        synced_at = now(),
        updated_at = now()
    `;

    if (existingIds.has(t.id)) updated += 1;
    else inserted += 1;
  }

  return { inserted, updated };
}

// Applies the first matching rule from mercury_category_rules. Returns null if
// no rule matches — caller leaves our_category null so it falls back to mercury_category.
async function applyCategoryRules(
  workspace: MercuryWorkspace,
  t: MercuryTransaction,
): Promise<{
  our_category: string;
  our_subcategory: string | null;
  is_deductible: boolean | null;
  deduction_pct: number | null;
  irs_reference: string | null;
} | null> {
  const rules = await sql`
    SELECT our_category, our_subcategory, is_deductible, deduction_pct, irs_reference,
           pattern, match_type, match_field
    FROM mercury_category_rules
    WHERE enabled = true
      AND (workspace IS NULL OR workspace = ${workspace})
    ORDER BY priority ASC, id ASC
  `;

  for (const r of rules) {
    const field =
      r.match_field === "bank_description"
        ? t.bankDescription
        : r.match_field === "mercury_category"
          ? t.mercuryCategory
          : t.counterpartyName;

    if (!field) continue;

    const pattern = r.pattern as string;
    const matched =
      r.match_type === "exact"
        ? field === pattern
        : r.match_type === "regex"
          ? new RegExp(pattern, "i").test(field)
          : field.toLowerCase().includes(pattern.toLowerCase());

    if (matched) {
      return {
        our_category: r.our_category as string,
        our_subcategory: (r.our_subcategory as string | null) ?? null,
        is_deductible: (r.is_deductible as boolean | null) ?? null,
        deduction_pct: (r.deduction_pct as number | null) ?? null,
        irs_reference: (r.irs_reference as string | null) ?? null,
      };
    }
  }

  return null;
}

async function openSyncRun(
  workspace: MercuryWorkspace,
  trigger: SyncOptions["trigger"],
): Promise<number> {
  const rows = await sql`
    INSERT INTO mercury_sync_runs (trigger, workspace, started_at, status)
    VALUES (${trigger}, ${workspace}, now(), 'running')
    RETURNING id
  `;
  return rows[0].id as number;
}

async function closeSyncRun(
  id: number,
  status: "success" | "error",
  result: SyncResult,
): Promise<void> {
  await sql`
    UPDATE mercury_sync_runs SET
      finished_at = now(),
      status = ${status},
      accounts_synced = ${result.accountsSynced},
      transactions_inserted = ${result.transactionsInserted},
      transactions_updated = ${result.transactionsUpdated},
      error_message = ${result.error ?? null},
      duration_ms = ${result.durationMs}
    WHERE id = ${id}
  `;
}
