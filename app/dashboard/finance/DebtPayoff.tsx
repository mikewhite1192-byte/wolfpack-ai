"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Target, TrendingDown, DollarSign, Calendar } from "lucide-react";
import { calculatePayoff, estimateExtraPaymentImpact, type DebtAccount, type PayoffResult } from "@/lib/finance/debt-engine";

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

function futureDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  credit_limit: number | null;
  interest_rate: number | null;
}

export default function DebtPayoff() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [extraPayment, setExtraPayment] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/personal-accounts");
      const data = await res.json();
      setAccounts((data.accounts || []).filter((a: Account) => a.type === "credit_card"));
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  // Build debt accounts from personal_accounts
  const debts: DebtAccount[] = accounts.map((a) => ({
    name: a.name,
    balance: Math.abs(parseFloat(String(a.current_balance)) || 0),
    apr: parseFloat(String(a.interest_rate)) || 0.2499,
    minimumPayment: Math.max(25, Math.abs(parseFloat(String(a.current_balance)) || 0) * 0.02),
  }));

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);

  if (totalDebt === 0) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Target style={{ width: 48, height: 48, color: T.green, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 20, fontWeight: 700, color: T.green }}>Debt Free!</div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 8 }}>No credit card balances to pay off. Keep it up.</div>
      </div>
    );
  }

  // Calculate both methods
  const avalanche = calculatePayoff(debts, monthlyBudget, "avalanche");
  const snowball = calculatePayoff(debts, monthlyBudget, "snowball");

  // Extra payment impact
  const impact = extraPayment > 0 ? estimateExtraPaymentImpact(debts, monthlyBudget, extraPayment) : null;

  // Chart: remaining balance over time (avalanche)
  const chartData = avalanche.schedule.filter((_, i) => i % 3 === 0 || i === avalanche.schedule.length - 1).map((m) => ({
    month: `M${m.month}`,
    remaining: Math.round(m.totalRemaining),
  }));

  return (
    <div>
      {/* Total debt + budget */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.red, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(totalDebt)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Total Credit Card Debt</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>Monthly Payment Budget</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ color: T.muted }}>$</span>
            <input type="number" value={monthlyBudget} onChange={(e) => setMonthlyBudget(parseInt(e.target.value) || 100)} min={100} step={50}
              style={{ width: 100, padding: "6px 10px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 20, fontWeight: 700, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif" }} />
          </div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{avalanche.months} mo</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Payoff Timeline (Avalanche)</div>
          <div style={{ fontSize: 10, color: T.muted }}>Debt free by {futureDate(avalanche.months)}</div>
        </div>
      </div>

      {/* Avalanche vs Snowball comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {[
          { result: avalanche, label: "Avalanche", desc: "Highest APR first — least total interest", color: T.green, recommended: true },
          { result: snowball, label: "Snowball", desc: "Lowest balance first — fastest first win", color: T.yellow, recommended: false },
        ].map(({ result, label, desc, color, recommended }) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${recommended ? color + "40" : T.border}`, borderRadius: 12, padding: 20, position: "relative" }}>
            {recommended && (
              <div style={{ position: "absolute", top: -10, right: 16, background: color, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>RECOMMENDED</div>
            )}
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>{label} Method</div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 16 }}>{desc}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: T.muted }}>Payoff timeline</span>
                <span style={{ color: T.text, fontWeight: 700 }}>{result.months} months ({futureDate(result.months)})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: T.muted }}>Total paid</span>
                <span style={{ color: T.text }}>{fmt(result.totalPaid)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: T.muted }}>Total interest</span>
                <span style={{ color: T.red, fontWeight: 700 }}>{fmt(result.totalInterest)}</span>
              </div>
              {result.payoffDates.map((p) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
                  <span style={{ color: T.muted }}>{p.name} paid off</span>
                  <span style={{ color: color }}>{futureDate(p.month)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Interest saved comparison */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, fontSize: 13 }}>
        <span style={{ color: T.muted }}>Snowball costs</span>
        <span style={{ color: T.red, fontWeight: 700 }}>{fmt(snowball.totalInterest - avalanche.totalInterest)} more in interest</span>
        <span style={{ color: T.muted }}>than Avalanche</span>
      </div>

      {/* Extra payment slider */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.green, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>What If I Pay Extra?</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: T.muted }}>$0</span>
          <input type="range" min={0} max={1000} step={25} value={extraPayment} onChange={(e) => setExtraPayment(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: T.green }} />
          <span style={{ fontSize: 12, color: T.muted }}>$1,000</span>
        </div>
        {impact && extraPayment > 0 && (
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{impact.monthsSaved} mo</div>
              <div style={{ fontSize: 11, color: T.muted }}>Months saved</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(impact.interestSaved)}</div>
              <div style={{ fontSize: 11, color: T.muted }}>Interest saved</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif" }}>{futureDate(impact.newMonths)}</div>
              <div style={{ fontSize: 11, color: T.muted }}>New payoff date</div>
            </div>
          </div>
        )}
      </div>

      {/* Balance over time chart */}
      {chartData.length > 1 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.green, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Debt Payoff Trajectory (Avalanche)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="remaining" fill={T.red} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
