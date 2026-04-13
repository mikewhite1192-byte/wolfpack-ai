"use client";

import { useEffect, useState, useCallback } from "react";
import { LineChart as LineChartIcon, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const T = { orange: "#E86A2A", text: "#e8eaf0", muted: "#b0b4c8", surface: "#111111", border: "rgba(255,255,255,0.07)", green: "#2ecc71", red: "#e74c3c", yellow: "#f5a623", blue: "#3B82F6" };
function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n); }

interface Account { id: string; name: string; type: string; current_balance: number; }

export default function InvestmentTracker() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [sp500Return, setSp500Return] = useState(12.5); // YTD placeholder

  useEffect(() => {
    fetch("/api/finance/personal-accounts").then((r) => r.json()).then((d) => {
      setAccounts((d.accounts || []).filter((a: Account) => a.type === "investment" || a.type === "retirement"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function updateBalance(id: string) {
    await fetch("/api/finance/personal-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, current_balance: parseFloat(editValue) || 0 }),
    });
    setEditingId(null);
    // Refresh
    const res = await fetch("/api/finance/personal-accounts");
    const d = await res.json();
    setAccounts((d.accounts || []).filter((a: Account) => a.type === "investment" || a.type === "retirement"));
  }

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  const investmentAccounts = accounts.filter((a) => a.type === "investment");
  const retirementAccounts = accounts.filter((a) => a.type === "retirement");
  const totalInvestments = investmentAccounts.reduce((s, a) => s + (parseFloat(String(a.current_balance)) || 0), 0);
  const totalRetirement = retirementAccounts.reduce((s, a) => s + (parseFloat(String(a.current_balance)) || 0), 0);
  const totalPortfolio = totalInvestments + totalRetirement;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(totalPortfolio)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Total Portfolio</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.blue, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(totalInvestments)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Brokerage</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(totalRetirement)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Retirement</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>S&P 500 YTD (%)</div>
          <input type="number" step="0.1" value={sp500Return} onChange={(e) => setSp500Return(parseFloat(e.target.value) || 0)}
            style={{ width: 80, padding: "6px 8px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, color: sp500Return >= 0 ? T.green : T.red, fontSize: 20, fontWeight: 700, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif" }} />
        </div>
      </div>

      {/* Account list */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Brokerage */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Brokerage Accounts</div>
          {investmentAccounts.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: T.muted, fontSize: 13 }}>No brokerage accounts configured. Upload an investment statement or add an account in Net Worth.</div>
          ) : investmentAccounts.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
              <BarChart3 style={{ width: 14, height: 14, color: T.blue }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.name}</div>
              </div>
              {editingId === a.id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus
                    style={{ width: 100, padding: "4px 8px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.blue}`, borderRadius: 4, color: T.text, fontSize: 12 }}
                    onKeyDown={(e) => { if (e.key === "Enter") updateBalance(a.id); if (e.key === "Escape") setEditingId(null); }} />
                  <button onClick={() => updateBalance(a.id)} style={{ padding: "4px 10px", fontSize: 11, background: T.blue, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Save</button>
                </div>
              ) : (
                <div onClick={() => { setEditingId(a.id); setEditValue(String(parseFloat(String(a.current_balance)) || 0)); }}
                  style={{ fontSize: 16, fontWeight: 700, color: T.blue, cursor: "pointer" }}>
                  {fmt(parseFloat(String(a.current_balance)) || 0)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Retirement */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Retirement Accounts</div>
          {retirementAccounts.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: T.muted, fontSize: 13 }}>
              No retirement accounts yet. When you open your SEP-IRA or Solo 401(k), add it here.
              <div style={{ marginTop: 12 }}>
                <button onClick={async () => {
                  await fetch("/api/finance/personal-accounts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "SEP-IRA", type: "retirement", institution: "TBD" }),
                  });
                  const res = await fetch("/api/finance/personal-accounts");
                  const d = await res.json();
                  setAccounts((d.accounts || []).filter((a: Account) => a.type === "investment" || a.type === "retirement"));
                }} style={{ padding: "8px 16px", fontSize: 12, background: T.orange, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                  + Add SEP-IRA
                </button>
              </div>
            </div>
          ) : retirementAccounts.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
              <TrendingUp style={{ width: 14, height: 14, color: T.orange }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.name}</div>
              </div>
              {editingId === a.id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus
                    style={{ width: 100, padding: "4px 8px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.orange}`, borderRadius: 4, color: T.text, fontSize: 12 }}
                    onKeyDown={(e) => { if (e.key === "Enter") updateBalance(a.id); if (e.key === "Escape") setEditingId(null); }} />
                  <button onClick={() => updateBalance(a.id)} style={{ padding: "4px 10px", fontSize: 11, background: T.orange, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Save</button>
                </div>
              ) : (
                <div onClick={() => { setEditingId(a.id); setEditValue(String(parseFloat(String(a.current_balance)) || 0)); }}
                  style={{ fontSize: 16, fontWeight: 700, color: T.orange, cursor: "pointer" }}>
                  {fmt(parseFloat(String(a.current_balance)) || 0)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Benchmark note */}
      <div style={{ marginTop: 16, padding: "12px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.muted }}>
        <strong style={{ color: T.text }}>Benchmark:</strong> The S&P 500 has historically returned ~10% annually (~7% inflation-adjusted). Enter your YTD return above to compare. Upload investment statements for automatic tracking.
      </div>
    </div>
  );
}
