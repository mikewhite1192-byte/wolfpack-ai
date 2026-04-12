// ── Wolf Pack Tax Strategy Engine ─────────────────────────────────────
// Implements 13 IRS-aligned tax reduction strategies for single-member
// Michigan LLCs. Each strategy is a pure function that takes financial
// data and returns a deduction amount + explanation.
//
// References:
//   IRS Pub 334 (Small Business), Pub 535 (Business Expenses),
//   Pub 560 (Retirement Plans), Pub 587 (Home Office),
//   Pub 946 (Depreciation), Pub 463 (Travel/Meals)
//   IRC §199A (QBI), IRC §280A(g) (Augusta Rule)

// ── 2026 Tax Constants ───────────────────────────────────────────────
export const TAX_CONSTANTS = {
  // Federal tax brackets (single filer, 2026)
  BRACKETS: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  STANDARD_DEDUCTION: 14600,
  SE_TAX_RATE: 0.9235 * 0.153, // 92.35% of net × 15.3%
  SE_DEDUCTION_RATE: 0.5, // 50% of SE tax is deductible
  QBI_RATE: 0.20, // 20% of qualified business income
  QBI_PHASEOUT_SINGLE: 191950,
  SEP_IRA_RATE: 0.25, // 25% of net SE earnings
  SEP_IRA_MAX: 69000,
  SOLO_401K_EMPLOYEE: 23000, // employee deferral limit
  SOLO_401K_TOTAL_MAX: 69000,
  HOME_OFFICE_SIMPLIFIED_RATE: 5, // $5 per sq ft
  HOME_OFFICE_MAX_SQFT: 300,
  AUGUSTA_RULE_MAX_DAYS: 14,
  MILEAGE_RATE: 0.67, // $0.67 per mile for 2026
  MICHIGAN_TAX_RATE: 0.0425,
  SCORP_THRESHOLD: 50000,
};

// ── Input Data ───────────────────────────────────────────────────────
export interface TaxInput {
  grossRevenue: number;
  totalExpenses: number;
  // Optional overrides for specific strategies
  homeOfficeSqFt?: number;
  augustaRuleDays?: number;
  augustaRuleDailyRate?: number;
  section179Amount?: number;
  healthInsurancePremiums?: number;
  businessMiles?: number;
  accountablePlanAmount?: number;
  incomeDeferralAmount?: number;
  expenseAccelerationAmount?: number;
  sepIraContribution?: number;
  solo401kContribution?: number;
  priorYearProfit?: number; // for S-Corp threshold tracking
}

// ── Strategy Result ──────────────────────────────────────────────────
export interface StrategyResult {
  id: string;
  name: string;
  deduction: number;
  explanation: string;
  irsReference: string;
  isActive: boolean; // whether this strategy has a nonzero impact
}

export interface TaxCalculation {
  netProfit: number;
  strategies: StrategyResult[];
  totalDeductions: number;
  seTaxBefore: number;
  seTaxAfter: number;
  federalTaxBefore: number;
  federalTaxAfter: number;
  michiganTaxBefore: number;
  michiganTaxAfter: number;
  totalTaxBefore: number;
  totalTaxAfter: number;
  totalSavings: number;
  effectiveRate: number;
  scorpThresholdMet: boolean;
}

// ── Calculate Federal Income Tax ─────────────────────────────────────
function calculateFederalTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  for (const bracket of TAX_CONSTANTS.BRACKETS) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

