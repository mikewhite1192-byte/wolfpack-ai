"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, Check, Loader2 } from "lucide-react";

const CRM_FIELDS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "source", label: "Source" },
];

interface CsvImportModalProps { onClose: () => void; onComplete: () => void; }
interface ContactList { id: string; name: string; }

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
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");
  const [listMode, setListMode] = useState<"existing" | "new">("existing");

  useEffect(() => { fetch("/api/contact-lists").then(r => r.json()).then(data => setLists(data.lists || [])).catch(() => {}); }, []);

  async function handleFileUpload(file: File) {
    setUploading(true); setError("");
    const formData = new FormData(); formData.append("file", file);
    const res = await fetch("/api/contacts/import?action=preview", { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) { setError(data.error); setUploading(false); return; }
    setHeaders(data.headers); setSampleRows(data.sampleRows); setTotalRows(data.totalRows);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l: string) => l.trim());
    const parseCSVLine = (line: string): string[] => { const result: string[] = []; let current = ""; let inQuotes = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; } else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; } else { current += ch; } } result.push(current.trim()); return result; };
    setAllRows(lines.slice(1).map(parseCSVLine));
    const autoMap: Record<string, number | undefined> = {};
    data.headers.forEach((h: string, i: number) => { const lower = h.toLowerCase().replace(/[^a-z]/g, ""); if (lower.includes("first") && lower.includes("name")) autoMap.firstName = i; else if (lower === "firstname" || lower === "first") autoMap.firstName = i; else if (lower.includes("last") && lower.includes("name")) autoMap.lastName = i; else if (lower === "lastname" || lower === "last") autoMap.lastName = i; else if (lower === "name" || lower === "fullname") autoMap.firstName = i; else if (lower.includes("email") || lower.includes("mail")) autoMap.email = i; else if (lower.includes("phone") || lower.includes("mobile") || lower.includes("cell")) autoMap.phone = i; else if (lower.includes("company") || lower.includes("business") || lower.includes("organization")) autoMap.company = i; else if (lower.includes("source") || lower.includes("origin") || lower.includes("campaign")) autoMap.source = i; });
    setMapping(autoMap); setUploading(false); setStep("map");
  }

  async function handleImport() {
    setStep("importing");
    let listId = selectedListId || null;
    if (listMode === "new" && newListName.trim()) { const listRes = await fetch("/api/contact-lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newListName.trim() }) }); const listData = await listRes.json(); if (listData.list) listId = listData.list.id; }
    const res = await fetch("/api/contacts/import?action=execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: allRows, mapping, aiEnabled, listId }) });
    const data = await res.json();
    if (data.error) { setError(data.error); setStep("map"); return; }
    setResult(data); setStep("done");
  }

  const inputClass = "w-full px-3 py-2 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors";

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="w-[640px] max-w-[95vw] max-h-[85vh] bg-[#0a0a0a] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.07] flex justify-between items-center flex-shrink-0">
          <div className="font-display text-xl text-[#e8eaf0] tracking-wider">IMPORT CONTACTS</div>
          <button onClick={onClose} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {/* Upload */}
          {step === "upload" && (
            <div>
              <div onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#E86A2A"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file); }}
                className="border-2 border-dashed border-white/[0.07] rounded-xl p-14 text-center cursor-pointer hover:border-[#E86A2A]/40 transition-colors">
                <Upload className="w-9 h-9 text-[#E86A2A] mx-auto mb-3" />
                <div className="text-[15px] text-[#e8eaf0] font-semibold mb-1.5">{uploading ? "Processing..." : "Drop your CSV file here"}</div>
                <div className="text-xs text-[#b0b4c8]">or click to browse</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }} />
              {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
              <div className="text-xs text-[#b0b4c8] mt-4 leading-relaxed">Upload a CSV file with your contacts. The first row should be column headers. We&apos;ll help you map the fields.</div>
            </div>
          )}

          {/* Map */}
          {step === "map" && (
            <div>
              <div className="text-sm text-[#b0b4c8] mb-4">{totalRows} contacts found. Map your CSV columns to CRM fields:</div>
              <div className="flex flex-col gap-2.5 mb-5">
                {CRM_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <div className="w-[120px] text-sm font-semibold text-[#e8eaf0]">{field.label}</div>
                    <div className="text-sm text-[#b0b4c8] w-5 text-center">←</div>
                    <select value={mapping[field.key] !== undefined ? mapping[field.key] : ""} onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value === "" ? undefined : parseInt(e.target.value) }))}
                      className={`${inputClass} flex-1`}>
                      <option value="">— Skip —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-2">Preview (first {sampleRows.length} rows)</div>
              <div className="overflow-auto rounded-lg border border-white/[0.07] mb-4">
                <table className="w-full border-collapse text-xs">
                  <thead><tr>{headers.map((h, i) => <th key={i} className="px-2.5 py-2 bg-[#111] text-[#b0b4c8] text-left border-b border-white/[0.07] whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody>{sampleRows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="px-2.5 py-1.5 text-[#e8eaf0] border-b border-white/[0.07] whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis">{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>

              {/* List */}
              <div className="bg-[#111] border border-white/[0.07] rounded-lg px-3.5 py-3 mb-4">
                <div className="text-sm font-semibold text-[#e8eaf0] mb-2">Add to List</div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select value={listMode === "existing" ? selectedListId : "__new__"} onChange={e => { if (e.target.value === "__new__") setListMode("new"); else { setListMode("existing"); setSelectedListId(e.target.value); } }}
                    className={`${inputClass} flex-1`}>
                    <option value="">No list (general contacts)</option>
                    {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    <option value="__new__">+ Create new list</option>
                  </select>
                  {listMode === "new" && <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="New list name..." className={`${inputClass} flex-1`} />}
                </div>
              </div>

              {/* AI toggle */}
              <div className="bg-[#111] border border-white/[0.07] rounded-lg px-3.5 py-3 flex items-center gap-2.5">
                <div onClick={() => setAiEnabled(!aiEnabled)} className={`w-10 h-[22px] rounded-full cursor-pointer transition-colors relative flex-shrink-0 ${aiEnabled ? "bg-emerald-400" : "bg-white/10"}`}>
                  <div className={`w-[18px] h-[18px] rounded-full bg-white absolute top-0.5 transition-all ${aiEnabled ? "left-5" : "left-0.5"}`} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#e8eaf0]">AI Agent Auto-Text</div>
                  <div className="text-[11px] text-[#b0b4c8]">AI will automatically text each imported lead</div>
                </div>
              </div>
              {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
            </div>
          )}

          {/* Importing */}
          {step === "importing" && (
            <div className="text-center py-16">
              <Loader2 className="w-10 h-10 text-[#E86A2A] mx-auto mb-4 animate-spin" />
              <div className="text-base font-bold text-[#e8eaf0] mb-1.5">Importing contacts...</div>
              <div className="text-sm text-[#b0b4c8]">This may take a moment for large files</div>
            </div>
          )}

          {/* Done */}
          {step === "done" && result && (
            <div className="text-center py-10">
              <Check className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <div className="text-lg font-bold text-[#e8eaf0] font-display tracking-wider mb-5">IMPORT COMPLETE</div>
              <div className="flex gap-4 justify-center mb-6">
                {[
                  { value: result.imported, label: "Imported", color: "#2ecc71" },
                  { value: result.skipped, label: "Duplicates", color: "#E86A2A" },
                  ...(result.errors > 0 ? [{ value: result.errors, label: "Errors", color: "#e74c3c" }] : []),
                ].map(s => (
                  <div key={s.label} className="bg-[#111] border border-white/[0.07] rounded-xl px-6 py-3.5 text-center">
                    <div className="text-2xl font-bold font-display" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[11px] text-[#b0b4c8]">{s.label}</div>
                  </div>
                ))}
              </div>
              {aiEnabled && result.imported > 0 && <div className="text-xs text-emerald-400 mb-4">AI Agent is texting {result.imported} new leads now</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.07] flex justify-end gap-2.5 flex-shrink-0">
          {step === "map" && (<>
            <button onClick={() => setStep("upload")} className="px-5 py-2.5 bg-transparent border border-white/[0.07] rounded-lg text-sm text-[#b0b4c8] cursor-pointer hover:bg-white/[0.04] transition-colors">Back</button>
            <button onClick={handleImport} disabled={!mapping.firstName && !mapping.lastName && !mapping.email && !mapping.phone}
              className={`px-6 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer transition-colors ${!mapping.firstName && !mapping.lastName && !mapping.email && !mapping.phone ? "opacity-50 cursor-not-allowed" : "hover:bg-[#ff7b3a]"}`}>
              Import {totalRows} Contacts
            </button>
          </>)}
          {step === "done" && (
            <button onClick={() => { onComplete(); onClose(); }} className="px-6 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer hover:bg-[#ff7b3a] transition-colors">Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
