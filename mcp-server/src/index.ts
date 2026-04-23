#!/usr/bin/env node
// Wolf Pack finance MCP server.
// Exposes read-only tools over stdio so Claude Desktop can query Mike's
// Mercury-synced finances directly from the desktop app.
//
// Setup: see ../README.md

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[wolfpack-finance-mcp] DATABASE_URL env var is required.");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

// ──────────────────────────────────────────────────────────────────────
// Tool definitions
// ──────────────────────────────────────────────────────────────────────

const tools: Tool[] = [
  {
    name: "list_accounts",
    description:
      "List all bank accounts (Mercury synced + any manual legacy accounts). Use to get the current balance sheet.",
    inputSchema: {
      type: "object",
      properties: {
        workspace: {
          type: "string",
          enum: ["business", "personal", "all"],
          description: "Which workspace to list. Defaults to 'all'.",
        },
      },
    },
  },
  {
    name: "list_transactions",
    description:
      "List transactions with filters. Results come from the unified view that combines Mercury transactions and any legacy biz/personal transactions.",
    inputSchema: {
      type: "object",
      properties: {
        workspace: { type: "string", enum: ["business", "personal"], description: "Required." },
        start_date: { type: "string", description: "YYYY-MM-DD. Inclusive." },
        end_date: { type: "string", description: "YYYY-MM-DD. Inclusive." },
        category: { type: "string", description: "Exact category match." },
        description_contains: { type: "string", description: "Case-insensitive substring on description." },
        min_amount: { type: "number", description: "Absolute-value lower bound." },
        max_amount: { type: "number", description: "Absolute-value upper bound." },
        only_debits: { type: "boolean" },
        only_credits: { type: "boolean" },
        limit: { type: "integer", description: "Max rows. Default 100, cap 1000." },
      },
      required: ["workspace"],
    },
  },
  {
    name: "get_net_worth",
    description:
      "Current net worth snapshot: personal assets, liabilities, business net worth, combined total. Computed live from Mercury + any manual accounts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_spending_by_category",
    description:
      "Spend rollup grouped by category for a period. Returns total amount per category (positive numbers for spend).",
    inputSchema: {
      type: "object",
      properties: {
        workspace: { type: "string", enum: ["business", "personal"], description: "Required." },
        start_date: { type: "string", description: "YYYY-MM-DD. Inclusive." },
        end_date: { type: "string", description: "YYYY-MM-DD. Inclusive." },
      },
      required: ["workspace"],
    },
  },
  {
    name: "get_top_vendors",
    description:
      "Top N vendors/merchants by total spend in a period. Useful for 'who am I paying the most to'.",
    inputSchema: {
      type: "object",
      properties: {
        workspace: { type: "string", enum: ["business", "personal"], description: "Required." },
        start_date: { type: "string" },
        end_date: { type: "string" },
        limit: { type: "integer", description: "Default 15." },
      },
      required: ["workspace"],
    },
  },
  {
    name: "search_transactions",
    description:
      "Full-text search across transaction descriptions. Returns matching rows across both workspaces.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring to search for, case-insensitive." },
        workspace: { type: "string", enum: ["business", "personal", "all"], description: "Defaults to 'all'." },
        limit: { type: "integer", description: "Default 50." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_business_candidates",
    description:
      "Personal transactions flagged by the classifier as likely business expenses, awaiting review. Grouped by merchant.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_pnl",
    description:
      "Business profit & loss for a period. Revenue (credits) minus expenses (debits) from the business unified view.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD." },
        end_date: { type: "string", description: "YYYY-MM-DD." },
      },
    },
  },
  {
    name: "get_credit_summary",
    description:
      "Latest credit report snapshot Mike has entered. Includes 3-bureau scores, utilization, inquiries, account age.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_sync_status",
    description:
      "When was Mercury last synced for each workspace, and did it succeed? Also surfaces errors from failed runs.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ──────────────────────────────────────────────────────────────────────
// Tool handlers
// ──────────────────────────────────────────────────────────────────────

type Args = Record<string, unknown>;

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function toStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

async function handleListAccounts(args: Args) {
  const workspace = (toStr(args.workspace) ?? "all") as "business" | "personal" | "all";

  const mercury =
    workspace === "all"
      ? await sql`
          SELECT workspace, name, kind, current_balance, available_balance,
                 legal_business_name, status, created_at, synced_at
          FROM mercury_accounts
          WHERE archived = false
          ORDER BY workspace, kind, name
        `
      : await sql`
          SELECT workspace, name, kind, current_balance, available_balance,
                 legal_business_name, status, created_at, synced_at
          FROM mercury_accounts
          WHERE workspace = ${workspace} AND archived = false
          ORDER BY kind, name
        `;

  const legacy =
    workspace === "business"
      ? []
      : await sql`
          SELECT name, type AS kind, institution, current_balance, credit_limit, interest_rate
          FROM personal_accounts
          WHERE is_active = TRUE
          ORDER BY type, name
        `;

  return {
    mercury: mercury.map((r) => ({
      workspace: r.workspace,
      name: r.name,
      kind: r.kind,
      current_balance: Number(r.current_balance),
      available_balance: Number(r.available_balance),
      legal_name: r.legal_business_name,
      status: r.status,
      last_synced: r.synced_at,
    })),
    manual_personal: legacy.map((r) => ({
      name: r.name,
      kind: r.kind,
      institution: r.institution,
      current_balance: Number(r.current_balance),
      credit_limit: r.credit_limit != null ? Number(r.credit_limit) : null,
      interest_rate: r.interest_rate != null ? Number(r.interest_rate) : null,
    })),
  };
}

async function handleListTransactions(args: Args) {
  const workspace = toStr(args.workspace);
  if (workspace !== "business" && workspace !== "personal") {
    throw new McpError(ErrorCode.InvalidParams, "workspace must be 'business' or 'personal'");
  }
  const startDate = toStr(args.start_date);
  const endDate = toStr(args.end_date);
  const category = toStr(args.category);
  const descr = toStr(args.description_contains);
  const minAmt = toNum(args.min_amount);
  const maxAmt = toNum(args.max_amount);
  const onlyDebits = args.only_debits === true;
  const onlyCredits = args.only_credits === true;
  const limit = Math.min(Math.max(1, Math.round(toNum(args.limit) ?? 100)), 1000);

  const view = workspace === "business" ? "business_transactions_unified" : "personal_transactions_unified";

  // Build filter clauses with neon's tagged template concatenation.
  const rows = await sql(
    `
    SELECT source, id, account_name, date::text AS date, amount::numeric AS amount,
           description, category, subcategory, status, notes
    FROM ${view}
    WHERE 1=1
      ${startDate ? "AND date >= $1" : ""}
      ${endDate ? `AND date <= $${startDate ? 2 : 1}` : ""}
    ORDER BY date DESC
    LIMIT ${limit * 3}
    `,
    [startDate, endDate].filter(Boolean) as string[],
  );

  // Finish filtering in JS (simpler than dynamic SQL for the rest).
  const filtered = rows
    .filter((r) => !category || (r.category ?? "").toLowerCase() === category.toLowerCase())
    .filter((r) =>
      !descr || String(r.description ?? "").toLowerCase().includes(descr.toLowerCase()),
    )
    .filter((r) => {
      const abs = Math.abs(Number(r.amount));
      if (minAmt !== undefined && abs < minAmt) return false;
      if (maxAmt !== undefined && abs > maxAmt) return false;
      return true;
    })
    .filter((r) => {
      const amt = Number(r.amount);
      if (onlyDebits && amt >= 0) return false;
      if (onlyCredits && amt <= 0) return false;
      return true;
    })
    .slice(0, limit);

  return {
    workspace,
    returned: filtered.length,
    transactions: filtered.map((r) => ({
      source: r.source,
      id: r.id,
      date: r.date,
      amount: Number(r.amount),
      description: r.description,
      category: r.category,
      subcategory: r.subcategory,
      account: r.account_name,
      status: r.status,
      notes: r.notes,
    })),
  };
}

async function handleGetNetWorth() {
  const mercury = await sql`
    SELECT workspace, kind, COALESCE(SUM(current_balance), 0)::numeric AS total
    FROM mercury_accounts
    WHERE archived = false
    GROUP BY workspace, kind
  `;

  const legacy = await sql`
    SELECT type, COALESCE(SUM(current_balance), 0)::numeric AS total
    FROM personal_accounts
    WHERE is_active = TRUE
    GROUP BY type
  `;

  const m: Record<string, Record<string, number>> = { business: {}, personal: {} };
  for (const r of mercury) {
    const ws = r.workspace as string;
    const kind = r.kind as string;
    m[ws] = m[ws] ?? {};
    m[ws][kind] = Number(r.total);
  }
  const lg: Record<string, number> = {};
  for (const r of legacy) lg[r.type as string] = Number(r.total);

  const personalAssets =
    (m.personal.checking ?? 0) +
    (m.personal.savings ?? 0) +
    (m.personal.treasury ?? 0) +
    (m.personal.investment ?? 0) +
    (lg.checking ?? 0) +
    (lg.savings ?? 0) +
    (lg.investment ?? 0) +
    (lg.retirement ?? 0);

  const personalCC = (m.personal.creditCard ?? 0) + (lg.credit_card ?? 0);
  const personalNetWorth = personalAssets - Math.abs(personalCC);

  const businessAssets =
    (m.business.checking ?? 0) +
    (m.business.savings ?? 0) +
    (m.business.treasury ?? 0);
  const businessCC = m.business.creditCard ?? 0;
  const businessNetWorth = businessAssets - Math.abs(businessCC);

  return {
    personal: {
      assets: personalAssets,
      credit_card_debt: Math.abs(personalCC),
      net_worth: personalNetWorth,
      mercury_breakdown: m.personal,
      manual_breakdown: lg,
    },
    business: {
      assets: businessAssets,
      credit_card_debt: Math.abs(businessCC),
      net_worth: businessNetWorth,
      mercury_breakdown: m.business,
    },
    combined_net_worth: personalNetWorth + businessNetWorth,
  };
}

async function handleSpendingByCategory(args: Args) {
  const workspace = toStr(args.workspace);
  if (workspace !== "business" && workspace !== "personal") {
    throw new McpError(ErrorCode.InvalidParams, "workspace required");
  }
  const startDate = toStr(args.start_date);
  const endDate = toStr(args.end_date);
  const view = workspace === "business" ? "business_transactions_unified" : "personal_transactions_unified";

  const rows = await sql(
    `
    SELECT COALESCE(category, 'Uncategorized') AS category,
           SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric AS spent,
           SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)::numeric AS received,
           COUNT(*)::int AS txn_count
    FROM ${view}
    WHERE 1=1
      ${startDate ? "AND date >= $1" : ""}
      ${endDate ? `AND date <= $${startDate ? 2 : 1}` : ""}
    GROUP BY COALESCE(category, 'Uncategorized')
    ORDER BY spent DESC
    `,
    [startDate, endDate].filter(Boolean) as string[],
  );

  return {
    workspace,
    period: { start: startDate ?? "(all time)", end: endDate ?? "(today)" },
    categories: rows.map((r) => ({
      category: r.category,
      spent: Number(r.spent),
      received: Number(r.received),
      txn_count: r.txn_count,
    })),
  };
}

async function handleTopVendors(args: Args) {
  const workspace = toStr(args.workspace);
  if (workspace !== "business" && workspace !== "personal") {
    throw new McpError(ErrorCode.InvalidParams, "workspace required");
  }
  const startDate = toStr(args.start_date);
  const endDate = toStr(args.end_date);
  const limit = Math.min(Math.max(1, Math.round(toNum(args.limit) ?? 15)), 100);
  const view = workspace === "business" ? "business_transactions_unified" : "personal_transactions_unified";

  const rows = await sql(
    `
    SELECT description AS vendor,
           SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric AS total_spent,
           COUNT(*)::int AS txn_count,
           MIN(date::text) AS first_seen,
           MAX(date::text) AS last_seen
    FROM ${view}
    WHERE amount < 0
      ${startDate ? "AND date >= $1" : ""}
      ${endDate ? `AND date <= $${startDate ? 2 : 1}` : ""}
    GROUP BY description
    ORDER BY total_spent DESC
    LIMIT ${limit}
    `,
    [startDate, endDate].filter(Boolean) as string[],
  );

  return {
    workspace,
    vendors: rows.map((r) => ({
      vendor: r.vendor,
      total_spent: Number(r.total_spent),
      txn_count: r.txn_count,
      first_seen: r.first_seen,
      last_seen: r.last_seen,
    })),
  };
}

async function handleSearchTransactions(args: Args) {
  const query = toStr(args.query);
  if (!query) throw new McpError(ErrorCode.InvalidParams, "query required");
  const workspace = (toStr(args.workspace) ?? "all") as "business" | "personal" | "all";
  const limit = Math.min(Math.max(1, Math.round(toNum(args.limit) ?? 50)), 500);
  const pattern = `%${query}%`;

  const rows =
    workspace === "business"
      ? await sql`
          SELECT 'business' AS workspace, source, id, date::text AS date, amount::numeric AS amount, description, category
          FROM business_transactions_unified
          WHERE description ILIKE ${pattern}
          ORDER BY date DESC
          LIMIT ${limit}
        `
      : workspace === "personal"
        ? await sql`
            SELECT 'personal' AS workspace, source, id, date::text AS date, amount::numeric AS amount, description, category
            FROM personal_transactions_unified
            WHERE description ILIKE ${pattern}
            ORDER BY date DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT 'business' AS workspace, source, id, date::text AS date, amount::numeric AS amount, description, category
            FROM business_transactions_unified
            WHERE description ILIKE ${pattern}
            UNION ALL
            SELECT 'personal' AS workspace, source, id, date::text AS date, amount::numeric AS amount, description, category
            FROM personal_transactions_unified
            WHERE description ILIKE ${pattern}
            ORDER BY date DESC
            LIMIT ${limit}
          `;

  return {
    query,
    matches: rows.length,
    results: rows.map((r) => ({
      workspace: r.workspace,
      source: r.source,
      date: r.date,
      amount: Number(r.amount),
      description: r.description,
      category: r.category,
    })),
  };
}

async function handleBusinessCandidates() {
  const rows = await sql`
    WITH unified AS (
      SELECT 'legacy' AS source, id, date::text AS date, amount,
             description,
             business_candidate_confidence AS confidence,
             business_candidate_reason AS reason,
             suggested_biz_category, suggested_deduction_pct, suggested_irs_reference,
             subscription_name
      FROM personal_transactions
      WHERE business_review_status = 'pending_review'
      UNION ALL
      SELECT 'mercury' AS source, id,
             COALESCE(posted_at::date::text, created_at::date::text) AS date,
             amount,
             COALESCE(counterparty_name, bank_description, '') AS description,
             business_candidate_confidence AS confidence,
             business_candidate_reason AS reason,
             suggested_biz_category, suggested_deduction_pct, suggested_irs_reference,
             subscription_name
      FROM mercury_transactions
      WHERE workspace = 'personal' AND business_review_status = 'pending_review'
    )
    SELECT COALESCE(subscription_name, description) AS merchant,
           suggested_biz_category AS category,
           COUNT(*)::int AS txn_count,
           SUM(ABS(amount))::numeric AS total_amount,
           ROUND(AVG(confidence))::int AS avg_confidence,
           MAX(suggested_deduction_pct) AS deduction_pct,
           MAX(suggested_irs_reference) AS irs_reference,
           MAX(reason) AS reason
    FROM unified
    GROUP BY COALESCE(subscription_name, description), suggested_biz_category
    ORDER BY total_amount DESC
  `;

  return {
    candidates: rows.map((r) => ({
      merchant: r.merchant,
      category: r.category,
      txn_count: r.txn_count,
      total_amount: Number(r.total_amount),
      avg_confidence: r.avg_confidence,
      deduction_pct: r.deduction_pct,
      irs_reference: r.irs_reference,
      reason: r.reason,
    })),
  };
}

async function handleGetPnl(args: Args) {
  const startDate = toStr(args.start_date);
  const endDate = toStr(args.end_date);

  const rows = await sql(
    `
    SELECT
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)::numeric AS revenue,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END)::numeric AS expenses,
      COUNT(*)::int AS txn_count
    FROM business_transactions_unified
    WHERE 1=1
      ${startDate ? "AND date >= $1" : ""}
      ${endDate ? `AND date <= $${startDate ? 2 : 1}` : ""}
    `,
    [startDate, endDate].filter(Boolean) as string[],
  );

  const r = rows[0];
  const revenue = Number(r.revenue ?? 0);
  const expenses = Number(r.expenses ?? 0);

  return {
    period: { start: startDate ?? "(all time)", end: endDate ?? "(today)" },
    revenue,
    expenses,
    net_income: revenue - expenses,
    txn_count: r.txn_count,
  };
}

async function handleCreditSummary() {
  const rows = await sql`
    SELECT report_date::text AS report_date,
           score_equifax, score_transunion, score_experian, score_average,
           utilization_rate, payment_history_pct, hard_inquiries_12mo,
           oldest_account_years, total_accounts, open_accounts, derogatory_marks
    FROM personal_credit_reports
    ORDER BY report_date DESC
    LIMIT 4
  `;

  return {
    history: rows.map((r) => ({
      report_date: r.report_date,
      scores: {
        equifax: r.score_equifax,
        transunion: r.score_transunion,
        experian: r.score_experian,
        average: r.score_average,
      },
      utilization_rate: r.utilization_rate,
      payment_history_pct: r.payment_history_pct,
      hard_inquiries_12mo: r.hard_inquiries_12mo,
      oldest_account_years: r.oldest_account_years,
      total_accounts: r.total_accounts,
      open_accounts: r.open_accounts,
      derogatory_marks: r.derogatory_marks,
    })),
  };
}

async function handleSyncStatus() {
  const rows = await sql`
    SELECT workspace,
           MAX(finished_at) FILTER (WHERE status = 'success') AS last_success,
           MAX(finished_at) FILTER (WHERE status = 'error') AS last_error,
           (SELECT error_message FROM mercury_sync_runs m2 WHERE m2.workspace = m1.workspace AND m2.status = 'error' ORDER BY finished_at DESC LIMIT 1) AS last_error_message
    FROM mercury_sync_runs m1
    WHERE workspace IS NOT NULL
    GROUP BY workspace
  `;

  const tokenStatus = {
    business_token_configured: Boolean(process.env.MERCURY_BUSINESS_API_TOKEN),
    personal_token_configured: Boolean(process.env.MERCURY_PERSONAL_API_TOKEN),
  };

  return {
    tokens: tokenStatus,
    workspaces: rows.map((r) => ({
      workspace: r.workspace,
      last_success: r.last_success,
      last_error: r.last_error,
      last_error_message: r.last_error_message,
    })),
  };
}

// ──────────────────────────────────────────────────────────────────────
// Server setup
// ──────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "wolfpack-finance", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    let result: unknown;
    switch (name) {
      case "list_accounts":
        result = await handleListAccounts(args);
        break;
      case "list_transactions":
        result = await handleListTransactions(args);
        break;
      case "get_net_worth":
        result = await handleGetNetWorth();
        break;
      case "get_spending_by_category":
        result = await handleSpendingByCategory(args);
        break;
      case "get_top_vendors":
        result = await handleTopVendors(args);
        break;
      case "search_transactions":
        result = await handleSearchTransactions(args);
        break;
      case "get_business_candidates":
        result = await handleBusinessCandidates();
        break;
      case "get_pnl":
        result = await handleGetPnl(args);
        break;
      case "get_credit_summary":
        result = await handleCreditSummary();
        break;
      case "get_sync_status":
        result = await handleSyncStatus();
        break;
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    if (err instanceof McpError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

// Keep alive — stdio transport handles lifecycle.
