import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  if (!ADMIN_EMAILS.includes(email)) throw new Error("Forbidden");
}

const SMART_SCAN_PROMPT = `You are a tax advisor for The Wolf Pack Co LLC, a Michigan single-member LLC that does web development, custom software, AI chatbots, and AI automation.

Mike (the owner) is uploading PERSONAL bank/credit card statements. Your job is to scan every transaction and identify which ones are BUSINESS EXPENSES deductible on Schedule C.

KNOWN BUSINESS TOOLS & SERVICES (flag these as 100% business):
- Anthropic / Claude API
- OpenAI / ChatGPT
- Retell AI
- ElevenLabs
- Vercel
- Neon (database)
- Railway
- Supabase
- Twilio
- Loop Message
- Adobe / Premiere Pro / Creative Cloud
- Kling AI
- Porkbun / Namecheap (domains)
- Zoho Mail
- Google Workspace
- Skool
- Upwork (fees)
- GoHighLevel / GHL
- Stripe (fees deducted from revenue — may not appear as charges)
- GitHub / GitLab
- Figma
- Notion, Slack, 1Password, Zoom
- Meta Ads / Facebook Ads (ONLY if for Wolf Pack, NOT life insurance campaigns)
- Google Ads (ONLY if for Wolf Pack)

PARTIALLY DEDUCTIBLE:
- T-Mobile / phone bill → 100% business (Mike confirmed)
- Internet (Comcast/Xfinity/AT&T) → 50% business use
- Best Buy / Apple Store / Amazon → ONLY if it's computer equipment, monitors, keyboards, office supplies. NOT personal items. Flag as "needs review" if ambiguous.

NOT BUSINESS EXPENSES (skip these):
- Groceries (Kroger, Meijer, Costco, Whole Foods)
- Restaurants / DoorDash / UberEats (unless clearly a business meal)
- Entertainment (Netflix, Spotify, Hulu, bars, concerts)
- Rent / mortgage
- Utilities (gas, electric, water) — unless home office
- Personal shopping, clothing, haircuts
- ATM withdrawals
- Venmo/Zelle transfers (unless clearly business)
- Gas stations (unless business mileage — separate deduction)
- Car payment, car insurance
- Life insurance related charges
- Personal health/gym/pharmacy

For each transaction you flag as a business expense, return:
- original_description: the transaction description as-is
- amount: the dollar amount (negative = charge, positive = credit/refund)
- date: the transaction date
- category: IRS Schedule C category (Advertising, Software, Insurance, etc.)
- subcategory: specific type (AI Services, Hosting, Phone, etc.)
- deduction_pct: percentage deductible (100, 50, etc.)
- irs_reference: Schedule C line reference
- confidence: "high" (clearly business) or "review" (probably business but Mike should confirm)
- reasoning: one sentence explaining why this is a business expense

Return ONLY a JSON array of flagged business transactions. If no business expenses found, return an empty array [].
Do NOT include personal transactions in the output.`;

