"use client";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  surfaceAlt: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  blue: "#3498db",
  purple: "#9b59b6",
  yellow: "#f39c12",
};

const ADMIN_EMAILS = ["info@thewolfpackco.com"];

interface BusinessData {
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

interface FunnelStage {
  name: string;
  color: string;
  count: number;
  totalValue: number;
  conversionRate: number | null;
}

interface StageBreakdown {
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
  count: number;
  totalValue: number;
}

interface LeadSource {
  source: string;
  count: number;
  wonCount: number;
  totalValue: number;
}

interface AnalyticsData {
  funnel: FunnelStage[];
  stageBreakdown: StageBreakdown[];
  wonThisMonth: { count: number; totalValue: number };
  lostThisMonth: { count: number; totalValue: number };
  avgDealSize: number;
  avgTimeInStage: Record<string, number>;
  leadSources: LeadSource[];
}

export default function AnalyticsPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<"pipeline" | "business">("pipeline");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [bizData, setBizData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bizLoading, setBizLoading] = useState(false);

  const isAdmin = ADMIN_EMAILS.includes(user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/pipeline");
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("[analytics] fetch error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (tab === "business" && !bizData && isAdmin) {
      setBizLoading(true);
      fetch("/api/owner").then(r => r.json()).then(d => { setBizData(d); setBizLoading(false); }).catch(() => setBizLoading(false));
    }
  }, [tab, bizData, isAdmin]);

  if (loading) return <div style={{ color: T.muted, padding: 40, textAlign: "center" }}>Loading analytics...</div>;
  if (!data) return <div style={{ color: T.red, padding: 40, textAlign: "center" }}>Failed to load analytics.</div>;

  const totalDeals = data.stageBreakdown.reduce((sum, s) => sum + s.count, 0);
  const totalValue = data.stageBreakdown.reduce((sum, s) => sum + s.totalValue, 0);
  const maxFunnelCount = Math.max(...data.funnel.map(f => f.count), 1);

  return (
    <div>
      <style>{`
        .an-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1px; margin-bottom: 24px; }
        .an-tabs { display: flex; gap: 4px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 4px; margin-bottom: 24px; width: fit-content; }
        .an-tab { padding: 8px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s; }
        .an-tab-active { background: ${T.orange}; color: #fff; }
        .an-tab-inactive { background: transparent; color: ${T.muted}; }
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
        .an-grid { display: grid; gap: 16px; margin-bottom: 16px; }
        .an-grid-4 { grid-template-columns: repeat(4, 1fr); }
        .an-grid-2 { grid-template-columns: 1fr 1fr; }
        .an-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 20px; }
        .an-card-sm { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 16px; text-align: center; }
        .an-section { font-size: 11px; font-weight: 700; color: ${T.orange}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px; }
        .an-stat-value { font-size: 28px; font-weight: 800; color: ${T.text}; font-family: 'Inter', sans-serif; }
        .an-stat-label { font-size: 11px; color: ${T.muted}; margin-top: 4px; font-weight: 600; }
        .an-funnel-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .an-funnel-label { width: 120px; font-size: 13px; color: ${T.text}; font-weight: 500; flex-shrink: 0; }
        .an-funnel-bar-wrap { flex: 1; height: 32px; background: rgba(255,255,255,0.03); border-radius: 6px; overflow: hidden; position: relative; }
        .an-funnel-bar { height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; transition: width 0.5s ease; min-width: 40px; }
        .an-funnel-count { font-size: 12px; font-weight: 700; color: #fff; }
        .an-funnel-arrow { font-size: 11px; color: ${T.muted}; text-align: center; padding: 2px 0; }
        .an-funnel-conv { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
        .an-table { width: 100%; border-collapse: collapse; }
        .an-table th { text-align: left; font-size: 11px; color: ${T.muted}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 12px; border-bottom: 1px solid ${T.border}; }
        .an-table td { padding: 10px 12px; font-size: 13px; color: ${T.text}; border-bottom: 1px solid ${T.border}; }
        .an-table tr:last-child td { border-bottom: none; }
        .an-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; flex-shrink: 0; }
        .an-source-bar { height: 6px; border-radius: 3px; background: ${T.orange}; transition: width 0.5s ease; }
        @media (max-width: 900px) {
          .an-grid-4 { grid-template-columns: repeat(2, 1fr); }
          .an-grid-2 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="an-title">ANALYTICS</div>

      <div className="an-tabs">
        <button className={`an-tab ${tab === "pipeline" ? "an-tab-active" : "an-tab-inactive"}`} onClick={() => setTab("pipeline")}>Pipeline</button>
        {isAdmin && <button className={`an-tab ${tab === "business" ? "an-tab-active" : "an-tab-inactive"}`} onClick={() => setTab("business")}>Business</button>}
      </div>

      {tab === "pipeline" && (<>
      {/* KPI Cards */}
      <div className="an-grid an-grid-4">
        <div className="an-card-sm">
          <div className="an-stat-value">{totalDeals}</div>
          <div className="an-stat-label">Total Deals</div>
        </div>
        <div className="an-card-sm">
          <div className="an-stat-value" style={{ color: T.green }}>${totalValue.toLocaleString()}</div>
          <div className="an-stat-label">Total Pipeline Value</div>
        </div>
        <div className="an-card-sm">
          <div className="an-stat-value" style={{ color: T.orange }}>${Math.round(data.avgDealSize).toLocaleString()}</div>
          <div className="an-stat-label">Avg Deal Size</div>
        </div>
        <div className="an-card-sm">
          <div className="an-stat-value" style={{ color: T.green }}>
            {data.wonThisMonth.count}
            <span style={{ fontSize: 14, color: T.muted, fontWeight: 400 }}> / </span>
            <span style={{ fontSize: 20, color: T.red }}>{data.lostThisMonth.count}</span>
          </div>
          <div className="an-stat-label">Won / Lost This Month</div>
        </div>
      </div>

      {/* Won/Lost detail */}
      <div className="an-grid an-grid-2" style={{ marginBottom: 16 }}>
        <div className="an-card" style={{ borderLeft: `3px solid ${T.green}` }}>
          <div className="an-section">Won This Month</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="an-stat-value" style={{ color: T.green }}>{data.wonThisMonth.count} deals</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.green }}>${data.wonThisMonth.totalValue.toLocaleString()}</div>
          </div>
        </div>
        <div className="an-card" style={{ borderLeft: `3px solid ${T.red}` }}>
          <div className="an-section">Lost This Month</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="an-stat-value" style={{ color: T.red }}>{data.lostThisMonth.count} deals</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.red }}>${data.lostThisMonth.totalValue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div className="an-card" style={{ marginBottom: 16 }}>
        <div className="an-section">Pipeline Funnel</div>
        {data.funnel.map((stage, i) => (
          <div key={stage.name}>
            <div className="an-funnel-row">
              <div className="an-funnel-label">{stage.name}</div>
              <div className="an-funnel-bar-wrap">
                <div
                  className="an-funnel-bar"
                  style={{
                    width: `${Math.max((stage.count / maxFunnelCount) * 100, 8)}%`,
                    background: stage.color,
                  }}
                >
                  <span className="an-funnel-count">{stage.count}</span>
                </div>
              </div>
              <div style={{ width: 80, textAlign: "right", fontSize: 12, color: T.muted }}>
                ${stage.totalValue.toLocaleString()}
              </div>
            </div>
            {stage.conversionRate !== null && i < data.funnel.length - 1 && (
              <div className="an-funnel-arrow">
                <span className="an-funnel-conv" style={{
                  background: stage.conversionRate >= 50 ? `${T.green}20` : stage.conversionRate >= 25 ? `${T.yellow}20` : `${T.red}20`,
                  color: stage.conversionRate >= 50 ? T.green : stage.conversionRate >= 25 ? T.yellow : T.red,
                }}>
                  {stage.conversionRate}% conversion
                </span>
              </div>
            )}
          </div>
        ))}
        {data.funnel.length === 0 && (
          <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: 20 }}>No active pipeline stages with deals yet.</div>
        )}
      </div>

      <div className="an-grid an-grid-2">
        {/* Stage Breakdown Table */}
        <div className="an-card">
          <div className="an-section">Stage Breakdown</div>
          <table className="an-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th style={{ textAlign: "right" }}>Deals</th>
                <th style={{ textAlign: "right" }}>Value</th>
                <th style={{ textAlign: "right" }}>Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {data.stageBreakdown.map(stage => (
                <tr key={stage.name}>
                  <td>
                    <span className="an-dot" style={{ background: stage.color }} />
                    {stage.name}
                  </td>
                  <td style={{ textAlign: "right" }}>{stage.count}</td>
                  <td style={{ textAlign: "right" }}>${stage.totalValue.toLocaleString()}</td>
                  <td style={{ textAlign: "right", color: T.muted }}>
                    {data.avgTimeInStage[stage.name] !== undefined
                      ? `${data.avgTimeInStage[stage.name]}d`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Lead Source Breakdown */}
        <div className="an-card">
          <div className="an-section">Lead Sources</div>
          {data.leadSources.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: 20 }}>No lead source data yet.</div>
          ) : (
            <table className="an-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th style={{ textAlign: "right" }}>Leads</th>
                  <th style={{ textAlign: "right" }}>Won</th>
                  <th style={{ textAlign: "right" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {data.leadSources.map(src => {
                  const maxCount = Math.max(...data.leadSources.map(s => s.count), 1);
                  return (
                    <tr key={src.source}>
                      <td>
                        <div>{src.source}</div>
                        <div style={{ marginTop: 4 }}>
                          <div className="an-source-bar" style={{ width: `${(src.count / maxCount) * 100}%` }} />
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>{src.count}</td>
                      <td style={{ textAlign: "right", color: T.green }}>{src.wonCount}</td>
                      <td style={{ textAlign: "right" }}>${src.totalValue.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </>)}

      {tab === "business" && isAdmin && (
        bizLoading ? (
          <div style={{ color: T.muted, textAlign: "center", padding: 80 }}>Loading business data...</div>
        ) : bizData ? (
          <>
            <div className="ow-section">Revenue</div>
            <div className="ow-grid ow-grid-4">
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.green }}>{formatMoney(bizData.mrr)}</div><div className="ow-stat-label">Monthly Recurring Revenue</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.text }}>{formatMoney(bizData.revenueThisMonth)}</div><div className="ow-stat-label">Revenue This Month</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.muted }}>{formatMoney(bizData.revenueLastMonth)}</div><div className="ow-stat-label">Revenue Last Month</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: bizData.revenueGrowth >= 0 ? T.green : T.red }}>{bizData.revenueGrowth >= 0 ? "+" : ""}{bizData.revenueGrowth.toFixed(1)}%</div><div className="ow-stat-label">MoM Growth</div></div>
            </div>

            <div className="ow-section">Subscribers</div>
            <div className="ow-grid ow-grid-4">
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.orange }}>{bizData.totalSubscribers}</div><div className="ow-stat-label">Total Active</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.green }}>{bizData.recentSignups}</div><div className="ow-stat-label">New (30 Days)</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.red }}>{bizData.churnedThisMonth}</div><div className="ow-stat-label">Churned</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: bizData.churnRate > 5 ? T.red : bizData.churnRate > 3 ? T.yellow : T.green }}>{bizData.churnRate.toFixed(1)}%</div><div className="ow-stat-label">Churn Rate</div></div>
            </div>

            <div className="ow-grid ow-grid-2">
              <div className="ow-card">
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Plan Breakdown</div>
                <div className="ow-sub-row"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="ow-badge" style={{ background: "rgba(52,152,219,0.15)", color: "#3498db" }}>Starter</span><span style={{ fontSize: 13, color: T.text }}>{bizData.starterCount}</span></div><span style={{ fontSize: 13, color: T.muted }}>{bizData.totalSubscribers > 0 ? Math.round((bizData.starterCount / bizData.totalSubscribers) * 100) : 0}%</span></div>
                <div className="ow-sub-row"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="ow-badge" style={{ background: "rgba(232,106,42,0.15)", color: T.orange }}>Pro</span><span style={{ fontSize: 13, color: T.text }}>{bizData.proCount}</span></div><span style={{ fontSize: 13, color: T.muted }}>{bizData.totalSubscribers > 0 ? Math.round((bizData.proCount / bizData.totalSubscribers) * 100) : 0}%</span></div>
                <div className="ow-sub-row"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="ow-badge" style={{ background: "rgba(155,89,182,0.15)", color: T.purple }}>Agency</span><span style={{ fontSize: 13, color: T.text }}>{bizData.agencyCount}</span></div><span style={{ fontSize: 13, color: T.muted }}>{bizData.totalSubscribers > 0 ? Math.round((bizData.agencyCount / bizData.totalSubscribers) * 100) : 0}%</span></div>
                <div className="ow-bar" style={{ marginTop: 14 }}><div style={{ display: "flex", height: "100%" }}>{bizData.starterCount > 0 && <div className="ow-bar-fill" style={{ width: `${(bizData.starterCount / Math.max(bizData.totalSubscribers, 1)) * 100}%`, background: "#3498db" }} />}{bizData.proCount > 0 && <div className="ow-bar-fill" style={{ width: `${(bizData.proCount / Math.max(bizData.totalSubscribers, 1)) * 100}%`, background: T.orange }} />}{bizData.agencyCount > 0 && <div className="ow-bar-fill" style={{ width: `${(bizData.agencyCount / Math.max(bizData.totalSubscribers, 1)) * 100}%`, background: T.purple }} />}</div></div>
              </div>
              <div className="ow-card">
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Pipeline</div>
                <div className="ow-sub-row"><span style={{ fontSize: 13, color: T.muted }}>Deals Won</span><span style={{ fontSize: 15, fontWeight: 700, color: T.green }}>{bizData.dealsWon}</span></div>
                <div className="ow-sub-row"><span style={{ fontSize: 13, color: T.muted }}>Deal Value Won</span><span style={{ fontSize: 15, fontWeight: 700, color: T.green }}>{formatMoney(bizData.dealValueWon)}</span></div>
              </div>
            </div>

            <div className="ow-section">Platform Usage</div>
            <div className="ow-grid ow-grid-4">
              {[
                { label: "Workspaces", value: bizData.totalWorkspaces, color: T.text },
                { label: "Total Contacts", value: formatNum(bizData.totalContacts), color: T.text },
                { label: "Conversations", value: formatNum(bizData.totalConversations), color: T.text },
                { label: "Active Convos (7d)", value: bizData.activeConversations, color: T.orange },
                { label: "AI Messages Sent", value: formatNum(bizData.totalAiMessages), color: T.blue },
                { label: "Bookings (Total)", value: bizData.totalBookings, color: T.green },
                { label: "Bookings (Month)", value: bizData.bookingsThisMonth, color: T.green },
              ].map(s => (
                <div key={s.label} className="ow-stat"><div className="ow-stat-val" style={{ color: s.color as string }}>{s.value}</div><div className="ow-stat-label">{s.label}</div></div>
              ))}
            </div>

            <div className="ow-section">Cold Outreach</div>
            <div className="ow-grid ow-grid-4">
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.text }}>{formatNum(bizData.outreachTotal)}</div><div className="ow-stat-label">Total Contacts</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.green }}>{bizData.outreachReplied}</div><div className="ow-stat-label">Replied</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.red }}>{bizData.outreachBounced}</div><div className="ow-stat-label">Bounced</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.green }}>{bizData.outreachConverted}</div><div className="ow-stat-label">Converted</div></div>
            </div>

            <div className="ow-section">Affiliates</div>
            <div className="ow-grid ow-grid-4">
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.text }}>{bizData.totalAffiliates}</div><div className="ow-stat-label">Active Affiliates</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.text }}>{bizData.activeReferrals}</div><div className="ow-stat-label">Active Referrals</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.green }}>{formatMoney(bizData.affiliateEarned)}</div><div className="ow-stat-label">Total Earned</div></div>
              <div className="ow-stat"><div className="ow-stat-val" style={{ color: T.orange }}>{formatMoney(bizData.affiliatePaid)}</div><div className="ow-stat-label">Total Paid Out</div></div>
            </div>
          </>
        ) : (
          <div style={{ color: T.red, textAlign: "center", padding: 80 }}>Failed to load business data.</div>
        )
      )}
    </div>
  );
}
