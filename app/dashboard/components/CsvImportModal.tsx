"use client";

import { useState, useRef } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  bg: "#0D1426",
};

const CRM_FIELDS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "source", label: "Source" },
];

interface CsvImportModalProps {
  onClose: () => void;
  onComplete: () => void;
}

export default function CsvImportModal({ onClose, onComplete }: CsvImportModalProps) {
  const [step, setStep] = useState<"upload" | "map" | "importing" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number | undefined>>({});
  const [aiEnabled, setAiEnabled] = useState(true);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState("");

  async function handleFileUpload(file: File) {
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/contacts/import?action=preview", { method: "POST", body: formData });
    const data = await res.json();

    if (data.error) {
      setError(data.error);
      setUploading(false);
      return;
    }

    setHeaders(data.headers);
    setSampleRows(data.sampleRows);
    setTotalRows(data.totalRows);

    // Parse full file for later import
    const text = await file.text();
    setRawText(text);
    const lines = text.split(/\r?\n/).filter((l: string) => l.trim());
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };
    setAllRows(lines.slice(1).map(parseCSVLine));

    // Auto-map obvious columns
    const autoMap: Record<string, number | undefined> = {};
    data.headers.forEach((h: string, i: number) => {
      const lower = h.toLowerCase().replace(/[^a-z]/g, "");
      if (lower.includes("first") && lower.includes("name")) autoMap.firstName = i;
      else if (lower === "firstname" || lower === "first") autoMap.firstName = i;
      else if (lower.includes("last") && lower.includes("name")) autoMap.lastName = i;
      else if (lower === "lastname" || lower === "last") autoMap.lastName = i;
      else if (lower === "name" || lower === "fullname") autoMap.firstName = i;
      else if (lower.includes("email") || lower.includes("mail")) autoMap.email = i;
      else if (lower.includes("phone") || lower.includes("mobile") || lower.includes("cell")) autoMap.phone = i;
      else if (lower.includes("company") || lower.includes("business") || lower.includes("organization")) autoMap.company = i;
      else if (lower.includes("source") || lower.includes("origin") || lower.includes("campaign")) autoMap.source = i;
    });
    setMapping(autoMap);

    setUploading(false);
    setStep("map");
  }

  async function handleImport() {
    setStep("importing");

    const res = await fetch("/api/contacts/import?action=execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: allRows, mapping, aiEnabled }),
    });
    const data = await res.json();

    if (data.error) {
      setError(data.error);
      setStep("map");
      return;
    }

    setResult(data);
    setStep("done");
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        width: 640, maxWidth: "95vw", maxHeight: "85vh",
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14,
        overflow: "hidden", display: "flex", flexDirection: "column",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: T.text, letterSpacing: 0.5 }}>
            IMPORT CONTACTS
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

          {/* Step 1: Upload */}
          {step === "upload" && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${T.border}`, borderRadius: 12, padding: "50px 20px",
                  textAlign: "center", cursor: "pointer", transition: "border-color 0.2s",
                }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.orange; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = T.border; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = T.border;
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 15, color: T.text, fontWeight: 600, marginBottom: 6 }}>
                  {uploading ? "Processing..." : "Drop your CSV file here"}
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>or click to browse</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              {error && <div style={{ color: T.red, fontSize: 13, marginTop: 12 }}>{error}</div>}
              <div style={{ fontSize: 12, color: T.muted, marginTop: 16, lineHeight: 1.6 }}>
                Upload a CSV file with your contacts. The first row should be column headers (Name, Email, Phone, etc). We'll help you map the fields.
              </div>
            </div>
          )}

          {/* Step 2: Map Fields */}
          {step === "map" && (
            <div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>
                {totalRows} contacts found. Map your CSV columns to CRM fields:
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {CRM_FIELDS.map(field => (
                  <div key={field.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 120, fontSize: 13, fontWeight: 600, color: T.text }}>{field.label}</div>
                    <div style={{ fontSize: 13, color: T.muted, width: 20, textAlign: "center" }}>←</div>
                    <select
                      value={mapping[field.key] !== undefined ? mapping[field.key] : ""}
                      onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value === "" ? undefined : parseInt(e.target.value) }))}
                      style={{
                        flex: 1, padding: "8px 12px", background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 8, color: T.text, fontSize: 13, fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      <option value="">— Skip —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                Preview (first {sampleRows.length} rows)
              </div>
              <div style={{ overflow: "auto", borderRadius: 8, border: `1px solid ${T.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} style={{ padding: "8px 10px", background: T.surface, color: T.muted, textAlign: "left", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} style={{ padding: "6px 10px", color: T.text, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Toggle */}
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div
                  onClick={() => setAiEnabled(!aiEnabled)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, cursor: "pointer",
                    background: aiEnabled ? T.green : "rgba(255,255,255,0.1)",
                    position: "relative", flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 2, left: aiEnabled ? 20 : 2, transition: "left 0.2s",
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>AI Agent Auto-Text</div>
                  <div style={{ fontSize: 11, color: T.muted }}>AI will automatically text each imported lead</div>
                </div>
              </div>

              {error && <div style={{ color: T.red, fontSize: 13, marginTop: 12 }}>{error}</div>}
            </div>
          )}

          {/* Step 3: Importing */}
          {step === "importing" && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>Importing contacts...</div>
              <div style={{ fontSize: 13, color: T.muted }}>This may take a moment for large files</div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === "done" && result && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 0.5, marginBottom: 20 }}>
                IMPORT COMPLETE
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 24 }}>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{result.imported}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Imported</div>
                </div>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{result.skipped}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>Duplicates</div>
                </div>
                {result.errors > 0 && (
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: T.red, fontFamily: "'Bebas Neue', sans-serif" }}>{result.errors}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>Errors</div>
                  </div>
                )}
              </div>
              {aiEnabled && result.imported > 0 && (
                <div style={{ fontSize: 12, color: T.green, marginBottom: 16 }}>
                  AI Agent is texting {result.imported} new leads now
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {step === "map" && (
            <>
              <button onClick={() => setStep("upload")} style={{ padding: "9px 18px", background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, fontSize: 13, cursor: "pointer" }}>Back</button>
              <button
                onClick={handleImport}
                disabled={!mapping.firstName && !mapping.lastName && !mapping.email && !mapping.phone}
                style={{ padding: "9px 22px", background: T.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (!mapping.firstName && !mapping.lastName && !mapping.email && !mapping.phone) ? 0.5 : 1 }}
              >
                Import {totalRows} Contacts
              </button>
            </>
          )}
          {step === "done" && (
            <button onClick={() => { onComplete(); onClose(); }} style={{ padding: "9px 22px", background: T.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
