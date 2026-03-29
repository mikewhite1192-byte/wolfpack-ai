"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  blue: "#007AFF",
  yellow: "#f5a623",
  bg: "#0a0a0a",
};

interface Stats {
  total: string;
  active: string;
  completed: string;
  replied: string;
  bounced: string;
  unsubscribed: string;
  converted: string;
}

interface RecentEmail {
  email: string;
  first_name: string | null;
  step: number;
  status: string;
  sent_at: string;
}

const ADMIN_EMAILS = ["info@thewolfpackco.com"];

export default function OutreachPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeState, setScrapeState] = useState("");
  const [scrapeCount, setScrapeCount] = useState(30);

  // Admin check
  useEffect(() => {
    if (isLoaded && user) {
      const email = user.primaryEmailAddress?.emailAddress || "";
      if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
        router.push("/dashboard");
      }
    }
  }, [isLoaded, user, router]);

  // Load stats
  useEffect(() => {
    fetch("/api/outreach/stats")
      .then(r => r.json())
      .then(data => {
        setStats(data.stats);
        setRecentEmails(data.recentEmails || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function runSend() {
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/outreach/send", { method: "POST" });
    const data = await res.json();
    setSendResult(`Sent: ${data.sent}, Failed: ${data.failed || 0}, Today total: ${data.todayTotal}/${data.dailyLimit}`);
    setSending(false);
    // Refresh stats
    const statsRes = await fetch("/api/outreach/stats");
    const statsData = await statsRes.json();
    setStats(statsData.stats);
    setRecentEmails(statsData.recentEmails || []);
  }

  async function runScrape() {
    setScraping(true);
    setScrapeState("Scraping...");
    const res = await fetch("/api/outreach/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: scrapeCount }),
    });
    const data = await res.json();
    setScrapeState(`Found: ${data.found || 0}, Valid: ${data.valid || 0}, Added: ${data.added || 0}`);
    setScraping(false);
    // Refresh stats
    const statsRes = await fetch("/api/outreach/stats");
    const statsData = await statsRes.json();
    setStats(statsData.stats);
  }

  const email = user?.primaryEmailAddress?.emailAddress || "";
  if (isLoaded && !ADMIN_EMAILS.includes(email.toLowerCase())) return null;

  return (
    <div>
      <style>{`
        .out-label { font-size: 11px; font-weight: 700; color: ${T.orange}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
        .out-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .out-stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 16px 14px; }
        .out-stat-val { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 0.5px; line-height: 1; margin-bottom: 4px; }
        .out-stat-label { font-size: 11px; font-weight: 600; color: ${T.muted}; }
        .out-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 18px; margin-bottom: 14px; }
        .out-btn { padding: 10px 20px; background: ${T.orange}; color: #fff; font-size: 13px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; }
        .out-btn:hover { opacity: 0.9; }
        .out-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .out-btn-ghost { padding: 10px 20px; background: none; border: 1px solid ${T.border}; color: ${T.text}; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; }
        .out-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .out-table { width: 100%; border-collapse: collapse; }
        .out-table th { text-align: left; font-size: 11px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; padding: 8px 0; border-bottom: 1px solid ${T.border}; }
        .out-table td { font-size: 13px; color: ${T.text}; padding: 10px 0; border-bottom: 1px solid ${T.border}; }
        .out-table td.muted { color: ${T.muted}; }
        .out-input { padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 6px; color: ${T.text}; font-size: 13px; outline: none; width: 80px; }
        @media (max-width: 900px) { .out-stats { grid-template-columns: repeat(2, 1fr); } .out-row { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: T.text, letterSpacing: 1 }}>OUTREACH ENGINE</div>
        <div style={{ fontSize: 11, color: T.muted, background: "rgba(232,106,42,0.1)", padding: "4px 12px", borderRadius: 12, border: "1px solid rgba(232,106,42,0.2)" }}>Admin Only</div>
      </div>

      {loading ? (
        <div style={{ color: T.muted, textAlign: "center", padding: 60 }}>Loading...</div>
      ) : (
        <>
          {/* Stats */}
          <div className="out-stats">
            {stats && [
              { label: "Total Contacts", value: stats.total, color: T.text },
              { label: "Active in Sequence", value: stats.active, color: T.orange },
              { label: "Completed", value: stats.completed, color: T.muted },
              { label: "Replied", value: stats.replied, color: T.green },
              { label: "Bounced", value: stats.bounced, color: T.red },
              { label: "Unsubscribed", value: stats.unsubscribed, color: T.yellow },
              { label: "Converted", value: stats.converted, color: T.green },
              { label: "Reply Rate", value: parseInt(stats.total) > 0 ? `${Math.round((parseInt(stats.replied) / parseInt(stats.total)) * 100)}%` : "0%", color: T.blue },
            ].map(s => (
              <div key={s.label} className="out-stat">
                <div className="out-stat-val" style={{ color: s.color }}>{s.value}</div>
                <div className="out-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="out-row">
            {/* Controls */}
            <div className="out-card">
              <div className="out-label">Controls</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>Scrape New Contacts</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      className="out-input"
                      type="number"
                      value={scrapeCount}
                      onChange={e => setScrapeCount(parseInt(e.target.value) || 30)}
                      min={1}
                      max={500}
                    />
                    <button className="out-btn" onClick={runScrape} disabled={scraping}>
                      {scraping ? "Scraping..." : "Scrape NIPR"}
                    </button>
                  </div>
                  {scrapeState && <div style={{ fontSize: 12, color: T.green, marginTop: 6 }}>{scrapeState}</div>}
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>Send Sequence Emails</div>
                  <button className="out-btn" onClick={runSend} disabled={sending}>
                    {sending ? "Sending..." : "Run Send Now"}
                  </button>
                  {sendResult && <div style={{ fontSize: 12, color: T.green, marginTop: 6 }}>{sendResult}</div>}
                </div>
              </div>
            </div>

            {/* Recent Sends */}
            <div className="out-card">
              <div className="out-label">Recent Sends</div>
              {recentEmails.length === 0 ? (
                <div style={{ color: T.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No emails sent yet</div>
              ) : (
                <table className="out-table">
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Step</th>
                      <th>Status</th>
                      <th>Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEmails.map((e, i) => (
                      <tr key={i}>
                        <td>{e.first_name || e.email.split("@")[0]}</td>
                        <td className="muted">Email #{e.step}</td>
                        <td style={{ color: e.status === "sent" ? T.green : T.red }}>{e.status}</td>
                        <td className="muted">{new Date(e.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