// ── Run All 13 Strategies ────────────────────────────────────────────
export function calculateTaxStrategies(input: TaxInput): TaxCalculation {
  const C = TAX_CONSTANTS;
  const netProfit = input.grossRevenue - input.totalExpenses;

  // ── Strategy 1: Self-Employment Tax Deduction ────────────
  const seTax = Math.max(0, netProfit * C.SE_TAX_RATE);
  const seDeduction = seTax * C.SE_DEDUCTION_RATE;

  // ── Strategy 2: Section 199A QBI Deduction ───────────────
  const qbiEligibleIncome = Math.max(0, netProfit - seDeduction);
  const qbiDeduction = qbiEligibleIncome < C.QBI_PHASEOUT_SINGLE
    ? qbiEligibleIncome * C.QBI_RATE
    : 0; // Simplified — full phase-out calc is more complex

  // ── Strategy 3: SEP-IRA Contribution ─────────────────────
  const netSEEarnings = netProfit - seDeduction;
  const sepIraMax = Math.min(netSEEarnings * C.SEP_IRA_RATE, C.SEP_IRA_MAX);
  const sepIra = Math.min(input.sepIraContribution ?? 0, sepIraMax);

  // ── Strategy 4: Solo 401(k) ──────────────────────────────
  // Two buckets: employee deferral + employer profit sharing
  const solo401kEmployee = Math.min(input.solo401kContribution ?? 0, C.SOLO_401K_EMPLOYEE);
  const solo401kEmployer = Math.min(netSEEarnings * C.SEP_IRA_RATE, C.SOLO_401K_TOTAL_MAX - solo401kEmployee);
  const solo401k = solo401kEmployee + Math.max(0, solo401kEmployer);
  // Use EITHER SEP-IRA OR Solo 401k, not both (simplified)
  const retirementDeduction = Math.max(sepIra, solo401k);
  const retirementType = sepIra >= solo401k ? "SEP-IRA" : "Solo 401(k)";

  // ── Strategy 5: Home Office Deduction ────────────────────
  const sqft = Math.min(input.homeOfficeSqFt ?? 0, C.HOME_OFFICE_MAX_SQFT);
  const homeOffice = sqft * C.HOME_OFFICE_SIMPLIFIED_RATE;

  // ── Strategy 6: Augusta Rule ─────────────────────────────
  const augustaDays = Math.min(input.augustaRuleDays ?? 0, C.AUGUSTA_RULE_MAX_DAYS);
  const augustaIncome = augustaDays * (input.augustaRuleDailyRate ?? 0);
  // Augusta Rule income is TAX-FREE, so it's effectively a deduction

  // ── Strategy 7: Section 179 Equipment ────────────────────
  const section179 = input.section179Amount ?? 0;

  // ── Strategy 8: Health Insurance Premium Deduction ───────
  const healthInsurance = input.healthInsurancePremiums ?? 0;

  // ── Strategy 9: Vehicle Mileage ──────────────────────────
  const mileageDeduction = (input.businessMiles ?? 0) * C.MILEAGE_RATE;

  // ── Strategy 10: Accountable Plan ────────────────────────
  const accountablePlan = input.accountablePlanAmount ?? 0;

  // ── Strategy 11: Income Deferral ─────────────────────────
  const incomeDeferral = input.incomeDeferralAmount ?? 0;

  // ── Strategy 12: Expense Acceleration ────────────────────
  const expenseAcceleration = input.expenseAccelerationAmount ?? 0;

  // ── Strategy 13: S-Corp Election Monitor ─────────────────
  const scorpThresholdMet = netProfit >= C.SCORP_THRESHOLD;

  // ── Build strategy results ───────────────────────────────
  const strategies: StrategyResult[] = [
    { id: "se_deduction", name: "Self-Employment Tax Deduction", deduction: seDeduction, explanation: `50% of $${seTax.toFixed(0)} SE tax = $${seDeduction.toFixed(0)} above-the-line deduction`, irsReference: "IRC §164(f)", isActive: seDeduction > 0 },
    { id: "qbi", name: "Section 199A QBI Deduction", deduction: qbiDeduction, explanation: `20% of $${qbiEligibleIncome.toFixed(0)} qualified business income`, irsReference: "IRC §199A", isActive: qbiDeduction > 0 },
    { id: "retirement", name: `${retirementType} Contribution`, deduction: retirementDeduction, explanation: retirementType === "SEP-IRA" ? `Up to 25% of net SE earnings, max $${C.SEP_IRA_MAX.toLocaleString()}` : `Employee: $${solo401kEmployee.toLocaleString()} + Employer: $${Math.max(0, solo401kEmployer).toFixed(0)}`, irsReference: retirementType === "SEP-IRA" ? "IRS Pub 560" : "IRS Pub 560, IRC §401(k)", isActive: retirementDeduction > 0 },
    { id: "home_office", name: "Home Office Deduction", deduction: homeOffice, explanation: `${sqft} sq ft × $${C.HOME_OFFICE_SIMPLIFIED_RATE}/sq ft (simplified method)`, irsReference: "IRS Pub 587", isActive: homeOffice > 0 },
    { id: "augusta", name: "Augusta Rule (Home Rental)", deduction: augustaIncome, explanation: `${augustaDays} days × $${input.augustaRuleDailyRate ?? 0}/day = $${augustaIncome.toFixed(0)} tax-free rental income`, irsReference: "IRC §280A(g)", isActive: augustaIncome > 0 },
    { id: "section_179", name: "Section 179 Equipment", deduction: section179, explanation: `Full first-year deduction on business equipment`, irsReference: "IRS Pub 946, IRC §179", isActive: section179 > 0 },
    { id: "health_insurance", name: "Health Insurance Premium", deduction: healthInsurance, explanation: `100% of premiums deducted above-the-line`, irsReference: "IRC §162(l)", isActive: healthInsurance > 0 },
    { id: "mileage", name: "Vehicle Mileage Deduction", deduction: mileageDeduction, explanation: `${input.businessMiles ?? 0} miles × $${C.MILEAGE_RATE}/mile`, irsReference: "IRS Pub 463", isActive: mileageDeduction > 0 },
    { id: "accountable_plan", name: "Accountable Plan", deduction: accountablePlan, explanation: `Tax-free reimbursement for personal business expenses`, irsReference: "IRS Pub 535", isActive: accountablePlan > 0 },
    { id: "income_deferral", name: "Income Deferral", deduction: incomeDeferral, explanation: `Deferred invoices to shift income to next tax year`, irsReference: "Cash method timing", isActive: incomeDeferral > 0 },
    { id: "expense_acceleration", name: "Expense Acceleration", deduction: expenseAcceleration, explanation: `Pre-paid deductible expenses before year-end`, irsReference: "Cash method timing", isActive: expenseAcceleration > 0 },
    { id: "scorp_monitor", name: "S-Corp Election Monitor", deduction: 0, explanation: scorpThresholdMet ? `Net profit $${netProfit.toLocaleString()} exceeds $${C.SCORP_THRESHOLD.toLocaleString()} threshold — consider S-Corp election to save on SE tax` : `Net profit $${netProfit.toLocaleString()} below $${C.SCORP_THRESHOLD.toLocaleString()} threshold — S-Corp not yet advantageous`, irsReference: "IRC §1362", isActive: scorpThresholdMet },
  ];

  // ── Calculate total deductions and taxes ──────────────────
  const totalStrategyDeductions = strategies.reduce((sum, s) => sum + s.deduction, 0);

  // Tax BEFORE strategies (just SE tax + income tax on full profit)
  const taxableBeforeStrategies = Math.max(0, netProfit - seDeduction - C.STANDARD_DEDUCTION);
  const federalBefore = calculateFederalTax(taxableBeforeStrategies);
  const michiganBefore = Math.max(0, netProfit - seDeduction) * C.MICHIGAN_TAX_RATE;

  // Tax AFTER strategies
  const adjustedIncome = Math.max(0, netProfit - totalStrategyDeductions);
  const taxableAfter = Math.max(0, adjustedIncome - C.STANDARD_DEDUCTION);
  const federalAfter = calculateFederalTax(taxableAfter);
  const michiganAfter = Math.max(0, adjustedIncome) * C.MICHIGAN_TAX_RATE;

  // SE tax doesn't change with income deductions (it's on net profit),
  // but retirement contributions reduce the SE earnings base
  const adjustedSEProfit = Math.max(0, netProfit - retirementDeduction - homeOffice - section179 - mileageDeduction);
  const seTaxAfter = Math.max(0, adjustedSEProfit * C.SE_TAX_RATE);

  const totalBefore = seTax + federalBefore + michiganBefore;
  const totalAfter = seTaxAfter + federalAfter + michiganAfter;

  return {
    netProfit,
    strategies,
    totalDeductions: totalStrategyDeductions,
    seTaxBefore: seTax,
    seTaxAfter: seTaxAfter,
    federalTaxBefore: federalBefore,
    federalTaxAfter: federalAfter,
    michiganTaxBefore: michiganBefore,
    michiganTaxAfter: michiganAfter,
    totalTaxBefore: totalBefore,
    totalTaxAfter: totalAfter,
    totalSavings: Math.max(0, totalBefore - totalAfter),
    effectiveRate: netProfit > 0 ? (totalAfter / netProfit) * 100 : 0,
    scorpThresholdMet,
  };
}
