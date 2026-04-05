"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import OnboardingChat from "./components/OnboardingChat";

interface Stats {
  pipelineValue: number;
  closedThisMonth: number;
  closedCount: number;
  conversionRate: number;
  avgDealSize: number;
  totalLeads: number;
  activeLeads: number;
  openConversations?: number;
  aiMessagesSent?: number;
  appointmentsThisWeek?: number;
  followUpsDue?: number;
}

interface Stage { name: string; color: string; count: string; }

interface Activity {
  action: string;
  details: Record<string, string> | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
}

interface Recommendation {
  id: string;
  type: "urgent" | "warning" | "insight" | "positive";
  key: string;
  title: string;
  description: string;
  action_label?: string;
  action_href?: string;
  contact_id?: string;
}

function fmt(n: number) { return n.toLocaleString("en-US"); }
function fmtMoney(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return "$" + fmt(n);
}

function getActivityText(a: Activity) {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || "Someone";
  const d = a.details || {};
  switch (a.action) {
    case "stage_changed": return `${name} moved to ${d.to}`;
    case "note_added": return `Note on ${name}: "${(d.text || "").substring(0, 50)}..."`;
    case "call_made": return `Call to ${name}`;
    case "email_sent": return `Email sent to ${name}`;
    case "sms_sent": return `SMS sent to ${name}`;
    case "ai_note": return `AI: ${(d.text || "").substring(0, 70)}${(d.text || "").length > 70 ? "..." : ""}`;
    case "appointment_booked": return `Appointment booked with ${name}`;
    default: return `${a.action} — ${name}`;
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const typeColors: Record<string, string> = { urgent: "#e74c3c", warning: "#f5a623", insight: "#007AFF", positive: "#2ecc71" };
const typeLabels: Record<string, string> = { urgent: "Urgent", warning: "Warning", insight: "Insight", positive: "Win" };

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(data => { setStats(data.stats); setStages(data.stages || []); setActivity(data.activity || []); setLoading(false); })
      .catch(() => setLoading(false));

    fetch("/api/ai-agent/onboard")
      .then(r => r.json())
      .then(data => { if (!data.done) setShowOnboarding(true); setOnboardingChecked(true); })
      .catch(() => setOnboardingChecked(true));

    fetch("/api/dashboard/recommendations", { method: "POST" })
      .then(() => fetch("/api/dashboard/recommendations"))
      .then(r => r.json())
      .then(data => setRecommendations(data.recommendations || []))
      .catch(() => {});
  }, []);

  async function dismissRec(id: string) {
    setRecommendations(prev => prev.filter(r => r.id !== id));
    await fetch("/api/dashboard/recommendations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }

  const maxStageCount = Math.max(...stages.map(s => parseInt(s.count) || 0), 1);

  return (
    <div>
      {showOnboarding && onboardingChecked && <OnboardingChat onComplete={() => setShowOnboarding(false)} />}

      {loading ? (
        <div className="text-center py-16 text-[#b0b4c8] text-sm">Loading dashboard...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* Left — Main */}
          <div className="min-w-0">
            {/* Stats */}
            <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-3">Overview</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
              {stats && [
                { label: "Pipeline Value", value: fmtMoney(stats.pipelineValue), color: "#E86A2A" },
                { label: "Closed This Month", value: fmtMoney(stats.closedThisMonth), color: "#2ecc71" },
                { label: "Conversion Rate", value: `${stats.conversionRate}%`, color: "#E86A2A" },
                { label: "Avg Deal Size", value: fmtMoney(stats.avgDealSize), color: "#e8eaf0" },
                { label: "Total Leads", value: fmt(stats.totalLeads), color: "#e8eaf0" },
                { label: "Active Leads", value: fmt(stats.activeLeads), color: "#E86A2A" },
                { label: "Deals Won", value: fmt(stats.closedCount), color: "#2ecc71" },
                { label: "Open Conversations", value: fmt(stats.openConversations || 0), color: "#007AFF" },
              ].map(s => (
                <div key={s.label} className="bg-[#111] border border-white/[0.07] rounded-xl px-3.5 py-4 hover:border-white/[0.12] transition-all duration-200">
                  <div className="font-display text-[28px] tracking-wide leading-none mb-1" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px] font-semibold text-[#b0b4c8]">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Pipeline */}
              <div className="bg-[#111] border border-white/[0.07] rounded-xl p-5">
                <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-3">Pipeline</div>
                {stages.map(s => {
                  const count = parseInt(s.count) || 0;
                  const pct = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0;
                  return (
                    <div key={s.name} className="flex items-center gap-2.5 py-2 border-b border-white/[0.07] last:border-b-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <div className="text-xs text-[#b0b4c8] min-w-[90px]">{s.name}</div>
                      <div className="flex-1 h-[3px] bg-white/5 rounded-full">
                        <div className="h-[3px] rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: s.color }} />
                      </div>
                      <div className="font-display text-base text-[#e8eaf0] min-w-[24px] text-right">{count}</div>
                    </div>
                  );
                })}
              </div>

              {/* Activity */}
              <div className="bg-[#111] border border-white/[0.07] rounded-xl p-5">
                <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-3">Activity</div>
                {activity.length === 0 ? (
                  <div className="text-center py-6 text-[#b0b4c8] text-xs">No activity yet.</div>
                ) : (
                  activity.slice(0, 8).map((a, i) => (
                    <div key={i} className="flex gap-2.5 py-2.5 border-b border-white/[0.07] last:border-b-0 items-start">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{
                        background: a.action === "ai_note" ? "#007AFF" :
                                   a.action === "appointment_booked" ? "#2ecc71" :
                                   a.action === "stage_changed" ? "#f5a623" : "#E86A2A"
                      }} />
                      <div>
                        <div className="text-xs text-[#b0b4c8] leading-relaxed">{getActivityText(a)}</div>
                        <div className="text-[10px] text-white/20 mt-0.5">{timeAgo(a.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right — AI Recs */}
          <div className="min-w-0">
            <div className="bg-[#111] border border-white/[0.07] rounded-xl p-5">
              <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-3">AI Recommendations</div>
              {recommendations.length === 0 ? (
                <div className="text-center py-6 text-[#b0b4c8] text-xs">All caught up. No actions needed.</div>
              ) : (
                recommendations.map((r) => (
                  <div key={r.id} className="py-3 border-b border-white/[0.07] last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div className="text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mb-1.5"
                        style={{ background: `${typeColors[r.type] || "#888"}18`, color: typeColors[r.type] || "#888", border: `1px solid ${typeColors[r.type] || "#888"}30` }}>
                        {typeLabels[r.type] || r.type}
                      </div>
                      <button onClick={() => dismissRec(r.id)} title="Dismiss"
                        className="bg-transparent border-none text-white/15 cursor-pointer hover:text-white/40 transition-colors p-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[13px] font-semibold text-[#e8eaf0] mb-1">{r.title}</div>
                    <div className="text-[11px] text-[#b0b4c8] leading-relaxed">{r.description}</div>
                    {r.action_label && r.action_href && (
                      <Link href={r.action_href} className="text-[11px] font-semibold text-[#E86A2A] no-underline hover:underline mt-1.5 inline-block">
                        {r.action_label} →
                      </Link>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
