"use client";

import { useState } from "react";
import { Search, Upload, Check, X, Loader2, FileText, Sparkles, DollarSign } from "lucide-react";

const T = { orange: "#E86A2A", text: "#e8eaf0", muted: "#b0b4c8", surface: "#111111", border: "rgba(255,255,255,0.07)", green: "#2ecc71", red: "#e74c3c", yellow: "#f5a623", blue: "#3B82F6" };
function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n); }

interface FlaggedExpense {
  original_description: string;
  amount: number;
  date: string;
  category: string;
  subcategory: string;
  deduction_pct: number;
  irs_reference: string;
  confidence: string;
  reasoning: string;
  confirmed: boolean;
}

type Stage = "upload" | "scanning" | "review" | "saved";

export default function CatchUp() {
  const [stage, setStage] = useState<Stage>("upload");
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flagged, setFlagged] = useState<FlaggedExpense[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");

    try {
      // Step 1: Parse the PDF to extract transactions
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "personal");

      // Use a lightweight parse — we don't need to save to personal_transactions,
      // just extract the text and parse transactions
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default || pdfParseModule;
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfData = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer);

      // Import the parser
      const { parseCapitalOneStatement } = await import("@/lib/finance/pdf-parser");
      const parsed = parseCapitalOneStatement(pdfData.text);

      if (parsed.transactions.length === 0) {
        setUploadMsg("No transactions found in this PDF. Try a different statement.");
        setUploading(false);
        return;
      }

      setTotalScanned(parsed.transactions.length);
      setUploadMsg(`Extracted ${parsed.transactions.length} transactions. Running AI scan...`);
      setStage("scanning");
      setScanning(true);

      // Step 2: Send to Claude for Smart Scan
      const scanRes = await fetch("/api/finance/catch-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scan",
          transactions: parsed.transactions.map((tx) => ({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
          })),
        }),
      });

      const scanData = await scanRes.json();
      const flaggedExpenses: FlaggedExpense[] = (scanData.flaggedExpenses || []).map(
        (exp: Omit<FlaggedExpense, "confirmed">) => ({
          ...exp,
          confirmed: exp.confidence === "high",
        })
      );

      setFlagged(flaggedExpenses);
      setStage("review");
    } catch (err) {
      setUploadMsg(`Error: ${err instanceof Error ? err.message : "Upload failed"}`);
    }

    setUploading(false);
    setScanning(false);
    e.target.value = "";
  }

  async function handleSave() {
    const confirmed = flagged.filter((f) => f.confirmed);
    if (confirmed.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/finance/catch-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          year: new Date().getFullYear(),
          expenses: confirmed,
        }),
      });
      if (res.ok) setStage("saved");
    } catch { /* silent */ }
    setSaving(false);
  }

  const confirmedCount = flagged.filter((f) => f.confirmed).length;
  const confirmedTotal = flagged.filter((f) => f.confirmed).reduce((s, f) => s + Math.abs(f.amount || 0), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Sparkles style={{ width: 20, height: 20, color: T.orange }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Smart Scan — Find Business Expenses</div>
          <div style={{ fontSize: 12, color: T.muted }}>
            Upload a personal bank or credit card statement. AI identifies your business expenses automatically.
          </div>
        </div>
      </div>

      {/* Stage: Upload */}
      {stage === "upload" && (
        <div style={{ background: T.surface, border: `2px dashed ${T.border}`, borderRadius: 16, padding: 60, textAlign: "center" }}>
          <Upload style={{ width: 40, height: 40, color: T.orange, margin: "0 auto 16px" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>Upload Personal Statement (PDF)</div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, maxWidth: 500, margin: "0 auto 20px" }}>
            SoFi, Capital One, Amazon CC, or any bank/credit card statement. Claude AI will scan every transaction and flag your business expenses.
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: T.orange, color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: uploading ? "wait" : "pointer" }}>
            <FileText style={{ width: 16, height: 16 }} />
            {uploading ? "Parsing..." : "Choose PDF"}
            <input type="file" accept=".pdf" onChange={handleUpload} style={{ display: "none" }} disabled={uploading} />
          </label>
          {uploadMsg && <div style={{ marginTop: 16, fontSize: 13, color: uploadMsg.startsWith("Error") ? T.red : T.green }}>{uploadMsg}</div>}

          {/* Note about T-Mobile */}
          <div style={{ marginTop: 24, fontSize: 11, color: T.muted, maxWidth: 400, margin: "24px auto 0" }}>
            T-Mobile is flagged as 100% business. Internet at 50%. Equipment purchases flagged for Section 179. Meta Ads only for Wolf Pack (not other ventures).
          </div>
        </div>
      )}

      {/* Stage: Scanning */}
      {stage === "scanning" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 60, textAlign: "center" }}>
          <Loader2 style={{ width: 40, height: 40, color: T.orange, margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>AI Scanning {totalScanned} Transactions...</div>
          <div style={{ fontSize: 13, color: T.muted }}>Claude is reviewing each transaction against your business profile.</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Stage: Review */}
      {stage === "review" && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif" }}>{totalScanned}</div>
              <div style={{ fontSize: 11, color: T.muted }}>Transactions Scanned</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{flagged.length}</div>
              <div style={{ fontSize: 11, color: T.muted }}>Business Expenses Found</div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(confirmedTotal)}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{confirmedCount} Confirmed Deductions</div>
            </div>
          </div>

          {/* Flagged expenses checklist */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase" }}>Review Business Expenses</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setFlagged((f) => f.map((e) => ({ ...e, confirmed: true })))}
                  style={{ fontSize: 11, color: T.green, background: "none", border: `1px solid ${T.green}40`, borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
                  Confirm All
                </button>
                <button onClick={() => setFlagged((f) => f.map((e) => ({ ...e, confirmed: false })))}
                  style={{ fontSize: 11, color: T.muted, background: "none", border: `1px solid ${T.border}`, borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
                  Deselect All
                </button>
              </div>
            </div>

            {flagged.map((exp, idx) => (
              <div key={idx}
                onClick={() => setFlagged((f) => f.map((e, i) => i === idx ? { ...e, confirmed: !e.confirmed } : e))}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                  borderBottom: `1px solid ${T.border}`, cursor: "pointer",
                  background: exp.confirmed ? "rgba(46,204,113,0.04)" : "transparent",
                  transition: "background 0.15s",
                }}>
                {/* Checkbox */}
                <div style={{ width: 22, height: 22, borderRadius: 4, border: `2px solid ${exp.confirmed ? T.green : T.border}`, background: exp.confirmed ? T.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {exp.confirmed && <Check style={{ width: 14, height: 14, color: "#fff" }} />}
                </div>

                {/* Description + reasoning */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{exp.original_description}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{exp.reasoning}</div>
                </div>

                {/* Category */}
                <div style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>
                  {exp.category}
                  {exp.deduction_pct < 100 && <span style={{ color: T.yellow }}> ({exp.deduction_pct}%)</span>}
                </div>

                {/* Confidence badge */}
                <div style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: exp.confidence === "high" ? "rgba(46,204,113,0.15)" : "rgba(245,166,35,0.15)", color: exp.confidence === "high" ? T.green : T.yellow, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {exp.confidence === "high" ? "HIGH" : "REVIEW"}
                </div>

                {/* Amount */}
                <div style={{ fontSize: 14, fontWeight: 700, color: T.red, whiteSpace: "nowrap", minWidth: 80, textAlign: "right" }}>
                  {fmt(Math.abs(exp.amount || 0))}
                </div>

                {/* Date */}
                <div style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>{exp.date}</div>
              </div>
            ))}

            {flagged.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>
                No business expenses found in this statement. Try a different statement or add expenses manually.
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => { setStage("upload"); setFlagged([]); }}
              style={{ padding: "12px 24px", fontSize: 13, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, cursor: "pointer" }}>
              Scan Another Statement
            </button>
            <button onClick={handleSave} disabled={saving || confirmedCount === 0}
              style={{ padding: "12px 32px", fontSize: 14, fontWeight: 700, background: confirmedCount > 0 ? T.orange : "rgba(255,255,255,0.04)", color: confirmedCount > 0 ? "#fff" : T.muted, border: "none", borderRadius: 8, cursor: confirmedCount > 0 ? "pointer" : "default" }}>
              {saving ? "Saving..." : `Add ${confirmedCount} Expenses to Schedule C (${fmt(confirmedTotal)})`}
            </button>
          </div>
        </>
      )}

      {/* Stage: Saved */}
      {stage === "saved" && (
        <div style={{ background: T.surface, border: `1px solid rgba(46,204,113,0.3)`, borderRadius: 16, padding: 60, textAlign: "center" }}>
          <Check style={{ width: 48, height: 48, color: T.green, margin: "0 auto 16px" }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: T.green, marginBottom: 8 }}>Expenses Added to Schedule C</div>
          <div style={{ fontSize: 14, color: T.muted, marginBottom: 24 }}>
            {confirmedCount} business expenses totaling {fmt(confirmedTotal)} have been added. Your tax calculations, waterfall chart, and Schedule C summary are updated.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => { setStage("upload"); setFlagged([]); }}
              style={{ padding: "12px 24px", fontSize: 13, fontWeight: 600, background: T.orange, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
              Scan Another Statement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
