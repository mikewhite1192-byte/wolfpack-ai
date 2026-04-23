"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Upload, TrendingUp, TrendingDown, DollarSign, FileText, AlertTriangle } from "lucide-react";
import { calculateTaxStrategies, type TaxInput, type TaxCalculation } from "@/lib/finance/tax-engine";
import MercuryBalances from "./MercuryBalances";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  yellow: "#f5a623",
  bg: "#0a0a0a",
};

const CHART_COLORS = ["#E86A2A", "#3B82F6", "#2ecc71", "#f5a623", "#e74c3c", "#8B5CF6", "#06B6D4", "#D946EF", "#F97316", "#84CC16"];

interface Statement {
  id: string;
  month: string;
  opening_balance: number;
  closing_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  transaction_count: number;
  total_income: number;
  total_expenses: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  total: number;
  deductible_total: number;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 18px", textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || T.text, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted }}>{sub}</div>}
    </div>
  );
}

export default function BusinessDashboard() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [ytd, setYtd] = useState({ ytd_revenue: 0, ytd_expenses: 0, ytd_transactions: 0 });
  const [taxCalc, setTaxCalc] = useState<TaxCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  // Tax strategy inputs (editable by user in future, defaults for now)
  const [taxInputs] = useState<Partial<TaxInput>>({
    homeOfficeSqFt: 200,
    healthInsurancePremiums: 0,
    businessMiles: 0,
    sepIraContribution: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      const [stmtRes, txRes] = await Promise.all([
        fetch("/api/finance/statements?type=business"),
        fetch("/api/finance/transactions?type=business"),
      ]);
      const stmtData = await stmtRes.json();
      const txData = await txRes.json();

      setStatements(stmtData.statements || []);
      setYtd(stmtData.ytd || { ytd_revenue: 0, ytd_expenses: 0, ytd_transactions: 0 });
      setCategories(txData.categories || []);

      // Run tax engine
      const revenue = parseFloat(stmtData.ytd?.ytd_revenue) || 0;
      const expenses = parseFloat(stmtData.ytd?.ytd_expenses) || 0;
      if (revenue > 0 || expenses > 0) {
        const calc = calculateTaxStrategies({
          grossRevenue: revenue,
          totalExpenses: expenses,
          ...taxInputs,
        });
        setTaxCalc(calc);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [taxInputs]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "business");

    try {
      const res = await fetch("/api/finance/parse-statement", { method: "POST", body: formData });
      const data = await res.json();
      if (data.ok) {
        setUploadMsg(`Imported ${data.transactionsImported} transactions from ${data.month}`);
        fetchData();
      } else {
        setUploadMsg(`Error: ${data.error}`);
      }
    } catch {
      setUploadMsg("Upload failed — check connection");
    }
    setUploading(false);
    e.target.value = "";
  }

  const netProfit = (parseFloat(String(ytd.ytd_revenue)) || 0) - (parseFloat(String(ytd.ytd_expenses)) || 0);
  const hasData = statements.length > 0;

  // Monthly revenue vs expenses chart data
  const monthlyData = statements.slice(0, 12).reverse().map((s) => ({
    month: s.month?.slice(5) || "",
    revenue: parseFloat(String(s.total_income)) || 0,
    expenses: parseFloat(String(s.total_expenses)) || 0,
  }));

  // Tax waterfall data
  const waterfallData = taxCalc?.strategies.filter((s) => s.deduction > 0).map((s) => ({
    name: s.name.length > 20 ? s.name.slice(0, 18) + "…" : s.name,
    value: s.deduction,
    fullName: s.name,
  })) || [];

  // Expense donut data
  const donutData = categories.filter((c) => c.category !== "Income" && c.category !== "Uncategorized").map((c, i) => ({
    name: c.category,
    value: parseFloat(String(c.total)) || 0,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80, color: T.muted, fontSize: 13 }}>Loading business dashboard...</div>;
  }

  return (
    <div>
      {/* Mercury live balances */}
      <MercuryBalances workspace="business" />

      {/* Upload bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "12px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <Upload style={{ width: 16, height: 16, color: T.orange }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.orange }}>
            {uploading ? "Parsing..." : "Upload Statement (PDF)"}
          </span>
          <input type="file" accept=".pdf" onChange={handleUpload} style={{ display: "none" }} disabled={uploading} />
        </label>
        {uploadMsg && <span style={{ fontSize: 12, color: uploadMsg.startsWith("Error") ? T.red : T.green }}>{uploadMsg}</span>}
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>{statements.length} statement{statements.length !== 1 ? "s" : ""} uploaded</span>
      </div>

      {!hasData ? (
        /* Empty state */
        <div style={{ textAlign: "center", padding: 80 }}>
          <FileText style={{ width: 48, height: 48, color: T.muted, margin: "0 auto 16px", opacity: 0.3 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>No statements yet</div>
          <div style={{ fontSize: 14, color: T.muted, maxWidth: 400, margin: "0 auto" }}>
            Upload your first Capital One bank statement PDF to see your financial dashboard, tax strategies, and AI analysis.
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            <KPI label="YTD Revenue" value={fmt(parseFloat(String(ytd.ytd_revenue)) || 0)} color={T.green} />
            <KPI label="YTD Expenses" value={fmt(parseFloat(String(ytd.ytd_expenses)) || 0)} color={T.red} />
            <KPI label="Net Profit" value={fmt(netProfit)} color={netProfit >= 0 ? T.green : T.red} />
            <KPI label="Tax (No Strategy)" value={taxCalc ? fmt(taxCalc.totalTaxBefore) : "—"} sub="Federal + SE + MI" color={T.red} />
            <KPI label="Tax (After Strategy)" value={taxCalc ? fmt(taxCalc.totalTaxAfter) : "—"} sub={taxCalc ? `${taxCalc.effectiveRate.toFixed(1)}% effective rate` : ""} color={T.orange} />
            <KPI label="Total Savings" value={taxCalc ? fmt(taxCalc.totalSavings) : "—"} sub="From tax strategies" color={T.green} />
          </div>

          {/* S-Corp Alert */}
          {taxCalc?.scorpThresholdMet && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(245,166,35,0.08)", border: `1px solid rgba(245,166,35,0.3)`, borderRadius: 10, marginBottom: 20 }}>
              <AlertTriangle style={{ width: 16, height: 16, color: T.yellow, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: T.yellow }}>
                <strong>S-Corp Threshold Reached.</strong> Net profit exceeds $50,000 — consider S-Corp election to reduce self-employment tax.
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Revenue vs Expenses Chart */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Monthly Revenue vs Expenses</div>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} barGap={2}>
                    <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="revenue" fill={T.green} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill={T.red} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13 }}>Upload statements to see chart</div>
              )}
            </div>

            {/* Expense Breakdown Donut */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Expense Breakdown</div>
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 10, color: T.muted }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13 }}>No expense data yet</div>
              )}
            </div>
          </div>

          {/* Tax Waterfall */}
          {waterfallData.length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
                Tax Strategy Waterfall — {fmt(taxCalc?.totalSavings || 0)} Saved
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, waterfallData.length * 36)}>
                <BarChart data={waterfallData} layout="vertical" barSize={20}>
                  <XAxis type="number" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fill: T.text, fontSize: 11 }} axisLine={false} tickLine={false} width={160} />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt(Number(v))} labelFormatter={(l) => waterfallData.find((d) => d.name === l)?.fullName || l} />
                  <Bar dataKey="value" fill={T.green} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent Statements */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Uploaded Statements</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {statements.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <FileText style={{ width: 14, height: 14, color: T.orange }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.month}</span>
                    <span style={{ fontSize: 11, color: T.muted, marginLeft: 12 }}>{s.transaction_count} transactions</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                    <span style={{ color: T.green }}>
                      <TrendingUp style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
                      {fmt(parseFloat(String(s.total_income)) || 0)}
                    </span>
                    <span style={{ color: T.red }}>
                      <TrendingDown style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
                      {fmt(parseFloat(String(s.total_expenses)) || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
