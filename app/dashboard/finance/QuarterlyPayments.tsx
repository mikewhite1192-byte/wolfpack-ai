"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, ExternalLink, CheckCircle, Clock, AlertTriangle } from "lucide-react";
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
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

interface Payment {
  id: string;
  quarter: string;
  year: number;
  type: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  confirmation_number: string | null;
  status: string;
}

const QUARTERS = [
  { q: "Q1", federal_due: "04-15", state_due: "04-15", label: "Jan 1 – Mar 31" },
  { q: "Q2", federal_due: "06-16", state_due: "06-16", label: "Apr 1 – May 31" },
  { q: "Q3", federal_due: "09-15", state_due: "09-15", label: "Jun 1 – Aug 31" },
  { q: "Q4", federal_due: "01-15", state_due: "01-15", label: "Sep 1 – Dec 31" },
];

export default function QuarterlyPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ytd, setYtd] = useState({ ytd_revenue: 0, ytd_expenses: 0 });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const year = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    try {
      const [payRes, stmtRes] = await Promise.all([
        fetch(`/api/finance/quarterly-payments?year=${year}`).catch(() => null),
        fetch("/api/finance/statements?type=business"),
      ]);
      if (payRes?.ok) {
        const data = await payRes.json();
        setPayments(data.payments || []);
      }
      const stmtData = await stmtRes.json();
      setYtd(stmtData.ytd || { ytd_revenue: 0, ytd_expenses: 0 });
    } catch { /* silent */ }
    setLoading(false);
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Calculate estimated quarterly payment using safe harbor
  const revenue = parseFloat(String(ytd.ytd_revenue)) || 0;
  const expenses = parseFloat(String(ytd.ytd_expenses)) || 0;
  const calc = calculateTaxStrategies({ grossRevenue: revenue, totalExpenses: expenses, homeOfficeSqFt: 200 });

  const annualizedTax = calc.totalTaxAfter;
  const quarterlyFederal = Math.ceil(annualizedTax * 0.9 / 4); // 90% safe harbor / 4
  const quarterlyState = Math.ceil((calc.michiganTaxAfter) / 4);

  async function markPaid(quarter: string, type: string) {
    setSavingId(`${quarter}-${type}`);
    const confirmNum = prompt("Confirmation number (optional):");
    try {
      await fetch("/api/finance/quarterly-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quarter, year, type,
          amount: type === "federal" ? quarterlyFederal : quarterlyState,
          confirmation_number: confirmNum || null,
        }),
      });
      fetchData();
    } catch { /* silent */ }
    setSavingId(null);
  }

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  return (
    <div>
      {/* Estimated amounts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(quarterlyFederal)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Federal (per quarter)</div>
          <div style={{ fontSize: 10, color: T.muted }}>90% safe harbor ÷ 4</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(quarterlyState)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Michigan (per quarter)</div>
          <div style={{ fontSize: 10, color: T.muted }}>4.25% flat ÷ 4</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(annualizedTax)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Annual Tax (after strategies)</div>
          <div style={{ fontSize: 10, color: T.muted }}>{calc.effectiveRate.toFixed(1)}% effective rate</div>
        </div>
      </div>

      {/* Quarterly grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {QUARTERS.map((q) => {
          const dueYear = q.q === "Q4" ? year + 1 : year;
          const federalDue = `${dueYear}-${q.federal_due}`;
          const stateDue = `${dueYear}-${q.state_due}`;
          const federalPaid = payments.find((p) => p.quarter === q.q && p.type === "federal" && p.status === "paid");
          const statePaid = payments.find((p) => p.quarter === q.q && p.type === "state" && p.status === "paid");
          const isPast = new Date(federalDue) < new Date();

          return (
            <div key={q.q} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{q.q} — {q.label}</div>
                {isPast && !federalPaid && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.red, display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle style={{ width: 12, height: 12 }} /> OVERDUE
                  </span>
                )}
              </div>

              {/* Federal */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Federal — {fmt(quarterlyFederal)}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Due {federalDue}</div>
                </div>
                {federalPaid ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.green, fontSize: 12 }}>
                    <CheckCircle style={{ width: 14, height: 14 }} /> Paid
                    {federalPaid.confirmation_number && <span style={{ color: T.muted }}>#{federalPaid.confirmation_number}</span>}
                  </div>
                ) : (
                  <button onClick={() => markPaid(q.q, "federal")} disabled={savingId === `${q.q}-federal`}
                    style={{ padding: "6px 14px", fontSize: 11, fontWeight: 600, background: T.orange, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                    {savingId === `${q.q}-federal` ? "..." : "Mark Paid"}
                  </button>
                )}
              </div>

              {/* State */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Michigan — {fmt(quarterlyState)}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Due {stateDue}</div>
                </div>
                {statePaid ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.green, fontSize: 12 }}>
                    <CheckCircle style={{ width: 14, height: 14 }} /> Paid
                    {statePaid.confirmation_number && <span style={{ color: T.muted }}>#{statePaid.confirmation_number}</span>}
                  </div>
                ) : (
                  <button onClick={() => markPaid(q.q, "state")} disabled={savingId === `${q.q}-state`}
                    style={{ padding: "6px 14px", fontSize: 11, fontWeight: 600, background: T.orange, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                    {savingId === `${q.q}-state` ? "..." : "Mark Paid"}
                  </button>
                )}
              </div>

              {/* Pay links */}
              <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                <a href="https://directpay.irs.gov" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.orange, textDecoration: "none" }}>
                  <ExternalLink style={{ width: 10, height: 10 }} /> IRS Direct Pay
                </a>
                <a href="https://www.michigan.gov/taxes" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: T.orange, textDecoration: "none" }}>
                  <ExternalLink style={{ width: 10, height: 10 }} /> Michigan Treasury
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
