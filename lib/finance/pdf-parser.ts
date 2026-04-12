// ── PDF Statement Parser ─────────────────────────────────────────────
// Extracts transactions from bank statement PDFs.
// Currently supports Capital One business checking format.
// When Mike gets real PDFs, the regex patterns can be tuned to match
// the exact layout.

export interface ParsedTransaction {
  date: string;       // "2026-04-01"
  description: string;
  amount: number;     // negative = debit, positive = credit
  balance?: number;   // running balance if available
}

export interface ParsedStatement {
  month: string;              // "2026-04"
  openingBalance: number;
  closingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  transactions: ParsedTransaction[];
  rawText: string;            // full extracted text for AI analysis
}

// ── Capital One Business Checking Parser ─────────────────────────────
// Capital One statements typically have:
//   - Account summary at the top with opening/closing balances
//   - Transaction table with columns: Date, Description, Withdrawals,
//     Deposits, Balance
//   - Dates in "MM/DD" or "MM/DD/YYYY" format
//   - Dollar amounts with commas and 2 decimal places

export function parseCapitalOneStatement(text: string): ParsedStatement {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Extract statement period / month
  let month = "";
  const periodMatch = text.match(
    /(?:statement\s+period|period\s+ending|through)\s*[:\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
  );
  if (periodMatch) {
    const year = periodMatch[3].length === 2 ? `20${periodMatch[3]}` : periodMatch[3];
    month = `${year}-${periodMatch[1].padStart(2, "0")}`;
  } else {
    // Fallback: use current month
    const now = new Date();
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  // Extract opening/closing balances
  let openingBalance = 0;
  let closingBalance = 0;

  const openMatch = text.match(
    /(?:beginning|opening|previous)\s+balance[:\s]*\$?([\d,]+\.\d{2})/i,
  );
  if (openMatch) openingBalance = parseAmount(openMatch[1]);

  const closeMatch = text.match(
    /(?:ending|closing|new)\s+balance[:\s]*\$?([\d,]+\.\d{2})/i,
  );
  if (closeMatch) closingBalance = parseAmount(closeMatch[1]);

  // Extract total deposits and withdrawals
  let totalDeposits = 0;
  let totalWithdrawals = 0;

  const depositMatch = text.match(
    /(?:total\s+)?deposits?(?:\s+and\s+credits?)?[:\s]*\$?([\d,]+\.\d{2})/i,
  );
  if (depositMatch) totalDeposits = parseAmount(depositMatch[1]);

  const withdrawalMatch = text.match(
    /(?:total\s+)?(?:withdrawals?|debits?)(?:\s+and\s+charges?)?[:\s]*\$?([\d,]+\.\d{2})/i,
  );
  if (withdrawalMatch) totalWithdrawals = parseAmount(withdrawalMatch[1]);

  // Extract individual transactions
  // Pattern: date followed by description followed by amount(s)
  // Multiple formats handled:
  //   "04/01  STRIPE TRANSFER  1,234.56"
  //   "04/01/2026  STRIPE TRANSFER  $1,234.56  $5,678.90"
  //   "Apr 01  STRIPE TRANSFER  -1,234.56"
  const transactions: ParsedTransaction[] = [];

  const txRegex =
    /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})(?:\s+(-?\$?[\d,]+\.\d{2}))?(?:\s+(-?\$?[\d,]+\.\d{2}))?/gm;

  let match;
  while ((match = txRegex.exec(text)) !== null) {
    const txMonth = match[1].padStart(2, "0");
    const txDay = match[2].padStart(2, "0");
    const txYear = match[3]
      ? match[3].length === 2 ? `20${match[3]}` : match[3]
      : month.split("-")[0] || new Date().getFullYear().toString();
    const date = `${txYear}-${txMonth}-${txDay}`;
    const description = match[4].trim();

    // Determine amount: last numeric column is usually the balance,
    // second-to-last is the transaction amount.
    // If only one amount, it's the transaction amount.
    let amount: number;
    let balance: number | undefined;

    if (match[7]) {
      // Three amounts: withdrawal, deposit, balance
      const withdrawal = parseAmount(match[5]);
      const deposit = parseAmount(match[6]);
      balance = parseAmount(match[7]);
      amount = deposit > 0 ? deposit : -withdrawal;
    } else if (match[6]) {
      // Two amounts: amount + balance
      amount = parseAmount(match[5]);
      balance = parseAmount(match[6]);
    } else {
      // One amount
      amount = parseAmount(match[5]);
    }

    // Skip header/summary rows
    if (description.toLowerCase().includes("opening balance")) continue;
    if (description.toLowerCase().includes("closing balance")) continue;
    if (description.toLowerCase().includes("total ")) continue;

    transactions.push({ date, description, amount, balance });
  }

  // If no transactions were parsed with the regex, try a simpler line-by-line approach
  if (transactions.length === 0) {
    for (const line of lines) {
      const simpleMatch = line.match(
        /^(\d{1,2})[\/\-](\d{1,2})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})\s*$/,
      );
      if (simpleMatch) {
        const txYear = month.split("-")[0] || new Date().getFullYear().toString();
        transactions.push({
          date: `${txYear}-${simpleMatch[1].padStart(2, "0")}-${simpleMatch[2].padStart(2, "0")}`,
          description: simpleMatch[3].trim(),
          amount: parseAmount(simpleMatch[4]),
        });
      }
    }
  }

  // Recalculate totals from transactions if not found in header
  if (totalDeposits === 0 && totalWithdrawals === 0) {
    for (const tx of transactions) {
      if (tx.amount > 0) totalDeposits += tx.amount;
      else totalWithdrawals += Math.abs(tx.amount);
    }
  }

  return {
    month,
    openingBalance,
    closingBalance,
    totalDeposits,
    totalWithdrawals,
    transactions,
    rawText: text,
  };
}

// ── Generic Parser (fallback) ────────────────────────────────────────
// For statements that don't match Capital One format.
// Attempts basic date + description + amount extraction.
export function parseGenericStatement(text: string): ParsedStatement {
  return parseCapitalOneStatement(text); // Same logic for now, tuned later
}

// ── Helper: parse dollar amount string to number ─────────────────────
function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, "");
  return parseFloat(cleaned) || 0;
}
