"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Download, MailCheck, RotateCcw, CheckCircle2, XCircle } from "lucide-react";

interface CleanedEmail { email: string; valid: boolean; reason: string; }
interface CleanResult { total: number; valid: number; invalid: number; results: CleanedEmail[]; }

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Split a CSV line, respecting quoted fields (mirrors the contacts importer).
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (ch === "," && !inQ) { out.push(cur); cur = ""; } else { cur += ch; }
  }
  out.push(cur);
  return out;
}

function toCsv(rows: string[][]): string {
  return rows
    .map(r => r.map(c => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\r\n");
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EmailCleanerPage() {
  const [fileName, setFileName] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<CleanResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(""); setResult(null); setFound([]); setFileName(file.name);
    try {
      const text = await file.text();
      const emails = new Set<string>();
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        for (const cell of parseCSVLine(line)) {
          const matches = cell.match(EMAIL_RE);
          if (matches) for (const m of matches) emails.add(m.trim().toLowerCase());
        }
      }
      if (emails.size === 0) { setError("No email addresses found in that file."); return; }
      setFound([...emails]);
    } catch {
      setError("Could not read that file. Make sure it's a .csv or plain text file.");
    }
  }

  async function runClean() {
    setCleaning(true); setError("");
    try {
      const res = await fetch("/api/outreach/clean-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: found }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong cleaning the list."); setCleaning(false); return; }
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    }
    setCleaning(false);
  }

  function reset() {
    setFileName(""); setFound([]); setResult(null); setError(""); setCleaning(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadClean() {
    if (!result) return;
    const rows: string[][] = [["email"], ...result.results.filter(r => r.valid).map(r => [r.email])];
    download("cleaned-emails.csv", toCsv(rows));
  }

  function downloadReport() {
    if (!result) return;
    const rows: string[][] = [
      ["email", "status", "reason"],
      ...result.results.map(r => [r.email, r.valid ? "keep" : "remove", r.reason]),
    ];
    download("email-clean-report.csv", toCsv(rows));
  }

  // Group the removed ones by reason for a quick breakdown.
  const removedByReason = result
    ? Object.entries(
        result.results.filter(r => !r.valid).reduce<Record<string, number>>((acc, r) => {
          const key = r.reason.replace(/\s*\([^)]*\)/, ""); // collapse "(domain.com)"
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])
    : [];

  const card = "bg-[#111] border border-white/[0.07] rounded-xl px-5 py-4 text-center";

  return (
    <div className="max-w-[860px] mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-1.5">
        <MailCheck className="w-6 h-6 text-[#E86A2A]" />
        <h1 className="font-display text-2xl tracking-wider text-[#e8eaf0]">EMAIL CLEANER</h1>
      </div>
      <p className="text-sm text-[#b0b4c8] mb-6">
        Upload a CSV of emails to strip out the junk before you send. Removes malformed addresses,
        known-dead consumer domains, and any domain with no mail server — the bounces that wreck deliverability.
      </p>

      {/* Step 1: upload */}
      {!result && (
        <>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#E86A2A"; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="border-2 border-dashed border-white/[0.07] rounded-xl p-14 text-center cursor-pointer hover:border-[#E86A2A]/40 transition-colors"
          >
            <Upload className="w-9 h-9 text-[#E86A2A] mx-auto mb-3" />
            <div className="text-[15px] text-[#e8eaf0] font-semibold mb-1.5">
              {fileName ? fileName : "Drop your CSV here"}
            </div>
            <div className="text-xs text-[#b0b4c8]">or click to browse — any CSV; we&apos;ll find the email column automatically</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {found.length > 0 && (
            <div className="mt-5 flex items-center justify-between gap-4 bg-[#111] border border-white/[0.07] rounded-xl px-5 py-4">
              <div className="text-sm text-[#e8eaf0]">
                <span className="font-bold text-[#E86A2A]">{found.length.toLocaleString()}</span> unique emails found
              </div>
              <div className="flex gap-2.5">
                <button onClick={reset} className="px-4 py-2.5 bg-transparent border border-white/[0.07] rounded-lg text-sm text-[#b0b4c8] cursor-pointer hover:bg-white/[0.04] transition-colors">Clear</button>
                <button onClick={runClean} disabled={cleaning}
                  className={`px-6 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer transition-colors flex items-center gap-2 ${cleaning ? "opacity-60 cursor-not-allowed" : "hover:bg-[#ff7b3a]"}`}>
                  {cleaning ? <><Loader2 className="w-4 h-4 animate-spin" /> Cleaning…</> : <>Clean {found.length.toLocaleString()} emails</>}
                </button>
              </div>
            </div>
          )}
          {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
        </>
      )}

      {/* Step 2: results */}
      {result && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className={card}>
              <div className="text-2xl font-bold font-display text-[#e8eaf0]">{result.total.toLocaleString()}</div>
              <div className="text-[11px] text-[#b0b4c8] mt-0.5">Checked</div>
            </div>
            <div className={card}>
              <div className="text-2xl font-bold font-display text-emerald-400 flex items-center justify-center gap-1.5"><CheckCircle2 className="w-5 h-5" />{result.valid.toLocaleString()}</div>
              <div className="text-[11px] text-[#b0b4c8] mt-0.5">Keep (clean)</div>
            </div>
            <div className={card}>
              <div className="text-2xl font-bold font-display text-red-400 flex items-center justify-center gap-1.5"><XCircle className="w-5 h-5" />{result.invalid.toLocaleString()}</div>
              <div className="text-[11px] text-[#b0b4c8] mt-0.5">Removed</div>
            </div>
          </div>

          <div className="flex gap-2.5 mb-6">
            <button onClick={downloadClean}
              className="px-5 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer hover:bg-[#ff7b3a] transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" /> Download clean list ({result.valid.toLocaleString()})
            </button>
            <button onClick={downloadReport}
              className="px-5 py-2.5 bg-transparent border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] cursor-pointer hover:bg-white/[0.04] transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" /> Full report
            </button>
            <button onClick={reset}
              className="px-5 py-2.5 bg-transparent border border-white/[0.07] rounded-lg text-sm text-[#b0b4c8] cursor-pointer hover:bg-white/[0.04] transition-colors flex items-center gap-2 ml-auto">
              <RotateCcw className="w-4 h-4" /> Clean another
            </button>
          </div>

          {removedByReason.length > 0 && (
            <div className="bg-[#111] border border-white/[0.07] rounded-xl px-5 py-4">
              <div className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-3">Why {result.invalid.toLocaleString()} were removed</div>
              <div className="flex flex-col gap-2">
                {removedByReason.map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between text-sm">
                    <span className="text-[#e8eaf0]">{reason}</span>
                    <span className="text-[#b0b4c8] tabular-nums">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-[#b0b4c8] mt-4 leading-relaxed">
            Note: this checks format, dead/disposable domains, and whether the domain accepts mail (MX).
            It does not open each mailbox (that needs port 25, which this host blocks), so a rare invalid
            address on a live domain can still slip through. Keep your send volume low and watch bounces.
          </p>
          {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
        </div>
      )}
    </div>
  );
}
