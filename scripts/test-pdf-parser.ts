// Quick test of the Claude-based PDF parser against Mike's real statements.
// Run: npx tsx scripts/test-pdf-parser.ts

import { readFileSync } from "node:fs";
import { parseStatementWithClaude } from "../lib/finance/pdf-parser-claude";

const TEST_FILES = [
  "/Volumes/External_HD/Wolfpack_site/bank_statements/Statement_012026_4210.pdf", // Cap One CC
  "/Volumes/External_HD/Wolfpack_site/bank_statements/20260301-Bank statement.pdf", // Cap One Checking
  "/Volumes/External_HD/Wolfpack_site/bank_statements/13ccbd12-c58f-4910-a618-14e08852f303.pdf", // SoFi
];

async function main() {
  for (const path of TEST_FILES) {
    const file = path.split("/").pop() ?? path;
    process.stdout.write(`\n=== ${file} ===\n`);
    try {
      const buf = readFileSync(path);
      const t0 = Date.now();
      const parsed = await parseStatementWithClaude(buf, file);
      const ms = Date.now() - t0;
      console.log(
        `Institution: ${parsed.institution} | ${parsed.account_type} | ${parsed.statement_type} | ending ${parsed.last_four ?? "?"}`,
      );
      console.log(
        `Period: ${parsed.period_start} -> ${parsed.period_end} (month=${parsed.month}) | ${ms}ms`,
      );
      console.log(
        `Balances: open=${parsed.opening_balance} close=${parsed.closing_balance} credits=${parsed.total_credits} debits=${parsed.total_debits}`,
      );
      console.log(`Transactions: ${parsed.transactions.length}`);
      for (const t of parsed.transactions.slice(0, 6)) {
        const sign = t.amount < 0 ? "-" : "+";
        const amt = Math.abs(t.amount).toFixed(2);
        console.log(`  ${t.date}  ${sign}$${amt.padStart(9)}  ${t.description}`);
      }
      if (parsed.transactions.length > 6) {
        console.log(`  ... + ${parsed.transactions.length - 6} more`);
      }
    } catch (err) {
      console.error(`FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
