"use client";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

const ADMIN_EMAILS = ["info@thewolfpackco.com"];

interface BusinessData {
  mrr: number; revenueThisMonth: number; revenueLastMonth: number; revenueGrowth: number;
  totalSubscribers: number; starterCount: number; proCount: number; agencyCount: number;
  churnedThisMonth: number; churnRate: number; totalWorkspaces: number; totalContacts: number;
  totalConversations: number; activeConversations: number; totalAiMessages: number;
  totalBookings: number; bookingsThisMonth: number; dealsWon: number; dealValueWon: number;
  recentSignups: number; outreachTotal: number; outreachReplied: number;
  outreachBounced: number; outreachConverted: number; totalAffiliates: number;
  affiliateEarned: number; affiliatePaid: number; activeReferrals: number;
}

function formatMoney(n: number): string { if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`; return `$${n.toFixed(0)}`; }
function formatNum(n: number): string { if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`; if (n >= 1000) return `${(n / 1000).toFixed(1)}k`; return n.toString(); }

interface FunnelStage { name: string; color: string; count: number; totalValue: number; conversionRate: number | null; }
interface StageBreakdown { name: string; color: string; isWon: boolean; isLost: boolean; count: number; totalValue: number; }
interface LeadSource { source: string; count: number; wonCount: number; totalValue: number; }
interface AnalyticsData { funnel: FunnelStage[]; stageBreakdown: StageBreakdown[]; wonThisMonth: { count: number; totalValue: number }; lostThisMonth: { count: number; totalValue: number }; avgDealSize: number; avgTimeInStage: Record<string, number>; leadSources: LeadSource[]; }
interface TrafficData { totalViews: number; uniqueVisitors: number; todayViews: number; yesterdayViews: number; daily: { date: string; views: number; visitors: number }[]; topPages: { path: string; views: number; visitors: number }[]; topReferrers: { referrer: string; views: number }[]; }