// POST /api/finance/catch-up — Smart Scan: analyze personal transactions for business expenses
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    // Mode 1: AI Smart Scan (analyze transactions)
    if (body.action === "scan") {
      const { transactions } = body; // Array of {date, description, amount}

      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return NextResponse.json({ error: "No transactions to scan" }, { status: 400 });
      }

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      // Build the transaction list for Claude
      const txList = transactions
        .map((tx: { date: string; description: string; amount: number }, i: number) =>
          `${i + 1}. ${tx.date} | ${tx.description} | $${Math.abs(tx.amount).toFixed(2)} ${tx.amount < 0 ? "(charge)" : "(credit)"}`
        )
        .join("\n");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SMART_SCAN_PROMPT,
        messages: [
          {
            role: "user",
            content: `Here are ${transactions.length} personal bank/credit card transactions. Scan them and return ONLY the business expenses as a JSON array:\n\n${txList}`,
          },
        ],
      });

      // Extract JSON from Claude's response
      const responseText = response.content[0].type === "text" ? response.content[0].text : "";
      let flaggedExpenses = [];
      try {
        // Find JSON array in the response (Claude sometimes wraps in markdown)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          flaggedExpenses = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error("[catch-up] Failed to parse Claude response:", responseText);
      }

      return NextResponse.json({
        flaggedExpenses,
        totalScanned: transactions.length,
        totalFlagged: flaggedExpenses.length,
      });
    }

    // Mode 2: Save confirmed expenses to biz_transactions
    if (body.action === "save") {
      const { expenses } = body; // Array of confirmed business expenses
      const year = body.year || new Date().getFullYear();

      if (!expenses || !Array.isArray(expenses)) {
        return NextResponse.json({ error: "No expenses to save" }, { status: 400 });
      }

      // Delete any existing catch-up entries for this year (clean re-save)
      await sql`
        DELETE FROM biz_transactions
        WHERE statement_id IS NULL
          AND EXTRACT(YEAR FROM date) = ${year}
          AND notes LIKE '%[Smart Scan]%'
      `;

      let saved = 0;
      for (const exp of expenses) {
        await sql`
          INSERT INTO biz_transactions (
            date, description, amount, type, category, subcategory,
            is_deductible, deduction_pct, irs_reference, notes
          ) VALUES (
            ${exp.date || `${year}-01-01`},
            ${exp.original_description || exp.name || "Unknown"},
            ${-Math.abs(exp.amount || exp.total_ytd || 0)},
            'expense',
            ${exp.category || "Uncategorized"},
            ${exp.subcategory || "Needs Review"},
            TRUE,
            ${exp.deduction_pct || 100},
            ${exp.irs_reference || "Schedule C"},
            ${"[Smart Scan] " + (exp.reasoning || "Identified by AI as business expense")}
          )
        `;
        saved++;
      }

      return NextResponse.json({ ok: true, saved });
    }

    // Mode 3: Manual save (fallback for Catch Up tab)
    if (body.expenses && Array.isArray(body.expenses)) {
      const year = body.year || new Date().getFullYear();

      // Delete existing manual entries for this year
      await sql`
        DELETE FROM biz_transactions
        WHERE statement_id IS NULL
          AND EXTRACT(YEAR FROM date) = ${year}
          AND notes LIKE '%[Manual Catch-Up]%'
      `;

      let saved = 0;
      for (const exp of body.expenses) {
        if (!exp.total_ytd || exp.total_ytd <= 0) continue;

        // Spread monthly expenses across months
        const monthsUsed = exp.months_used || 1;
        for (let m = 1; m <= monthsUsed; m++) {
          const date = `${year}-${String(m).padStart(2, "0")}-01`;
          await sql`
            INSERT INTO biz_transactions (
              date, description, amount, type, category, subcategory,
              is_deductible, deduction_pct, irs_reference, notes
            ) VALUES (
              ${date},
              ${exp.name},
              ${-exp.monthly_cost},
              'expense',
              ${exp.category},
              ${exp.subcategory},
              TRUE,
              ${exp.deduction_pct || 100},
              ${exp.irs_reference || "Schedule C"},
              ${"[Manual Catch-Up]"}
            )
          `;
        }
        saved++;
      }

      return NextResponse.json({ ok: true, saved });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[catch-up]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// GET /api/finance/catch-up — check if catch-up data exists
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const year = parseInt(req.nextUrl.searchParams.get("year") || String(new Date().getFullYear()));

    const existing = await sql`
      SELECT category, subcategory, description, amount, date, notes
      FROM biz_transactions
      WHERE statement_id IS NULL
        AND EXTRACT(YEAR FROM date) = ${year}
        AND (notes LIKE '%[Smart Scan]%' OR notes LIKE '%[Manual Catch-Up]%')
      ORDER BY date ASC
    `;

    return NextResponse.json({ expenses: existing, count: existing.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
