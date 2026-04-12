"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Download, ExternalLink, CheckCircle, ArrowRight } from "lucide-react";
import { calculateTaxStrategies, TAX_CONSTANTS } from "@/lib/finance/tax-engine";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  yellow: "#f5a623",
  blue: "#3B82F6",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

interface CategoryTotal {
  category: string;
  total: number;
  deductible_total: number;
}

export default function TaxFiling() {
  const [ytd, setYtd] = useState({ ytd_revenue: 0, ytd_expenses: 0 });
  const [categories, setCategories] = useState<CategoryTotal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [stmtRes, txRes] = await Promise.all([
        fetch("/api/finance/statements?type=business"),
        fetch("/api/finance/transactions?type=business"),
      ]);
      const stmtData = await stmtRes.json();
      const txData = await txRes.json();
      setYtd(stmtData.ytd || { ytd_revenue: 0, ytd_expenses: 0 });
      setCategories(txData.categories || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const revenue = parseFloat(String(ytd.ytd_revenue)) || 0;
  const expenses = parseFloat(String(ytd.ytd_expenses)) || 0;
  const calc = calculateTaxStrategies({ grossRevenue: revenue, totalExpenses: expenses, homeOfficeSqFt: 200 });
  const netProfit = calc.netProfit;

  // Schedule C line items from expense categories
  const schedCExpenses: { line: string; label: string; amount: number }[] = [
    { line: "8", label: "Advertising", amount: findCat("Advertising") },
    { line: "10", label: "Commissions & fees", amount: findCat("Banking") },
    { line: "11", label: "Contract labor", amount: findCat("Professional Services") },
    { line: "13", label: "Depreciation / Section 179", amount: findCat("Office Expenses") },
    { line: "15", label: "Insurance", amount: findCat("Insurance") },
    { line: "17", label: "Legal & professional services", amount: 0 },
    { line: "18", label: "Office expense", amount: 0 },
    { line: "24a", label: "Travel", amount: findCat("Travel") },
    { line: "24b", label: "Meals (50%)", amount: findCat("Meals") * 0.5 },
    { line: "25", label: "Utilities", amount: findCat("Utilities") },
    { line: "27a", label: "Other expenses (software, education, etc.)", amount: findCat("Software") + findCat("Education") },
  ];
  const totalSchedCExpenses = schedCExpenses.reduce((s, e) => s + e.amount, 0);

  function findCat(name: string): number {
    const cat = categories.find((c) => c.category === name);
    return parseFloat(String(cat?.total)) || 0;
  }

  // SE Tax calculation
  const seTaxableEarnings = netProfit * 0.9235;
  const seTax = seTaxableEarnings * 0.153;
  const seDeduction = seTax * 0.5;

  // 1040 summary
  const agi = netProfit - seDeduction;
  const taxableIncome = Math.max(0, agi - TAX_CONSTANTS.STANDARD_DEDUCTION);
  const federalTax = calc.federalTaxAfter;
  const michiganTax = calc.michiganTaxAfter;

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  const year = new Date().getFullYear();

  return (
    <div>
      {/* Year header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <FileText style={{ width: 20, height: 20, color: T.orange }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Tax Year {year} — Filing Summary</div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: T.muted }}>
          {revenue > 0 ? "Based on uploaded statement data" : "Upload statements to generate filing data"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Schedule C */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.orange, marginBottom: 4 }}>Schedule C — Profit or Loss from Business</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 20 }}>Sole Proprietorship — The Wolf Pack Co LLC</div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>Line 1: Gross Receipts</span>
            <span style={{ fontSize: 13, color: T.green, fontWeight: 700 }}>{fmt(revenue)}</span>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: 1, textTransform: "uppercase", margin: "16px 0 8px" }}>Expenses</div>
          {schedCExpenses.filter((e) => e.amount > 0).map((e) => (
            <div key={e.line} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
              <span style={{ color: T.muted }}>Line {e.line}: {e.label}</span>
              <span style={{ color: T.text }}>{fmt(e.amount)}</span>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", marginTop: 8, borderTop: `1px solid ${T.border}`, fontWeight: 700 }}>
            <span style={{ fontSize: 13, color: T.text }}>Line 28: Total Expenses</span>
            <span style={{ fontSize: 13, color: T.red }}>{fmt(totalSchedCExpenses)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", marginTop: 4, borderTop: `2px solid ${T.orange}`, fontWeight: 700 }}>
            <span style={{ fontSize: 14, color: T.text }}>Line 31: Net Profit</span>
            <span style={{ fontSize: 14, color: netProfit >= 0 ? T.green : T.red }}>{fmt(netProfit)}</span>
          </div>
        </div>

        {/* Schedule SE */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.orange, marginBottom: 4 }}>Schedule SE — Self-Employment Tax</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 20 }}>Social Security + Medicare on self-employment income</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: T.muted }}>Net earnings from Schedule C</span>
              <span style={{ color: T.text }}>{fmt(netProfit)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: T.muted }}>× 92.35% (taxable portion)</span>
              <span style={{ color: T.text }}>{fmt(seTaxableEarnings)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: T.muted }}>× 15.3% (SE tax rate)</span>
              <span style={{ color: T.red, fontWeight: 700 }}>{fmt(seTax)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
              <span style={{ color: T.muted }}>50% deductible (above-the-line)</span>
              <span style={{ color: T.green }}>{fmt(seDeduction)}</span>
            </div>
          </div>

          {/* 1040 Summary */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: `2px solid ${T.blue}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.blue, marginBottom: 16 }}>Form 1040 — Summary</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: T.muted }}>Adjusted Gross Income</span>
                <span style={{ color: T.text }}>{fmt(agi)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: T.muted }}>Standard Deduction</span>
                <span style={{ color: T.green }}>-{fmt(TAX_CONSTANTS.STANDARD_DEDUCTION)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: T.muted }}>Taxable Income</span>
                <span style={{ color: T.text }}>{fmt(taxableIncome)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                <span style={{ color: T.text }}>Federal Tax</span>
                <span style={{ color: T.red }}>{fmt(federalTax)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: T.text }}>Self-Employment Tax</span>
                <span style={{ color: T.red }}>{fmt(seTax)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: T.text }}>Michigan Tax (4.25%)</span>
                <span style={{ color: T.red }}>{fmt(michiganTax)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, paddingTop: 10, borderTop: `2px solid ${T.orange}` }}>
                <span style={{ color: T.text }}>Total Tax Liability</span>
                <span style={{ color: T.orange }}>{fmt(federalTax + seTax + michiganTax)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filing Instructions */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.orange, marginBottom: 16 }}>Filing Instructions</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Federal */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Federal — IRS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { step: 1, text: "Go to IRS Free File or Direct File", link: "https://www.irs.gov/freefile" },
                { step: 2, text: "Select the free filing option for your income level" },
                { step: 3, text: "Enter Schedule C data from the summary above" },
                { step: 4, text: "Enter Schedule SE self-employment tax" },
                { step: 5, text: "Apply standard deduction ($14,600)" },
                { step: 6, text: "Submit and save confirmation number" },
              ].map((s) => (
                <div key={s.step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${T.orange}20`, color: T.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.step}</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                    {s.text}
                    {s.link && (
                      <a href={s.link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 6, color: T.orange, textDecoration: "none", fontSize: 11 }}>
                        <ExternalLink style={{ width: 10, height: 10 }} /> Open
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Michigan */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Michigan — MI-1040</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { step: 1, text: "Go to Michigan Treasury e-file", link: "https://www.michigan.gov/taxes" },
                { step: 2, text: "Enter Michigan taxable income (same as federal AGI)" },
                { step: 3, text: "Apply Michigan flat tax rate (4.25%)" },
                { step: 4, text: `Michigan tax: ${fmt(michiganTax)}` },
                { step: 5, text: "Submit and save confirmation number" },
              ].map((s) => (
                <div key={s.step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${T.blue}20`, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.step}</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                    {s.text}
                    {s.link && (
                      <a href={s.link} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 6, color: T.blue, textDecoration: "none", fontSize: 11 }}>
                        <ExternalLink style={{ width: 10, height: 10 }} /> Open
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key dates */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Key Dates</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 12 }}>
            <span style={{ color: T.muted }}>Tax year: <strong style={{ color: T.text }}>{year}</strong></span>
            <span style={{ color: T.muted }}>Filing deadline: <strong style={{ color: T.text }}>April 15, {year + 1}</strong></span>
            <span style={{ color: T.muted }}>Extension deadline: <strong style={{ color: T.text }}>October 15, {year + 1}</strong></span>
            <span style={{ color: T.muted }}>SEP-IRA deadline: <strong style={{ color: T.text }}>April 15 (or extension date)</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
