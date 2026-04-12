// ── Retirement Readiness Engine ───────────────────────────────────────
// 4% Rule, future value projections, Monte Carlo simulation,
// and milestone tracking for retirement planning.

// ── The 4% Rule ──────────────────────────────────────────────────────
// Your retirement number = 25x your annual portfolio withdrawal needed.
// Annual withdrawal = annual lifestyle spend - Social Security income.
export function retirementNumber(
  annualSpend: number,
  annualSocialSecurity: number,
): number {
  return Math.max(0, (annualSpend - annualSocialSecurity)) * 25;
}

// ── Future Value of current savings + monthly contributions ──────────
// FV = PV × (1 + r)^n + PMT × [((1 + r)^n - 1) / r]
export function futureValue(
  currentBalance: number,
  monthlyContribution: number,
  annualReturn: number,
  yearsToRetirement: number,
): number {
  const r = annualReturn / 12;
  const n = yearsToRetirement * 12;
  if (r === 0) return currentBalance + monthlyContribution * n;

  const fvLumpSum = currentBalance * Math.pow(1 + r, n);
  const fvAnnuity = monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
  return fvLumpSum + fvAnnuity;
}

// ── Monthly contribution needed to hit a target ──────────────────────
export function monthlyContributionNeeded(
  currentBalance: number,
  targetBalance: number,
  annualReturn: number,
  yearsToRetirement: number,
): number {
  const r = annualReturn / 12;
  const n = yearsToRetirement * 12;
  if (r === 0) return Math.max(0, (targetBalance - currentBalance) / n);

  const fvOfCurrent = currentBalance * Math.pow(1 + r, n);
  const gap = targetBalance - fvOfCurrent;
  if (gap <= 0) return 0;

  return gap / ((Math.pow(1 + r, n) - 1) / r);
}

// ── Monte Carlo Simulation ───────────────────────────────────────────
// Runs 1000 simulations with random annual returns drawn from a normal
// distribution. Returns success rate (probability of not running out
// of money in retirement).
export interface MonteCarloResult {
  successRate: number;       // 0-100 percentage
  medianBalance: number;     // 50th percentile final balance
  bestCase: number;          // 90th percentile
  worstCase: number;         // 10th percentile
  simulations: number;
}

export function runMonteCarlo(
  currentBalance: number,
  monthlyContribution: number,
  yearsToRetirement: number,
  yearsInRetirement: number,
  annualWithdrawal: number,
  expectedReturn: number,    // e.g., 0.07
  volatility: number = 0.15, // standard deviation of annual returns
  numSimulations: number = 1000,
): MonteCarloResult {
  const successes: number[] = [];
  let successCount = 0;

  for (let sim = 0; sim < numSimulations; sim++) {
    let balance = currentBalance;

    // Accumulation phase
    for (let year = 0; year < yearsToRetirement; year++) {
      const annualReturn = randomNormal(expectedReturn, volatility);
      balance = balance * (1 + annualReturn) + monthlyContribution * 12;
    }

    const balanceAtRetirement = balance;

    // Distribution phase
    let survived = true;
    for (let year = 0; year < yearsInRetirement; year++) {
      const annualReturn = randomNormal(expectedReturn * 0.8, volatility); // Slightly lower returns in retirement (more conservative allocation)
      balance = balance * (1 + annualReturn) - annualWithdrawal;
      if (balance <= 0) {
        survived = false;
        break;
      }
    }

    if (survived) successCount++;
    successes.push(balanceAtRetirement);
  }

  successes.sort((a, b) => a - b);

  return {
    successRate: (successCount / numSimulations) * 100,
    medianBalance: successes[Math.floor(numSimulations / 2)],
    bestCase: successes[Math.floor(numSimulations * 0.9)],
    worstCase: successes[Math.floor(numSimulations * 0.1)],
    simulations: numSimulations,
  };
}

// Box-Muller transform for normal distribution
function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

// ── Cost of Waiting ──────────────────────────────────────────────────
// Shows how much delaying contributions costs in future value.
export interface CostOfWaitingEntry {
  label: string;
  startDelay: number;     // years delayed
  projectedBalance: number;
  costOfDelay: number;    // difference from starting today
}

export function costOfWaiting(
  monthlyContribution: number,
  annualReturn: number,
  yearsToRetirement: number,
): CostOfWaitingEntry[] {
  const delays = [0, 1, 2, 5, 10];
  const baseline = futureValue(0, monthlyContribution, annualReturn, yearsToRetirement);

  return delays.filter((d) => d < yearsToRetirement).map((delay) => ({
    label: delay === 0 ? "Start today" : `Wait ${delay} year${delay > 1 ? "s" : ""}`,
    startDelay: delay,
    projectedBalance: futureValue(0, monthlyContribution, annualReturn, yearsToRetirement - delay),
    costOfDelay: baseline - futureValue(0, monthlyContribution, annualReturn, yearsToRetirement - delay),
  }));
}

// ── Milestones ───────────────────────────────────────────────────────
export interface Milestone {
  label: string;
  target: number;
  reached: boolean;
  progressPct: number;
}

export function getMilestones(
  currentBalance: number,
  retirementTarget: number,
): Milestone[] {
  const milestones = [
    { label: "First $1,000", target: 1000 },
    { label: "First $10,000", target: 10000 },
    { label: "First $25,000", target: 25000 },
    { label: "First $50,000", target: 50000 },
    { label: "First $100,000", target: 100000 },
    { label: "25% of retirement goal", target: retirementTarget * 0.25 },
    { label: "50% of retirement goal", target: retirementTarget * 0.5 },
    { label: "100% — Fully funded!", target: retirementTarget },
  ];

  return milestones.map((m) => ({
    ...m,
    reached: currentBalance >= m.target,
    progressPct: Math.min(100, (currentBalance / m.target) * 100),
  }));
}
