"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, CheckCircle2, XCircle, Repeat, RefreshCw, TrendingUp } from "lucide-react";
import ManualBusinessExpense from "./ManualBusinessExpense";

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

interface CandidateTxn {
  source: "legacy" | "mercury";
  id: string;
  date: string;
  amount: number;
  description: string;
}

interface CandidateGroup {
  merchant: string;
  category: string | null;
  txn_count: number;
  total_amount: number;
  avg_confidence: number;
  suggested_deduction_pct: number | null;
  suggested_irs_reference: string | null;
  reason: string;
  first_seen: string;
  last_seen: string;
  transactions: CandidateTxn[];
}

interface Subscription {
  subscription_name: string;
  occurrence_count: number;
  total_spent: number;
  is_business_candidate: boolean;
}

interface Counts {
  pending_count: number;
  confirmed_count: number;
  kept_personal_count: number;
  unclassified_count: number;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function confidenceColor(c: number): string {
  if (c >= 80) return T.green;
  if (c >= 60) return T.yellow;
  return T.muted;
}

export default function BusinessCandidateReview() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [candidates, setCandidates] = useState<CandidateGroup[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/finance/business-candidates");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setCandidates(data.candidates ?? []);
      setSubscriptions(data.subscriptions ?? []);
      setCounts(data.counts ?? null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runClassifier() {
    setRunning(true);
    setMsg("Running Claude classifier over unclassified personal transactions...");
    try {
      const res = await fetch("/api/finance/classify-personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 500 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Classification failed");
      setMsg(
        `Classified ${data.legacy_classified + data.mercury_classified} transactions · ${data.candidates_found} business candidates · ${data.subscriptions_found} subscriptions detected.`,
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  async function moveToBusiness(group: CandidateGroup, txn: CandidateTxn) {
    try {
      const res = await fetch("/api/finance/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: txn.source,
          personalId: txn.id,
          category: group.category ?? "Other",
          deductionPct: group.suggested_deduction_pct ?? 100,
          irsReference: group.suggested_irs_reference,
        }),
      });
      if (!res.ok) throw new Error("Reclassify failed");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function moveAllInGroup(group: CandidateGroup) {
    for (const t of group.transactions) {
      await moveToBusiness(group, t);
    }
  }

  async function dismissTxn(txn: CandidateTxn, action: "keep_personal" | "dismiss") {
    try {
      const res = await fetch("/api/finance/business-candidates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: txn.source, id: txn.id, action }),
      });
      if (!res.ok) throw new Error("Dismiss failed");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading…</div>;
  }

  return (
    <div>
      {/* Manual entry panel for pre-Mercury historical business expenses */}
      <ManualBusinessExpense onAdded={load} />

      {/* Header with counts + run button */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${T.orange}15`, border: `1px solid ${T.orange}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles style={{ width: 20, height: 20, color: T.orange }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Business Expense Review</div>
          <div style={{ fontSize: 12, color: T.muted }}>
            Claude reviews your personal transactions for business expenses you can deduct. Nothing moves until you approve.
          </div>
        </div>
        <button
          onClick={runClassifier}
          disabled={running}
          style={{
            background: running ? "transparent" : T.orange,
            color: running ? T.muted : "#fff",
            border: `1px solid ${running ? T.border : T.orange}`,
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: running ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <RefreshCw style={{ width: 14, height: 14, animation: running ? "spin 1s linear infinite" : undefined }} />
          {running ? "Classifying…" : "Run classifier"}
        </button>
      </div>

      {msg && (
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 16, padding: "8px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          {msg}
        </div>
      )}

      {/* Status counts */}
      {counts && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
          <StatusCard label="Pending review" value={counts.pending_count} color={T.yellow} />
          <StatusCard label="Moved to business" value={counts.confirmed_count} color={T.green} />
          <StatusCard label="Kept personal" value={counts.kept_personal_count} color={T.blue} />
          <StatusCard label="Not yet classified" value={counts.unclassified_count} color={T.muted} />
        </div>
      )}

      {/* Candidates grouped by merchant */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>
          Business Candidates ({candidates.length} merchant{candidates.length === 1 ? "" : "s"})
        </div>
        {candidates.length === 0 ? (
          <div style={{ padding: 24, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, textAlign: "center", color: T.muted, fontSize: 13 }}>
            {counts?.unclassified_count ? "Run the classifier to find business expenses in your personal transactions." : "Nothing pending. All personal transactions reviewed."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {candidates.map((g) => {
              const isOpen = expanded === g.merchant + (g.category ?? "");
              return (
                <div key={g.merchant + (g.category ?? "")} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                  <div
                    onClick={() => setExpanded(isOpen ? null : g.merchant + (g.category ?? ""))}
                    style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{g.merchant}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{g.reason}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{fmt(Number(g.total_amount))}</div>
                      <div style={{ fontSize: 10, color: T.muted }}>{g.txn_count} txn{g.txn_count === 1 ? "" : "s"}</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 60 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: confidenceColor(g.avg_confidence) }}>{g.avg_confidence}%</div>
                      <div style={{ fontSize: 10, color: T.muted }}>confidence</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveAllInGroup(g); }}
                      style={{
                        background: T.green,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Repeat style={{ width: 12, height: 12 }} />
                      Move all
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 16px" }}>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
                        Suggested: <span style={{ color: T.text }}>{g.category ?? "—"}</span>
                        {g.suggested_deduction_pct != null && (
                          <span> · {g.suggested_deduction_pct}% deductible</span>
                        )}
                        {g.suggested_irs_reference && (
                          <span> · {g.suggested_irs_reference}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {g.transactions.map((t) => (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", fontSize: 12 }}>
                            <span style={{ color: T.muted, minWidth: 80 }}>{t.date}</span>
                            <span style={{ flex: 1, color: T.text }}>{t.description}</span>
                            <span style={{ color: T.text, fontWeight: 600, minWidth: 80, textAlign: "right" }}>{fmt(Math.abs(Number(t.amount)))}</span>
                            <button
                              onClick={() => moveToBusiness(g, t)}
                              title="Move to business"
                              style={{ background: "transparent", border: `1px solid ${T.green}`, color: T.green, borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 11 }}
                            >
                              <CheckCircle2 style={{ width: 12, height: 12 }} />
                            </button>
                            <button
                              onClick={() => dismissTxn(t, "keep_personal")}
                              title="Keep personal"
                              style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 11 }}
                            >
                              <XCircle style={{ width: 12, height: 12 }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subscriptions */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp style={{ width: 14, height: 14, color: T.blue }} />
          Detected Subscriptions ({subscriptions.length})
        </div>
        {subscriptions.length === 0 ? (
          <div style={{ padding: 24, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, textAlign: "center", color: T.muted, fontSize: 13 }}>
            No recurring charges detected yet. Run the classifier after uploading statements.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {subscriptions.map((s) => (
              <div key={s.subscription_name} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                    {s.subscription_name}
                    {s.is_business_candidate && (
                      <span style={{ marginLeft: 8, padding: "2px 6px", fontSize: 10, borderRadius: 4, background: `${T.orange}20`, color: T.orange, fontWeight: 700 }}>
                        BUSINESS
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>{s.occurrence_count} charge{s.occurrence_count === 1 ? "" : "s"}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{fmt(Number(s.total_spent))}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{label}</div>
    </div>
  );
}
