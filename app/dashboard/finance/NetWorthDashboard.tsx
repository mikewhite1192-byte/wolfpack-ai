"use client";

import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Wallet, TrendingUp, TrendingDown, Building2, User, CreditCard, PiggyBank, BarChart3, Plus } from "lucide-react";

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

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string;
  current_balance: number;
  credit_limit: number | null;
  interest_rate: number | null;
}

interface NetWorthData {
  assets: { checking: number; savings: number; investments: number; retirement: number; total: number };
  liabilities: { creditCards: number; total: number };
  personalNetWorth: number;
  businessNetWorth: number;
  combinedNetWorth: number;
  monthChange: number;
  history: { snapshot_date: string; net_worth: number; combined_net_worth: number }[];
}

export default function NetWorthDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [acctRes, nwRes] = await Promise.all([
        fetch("/api/finance/personal-accounts"),
        fetch("/api/finance/net-worth"),
      ]);
      const acctData = await acctRes.json();
      const nwData = await nwRes.json();
      setAccounts(acctData.accounts || []);
      setNetWorth(nwData);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function updateBalance(id: string) {
    await fetch("/api/finance/personal-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, current_balance: parseFloat(editBalance) || 0 }),
    });
    setEditingId(null);
    setEditBalance("");
    fetchData();
  }

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  const nw = netWorth;
  const assets = accounts.filter((a) => a.type !== "credit_card");
  const debts = accounts.filter((a) => a.type === "credit_card");

  const accountIcon = (type: string) => {
    if (type === "checking" || type === "savings") return <PiggyBank style={{ width: 14, height: 14, color: T.green }} />;
    if (type === "investment") return <BarChart3 style={{ width: 14, height: 14, color: T.blue }} />;
    if (type === "retirement") return <TrendingUp style={{ width: 14, height: 14, color: T.orange }} />;
    if (type === "credit_card") return <CreditCard style={{ width: 14, height: 14, color: T.red }} />;
    return <Wallet style={{ width: 14, height: 14, color: T.muted }} />;
  };

  // Chart data
  const chartData = (nw?.history || []).map((h) => ({
    date: h.snapshot_date?.slice(5) || "",
    personal: parseFloat(String(h.net_worth)) || 0,
    combined: parseFloat(String(h.combined_net_worth)) || 0,
  }));

  return (
    <div>
      {/* Main net worth KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
            {fmt(nw?.personalNetWorth || 0)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <User style={{ width: 12, height: 12, color: T.blue }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Personal Net Worth</span>
          </div>
          {nw?.monthChange !== 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: (nw?.monthChange || 0) >= 0 ? T.green : T.red, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              {(nw?.monthChange || 0) >= 0 ? <TrendingUp style={{ width: 12, height: 12 }} /> : <TrendingDown style={{ width: 12, height: 12 }} />}
              {fmt(Math.abs(nw?.monthChange || 0))} vs last snapshot
            </div>
          )}
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
            {fmt(nw?.combinedNetWorth || 0)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Building2 style={{ width: 12, height: 12, color: T.orange }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Combined (Personal + Business)</span>
          </div>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(nw?.assets?.total || 0)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Total Assets</div>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.red, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(nw?.liabilities?.total || 0)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Total Debt</div>
        </div>
      </div>

      {/* Net worth trend chart */}
      {chartData.length > 1 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Net Worth Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt(Number(v))} />
              <Line type="monotone" dataKey="personal" stroke={T.blue} strokeWidth={2} dot={false} name="Personal" />
              <Line type="monotone" dataKey="combined" stroke={T.orange} strokeWidth={2} dot={false} name="Combined" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Assets */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.green, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Assets</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {assets.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${T.border}` }}>
                {accountIcon(a.type)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>{a.institution} · {a.type}</div>
                </div>
                {editingId === a.id ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input type="number" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} autoFocus placeholder="0.00"
                      style={{ width: 100, padding: "4px 8px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.blue}`, borderRadius: 4, color: T.text, fontSize: 12 }}
                      onKeyDown={(e) => { if (e.key === "Enter") updateBalance(a.id); if (e.key === "Escape") setEditingId(null); }} />
                    <button onClick={() => updateBalance(a.id)} style={{ padding: "4px 10px", fontSize: 11, background: T.blue, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Save</button>
                  </div>
                ) : (
                  <div onClick={() => { setEditingId(a.id); setEditBalance(String(parseFloat(String(a.current_balance)) || 0)); }}
                    style={{ fontSize: 14, fontWeight: 700, color: T.green, cursor: "pointer" }} title="Click to update balance">
                    {fmt(parseFloat(String(a.current_balance)) || 0)}
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", fontWeight: 700, fontSize: 14, borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
              <span style={{ color: T.text }}>Total Assets</span>
              <span style={{ color: T.green }}>{fmt(nw?.assets?.total || 0)}</span>
            </div>
          </div>
        </div>

        {/* Liabilities */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.red, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Liabilities</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {debts.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${T.border}` }}>
                {accountIcon(a.type)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>
                    {a.institution}
                    {a.interest_rate ? ` · ${(parseFloat(String(a.interest_rate)) * 100).toFixed(1)}% APR` : ""}
                    {a.credit_limit ? ` · ${fmt(parseFloat(String(a.credit_limit)))} limit` : ""}
                  </div>
                </div>
                {editingId === a.id ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input type="number" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} autoFocus placeholder="0.00"
                      style={{ width: 100, padding: "4px 8px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.red}`, borderRadius: 4, color: T.text, fontSize: 12 }}
                      onKeyDown={(e) => { if (e.key === "Enter") updateBalance(a.id); if (e.key === "Escape") setEditingId(null); }} />
                    <button onClick={() => updateBalance(a.id)} style={{ padding: "4px 10px", fontSize: 11, background: T.red, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Save</button>
                  </div>
                ) : (
                  <div onClick={() => { setEditingId(a.id); setEditBalance(String(Math.abs(parseFloat(String(a.current_balance))) || 0)); }}
                    style={{ fontSize: 14, fontWeight: 700, color: T.red, cursor: "pointer" }} title="Click to update balance">
                    {fmt(Math.abs(parseFloat(String(a.current_balance)) || 0))}
                  </div>
                )}
              </div>
            ))}
            {debts.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: T.muted, fontSize: 13 }}>No credit card debt — nice!</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", fontWeight: 700, fontSize: 14, borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
              <span style={{ color: T.text }}>Total Liabilities</span>
              <span style={{ color: T.red }}>{fmt(nw?.liabilities?.total || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Business net worth */}
      <div style={{ marginTop: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Building2 style={{ width: 16, height: 16, color: T.orange }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Business Net Worth</span>
          <span style={{ fontSize: 11, color: T.muted }}>(from latest bank statement)</span>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.orange }}>{fmt(nw?.businessNetWorth || 0)}</span>
      </div>

      {/* Snapshot button */}
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <button onClick={async () => { await fetch("/api/finance/net-worth", { method: "POST" }); fetchData(); }}
          style={{ padding: "10px 24px", fontSize: 13, fontWeight: 600, background: T.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Save Net Worth Snapshot
        </button>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Saves current balances as a point-in-time snapshot for trend tracking</div>
      </div>
    </div>
  );
}
