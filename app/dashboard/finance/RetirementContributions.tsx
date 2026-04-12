"use client";

import { useEffect, useState, useCallback } from "react";
import { PiggyBank, TrendingUp, DollarSign } from "lucide-react";
import { calculateTaxStrategies, TAX_CONSTANTS } from "@/lib/finance/tax-engine";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  blue: "#3B82F6",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function RetirementContributions() {
  const [ytd, setYtd] = useState({ ytd_revenue: 0, ytd_expenses: 0 });
  const [contribution, setContribution] = useState(0);
  const [retirementType, setRetirementType] = useState<"sep-ira" | "solo-401k">("sep-ira");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/statements?type=business");
      const data = await res.json();
      setYtd(data.ytd || { ytd_revenue: 0, ytd_expenses: 0 });
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const revenue = parseFloat(String(ytd.ytd_revenue)) || 0;
  const expenses = parseFloat(String(ytd.ytd_expenses)) || 0;
  const netProfit = revenue - expenses;

  // Calculate SE earnings for max contribution
  const seTax = Math.max(0, netProfit * TAX_CONSTANTS.SE_TAX_RATE);
  const netSEEarnings = netProfit - seTax * TAX_CONSTANTS.SE_DEDUCTION_RATE;

  // Max contributions
  const sepIraMax = Math.min(netSEEarnings * TAX_CONSTANTS.SEP_IRA_RATE, TAX_CONSTANTS.SEP_IRA_MAX);
  const solo401kMax = Math.min(
    TAX_CONSTANTS.SOLO_401K_EMPLOYEE + Math.max(0, netSEEarnings * TAX_CONSTANTS.SEP_IRA_RATE),
    TAX_CONSTANTS.SOLO_401K_TOTAL_MAX,
  );
  const maxContribution = retirementType === "sep-ira" ? sepIraMax : solo401kMax;

  // Tax impact with and without contribution
  const calcWithout = calculateTaxStrategies({ grossRevenue: revenue, totalExpenses: expenses, homeOfficeSqFt: 200 });
  const calcWith = calculateTaxStrategies({
    grossRevenue: revenue,
    totalExpenses: expenses,
    homeOfficeSqFt: 200,
    sepIraContribution: retirementType === "sep-ira" ? contribution : 0,
    solo401kContribution: retirementType === "solo-401k" ? contribution : 0,
  });

  const taxSaved = calcWithout.totalTaxAfter - calcWith.totalTaxAfter;
  const effectiveCost = contribution - taxSaved; // What the contribution actually "costs" after tax savings

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  return (
    <div>
      {/* Type selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        <button onClick={() => { setRetirementType("sep-ira"); setContribution(0); }}
          style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, background: retirementType === "sep-ira" ? T.orange : "transparent", color: retirementType === "sep-ira" ? "#fff" : T.muted, border: `1px solid ${retirementType === "sep-ira" ? T.orange : T.border}`, borderRadius: 8, cursor: "pointer" }}>
          SEP-IRA
        </button>
        <button onClick={() => { setRetirementType("solo-401k"); setContribution(0); }}
          style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, background: retirementType === "solo-401k" ? T.orange : "transparent", color: retirementType === "solo-401k" ? "#fff" : T.muted, border: `1px solid ${retirementType === "solo-401k" ? T.orange : T.border}`, borderRadius: 8, cursor: "pointer" }}>
          Solo 401(k)
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(netProfit)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>Net Profit</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(maxContribution)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>Max {retirementType === "sep-ira" ? "SEP-IRA" : "Solo 401(k)"}</div>
          <div style={{ fontSize: 10, color: T.muted }}>{retirementType === "sep-ira" ? "25% of net SE earnings" : `$${TAX_CONSTANTS.SOLO_401K_EMPLOYEE.toLocaleString()} + employer`}</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(taxSaved)}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>Tax Saved</div>
          <div style={{ fontSize: 10, color: T.muted }}>From {fmt(contribution)} contribution</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.blue, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(Math.max(0, effectiveCost))}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>Effective Cost</div>
          <div style={{ fontSize: 10, color: T.muted }}>Contribution minus tax savings</div>
        </div>
      </div>

      {/* Contribution slider */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 20 }}>
          Contribution Slider
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: T.muted }}>$0</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, maxContribution)}
            step={100}
            value={contribution}
            onChange={(e) => setContribution(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: T.orange, cursor: "pointer" }}
          />
          <span style={{ fontSize: 13, color: T.muted }}>{fmt(maxContribution)}</span>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>
            {fmt(contribution)}
          </div>
          <div style={{ fontSize: 14, color: T.muted, marginTop: 4 }}>
            {retirementType === "sep-ira" ? "SEP-IRA" : "Solo 401(k)"} contribution
          </div>
        </div>

        {/* Impact breakdown */}
        {contribution > 0 && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Tax Impact</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: T.muted }}>Tax without contribution</span>
                  <span style={{ color: T.red }}>{fmt(calcWithout.totalTaxAfter)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: T.muted }}>Tax with contribution</span>
                  <span style={{ color: T.green }}>{fmt(calcWith.totalTaxAfter)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, paddingTop: 6, borderTop: `1px solid ${T.border}` }}>
                  <span style={{ color: T.text }}>Tax savings</span>
                  <span style={{ color: T.green }}>{fmt(taxSaved)}</span>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Retirement Impact</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: T.muted }}>Contribution</span>
                  <span style={{ color: T.text }}>{fmt(contribution)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: T.muted }}>Effective cost (after tax savings)</span>
                  <span style={{ color: T.blue }}>{fmt(Math.max(0, effectiveCost))}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, paddingTop: 6, borderTop: `1px solid ${T.border}` }}>
                  <span style={{ color: T.text }}>Monthly equivalent</span>
                  <span style={{ color: T.orange }}>{fmt(contribution / 12)}/mo</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* The cross-tab teaser */}
        {contribution > 0 && (
          <div style={{ marginTop: 20, padding: "14px 18px", background: "rgba(46,204,113,0.06)", border: `1px solid rgba(46,204,113,0.2)`, borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: T.green, lineHeight: 1.6 }}>
              <strong>One action, two wins:</strong> Contributing {fmt(contribution)} to your {retirementType === "sep-ira" ? "SEP-IRA" : "Solo 401(k)"} saves you {fmt(taxSaved)} in taxes this year AND adds {fmt(contribution)} toward your retirement goal.
            </div>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10 }}>SEP-IRA</div>
          <ul style={{ fontSize: 12, color: T.muted, lineHeight: 2, paddingLeft: 16, margin: 0 }}>
            <li>Up to 25% of net self-employment earnings</li>
            <li>Max ${TAX_CONSTANTS.SEP_IRA_MAX.toLocaleString()} annually ({new Date().getFullYear()})</li>
            <li>Only employer contributions (no employee deferral)</li>
            <li>Simple to set up — just open an account and contribute</li>
            <li>Deadline: tax filing deadline (April 15 + extensions)</li>
          </ul>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10 }}>Solo 401(k)</div>
          <ul style={{ fontSize: 12, color: T.muted, lineHeight: 2, paddingLeft: 16, margin: 0 }}>
            <li>Two contribution buckets: employee + employer</li>
            <li>Employee: up to ${TAX_CONSTANTS.SOLO_401K_EMPLOYEE.toLocaleString()} ({new Date().getFullYear()})</li>
            <li>Employer: up to 25% of net SE earnings</li>
            <li>Total max: ${TAX_CONSTANTS.SOLO_401K_TOTAL_MAX.toLocaleString()}</li>
            <li>More paperwork but potentially higher contribution limit</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
