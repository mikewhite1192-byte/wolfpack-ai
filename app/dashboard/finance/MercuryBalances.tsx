"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ExternalLink, Banknote } from "lucide-react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  blue: "#3B82F6",
};

interface MercuryAccount {
  id: string;
  workspace: "business" | "personal";
  name: string;
  kind: string;
  current_balance: string | number | null;
  available_balance: string | number | null;
  dashboard_link: string | null;
  status: string;
  synced_at: string;
}

interface LastRun {
  workspace: string;
  last_finished: string | null;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MercuryBalances({
  workspace,
}: {
  workspace: "business" | "personal";
}) {
  const [accounts, setAccounts] = useState<MercuryAccount[]>([]);
  const [lastRuns, setLastRuns] = useState<LastRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/mercury/accounts?workspace=${workspace}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAccounts(data.accounts ?? []);
      setLastRuns(data.lastRuns ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  async function triggerSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/finance/mercury/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, trigger: "manual" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, color: T.muted, fontSize: 13 }}>
        Loading Mercury accounts…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, color: T.muted, fontSize: 13 }}>
        Mercury: {error}. {workspace === "business" ? "Set MERCURY_BUSINESS_API_TOKEN in Vercel env." : "Set MERCURY_PERSONAL_API_TOKEN in Vercel env."}
      </div>
    );
  }

  const lastRun = lastRuns.find((r) => r.workspace === workspace)?.last_finished ?? null;
  const totalAvailable = accounts.reduce(
    (sum, a) => sum + Number(a.available_balance ?? 0),
    0,
  );
  const totalCurrent = accounts.reduce(
    (sum, a) => sum + Number(a.current_balance ?? 0),
    0,
  );

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.orange}15`, border: `1px solid ${T.orange}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Banknote style={{ width: 16, height: 16, color: T.orange }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Mercury — {workspace === "business" ? "Business" : "Personal"}</div>
            <div style={{ fontSize: 11, color: T.muted }}>Last synced {relativeTime(lastRun)} · {accounts.length} account{accounts.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <button
          onClick={triggerSync}
          disabled={syncing}
          style={{
            background: syncing ? "transparent" : T.orange,
            color: syncing ? T.muted : "#fff",
            border: `1px solid ${syncing ? T.border : T.orange}`,
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: syncing ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw style={{ width: 12, height: 12, animation: syncing ? "spin 1s linear infinite" : undefined }} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: accounts.length > 0 ? 14 : 0 }}>
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.2)" }}>
          <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Available</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{fmt(totalAvailable)}</div>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Current</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.blue, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{fmt(totalCurrent)}</div>
        </div>
      </div>

      {accounts.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {accounts.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.name}</div>
                <div style={{ fontSize: 11, color: T.muted, textTransform: "capitalize" }}>{a.kind}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
                    {fmt(Number(a.current_balance ?? 0))}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted }}>
                    {fmt(Number(a.available_balance ?? 0))} avail
                  </div>
                </div>
                {a.dashboard_link && (
                  <a
                    href={a.dashboard_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: T.muted, display: "flex", alignItems: "center" }}
                    title="Open in Mercury"
                  >
                    <ExternalLink style={{ width: 14, height: 14 }} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