function StatCard({ value, label, color }: { value: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="bg-[#111] border border-white/[0.07] rounded-xl px-4 py-4 text-center hover:border-white/[0.12] transition-colors">
      <div className="font-display text-[28px] tracking-wide leading-none mb-1" style={{ color: color || "#e8eaf0" }}>{value}</div>
      <div className="text-[11px] font-semibold text-[#b0b4c8] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-3 mt-6">{children}</div>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#111] border border-white/[0.07] rounded-xl p-5 ${className}`}>{children}</div>;
}

export default function AnalyticsPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<"pipeline" | "business" | "traffic">("pipeline");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [bizData, setBizData] = useState<BusinessData | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bizLoading, setBizLoading] = useState(false);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficRange, setTrafficRange] = useState("30d");

  const isAdmin = ADMIN_EMAILS.includes(user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "");

  const fetchData = useCallback(async () => { try { const res = await fetch("/api/analytics/pipeline"); setData(await res.json()); } catch {} setLoading(false); }, []);
  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === "business" && !bizData && isAdmin) { setBizLoading(true); fetch("/api/owner").then(r => r.json()).then(d => { setBizData(d); setBizLoading(false); }).catch(() => setBizLoading(false)); } }, [tab, bizData, isAdmin]);
  useEffect(() => { if (tab === "traffic") { setTrafficLoading(true); fetch(`/api/analytics/traffic?range=${trafficRange}`).then(r => r.json()).then(d => { setTrafficData(d); setTrafficLoading(false); }).catch(() => setTrafficLoading(false)); } }, [tab, trafficRange]);

  if (loading) return <div className="text-[#b0b4c8] py-10 text-center">Loading analytics...</div>;
  if (!data) return <div className="text-red-400 py-10 text-center">Failed to load analytics.</div>;

  const totalDeals = data.stageBreakdown.reduce((s, st) => s + st.count, 0);
  const totalValue = data.stageBreakdown.reduce((s, st) => s + st.totalValue, 0);
  const maxFunnelCount = Math.max(...data.funnel.map(f => f.count), 1);

  return (
    <div>
      <div className="font-display text-[28px] text-[#e8eaf0] tracking-wide mb-6">ANALYTICS</div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111] border border-white/[0.07] rounded-xl p-1 mb-6 w-fit">
        {[
          { id: "pipeline" as const, label: "Pipeline" },
          { id: "traffic" as const, label: "Site Traffic" },
          ...(isAdmin ? [{ id: "business" as const, label: "Business" }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer border-none transition-all ${
              tab === t.id ? "bg-[#E86A2A] text-white" : "bg-transparent text-[#b0b4c8] hover:text-[#e8eaf0]"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Pipeline Tab ── */}
      {tab === "pipeline" && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          <StatCard value={totalDeals} label="Total Deals" />
          <StatCard value={`$${totalValue.toLocaleString()}`} label="Total Pipeline Value" color="#2ecc71" />
          <StatCard value={`$${Math.round(data.avgDealSize).toLocaleString()}`} label="Avg Deal Size" color="#E86A2A" />
          <StatCard value={<>{data.wonThisMonth.count}<span className="text-sm text-[#b0b4c8] font-normal"> / </span><span className="text-xl text-red-400">{data.lostThisMonth.count}</span></>} label="Won / Lost This Month" color="#2ecc71" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card className="border-l-[3px] border-l-emerald-400">
            <SectionLabel>Won This Month</SectionLabel>
            <div className="flex justify-between items-baseline">
              <div className="text-[28px] font-extrabold text-emerald-400">{data.wonThisMonth.count} deals</div>
              <div className="text-lg font-bold text-emerald-400">${data.wonThisMonth.totalValue.toLocaleString()}</div>
            </div>
          </Card>
          <Card className="border-l-[3px] border-l-red-400">
            <SectionLabel>Lost This Month</SectionLabel>
            <div className="flex justify-between items-baseline">
              <div className="text-[28px] font-extrabold text-red-400">{data.lostThisMonth.count} deals</div>
              <div className="text-lg font-bold text-red-400">${data.lostThisMonth.totalValue.toLocaleString()}</div>
            </div>
          </Card>
        </div>

        {/* Pipeline Funnel */}
        <Card className="mb-4">
          <SectionLabel>Pipeline Funnel</SectionLabel>
          {data.funnel.length === 0 ? (
            <div className="text-[#b0b4c8] text-sm text-center py-5">No active pipeline stages with deals yet.</div>
          ) : data.funnel.map((stage, i) => (
            <div key={stage.name}>
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-[120px] text-sm text-[#e8eaf0] font-medium flex-shrink-0">{stage.name}</div>
                <div className="flex-1 h-8 bg-white/[0.03] rounded-md overflow-hidden relative">
                  <div className="h-full rounded-md flex items-center justify-end pr-2.5 transition-all duration-500 min-w-[40px]" style={{ width: `${Math.max((stage.count / maxFunnelCount) * 100, 8)}%`, background: stage.color }}>
                    <span className="text-xs font-bold text-white">{stage.count}</span>
                  </div>
                </div>
                <div className="w-20 text-right text-xs text-[#b0b4c8]">${stage.totalValue.toLocaleString()}</div>
              </div>
              {stage.conversionRate !== null && i < data.funnel.length - 1 && (
                <div className="text-center text-[11px] py-0.5 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{
                    background: stage.conversionRate >= 50 ? "rgba(46,204,113,0.12)" : stage.conversionRate >= 25 ? "rgba(243,156,18,0.12)" : "rgba(231,76,60,0.12)",
                    color: stage.conversionRate >= 50 ? "#2ecc71" : stage.conversionRate >= 25 ? "#f39c12" : "#e74c3c",
                  }}>{stage.conversionRate}% conversion</span>
                </div>
              )}
            </div>
          ))}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stage Breakdown */}
          <Card>
            <SectionLabel>Stage Breakdown</SectionLabel>
            <table className="w-full border-collapse">
              <thead><tr>{["Stage", "Deals", "Value", "Avg Time"].map((h, i) => <th key={h} className={`text-left text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider py-2 px-3 border-b border-white/[0.07] ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>{data.stageBreakdown.map(s => (
                <tr key={s.name} className="border-b border-white/[0.07] last:border-b-0">
                  <td className="py-2.5 px-3 text-sm text-[#e8eaf0]"><span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: s.color }} />{s.name}</td>
                  <td className="py-2.5 px-3 text-sm text-[#e8eaf0] text-right">{s.count}</td>
                  <td className="py-2.5 px-3 text-sm text-[#e8eaf0] text-right">${s.totalValue.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-sm text-[#b0b4c8] text-right">{data.avgTimeInStage[s.name] !== undefined ? `${data.avgTimeInStage[s.name]}d` : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </Card>

          {/* Lead Sources */}
          <Card>
            <SectionLabel>Lead Sources</SectionLabel>
            {data.leadSources.length === 0 ? <div className="text-[#b0b4c8] text-sm text-center py-5">No lead source data yet.</div> : (
              <table className="w-full border-collapse">
                <thead><tr>{["Source", "Leads", "Won", "Value"].map((h, i) => <th key={h} className={`text-left text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider py-2 px-3 border-b border-white/[0.07] ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
                <tbody>{data.leadSources.map(src => {
                  const maxCount = Math.max(...data.leadSources.map(s => s.count), 1);
                  return (
                    <tr key={src.source} className="border-b border-white/[0.07] last:border-b-0">
                      <td className="py-2.5 px-3"><div className="text-sm text-[#e8eaf0]">{src.source}</div><div className="h-1.5 rounded-full bg-[#E86A2A] mt-1" style={{ width: `${(src.count / maxCount) * 100}%` }} /></td>
                      <td className="py-2.5 px-3 text-sm text-[#e8eaf0] text-right">{src.count}</td>
                      <td className="py-2.5 px-3 text-sm text-emerald-400 text-right">{src.wonCount}</td>
                      <td className="py-2.5 px-3 text-sm text-[#e8eaf0] text-right">${src.totalValue.toLocaleString()}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
          </Card>
        </div>
      </>)}

      {/* ── Traffic Tab ── */}
      {tab === "traffic" && (
        trafficLoading ? <div className="text-[#b0b4c8] text-center py-20">Loading traffic data...</div> :
        trafficData ? (() => {
          const maxPageViews = Math.max(...(trafficData.topPages || []).map(p => p.views), 1);
          const maxRefViews = Math.max(...(trafficData.topReferrers || []).map(r => r.views), 1);
          const maxDailyViews = Math.max(...(trafficData.daily || []).map(d => d.views), 1);
          const todayChange = trafficData.yesterdayViews > 0 ? Math.round(((trafficData.todayViews - trafficData.yesterdayViews) / trafficData.yesterdayViews) * 100) : trafficData.todayViews > 0 ? 100 : 0;
          return (<>
            <div className="flex gap-1 mb-5">
              {[{ key: "24h", label: "24h" }, { key: "7d", label: "7 days" }, { key: "30d", label: "30 days" }, { key: "90d", label: "90 days" }].map(r => (
                <button key={r.key} onClick={() => setTrafficRange(r.key)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer border transition-all ${trafficRange === r.key ? "border-[#E86A2A]/40 bg-[#E86A2A]/15 text-[#E86A2A]" : "border-white/[0.07] bg-transparent text-[#b0b4c8] hover:border-white/[0.15]"}`}>{r.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
              <StatCard value={formatNum(trafficData.totalViews)} label="Total Views" />
              <StatCard value={formatNum(trafficData.uniqueVisitors)} label="Unique Visitors" />
              <StatCard value={trafficData.todayViews} label="Today" />
              <StatCard value={`${todayChange >= 0 ? "+" : ""}${todayChange}%`} label="vs Yesterday" color={todayChange >= 0 ? "#2ecc71" : "#e74c3c"} />
            </div>
            {trafficData.daily.length > 0 && (<>
              <SectionLabel>Views Over Time</SectionLabel>
              <Card className="mb-5">
                <div className="flex items-end gap-0.5 h-[140px]">
                  {trafficData.daily.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] text-[#b0b4c8]">{d.views}</div>
                      <div className="w-full max-w-[32px] rounded-t" style={{ background: "linear-gradient(180deg, #E86A2A, rgba(232,106,42,0.5))", height: `${Math.max((d.views / maxDailyViews) * 100, 4)}%`, transition: "height 0.3s ease" }} title={`${d.date}: ${d.views} views`} />
                      <div className="text-[9px] text-[#b0b4c8] -rotate-45 whitespace-nowrap">{new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>)}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <SectionLabel>Top Pages</SectionLabel>
                {trafficData.topPages.length === 0 ? <div className="text-[#b0b4c8] text-sm">No data yet</div> : trafficData.topPages.map((p, i) => (
                  <div key={i} className="mb-3">
                    <div className="flex justify-between mb-1"><span className="text-sm text-[#e8eaf0] font-medium">{p.path}</span><span className="text-xs text-[#b0b4c8]">{p.views} views / {p.visitors} unique</span></div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full bg-[#E86A2A] transition-all duration-300" style={{ width: `${(p.views / maxPageViews) * 100}%` }} /></div>
                  </div>
                ))}
              </Card>
              <Card>
                <SectionLabel>Top Referrers</SectionLabel>
                {trafficData.topReferrers.length === 0 ? <div className="text-[#b0b4c8] text-sm">No data yet</div> : trafficData.topReferrers.map((r, i) => {
                  let displayRef = r.referrer; try { if (r.referrer.startsWith("http")) displayRef = new URL(r.referrer).hostname; } catch {}
                  return (
                    <div key={i} className="mb-3">
                      <div className="flex justify-between mb-1"><span className="text-sm text-[#e8eaf0] font-medium">{displayRef}</span><span className="text-xs text-[#b0b4c8]">{r.views} views</span></div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full bg-blue-400 transition-all duration-300" style={{ width: `${(r.views / maxRefViews) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </Card>
            </div>
          </>);
        })() : <div className="text-[#b0b4c8] text-center py-20">No traffic data yet.</div>
      )}

      {/* ── Business Tab (Admin) ── */}
      {tab === "business" && isAdmin && (
        bizLoading ? <div className="text-[#b0b4c8] text-center py-20">Loading business data...</div> :
        bizData ? (<>
          <SectionLabel>Revenue</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
            <StatCard value={formatMoney(bizData.mrr)} label="MRR" color="#2ecc71" />
            <StatCard value={formatMoney(bizData.revenueThisMonth)} label="Revenue This Month" />
            <StatCard value={formatMoney(bizData.revenueLastMonth)} label="Revenue Last Month" color="#b0b4c8" />
            <StatCard value={`${bizData.revenueGrowth >= 0 ? "+" : ""}${bizData.revenueGrowth.toFixed(1)}%`} label="MoM Growth" color={bizData.revenueGrowth >= 0 ? "#2ecc71" : "#e74c3c"} />
          </div>

          <SectionLabel>Subscribers</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
            <StatCard value={bizData.totalSubscribers} label="Total Active" color="#E86A2A" />
            <StatCard value={bizData.recentSignups} label="New (30 Days)" color="#2ecc71" />
            <StatCard value={bizData.churnedThisMonth} label="Churned" color="#e74c3c" />
            <StatCard value={`${bizData.churnRate.toFixed(1)}%`} label="Churn Rate" color={bizData.churnRate > 5 ? "#e74c3c" : bizData.churnRate > 3 ? "#f39c12" : "#2ecc71"} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Card>
              <div className="text-sm font-bold text-[#e8eaf0] mb-3">Plan Breakdown</div>
              {[
                { label: "Starter", count: bizData.starterCount, color: "#3498db" },
                { label: "Pro", count: bizData.proCount, color: "#E86A2A" },
                { label: "Agency", count: bizData.agencyCount, color: "#9b59b6" },
              ].map(p => (
                <div key={p.label} className="flex justify-between items-center py-2.5 border-b border-white/[0.07] last:border-b-0">
                  <div className="flex items-center gap-2.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase" style={{ background: `${p.color}20`, color: p.color }}>{p.label}</span><span className="text-sm text-[#e8eaf0]">{p.count}</span></div>
                  <span className="text-sm text-[#b0b4c8]">{bizData.totalSubscribers > 0 ? Math.round((p.count / bizData.totalSubscribers) * 100) : 0}%</span>
                </div>
              ))}
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-3.5 flex">
                {bizData.starterCount > 0 && <div className="h-full bg-blue-400" style={{ width: `${(bizData.starterCount / Math.max(bizData.totalSubscribers, 1)) * 100}%` }} />}
                {bizData.proCount > 0 && <div className="h-full bg-[#E86A2A]" style={{ width: `${(bizData.proCount / Math.max(bizData.totalSubscribers, 1)) * 100}%` }} />}
                {bizData.agencyCount > 0 && <div className="h-full bg-purple-500" style={{ width: `${(bizData.agencyCount / Math.max(bizData.totalSubscribers, 1)) * 100}%` }} />}
              </div>
            </Card>
            <Card>
              <div className="text-sm font-bold text-[#e8eaf0] mb-3">Pipeline</div>
              <div className="flex justify-between py-2.5 border-b border-white/[0.07]"><span className="text-sm text-[#b0b4c8]">Deals Won</span><span className="text-[15px] font-bold text-emerald-400">{bizData.dealsWon}</span></div>
              <div className="flex justify-between py-2.5"><span className="text-sm text-[#b0b4c8]">Deal Value Won</span><span className="text-[15px] font-bold text-emerald-400">{formatMoney(bizData.dealValueWon)}</span></div>
            </Card>
          </div>

          <SectionLabel>Platform Usage</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
            {[
              { label: "Workspaces", value: bizData.totalWorkspaces },
              { label: "Total Contacts", value: formatNum(bizData.totalContacts) },
              { label: "Conversations", value: formatNum(bizData.totalConversations) },
              { label: "Active Convos (7d)", value: bizData.activeConversations, color: "#E86A2A" },
              { label: "AI Messages Sent", value: formatNum(bizData.totalAiMessages), color: "#3498db" },
              { label: "Bookings (Total)", value: bizData.totalBookings, color: "#2ecc71" },
              { label: "Bookings (Month)", value: bizData.bookingsThisMonth, color: "#2ecc71" },
            ].map(s => <StatCard key={s.label} value={s.value} label={s.label} color={s.color} />)}
          </div>

          <SectionLabel>Cold Outreach</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
            <StatCard value={formatNum(bizData.outreachTotal)} label="Total Contacts" />
            <StatCard value={bizData.outreachReplied} label="Replied" color="#2ecc71" />
            <StatCard value={bizData.outreachBounced} label="Bounced" color="#e74c3c" />
            <StatCard value={bizData.outreachConverted} label="Converted" color="#2ecc71" />
          </div>

          <SectionLabel>Affiliates</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <StatCard value={bizData.totalAffiliates} label="Active Affiliates" />
            <StatCard value={bizData.activeReferrals} label="Active Referrals" />
            <StatCard value={formatMoney(bizData.affiliateEarned)} label="Total Earned" color="#2ecc71" />
            <StatCard value={formatMoney(bizData.affiliatePaid)} label="Total Paid Out" color="#E86A2A" />
          </div>
        </>) : <div className="text-red-400 text-center py-20">Failed to load business data.</div>
      )}
    </div>
  );
}
