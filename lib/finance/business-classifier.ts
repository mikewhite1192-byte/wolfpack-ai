import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { neon } from "@neondatabase/serverless";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sql = neon(process.env.DATABASE_URL!);

// Batch size: Claude comfortably handles 50 transactions in one pass with
// tool_use output. Larger batches save money via prompt caching but raise
// latency and the risk of a single bad row failing the whole batch.
const BATCH_SIZE = 50;

const MODEL = "claude-haiku-4-5-20251001";

// Wolf Pack Co context — helps Claude distinguish plausible business from
// clearly personal. Edit this as the business evolves; the prompt is cached.
const BUSINESS_CONTEXT = `
Mike White operates The Wolf Pack Co LLC, a Michigan LLC running two products:
- Wolf Pack CRM (thewolfpack.ai) — AI-powered CRM + outreach + agency services
- Buena Onda — AI ad management SaaS

Typical legitimate business expenses for this operation:
- AI/LLM subscriptions: Anthropic/Claude, OpenAI, Perplexity
- Developer infrastructure: Vercel, Neon, Clerk, Supabase, GitHub, Cloudflare, Stripe
- Email/outreach tools: Instantly, SmartLead, Apollo, ZeroBounce, Mailgun, Twilio
- Hosting/compute: DigitalOcean, AWS, Linode
- Domains/SSL: GoDaddy, Namecheap, Porkbun
- Advertising: Meta Ads, Google Ads, LinkedIn Ads
- Contractor/SaaS: Upwork, Fiverr payments
- Office: Notion, Linear, Slack, 1Password
- Creative: Canva, Adobe, Figma, ElevenLabs
- Business meals/coffee with clients (50% deductible)
- Phone + internet (partial, typically 50% for mixed personal/business)
- Travel to clients or conferences
- Professional services: legal, accounting, banking fees

Clearly personal (flag is_subscription but NOT business_candidate):
- Groceries, personal restaurants/coffee (not client meetings)
- Personal streaming: Netflix, Spotify personal, Hulu, Disney+, HBO, YouTube Premium
- Personal shopping: Amazon orders that aren't office supplies, clothing
- Rent/mortgage, utilities for home (not home-office-deductible portion)
- Personal insurance (auto, health, life)
- Gym/fitness memberships
- Car payment, personal gas
- Gifts (non-business)
- Dating/entertainment

Ambiguous — flag as candidate with medium confidence (40-70):
- Amazon purchases (could be office supplies OR personal)
- Restaurants (could be client lunch OR personal)
- Coffee shops (client meeting OR just coffee)
- Phone bill (partial deduction)
- Home internet (partial deduction)
- Office supply stores (Target, Walmart if reasonable amount)

Be conservative. Better to flag as pending_review than confirm something that could trigger an audit. Only mark is_subscription=true for recurring charges (Netflix, Spotify, software subscriptions); not one-off purchases.
`.trim();

const CLASSIFIER_TOOL: Tool = {
  name: "classify_transactions",
  description:
    "Classify each transaction as business-candidate, subscription, or neither. Return one entry per input transaction, in the same order.",
  input_schema: {
    type: "object",
    properties: {
      classifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            txn_id: {
              type: "string",
              description: "The id field from the input transaction.",
            },
            business_candidate: {
              type: "boolean",
              description:
                "True if this might reasonably be a deductible business expense for Wolf Pack Co LLC.",
            },
            confidence: {
              type: "integer",
              description: "0-100. Confidence that this is a business expense.",
            },
            reason: {
              type: "string",
              description:
                "Short one-sentence explanation. E.g. 'SaaS subscription typical for software agencies' or 'Ambiguous Amazon order — could be office supplies'.",
            },
            suggested_biz_category: {
              type: ["string", "null"],
              description:
                "One of: Software & Subscriptions | Advertising & Marketing | Office Supplies | Professional Services | Contractors | Meals & Entertainment | Travel | Phone & Internet | Banking Fees | Cost of Goods Sold | Other. Null if not a candidate.",
            },
            suggested_deduction_pct: {
              type: ["integer", "null"],
              description:
                "0-100. 100 for pure business (SaaS subscription), 50 for mixed-use (phone, internet, business meal), null if not a candidate.",
            },
            suggested_irs_reference: {
              type: ["string", "null"],
              description:
                "Schedule C line reference, e.g. 'Schedule C Line 18 (Office expense)', 'Schedule C Line 24b (Meals, 50%)', 'Schedule C Line 8 (Advertising)', 'Schedule C Line 25 (Utilities)'. Null if not a candidate.",
            },
            is_subscription: {
              type: "boolean",
              description:
                "True if this looks like a recurring subscription (Netflix, SaaS, etc.), regardless of whether it's business or personal.",
            },
            subscription_name: {
              type: ["string", "null"],
              description:
                "Normalized merchant name for the subscription (e.g. 'Netflix', 'Anthropic Claude', 'Vercel'). Null if not a subscription.",
            },
          },
          required: [
            "txn_id",
            "business_candidate",
            "confidence",
            "reason",
            "is_subscription",
          ],
        },
      },
    },
    required: ["classifications"],
  },
};

