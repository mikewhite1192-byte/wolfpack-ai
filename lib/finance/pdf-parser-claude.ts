// Universal bank/credit-card statement parser using Claude's native PDF input.
// Replaces the Capital-One-only regex parser in pdf-parser.ts.
//
// Works on any bank + credit card statement: Claude reads the PDF directly
// (no pre-extraction), detects the institution + account, and returns
// structured transactions via tool_use.

import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

export type StatementType = "bank" | "credit_card" | "investment" | "other";
export type AccountType = "checking" | "savings" | "credit_card" | "investment" | "other";

export interface ParsedTransactionClaude {
  date: string; // YYYY-MM-DD
  description: string; // Raw merchant/description as shown on statement
  amount: number; // Signed: negative = debit/charge, positive = deposit/payment received
  running_balance: number | null;
}

export interface ParsedStatementClaude {
  institution: string; // e.g. "Capital One", "SoFi", "Chase"
  account_type: AccountType;
  statement_type: StatementType;
  last_four: string | null; // Last 4 digits of account number
  account_holder_name: string | null;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  month: string; // YYYY-MM (for the period_end month, used by the existing schema)
  opening_balance: number | null;
  closing_balance: number | null;
  total_credits: number | null; // Deposits / payments received
  total_debits: number | null; // Withdrawals / charges
  // Credit card specific (null for bank statements)
  credit_limit: number | null;
  minimum_payment_due: number | null;
  payment_due_date: string | null; // YYYY-MM-DD
  transactions: ParsedTransactionClaude[];
}

const PARSER_TOOL: Tool = {
  name: "parse_statement",
  description:
    "Extract structured data from a bank or credit card statement PDF. Return exactly one parsed_statement per call.",
  input_schema: {
    type: "object",
    properties: {
      institution: {
        type: "string",
        description: "Bank or card issuer name (e.g. 'Capital One', 'SoFi', 'Chase').",
      },
      account_type: {
        type: "string",
        enum: ["checking", "savings", "credit_card", "investment", "other"],
        description: "Type of account the statement is for.",
      },
      statement_type: {
        type: "string",
        enum: ["bank", "credit_card", "investment", "other"],
        description: "Kind of statement.",
      },
      last_four: {
        type: ["string", "null"],
        description:
          "Last 4 digits of the primary account number on this statement. Null if not shown.",
      },
      account_holder_name: {
        type: ["string", "null"],
        description: "Primary account holder name as printed on the statement.",
      },
      period_start: {
        type: "string",
        description:
          "Statement period start date in YYYY-MM-DD. For credit cards, the start of the billing cycle.",
      },
      period_end: {
        type: "string",
        description:
          "Statement period end date in YYYY-MM-DD. For credit cards, the end of the billing cycle.",
      },
      opening_balance: {
        type: ["number", "null"],
        description:
          "For bank: beginning balance. For credit cards: previous balance. Null if not shown.",
      },
      closing_balance: {
        type: ["number", "null"],
        description:
          "For bank: ending balance. For credit cards: new balance owed. Null if not shown.",
      },
      total_credits: {
        type: ["number", "null"],
        description:
          "Sum of deposits (bank) or payments received (credit card). Positive number.",
      },
      total_debits: {
        type: ["number", "null"],
        description:
          "Sum of withdrawals (bank) or charges (credit card). Positive number.",
      },
      credit_limit: {
        type: ["number", "null"],
        description: "Credit card only. Null for bank statements.",
      },
      minimum_payment_due: {
        type: ["number", "null"],
        description: "Credit card only. Null for bank statements.",
      },
      payment_due_date: {
        type: ["string", "null"],
        description: "Credit card only. YYYY-MM-DD. Null for bank statements.",
      },
      transactions: {
        type: "array",
        description:
          "Every transaction on the statement, in any order. Signs: negative = debit/charge (money out of a bank account, charge on a credit card). Positive = deposit/interest (money in) or payment received on a credit card.",
        items: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description:
                "Transaction date in YYYY-MM-DD. Infer year from statement period if only MM/DD is shown.",
            },
            description: {
              type: "string",
              description:
                "Merchant/description exactly as it appears on the statement (preserve formatting like 'AMAZON CORP SYF PAYMNT'). For multi-line entries, join with a space.",
            },
            amount: {
              type: "number",
              description: "Signed amount. Negative for debits/charges, positive for credits/payments.",
            },
            running_balance: {
              type: ["number", "null"],
              description: "Balance after this transaction, if the statement shows it. Else null.",
            },
          },
          required: ["date", "description", "amount"],
        },
      },
    },
    required: [
      "institution",
      "account_type",
      "statement_type",
      "period_start",
      "period_end",
      "transactions",
    ],
  },
};

export async function parseStatementWithClaude(
  pdfBuffer: Buffer,
  fileName: string,
): Promise<ParsedStatementClaude> {
  const base64 = pdfBuffer.toString("base64");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: `You are a forensic bookkeeper extracting structured data from bank and credit card statements.

Sign convention for amounts (critical):
- Bank statement: deposit / interest / transfer in = POSITIVE. Withdrawal / debit card / ACH out / fee = NEGATIVE.
- Credit card statement: new charge / purchase / interest = NEGATIVE (money spent). Payment received / credit / refund = POSITIVE.

Rules:
- Extract EVERY transaction line in the statement body. Do not summarize, skip, or merge.
- Preserve the original merchant description verbatim (e.g. "AMAZON CORP SYF PAYMNT" stays as-is — do not normalize to "Amazon").
- If a date shows only MM/DD, infer the year from the period_end.
- last_four: pull from headers like "ending in 4210", "account - 3337", "Checking ...5602".
- Return all data via the parse_statement tool. Never return prose.`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [PARSER_TOOL],
    tool_choice: { type: "tool", name: "parse_statement" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          {
            type: "text",
            text: `Parse this statement (source file: ${fileName}). Return the structured result via the parse_statement tool.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === "parse_statement",
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Parser returned no structured output");
  }

  const raw = toolUse.input as Omit<ParsedStatementClaude, "month"> & {
    month?: string;
  };

  // Derive month from period_end (schema expects YYYY-MM).
  const month = raw.month ?? raw.period_end.slice(0, 7);

  return {
    institution: raw.institution,
    account_type: raw.account_type,
    statement_type: raw.statement_type,
    last_four: raw.last_four ?? null,
    account_holder_name: raw.account_holder_name ?? null,
    period_start: raw.period_start,
    period_end: raw.period_end,
    month,
    opening_balance: raw.opening_balance ?? null,
    closing_balance: raw.closing_balance ?? null,
    total_credits: raw.total_credits ?? null,
    total_debits: raw.total_debits ?? null,
    credit_limit: raw.credit_limit ?? null,
    minimum_payment_due: raw.minimum_payment_due ?? null,
    payment_due_date: raw.payment_due_date ?? null,
    transactions: raw.transactions,
  };
}
