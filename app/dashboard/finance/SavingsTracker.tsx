"use client";

import { useEffect, useState, useCallback } from "react";
import { PiggyBank, Shield, TrendingUp } from "lucide-react";

const T = { orange: "#E86A2A", text: "#e8eaf0", muted: "#b0b4c8", surface: "#111111", border: "rgba(255,255,255,0.07)", green: "#2ecc71", red: "#e74c3c", yellow: "#f5a623", blue: "#3B82F6" };

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n); }

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.5s" }} />
    </div>
  );
}

export default function SavingsTracker() {
  const [accounts, setAccounts] = useState<{ type: string; current_balance: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyEssentials, setMonthlyEssentials] = useState(2500); // editable

  useEffect(() => {
    fetch("/api/finance/personal-accounts").then((r) => r.json()).then((d) => { setAccounts(d.accounts || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  const savingsBalance = accounts.filter((a) => a.type === "savings").reduce((s, a) => s + (parseFloat(String(a.current_balance)) || 0), 0);
  const totalIncome = accounts.filter((a) => a.type === "checking").reduce((s, a) => s + (parseFloat(String(a.current_balance)) || 0), 0); // Simplified — real calc from transactions
  const savingsRate = totalIncome > 0 ? (savingsBalance / totalIncome * 100) : 0;

  const threeMonthTarget = monthlyEssentials * 3;
  const sixMonthTarget = monthlyEssentials * 6;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.blue, fontFamily: "'Bebas Neue', sans-serif" }}>{savingsRate.toFixed(1)}%</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Savings Rate</div>
          <div style={{ fontSize: 10, color: savingsRate >= 20 ? T.green : savingsRate >= 10 ? T.yellow : T.red }}>{savingsRate >= 20 ? "Above target" : savingsRate >= 10 ? "At minimum" : "Below minimum"}</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(savingsBalance)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Savings Balance</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>Monthly Essentials</div>
          <input type="number" value={monthlyEssentials} onChange={(e) => setMonthlyEssentials(parseInt(e.target.value) || 0)} step={100}
            style={{ width: 100, padding: "6px 10px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 20, fontWeight: 700, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif" }} />
        </div>
      </div>

      {/* Savings rate targets */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Savings Rate Targets</div>
        {[
          { label: "Bare Minimum", target: 10, color: T.red },
          { label: "Recommended", target: 20, color: T.yellow },
          { label: "FIRE Target", target: 50, color: T.green },
        ].map((t) => (
          <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ width: 120, fontSize: 12, color: T.muted }}>{t.label} ({t.target}%)</span>
            <div style={{ flex: 1 }}><ProgressBar value={savingsRate} max={t.target} color={t.color} /></div>
            <span style={{ fontSize: 12, color: savingsRate >= t.target ? T.green : T.muted, fontWeight: 600 }}>{savingsRate >= t.target ? "✓" : `${(t.target - savingsRate).toFixed(1)}% to go`}</span>
          </div>
        ))}
      </div>

      {/* Emergency fund */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Shield style={{ width: 16, height: 16, color: T.orange }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase" }}>Emergency Fund</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>3-Month Target: {fmt(threeMonthTarget)}</div>
            <ProgressBar value={savingsBalance} max={threeMonthTarget} color={savingsBalance >= threeMonthTarget ? T.green : T.yellow} />
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{((savingsBalance / threeMonthTarget) * 100).toFixed(0)}% funded</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>6-Month Target: {fmt(sixMonthTarget)}</div>
            <ProgressBar value={savingsBalance} max={sixMonthTarget} color={savingsBalance >= sixMonthTarget ? T.green : T.orange} />
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{((savingsBalance / sixMonthTarget) * 100).toFixed(0)}% funded</div>
          </div>
        </div>
      </div>
    </div>
  );
}
