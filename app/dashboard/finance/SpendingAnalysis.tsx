"use client";

import { useEffect, useState, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { CreditCard, Edit3, Check } from "lucide-react";

const T = { orange: "#E86A2A", text: "#e8eaf0", muted: "#b0b4c8", surface: "#111111", border: "rgba(255,255,255,0.07)", green: "#2ecc71", red: "#e74c3c", yellow: "#f5a623", blue: "#3B82F6" };
const COLORS = ["#E86A2A", "#3B82F6", "#2ecc71", "#f5a623", "#e74c3c", "#8B5CF6", "#06B6D4", "#D946EF", "#F97316", "#84CC16", "#EC4899", "#14B8A6"];
function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n); }

interface SpendingCategory { category: string; total: number; count: number; }
interface BudgetTarget { id: string; category: string; monthly_target: number; is_active: boolean; }

export default function SpendingAnalysis() {
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [budgets, setBudgets] = useState<BudgetTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [txRes, budgetRes] = await Promise.all([
        fetch("/api/finance/transactions?type=personal"),
        fetch("/api/finance/budget-targets").catch(() => null),
      ]);
      const txData = await txRes.json();

      // Aggregate spending by category from transactions
      const catMap: Record<string, { total: number; count: number }> = {};
      for (const tx of (txData.transactions || [])) {
        if (parseFloat(tx.amount) >= 0) continue; // Skip income
        const cat = tx.category || "Uncategorized";
        if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
        catMap[cat].total += Math.abs(parseFloat(tx.amount));
        catMap[cat].count++;
      }
      setCategories(Object.entries(catMap).map(([category, data]) => ({ category, ...data })).sort((a, b) => b.total - a.total));

      if (budgetRes?.ok) {
        const bData = await budgetRes.json();
        setBudgets(bData.budgets || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  const totalSpending = categories.reduce((s, c) => s + c.total, 0);
  const donutData = categories.slice(0, 10).map((c, i) => ({ name: c.category, value: c.total, color: COLORS[i % COLORS.length] }));

  if (categories.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <CreditCard style={{ width: 48, height: 48, color: T.muted, margin: "0 auto 16px", opacity: 0.3 }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>No spending data yet</div>
        <div style={{ fontSize: 14, color: T.muted, maxWidth: 400, margin: "0 auto" }}>
          Upload personal bank or credit card statements to see your spending breakdown by category, budget targets, and recurring subscriptions.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Total + donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Spending Breakdown</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Category Totals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {categories.map((c, i) => {
              const pct = totalSpending > 0 ? (c.total / totalSpending * 100) : 0;
              return (
                <div key={c.category} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: T.text, flex: 1 }}>{c.category}</span>
                  <span style={{ fontSize: 12, color: T.muted }}>{pct.toFixed(0)}%</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.text, minWidth: 70, textAlign: "right" }}>{fmt(c.total)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
            <span style={{ color: T.text }}>Total</span>
            <span style={{ color: T.red }}>{fmt(totalSpending)}</span>
          </div>
        </div>
      </div>

      {/* Budget targets */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Budget Targets</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>Set monthly spending targets per category. Green = under budget, yellow = approaching, red = over.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {categories.map((c) => {
            const budget = budgets.find((b) => b.category === c.category);
            const target = budget?.monthly_target || 0;
            const pct = target > 0 ? (c.total / target * 100) : 0;
            const statusColor = pct === 0 ? T.muted : pct <= 80 ? T.green : pct <= 100 ? T.yellow : T.red;

            return (
              <div key={c.category} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                <span style={{ fontSize: 12, color: T.text, width: 140 }}>{c.category}</span>
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                  {target > 0 && <div style={{ height: 6, borderRadius: 3, width: `${Math.min(100, pct)}%`, background: statusColor }} />}
                </div>
                <span style={{ fontSize: 12, color: T.text, fontWeight: 700, minWidth: 70, textAlign: "right" }}>{fmt(c.total)}</span>
                <span style={{ fontSize: 11, color: T.muted, minWidth: 30, textAlign: "center" }}>/</span>
                <span style={{ fontSize: 12, color: target > 0 ? T.muted : "rgba(255,255,255,0.2)", minWidth: 70, textAlign: "right" }}>{target > 0 ? fmt(target) : "No target"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
