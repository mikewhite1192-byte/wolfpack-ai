"use client";

import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Shield, TrendingUp, AlertCircle, Upload } from "lucide-react";

const T = { orange: "#E86A2A", text: "#e8eaf0", muted: "#b0b4c8", surface: "#111111", border: "rgba(255,255,255,0.07)", green: "#2ecc71", red: "#e74c3c", yellow: "#f5a623", blue: "#3B82F6" };
function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n); }

function scoreColor(score: number): string {
  if (score >= 800) return T.green;
  if (score >= 740) return "#2ecc71";
  if (score >= 670) return T.yellow;
  if (score >= 580) return T.orange;
  return T.red;
}

function scoreLabel(score: number): string {
  if (score >= 800) return "Exceptional";
  if (score >= 740) return "Very Good";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Poor";
}

interface CreditReport {
  id: string;
  report_date: string;
  score_equifax: number | null;
  score_transunion: number | null;
  score_experian: number | null;
  score_average: number | null;
  utilization_rate: number | null;
  payment_history_pct: number | null;
  hard_inquiries_12mo: number | null;
  oldest_account_years: number | null;
  total_accounts: number | null;
  open_accounts: number | null;
  derogatory_marks: number | null;
}

export default function CreditScoreTracker() {
  const [reports, setReports] = useState<CreditReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualScore, setManualScore] = useState({ equifax: "", transunion: "", experian: "" });
  const [showManual, setShowManual] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/credit-reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveManualScore() {
    const avg = Math.round(([parseInt(manualScore.equifax) || 0, parseInt(manualScore.transunion) || 0, parseInt(manualScore.experian) || 0].filter(s => s > 0).reduce((a, b) => a + b, 0)) / [parseInt(manualScore.equifax) || 0, parseInt(manualScore.transunion) || 0, parseInt(manualScore.experian) || 0].filter(s => s > 0).length || 1);

    await fetch("/api/finance/credit-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score_equifax: parseInt(manualScore.equifax) || null,
        score_transunion: parseInt(manualScore.transunion) || null,
        score_experian: parseInt(manualScore.experian) || null,
        score_average: avg,
      }),
    });
    setShowManual(false);
    setManualScore({ equifax: "", transunion: "", experian: "" });
    fetchData();
  }

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  const latest = reports[0];
  const avgScore = latest?.score_average || 0;
  const utilization = latest ? parseFloat(String(latest.utilization_rate)) * 100 : 0;
  const paymentHistory = latest ? parseFloat(String(latest.payment_history_pct)) * 100 : 0;

  // Score factors
  const factors = [
    { label: "Payment History", weight: "35%", value: paymentHistory > 0 ? `${paymentHistory.toFixed(0)}%` : "—", status: paymentHistory >= 99 ? T.green : paymentHistory >= 95 ? T.yellow : T.red },
    { label: "Credit Utilization", weight: "30%", value: utilization > 0 ? `${utilization.toFixed(0)}%` : "—", status: utilization <= 10 ? T.green : utilization <= 30 ? T.yellow : T.red },
    { label: "Length of History", weight: "15%", value: latest?.oldest_account_years ? `${parseFloat(String(latest.oldest_account_years)).toFixed(1)} yrs` : "—", status: T.muted },
    { label: "Credit Mix", weight: "10%", value: latest?.total_accounts ? `${latest.total_accounts} accounts` : "—", status: T.muted },
    { label: "New Credit", weight: "10%", value: latest?.hard_inquiries_12mo !== null ? `${latest.hard_inquiries_12mo} inquiries` : "—", status: (latest?.hard_inquiries_12mo || 0) <= 2 ? T.green : T.yellow },
  ];

  // Chart data
  const chartData = reports.slice().reverse().map((r) => ({
    date: r.report_date?.slice(5) || "",
    score: r.score_average || 0,
  }));

  return (
    <div>
      {/* Score display or empty state */}
      {avgScore === 0 && reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Shield style={{ width: 48, height: 48, color: T.muted, margin: "0 auto 16px", opacity: 0.3 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>No credit score data yet</div>
          <div style={{ fontSize: 14, color: T.muted, maxWidth: 500, margin: "0 auto 20px" }}>
            Upload a credit report from annualcreditreport.com, or enter your scores manually below.
          </div>
          <button onClick={() => setShowManual(true)} style={{ padding: "12px 24px", fontSize: 13, fontWeight: 600, background: T.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            Enter Scores Manually
          </button>
        </div>
      ) : (
        <>
          {/* Score KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22, textAlign: "center", gridColumn: "1 / 3" }}>
              <div style={{ fontSize: 64, fontWeight: 700, color: scoreColor(avgScore), fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>{avgScore}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: scoreColor(avgScore) }}>{scoreLabel(avgScore)}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Average across bureaus</div>
            </div>
            {[
              { label: "Equifax", score: latest?.score_equifax },
              { label: "TransUnion", score: latest?.score_transunion },
            ].map((b) => (
              <div key={b.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: b.score ? scoreColor(b.score) : T.muted, fontFamily: "'Bebas Neue', sans-serif" }}>{b.score || "—"}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{b.label}</div>
              </div>
            ))}
          </div>

          {/* Score factors */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Score Factors</div>
            {factors.map((f) => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: f.status, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: T.text, flex: 1 }}>{f.label}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{f.weight}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text, minWidth: 80, textAlign: "right" }}>{f.value}</span>
              </div>
            ))}
          </div>

          {/* Utilization action */}
          {utilization > 30 && (
            <div style={{ padding: "14px 18px", background: "rgba(232,106,42,0.06)", border: `1px solid rgba(232,106,42,0.2)`, borderRadius: 10, marginBottom: 24, fontSize: 13, color: T.orange }}>
              <strong>Action:</strong> Your utilization is {utilization.toFixed(0)}% (above the 30% threshold). Paying down credit cards to get under 30% overall could add 20-40 points to your score within 60 days.
            </div>
          )}

          {/* Trend chart */}
          {chartData.length > 1 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Score Trend</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[500, 850]} tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke={T.blue} strokeWidth={2} dot={{ fill: T.blue, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <button onClick={() => setShowManual(true)} style={{ padding: "10px 20px", fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, cursor: "pointer" }}>
            + Add New Score Entry
          </button>
        </>
      )}

      {/* Manual entry modal */}
      {showManual && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }} onClick={() => setShowManual(false)}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 20 }}>Enter Credit Scores</div>
            {["equifax", "transunion", "experian"].map((bureau) => (
              <div key={bureau} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4, textTransform: "capitalize" }}>{bureau}</label>
                <input type="number" min={300} max={850} placeholder="e.g. 720"
                  value={manualScore[bureau as keyof typeof manualScore]}
                  onChange={(e) => setManualScore({ ...manualScore, [bureau]: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 14, fontWeight: 700 }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowManual(false)} style={{ padding: "8px 18px", fontSize: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveManualScore} style={{ padding: "8px 18px", fontSize: 12, fontWeight: 700, background: T.blue, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
