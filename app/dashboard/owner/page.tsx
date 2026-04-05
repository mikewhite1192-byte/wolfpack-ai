"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";

const ADMIN_EMAILS = ["info@thewolfpackco.com"];

interface DashboardData {
  mrr: number; revenueThisMonth: number; revenueLastMonth: number; revenueGrowth: number;
  totalSubscribers: number; starterCount: number; proCount: number; agencyCount: number;
  churnedThisMonth: number; churnRate: number; totalWorkspaces: number; totalContacts: number;
  totalConversations: number; activeConversations: number; totalAiMessages: number;
  totalBookings: number; bookingsThisMonth: number; dealsWon: number; dealValueWon: number;
  recentSignups: number; outreachTotal: number; outreachReplied: number;
  outreachBounced: number; outreachConverted: number; totalAffiliates: number;
  affiliateEarned: number; affiliatePaid: number; activeReferrals: number;
}

function formatMoney(n: number) { if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`; return `$${n.toFixed(0)}`; }
function formatNum(n: number) { if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`; if (n >= 1000) return `${(n / 1000).toFixed(1)}k`; return n.toString(); }

function Stat({ value, label, color }: { value: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="bg-[#111] border border-white/[0.07] rounded-xl px-3.5 py-4 hover:border-white/[0.12] transition-colors">
      <div className="font-display text-[32px] tracking-wide leading-none mb-1" style={{ color: color || "#e8eaf0" }}>{value}</div>
      <div className="text-[11px] font-semibold text-[#b0b4c8] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-3 mt-6">{children}</div>;
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
      if (!ADMIN_EMAILS.includes(email.toLowerCase())) router.push("/dashboard");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    fetch("/api/owner").then(r => r.json()).then(d => { if (d.error) { setError(d.error); } else { setData(d); } setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const email = user?.primaryEmailAddress?.emailAddress || "";
  if (isLoaded && !ADMIN_EMAILS.includes(email.toLowerCase())) return null;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="font-display text-[28px] text-[#e8eaf0] tracking-wider">BUSINESS OVERVIEW</div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#E86A2A] bg-[#E86A2A]/10 px-3 py-1 rounded-full border border-[#E86A2A]/20">
          <Shield className="w-3 h-3" /> Owner Only
        </div>
      </div>

      {loading ? <div className="text-[#b0b4c8] text-center py-20">Loading business data...</div> :
       error ? <div className="text-red-400 text-center py-20">{error}</div> :
       data ? (<>
        <SectionLabel>Revenue</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          <Stat value={formatMoney(data.mrr)} label="MRR" color="#2ecc71" />
          <Stat value={formatMoney(data.revenueThisMonth)} label="Revenue This Month" />
          <Stat value={formatMoney(data.revenueLastMonth)} label="Revenue Last Month" color="#b0b4c8" />
          <Stat value={`${data.revenueGrowth >= 0 ? "+" : ""}${data.revenueGrowth.toFixed(1)}%`} label="MoM Growth" color={data.revenueGrowth >= 0 ? "#2ecc71" : "#e74c3c"} />
        </div>

        <SectionLabel>Subscribers</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          <Stat value={data.totalSubscribers} label="Total Active" color="#E86A2A" />
          <Stat value={data.recentSignups} label="New (30 Days)" color="#2ecc71" />
          <Stat value={data.churnedThisMonth} label="Churned" color="#e74c3c" />
          <Stat value={`${data.churnRate.toFixed(1)}%`} label="Churn Rate" color={data.churnRate > 5 ? "#e74c3c" : data.churnRate > 3 ? "#f5a623" : "#2ecc71"} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="bg-[#111] border border-white/[0.07] rounded-xl p-5">
            <div className="text-sm font-bold text-[#e8eaf0] mb-3">Plan Breakdown</div>
            {[{ label: "Starter", count: data.starterCount, color: "#3498db" }, { label: "Pro", count: data.proCount, color: "#E86A2A" }, { label: "Agency", count: data.agencyCount, color: "#9b59b6" }].map(p => (
              <div key={p.label} className="flex justify-between items-center py-2.5 border-b border-white/[0.07] last:border-b-0">
                <div className="flex items-center gap-2.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase" style={{ background: `${p.color}20`, color: p.color }}>{p.label}</span><span className="text-sm text-[#e8eaf0]">{p.count} subscribers</span></div>
                <span className="text-sm text-[#b0b4c8]">{data.totalSubscribers > 0 ? Math.round((p.count / data.totalSubscribers) * 100) : 0}%</span>
              </div>
            ))}
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-3.5 flex">
              {data.starterCount > 0 && <div className="h-full bg-blue-400" style={{ width: `${(data.starterCount / Math.max(data.totalSubscribers, 1)) * 100}%` }} />}
              {data.proCount > 0 && <div className="h-full bg-[#E86A2A]" style={{ width: `${(data.proCount / Math.max(data.totalSubscribers, 1)) * 100}%` }} />}
              {data.agencyCount > 0 && <div className="h-full bg-purple-500" style={{ width: `${(data.agencyCount / Math.max(data.totalSubscribers, 1)) * 100}%` }} />}
            </div>
          </div>
          <div className="bg-[#111] border border-white/[0.07] rounded-xl p-5">
            <div className="text-sm font-bold text-[#e8eaf0] mb-3">Pipeline</div>
            <div className="flex justify-between py-2.5 border-b border-white/[0.07]"><span className="text-sm text-[#b0b4c8]">Deals Won</span><span className="text-[15px] font-bold text-emerald-400">{data.dealsWon}</span></div>
            <div className="flex justify-between py-2.5"><span className="text-sm text-[#b0b4c8]">Deal Value Won</span><span className="text-[15px] font-bold text-emerald-400">{formatMoney(data.dealValueWon)}</span></div>
          </div>
        </div>

        <SectionLabel>Platform Usage</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          {[
            { label: "Workspaces", value: data.totalWorkspaces },
            { label: "Total Contacts", value: formatNum(data.totalContacts) },
            { label: "Conversations", value: formatNum(data.totalConversations) },
            { label: "Active Convos (7d)", value: data.activeConversations, color: "#E86A2A" },
            { label: "AI Messages Sent", value: formatNum(data.totalAiMessages), color: "#007AFF" },
            { label: "Bookings (Total)", value: data.totalBookings, color: "#2ecc71" },
            { label: "Bookings (Month)", value: data.bookingsThisMonth, color: "#2ecc71" },
          ].map(s => <Stat key={s.label} value={s.value} label={s.label} color={s.color} />)}
        </div>

        <SectionLabel>Cold Outreach</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          <Stat value={formatNum(data.outreachTotal)} label="Total Contacts" />
          <Stat value={data.outreachReplied} label="Replied" color="#2ecc71" />
          <Stat value={data.outreachBounced} label="Bounced" color="#e74c3c" />
          <Stat value={data.outreachConverted} label="Converted" color="#2ecc71" />
        </div>

        <SectionLabel>Affiliates</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Stat value={data.totalAffiliates} label="Active Affiliates" />
          <Stat value={data.activeReferrals} label="Active Referrals" />
          <Stat value={formatMoney(data.affiliateEarned)} label="Total Earned" color="#2ecc71" />
          <Stat value={formatMoney(data.affiliatePaid)} label="Total Paid Out" color="#E86A2A" />
        </div>
      </>) : null}
    </div>
  );
}
