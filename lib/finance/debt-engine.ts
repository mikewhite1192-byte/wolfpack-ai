// ── Debt Payoff Engine ────────────────────────────────────────────────
// Calculates avalanche (lowest interest) and snowball (lowest balance)
// payoff schedules for multiple credit cards.

export interface DebtAccount {
  name: string;
  balance: number;     // current balance (positive number)
  apr: number;         // annual percentage rate as decimal (e.g., 0.2499)
  minimumPayment: number;
}

export interface PayoffMonth {
  month: number;
  payments: { name: string; payment: number; interestCharged: number; remainingBalance: number }[];
  totalPaid: number;
  totalInterest: number;
  totalRemaining: number;
}

export interface PayoffResult {
  method: "avalanche" | "snowball";
  months: number;
  totalPaid: number;
  totalInterest: number;
  schedule: PayoffMonth[];
  payoffDates: { name: string; month: number }[];
}

export function calculatePayoff(
  debts: DebtAccount[],
  monthlyBudget: number,
  method: "avalanche" | "snowball",
): PayoffResult {
  // Clone debts so we don't mutate originals
  const accounts = debts.map((d) => ({
    ...d,
    balance: d.balance,
    paidOff: false,
    paidOffMonth: 0,
  }));

  // Sort: avalanche = highest APR first, snowball = lowest balance first
  const sorted = [...accounts].sort((a, b) => {
    if (method === "avalanche") return b.apr - a.apr;
    return a.balance - b.balance;
  });

  const schedule: PayoffMonth[] = [];
  const payoffDates: { name: string; month: number }[] = [];
  let totalPaid = 0;
  let totalInterest = 0;
  let month = 0;
  const MAX_MONTHS = 360; // 30 year safety cap

  while (sorted.some((a) => a.balance > 0.01) && month < MAX_MONTHS) {
    month++;
    let remaining = monthlyBudget;
    const monthPayments: PayoffMonth["payments"] = [];
    let monthInterest = 0;

    // First: pay minimums on all accounts
    for (const acct of sorted) {
      if (acct.balance <= 0.01) continue;

      const interest = (acct.balance * acct.apr) / 12;
      monthInterest += interest;
      acct.balance += interest;

      const minPay = Math.min(acct.minimumPayment, acct.balance);
      const actualPay = Math.min(minPay, remaining);
      acct.balance -= actualPay;
      remaining -= actualPay;

      monthPayments.push({
        name: acct.name,
        payment: actualPay,
        interestCharged: interest,
        remainingBalance: acct.balance,
      });
    }

    // Then: throw remaining budget at the target account (first non-paid-off in sorted order)
    for (const acct of sorted) {
      if (acct.balance <= 0.01 || remaining <= 0) continue;

      const extraPay = Math.min(remaining, acct.balance);
      acct.balance -= extraPay;
      remaining -= extraPay;

      // Update the payment record for this account
      const record = monthPayments.find((p) => p.name === acct.name);
      if (record) {
        record.payment += extraPay;
        record.remainingBalance = acct.balance;
      }
    }

    // Check for newly paid-off accounts
    for (const acct of sorted) {
      if (acct.balance <= 0.01 && !acct.paidOff) {
        acct.paidOff = true;
        acct.paidOffMonth = month;
        acct.balance = 0;
        payoffDates.push({ name: acct.name, month });
      }
    }

    const monthTotalPaid = monthPayments.reduce((s, p) => s + p.payment, 0);
    totalPaid += monthTotalPaid;
    totalInterest += monthInterest;

    schedule.push({
      month,
      payments: monthPayments,
      totalPaid: monthTotalPaid,
      totalInterest: monthInterest,
      totalRemaining: sorted.reduce((s, a) => s + Math.max(0, a.balance), 0),
    });
  }

  return {
    method,
    months: month,
    totalPaid,
    totalInterest,
    schedule,
    payoffDates,
  };
}

// Helper: estimate how much extra payment speeds up payoff
export function estimateExtraPaymentImpact(
  debts: DebtAccount[],
  baseBudget: number,
  extraAmount: number,
): { baseMonths: number; newMonths: number; monthsSaved: number; interestSaved: number } {
  const base = calculatePayoff(debts, baseBudget, "avalanche");
  const withExtra = calculatePayoff(debts, baseBudget + extraAmount, "avalanche");

  return {
    baseMonths: base.months,
    newMonths: withExtra.months,
    monthsSaved: base.months - withExtra.months,
    interestSaved: base.totalInterest - withExtra.totalInterest,
  };
}
