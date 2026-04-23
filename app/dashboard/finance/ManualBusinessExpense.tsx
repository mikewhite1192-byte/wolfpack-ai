"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronUp, Check } from "lucide-react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
};

const CATEGORIES = [
  "Software & Subscriptions",
  "Advertising & Marketing",
  "Office Supplies",
  "Professional Services",
  "Contractors",
  "Meals & Entertainment",
  "Travel",
  "Phone & Internet",
  "Banking Fees",
  "Cost of Goods Sold",
  "Other",
];

// Keyed suggestions for IRS Schedule C line by category. User can override.
const DEFAULT_IRS: Record<string, string> = {
  "Software & Subscriptions": "Schedule C Line 18 (Office expense)",
  "Advertising & Marketing": "Schedule C Line 8 (Advertising)",
  "Office Supplies": "Schedule C Line 22 (Supplies)",
  "Professional Services": "Schedule C Line 17 (Legal & professional)",
  "Contractors": "Schedule C Line 11 (Contract labor)",
  "Meals & Entertainment": "Schedule C Line 24b (Meals, 50%)",
  "Travel": "Schedule C Line 24a (Travel)",
  "Phone & Internet": "Schedule C Line 25 (Utilities)",
  "Banking Fees": "Schedule C Line 27a (Other expenses)",
  "Cost of Goods Sold": "Schedule C Part III (Cost of Goods Sold)",
  "Other": "Schedule C Line 27a (Other expenses)",
};

const DEFAULT_DEDUCTION: Record<string, number> = {
  "Meals & Entertainment": 50,
  "Phone & Internet": 50,
};

export default function ManualBusinessExpense({ onAdded }: { onAdded?: () => void }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [deductionPct, setDeductionPct] = useState(DEFAULT_DEDUCTION[CATEGORIES[0]] ?? 100);
  const [irsReference, setIrsReference] = useState(DEFAULT_IRS[CATEGORIES[0]] ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function selectCategory(c: string) {
    setCategory(c);
    setDeductionPct(DEFAULT_DEDUCTION[c] ?? 100);
    setIrsReference(DEFAULT_IRS[c] ?? "");
  }

  async function save() {
    const amt = parseFloat(amount);
    if (!description.trim() || !amt || !date) {
      setMsg("Need date, description, and amount.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "business",
          date,
          description: description.trim(),
          amount: amt,
          category,
          deduction_pct: deductionPct,
          irs_reference: irsReference || null,
          is_deductible: true,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setMsg(`Saved: ${description} — $${amt.toFixed(2)}`);
      setDescription("");
      setAmount("");
      setNotes("");
      onAdded?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "#0a0a0a",
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: "8px 10px",
    color: T.text,
    fontSize: 13,
    width: "100%",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: T.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    display: "block",
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, marginBottom: 20 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "14px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: T.text,
        }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.orange}15`, border: `1px solid ${T.orange}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus style={{ width: 16, height: 16, color: T.orange }} />
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Add pre-Mercury business expense</div>
          <div style={{ fontSize: 11, color: T.muted }}>Manual entry for historical business spend that ran through personal cards before 4/19</div>
        </div>
        {open ? <ChevronUp style={{ width: 16, height: 16, color: T.muted }} /> : <ChevronDown style={{ width: 16, height: 16, color: T.muted }} />}
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Amount ($)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Deduction %</label>
              <input type="number" min="0" max="100" value={deductionPct} onChange={(e) => setDeductionPct(parseInt(e.target.value) || 0)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Merchant / description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="NIPR* SD4V6ZMNY" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={category} onChange={(e) => selectCategory(e.target.value)} style={inputStyle}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>IRS reference</label>
              <input type="text" value={irsReference} onChange={(e) => setIrsReference(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Insurance licensing renewal" style={inputStyle} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: saving ? "transparent" : T.orange,
                color: saving ? T.muted : "#fff",
                border: `1px solid ${saving ? T.border : T.orange}`,
                borderRadius: 6,
                padding: "9px 18px",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Check style={{ width: 14, height: 14 }} />
              {saving ? "Saving…" : "Save expense"}
            </button>
            {msg && (
              <span style={{ fontSize: 12, color: msg.startsWith("Saved") ? T.green : T.red }}>
                {msg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
