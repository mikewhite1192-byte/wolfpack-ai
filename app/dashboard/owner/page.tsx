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
  purple: "#9b59b6",
};

const ADMIN_EMAILS = ["info@thewolfpackco.com", "hello@buenaonda.ai"];

interface DashboardData {
  mrr: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowth: number;
  totalSubscribers: number;
  starterCount: number;
  proCount: number;
  agencyCount: number;
  churnedThisMonth: number;
  churnRate: number;
  totalWorkspaces: number;
  totalContacts: number;
  totalConversations: number;
  activeConversations: number;
  totalAiMessages: number;
  totalBookings: number;
  bookingsThisMonth: number;
  dealsWon: number;
  dealValueWon: number;
  recentSignups: number;
  outreachTotal: number;
  outreachReplied: number;
  outreachBounced: number;
  outreachConverted: number;
  totalAffiliates: number;
  affiliateEarned: number;
  affiliatePaid: number;
  activeReferrals: number;
}

function formatMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export default function OwnerDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && user) {
      const email = user.primaryEmailAddress?.emailAddress || "";
      if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
        router.push("/dashboard");
      }
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    fetch("/api/owner")
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const email = user?.primaryEmailAddress?.emailAddress || "";
  if (isLoaded && !ADMIN_EMAILS.includes(email.toLowerCase())) return null;

  return (
    <div>
      <style>{`
        .ow-grid { display: grid; gap: 10px; margin-bottom: 20px; }
        .ow-grid-4 { grid-template-columns: repeat(4, 1fr); }
        .ow-grid-3 { grid-template-columns: repeat(3, 1fr); }
        .ow-grid-2 { grid-template-columns: repeat(2, 1fr); }
        .ow-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 18px; }
        .ow-stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 16px 14px; }
        .ow-stat-val { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 0.5px; line-height: 1; margin-bottom: 4px; }
        .ow-stat-label { font-size: 11px; font-weight: 600; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.5px; }
        .ow-section { font-size: 11px; font-weight: 700; color: ${T.orange}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; margin-top: 24px; }
        .ow-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden; margin-top: 8px; }
        .ow-bar-fill { height: 100%; border-radius: 4px; }
        .ow-sub-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid ${T.border}; }
        .ow-sub-row:last-child { border-bottom: none; }
        .ow-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        @media (max-width: 900px) { .ow-grid-4 { grid-template-columns: repeat(2, 1fr); } .ow-grid-3 { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: T.text, letterSpacing: 1.5 }}>BUSINESS OVERVIEW</div>
        <div style={{ fontSize: 11, color: T.muted, background: "rgba(232,106,42,0.1)", padding: "4px 12px", borderRadius: 12, border: "1px solid rgba(232,106,42,0.2)" }}>Owner Only</div>
      </div>

      {loading ? (
        <div style={{ color: T.muted, textAlign: "center", padding: 80 }}>Loading business data...</div>
      ) : error ? (
        <div style={{ color: T.red, textAlign: "center", padding: 80 }}>{error}</div>
      ) : data ? (
        <>
          {/* ── REVENUE ── */}
          <div className="ow-section">Revenue</div>
          <div className="ow-grid ow-grid-4">
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.green }}>{formatMoney(data.mrr)}</div>
              <div className="ow-stat-label">Monthly Recurring Revenue</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.text }}>{formatMoney(data.revenueThisMonth)}</div>
              <div className="ow-stat-label">Revenue This Month</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.muted }}>{formatMoney(data.revenueLastMonth)}</div>
              <div className="ow-stat-label">Revenue Last Month</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: data.revenueGrowth >= 0 ? T.green : T.red }}>
                {data.revenueGrowth >= 0 ? "+" : ""}{data.revenueGrowth.toFixed(1)}%
              </div>
              <div className="ow-stat-label">Month-over-Month Growth</div>
            </div>
          </div>

          {/* ── SUBSCRIBERS ── */}
          <div className="ow-section">Subscribers</div>
          <div className="ow-grid ow-grid-4">
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.orange }}>{data.totalSubscribers}</div>
              <div className="ow-stat-label">Total Active</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.green }}>{data.recentSignups}</div>
              <div className="ow-stat-label">New (Last 30 Days)</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.red }}>{data.churnedThisMonth}</div>
              <div className="ow-stat-label">Churned This Month</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: data.churnRate > 5 ? T.red : data.churnRate > 3 ? T.yellow : T.green }}>
                {data.churnRate.toFixed(1)}%
              </div>
              <div className="ow-stat-label">Churn Rate</div>
            </div>
          </div>

          {/* Plan breakdown */}
          <div className="ow-grid ow-grid-2">
            <div className="ow-card">
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Plan Breakdown</div>
              <div className="ow-sub-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="ow-badge" style={{ background: "rgba(52,152,219,0.15)", color: "#3498db" }}>Starter</span>
                  <span style={{ fontSize: 13, color: T.text }}>{data.starterCount} subscribers</span>
                </div>
                <span style={{ fontSize: 13, color: T.muted }}>{data.totalSubscribers > 0 ? Math.round((data.starterCount / data.totalSubscribers) * 100) : 0}%</span>
              </div>
              <div className="ow-sub-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="ow-badge" style={{ background: "rgba(232,106,42,0.15)", color: T.orange }}>Pro</span>
                  <span style={{ fontSize: 13, color: T.text }}>{data.proCount} subscribers</span>
                </div>
                <span style={{ fontSize: 13, color: T.muted }}>{data.totalSubscribers > 0 ? Math.round((data.proCount / data.totalSubscribers) * 100) : 0}%</span>
              </div>
              <div className="ow-sub-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="ow-badge" style={{ background: "rgba(155,89,182,0.15)", color: T.purple }}>Agency</span>
                  <span style={{ fontSize: 13, color: T.text }}>{data.agencyCount} subscribers</span>
                </div>
                <span style={{ fontSize: 13, color: T.muted }}>{data.totalSubscribers > 0 ? Math.round((data.agencyCount / data.totalSubscribers) * 100) : 0}%</span>
              </div>

              {/* Visual bar */}
              <div className="ow-bar" style={{ marginTop: 14 }}>
                <div style={{ display: "flex", height: "100%" }}>
                  {data.starterCount > 0 && <div className="ow-bar-fill" style={{ width: `${(data.starterCount / Math.max(data.totalSubscribers, 1)) * 100}%`, background: "#3498db" }} />}
                  {data.proCount > 0 && <div className="ow-bar-fill" style={{ width: `${(data.proCount / Math.max(data.totalSubscribers, 1)) * 100}%`, background: T.orange }} />}
                  {data.agencyCount > 0 && <div className="ow-bar-fill" style={{ width: `${(data.agencyCount / Math.max(data.totalSubscribers, 1)) * 100}%`, background: T.purple }} />}
                </div>
              </div>
            </div>

            {/* Deals & Revenue */}
            <div className="ow-card">
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Pipeline</div>
              <div className="ow-sub-row">
                <span style={{ fontSize: 13, color: T.muted }}>Deals Won</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.green }}>{data.dealsWon}</span>
              </div>
              <div className="ow-sub-row">
                <span style={{ fontSize: 13, color: T.muted }}>Deal Value Won</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.green }}>{formatMoney(data.dealValueWon)}</span>
              </div>
            </div>
          </div>

          {/* ── PLATFORM USAGE ── */}
          <div className="ow-section">Platform Usage</div>
          <div className="ow-grid ow-grid-4">
            {[
              { label: "Workspaces", value: data.totalWorkspaces, color: T.text },
              { label: "Total Contacts", value: formatNum(data.totalContacts), color: T.text },
              { label: "Conversations", value: formatNum(data.totalConversations), color: T.text },
              { label: "Active Convos (7d)", value: data.activeConversations, color: T.orange },
              { label: "AI Messages Sent", value: formatNum(data.totalAiMessages), color: T.blue },
              { label: "Bookings (Total)", value: data.totalBookings, color: T.green },
              { label: "Bookings (Month)", value: data.bookingsThisMonth, color: T.green },
            ].map(s => (
              <div key={s.label} className="ow-stat">
                <div className="ow-stat-val" style={{ color: s.color }}>{s.value}</div>
                <div className="ow-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── OUTREACH ── */}
          <div className="ow-section">Cold Outreach</div>
          <div className="ow-grid ow-grid-4">
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.text }}>{formatNum(data.outreachTotal)}</div>
              <div className="ow-stat-label">Total Contacts</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.green }}>{data.outreachReplied}</div>
              <div className="ow-stat-label">Replied</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.red }}>{data.outreachBounced}</div>
              <div className="ow-stat-label">Bounced</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.green }}>{data.outreachConverted}</div>
              <div className="ow-stat-label">Converted</div>
            </div>
          </div>

          {/* ── AFFILIATES ── */}
          <div className="ow-section">Affiliates</div>
          <div className="ow-grid ow-grid-4">
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.text }}>{data.totalAffiliates}</div>
              <div className="ow-stat-label">Active Affiliates</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.text }}>{data.activeReferrals}</div>
              <div className="ow-stat-label">Active Referrals</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.green }}>{formatMoney(data.affiliateEarned)}</div>
              <div className="ow-stat-label">Total Earned</div>
            </div>
            <div className="ow-stat">
              <div className="ow-stat-val" style={{ color: T.orange }}>{formatMoney(data.affiliatePaid)}</div>
              <div className="ow-stat-label">Total Paid Out</div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