export interface TransactionToClassify {
  id: string;
  date: string;
  amount: number;
  description: string;
  existing_category?: string | null;
}

export interface Classification {
  txn_id: string;
  business_candidate: boolean;
  confidence: number;
  reason: string;
  suggested_biz_category: string | null;
  suggested_deduction_pct: number | null;
  suggested_irs_reference: string | null;
  is_subscription: boolean;
  subscription_name: string | null;
}

export async function classifyBatch(
  txns: TransactionToClassify[],
): Promise<Classification[]> {
  if (txns.length === 0) return [];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: `You are a forensic accountant reviewing personal bank transactions to identify expenses that should have been run through a business account. Your job: flag likely business expenses and subscriptions so the user can reclassify them for tax deduction purposes.

${BUSINESS_CONTEXT}

Output exactly one classification per input transaction, in the same order. Use the classify_transactions tool.`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [CLASSIFIER_TOOL],
    tool_choice: { type: "tool", name: "classify_transactions" },
    messages: [
      {
        role: "user",
        content: `Classify these transactions:\n\n${JSON.stringify(txns, null, 2)}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === "classify_transactions",
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Classifier returned no tool_use output");
  }

  const input = toolUse.input as { classifications: Classification[] };
  return input.classifications;
}

// Orchestrator: pulls unclassified personal rows from both personal_transactions
// and mercury_transactions (workspace='personal'), classifies in batches, stores
// results. Returns summary stats.
export async function classifyUnclassifiedPersonal(options?: {
  limit?: number;
}): Promise<{
  legacy_classified: number;
  mercury_classified: number;
  candidates_found: number;
  subscriptions_found: number;
}> {
  const limit = options?.limit ?? 500;

  const legacyRows = await sql`
    SELECT id, date::text AS date, amount, description, category AS existing_category
    FROM personal_transactions
    WHERE business_review_status IS NULL
       OR business_review_status = 'unclassified'
    ORDER BY date DESC
    LIMIT ${limit}
  `;

  const mercuryRows = await sql`
    SELECT id, COALESCE(posted_at::date::text, created_at::date::text) AS date,
           amount,
           COALESCE(counterparty_name, bank_description, '') AS description,
           mercury_category AS existing_category
    FROM mercury_transactions
    WHERE workspace = 'personal'
      AND (business_review_status IS NULL OR business_review_status = 'unclassified')
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const allRows = [
    ...legacyRows.map((r) => ({ source: "legacy" as const, row: r })),
    ...mercuryRows.map((r) => ({ source: "mercury" as const, row: r })),
  ];

  let legacyClassified = 0;
  let mercuryClassified = 0;
  let candidates = 0;
  let subscriptions = 0;

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const input: TransactionToClassify[] = batch.map(({ row }) => ({
      id: row.id as string,
      date: row.date as string,
      amount: Number(row.amount),
      description: (row.description as string) ?? "",
      existing_category: (row.existing_category as string | null) ?? null,
    }));

    const classifications = await classifyBatch(input);
    const byId = new Map(classifications.map((c) => [c.txn_id, c]));

    for (const { source, row } of batch) {
      const c = byId.get(row.id as string);
      if (!c) continue;

      const reviewStatus = c.business_candidate ? "pending_review" : "kept_personal";
      if (c.business_candidate) candidates += 1;
      if (c.is_subscription) subscriptions += 1;

      if (source === "legacy") {
        await sql`
          UPDATE personal_transactions SET
            business_candidate = ${c.business_candidate},
            business_candidate_confidence = ${c.confidence},
            business_candidate_reason = ${c.reason},
            suggested_biz_category = ${c.suggested_biz_category},
            suggested_deduction_pct = ${c.suggested_deduction_pct},
            suggested_irs_reference = ${c.suggested_irs_reference},
            subscription_name = ${c.subscription_name},
            business_review_status = ${reviewStatus},
            classified_at = now()
          WHERE id = ${row.id}
        `;
        legacyClassified += 1;
      } else {
        await sql`
          UPDATE mercury_transactions SET
            business_candidate = ${c.business_candidate},
            business_candidate_confidence = ${c.confidence},
            business_candidate_reason = ${c.reason},
            suggested_biz_category = ${c.suggested_biz_category},
            suggested_deduction_pct = ${c.suggested_deduction_pct},
            suggested_irs_reference = ${c.suggested_irs_reference},
            subscription_name = ${c.subscription_name},
            business_review_status = ${reviewStatus},
            classified_at = now()
          WHERE id = ${row.id}
        `;
        mercuryClassified += 1;
      }
    }
  }

  return {
    legacy_classified: legacyClassified,
    mercury_classified: mercuryClassified,
    candidates_found: candidates,
    subscriptions_found: subscriptions,
  };
}

// Moves a personal transaction to biz_transactions with the given tax metadata.
// Non-destructive: the personal row is kept, marked confirmed_business, and
// the new biz row references it via reclassified_from_personal_id.
export async function reclassifyPersonalToBusiness(opts: {
  source: "legacy" | "mercury";
  personalId: string;
  category: string;
  subcategory?: string | null;
  deductionPct: number;
  irsReference?: string | null;
  notes?: string | null;
}): Promise<{ biz_txn_id: string }> {
  const { source, personalId, category, subcategory, deductionPct, irsReference, notes } =
    opts;

  const row =
    source === "legacy"
      ? (
          await sql`
            SELECT id, date::text AS date, amount, description, subcategory AS orig_sub
            FROM personal_transactions WHERE id = ${personalId}
          `
        )[0]
      : (
          await sql`
            SELECT id,
                   COALESCE(posted_at::date::text, created_at::date::text) AS date,
                   amount,
                   COALESCE(counterparty_name, bank_description, '') AS description,
                   our_subcategory AS orig_sub
            FROM mercury_transactions WHERE id = ${personalId}
          `
        )[0];

  if (!row) throw new Error(`Personal transaction ${personalId} not found`);

  // Insert into biz_transactions. statement_id is nullable; we leave it null
  // since reclassified rows don't belong to any imported statement.
  const inserted = await sql`
    INSERT INTO biz_transactions (
      statement_id, date, description, amount, category, subcategory,
      is_deductible, deduction_pct, irs_reference, notes,
      reclassified_from_personal_id
    ) VALUES (
      NULL, ${row.date}, ${row.description}, ${row.amount}, ${category},
      ${subcategory ?? row.orig_sub ?? null}, true, ${deductionPct},
      ${irsReference ?? null}, ${notes ?? null}, ${personalId}
    )
    RETURNING id
  `;

  if (source === "legacy") {
    await sql`
      UPDATE personal_transactions SET
        business_review_status = 'confirmed_business',
        reviewed_at = now()
      WHERE id = ${personalId}
    `;
  } else {
    await sql`
      UPDATE mercury_transactions SET
        business_review_status = 'confirmed_business',
        reviewed_at = now()
      WHERE id = ${personalId}
    `;
  }

  return { biz_txn_id: inserted[0].id as string };
}
