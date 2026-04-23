"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload, FileText, Check, X, Building2 } from "lucide-react";

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

interface StatementRow {
  id: string;
  filename: string;
  month: string;
  statement_type?: string;
  account_name?: string;
  account_type?: string;
  institution?: string;
  opening_balance: number | string | null;
  closing_balance: number | string | null;
  total_deposits?: number | string | null;
  total_expenses?: number | string | null;
  total_income?: number | string | null;
  total_withdrawals?: number | string | null;
  total_credits?: number | string | null;
  total_debits?: number | string | null;
  transaction_count: number;
  parsed_at?: string;
  created_at?: string;
}

interface UploadRecord {
  name: string;
  status: "uploading" | "done" | "error";
  message?: string;
  meta?: {
    institution?: string;
    last_four?: string | null;
    month?: string;
    transactionsImported?: number;
    statement_type?: string;
  };
}

function fmt(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
}

export default function Statements({ variant }: { variant: "business" | "personal" }) {
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/statements?type=${variant}`);
      const data = await res.json();
      setRows(data.statements ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [variant]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (list.length === 0) return;

    // Seed rows as "uploading"
    setUploads((prev) => [
      ...prev,
      ...list.map((f) => ({ name: f.name, status: "uploading" as const })),
    ]);

    for (const file of list) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", variant);
        const res = await fetch("/api/finance/parse-statement", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name && u.status === "uploading"
              ? {
                  name: file.name,
                  status: "done",
                  meta: {
                    institution: data.institution,
                    last_four: data.last_four,
                    month: data.month,
                    transactionsImported: data.transactionsImported,
                    statement_type: data.statement_type,
                  },
                }
              : u,
          ),
        );
      } catch (e) {
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name && u.status === "uploading"
              ? { name: file.name, status: "error", message: e instanceof Error ? e.message : "Failed" }
              : u,
          ),
        );
      }
    }
    load();
  }

  const totalTransactions = rows.reduce((sum, r) => sum + (r.transaction_count || 0), 0);

  return (
    <div>
      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
        }}
        style={{
          background: dragOver ? `${T.orange}10` : T.surface,
          border: `2px dashed ${dragOver ? T.orange : T.border}`,
          borderRadius: 12,
          padding: 24,
          textAlign: "center",
          marginBottom: 20,
          transition: "all 0.15s",
        }}
      >
        <Upload style={{ width: 28, height: 28, color: T.orange, margin: "0 auto 10px" }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
          Drop PDF statements here, or click to select
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
          Capital One, SoFi, Chase, or any bank/credit card — Claude reads the format automatically.
          {variant === "personal" && " Accounts are auto-created from the statement header."}
        </div>
        <label style={{ display: "inline-block" }}>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
          <span
            style={{
              background: T.orange,
              color: "#fff",
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Select PDFs
          </span>
        </label>
      </div>

      {/* Active/recent uploads */}
      {uploads.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 8 }}>
            Recent uploads ({uploads.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {uploads.map((u, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                {u.status === "uploading" && <span style={{ color: T.yellow, fontWeight: 700 }}>…</span>}
                {u.status === "done" && <Check style={{ width: 14, height: 14, color: T.green }} />}
                {u.status === "error" && <X style={{ width: 14, height: 14, color: T.red }} />}
                <span style={{ color: T.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {u.name}
                </span>
                {u.status === "done" && u.meta && (
                  <span style={{ color: T.muted, fontSize: 11 }}>
                    {u.meta.institution} {u.meta.last_four ? `••${u.meta.last_four}` : ""} · {u.meta.month} · {u.meta.transactionsImported} txns
                  </span>
                )}
                {u.status === "error" && <span style={{ color: T.red, fontSize: 11 }}>{u.message}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statement list */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
          {variant === "business" ? "Business" : "Personal"} statements ({rows.length})
        </div>
        <div style={{ fontSize: 11, color: T.muted }}>{totalTransactions} total transactions</div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: T.muted,
            fontSize: 13,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
          }}
        >
          No statements yet. Upload your first PDF above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((s) => {
            const totalIn =
              Number(s.total_income ?? s.total_deposits ?? s.total_credits ?? 0);
            const totalOut =
              Number(s.total_expenses ?? s.total_withdrawals ?? s.total_debits ?? 0);
            return (
              <div
                key={s.id}
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
                    {variant === "personal" && s.account_name ? (
                      <>
                        <Building2 style={{ width: 12, height: 12, color: T.muted }} />
                        {s.account_name}
                      </>
                    ) : (
                      <>
                        <FileText style={{ width: 12, height: 12, color: T.muted }} />
                        {s.filename}
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {s.month}
                    {s.statement_type ? ` · ${s.statement_type}` : ""}
                    {s.institution ? ` · ${s.institution}` : ""}
                    {` · ${s.transaction_count} txns`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: T.muted }}>In</div>
                  <div style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>{fmt(totalIn)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: T.muted }}>Out</div>
                  <div style={{ fontSize: 13, color: T.red, fontWeight: 600 }}>{fmt(totalOut)}</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: T.muted }}>Close</div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{fmt(s.closing_balance)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
