"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OnboardingChat from "./components/OnboardingChat";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  yellow: "#f5a623",
  blue: "#007AFF",
};

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

    // Generate fresh recommendations, then fetch
    fetch("/api/dashboard/recommendations", { method: "POST" })
      .then(() => fetch("/api/dashboard/recommendations"))
      .then(r => r.json())
      .then(data => setRecommendations(data.recommendations || []))
      .catch(() => {});
  }, []);

  async function dismissRec(id: string) {
    setRecommendations(prev => prev.filter(r => r.id !== id));
    await fetch("/api/dashboard/recommendations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  const maxStageCount = Math.max(...stages.map(s => parseInt(s.count) || 0), 1);

  return (
    <div>
      {showOnboarding && onboardingChecked && <OnboardingChat onComplete={() => setShowOnboarding(false)} />}
      <style>{`
        .dash-label { font-size: 11px; font-weight: 700; color: ${T.orange}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
        .dash-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
        .dash-left { min-width: 0; }
        .dash-right { min-width: 0; }

        .dash-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .dash-stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 16px 14px; }
        .dash-stat-val { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 0.5px; line-height: 1; margin-bottom: 4px; }
        .dash-stat-label { font-size: 11px; font-weight: 600; color: ${T.muted}; }

        .dash-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .dash-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 18px; }

        .dash-stage-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid ${T.border}; }
        .dash-stage-row:last-child { border-bottom: none; }
        .dash-stage-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .dash-stage-name { font-size: 12px; color: ${T.muted}; min-width: 90px; }
        .dash-stage-count { font-family: 'Bebas Neue', sans-serif; font-size: 16px; color: ${T.text}; min-width: 24px; text-align: right; }
        .dash-stage-bar-wrap { flex: 1; height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; }
        .dash-stage-bar { height: 3px; border-radius: 2px; transition: width 0.5s ease; }

        .dash-activity-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid ${T.border}; align-items: flex-start; }
        .dash-activity-item:last-child { border-bottom: none; }
        .dash-activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .dash-activity-text { font-size: 12px; color: ${T.muted}; line-height: 1.5; }
        .dash-activity-time { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 2px; }

        .dash-rec-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 18px; margin-bottom: 12px; }
        .dash-rec-item { padding: 12px 0; border-bottom: 1px solid ${T.border}; }
        .dash-rec-item:last-child { border-bottom: none; }
        .dash-rec-badge { font-size: 8px; font-weight: 700; padding: 2px 7px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; margin-bottom: 6px; }
        .dash-rec-title { font-size: 13px; font-weight: 600; color: ${T.text}; margin-bottom: 3px; }
        .dash-rec-desc { font-size: 11px; color: ${T.muted}; line-height: 1.5; }
        .dash-rec-action { font-size: 11px; font-weight: 600; color: ${T.orange}; text-decoration: none; margin-top: 6px; display: inline-block; }
        .dash-rec-action:hover { text-decoration: underline; }

        .dash-empty { text-align: center; padding: 24px 0; color: ${T.muted}; font-size: 12px; }
        .dash-loading { text-align: center; padding: 60px; color: ${T.muted}; font-size: 14px; }

        @media (max-width: 1000px) {
          .dash-layout { grid-template-columns: 1fr; }
          .dash-stats { grid-template-columns: repeat(2, 1fr); }
          .dash-row { grid-template-columns: 1fr; }
        }
      `}</style>

      {loading ? (
        <div className="dash-loading">Loading dashboard...</div>
      ) : (
        <div className="dash-layout">
          {/* Left — Main content */}
          <div className="dash-left">
            {/* Stats */}
            <div className="dash-label">Overview</div>
            <div className="dash-stats">
              {stats && [
                { label: "Pipeline Value", value: fmtMoney(stats.pipelineValue), color: T.orange },
                { label: "Closed This Month", value: fmtMoney(stats.closedThisMonth), color: T.green },
                { label: "Conversion Rate", value: `${stats.conversionRate}%`, color: T.orange },
                { label: "Avg Deal Size", value: fmtMoney(stats.avgDealSize), color: T.text },
                { label: "Total Leads", value: fmt(stats.totalLeads), color: T.text },
                { label: "Active Leads", value: fmt(stats.activeLeads), color: T.orange },
                { label: "Deals Won", value: fmt(stats.closedCount), color: T.green },
                { label: "Open Conversations", value: fmt(stats.openConversations || 0), color: T.blue },
              ].map(s => (
                <div key={s.label} className="dash-stat">
                  <div className="dash-stat-val" style={{ color: s.color }}>{s.value}</div>
                  <div className="dash-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="dash-row">
              {/* Pipeline breakdown */}
              <div className="dash-card">
                <div className="dash-label">Pipeline</div>
                {stages.map(s => {
                  const count = parseInt(s.count) || 0;
                  const pct = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0;
                  return (
                    <div key={s.name} className="dash-stage-row">
                      <div className="dash-stage-dot" style={{ background: s.color }} />
                      <div className="dash-stage-name">{s.name}</div>
                      <div className="dash-stage-bar-wrap">
                        <div className="dash-stage-bar" style={{ width: `${pct}%`, background: s.color }} />
                      </div>
                      <div className="dash-stage-count">{count}</div>
                    </div>
                  );
                })}
              </div>

              {/* Recent activity */}
              <div className="dash-card">
                <div className="dash-label">Activity</div>
                {activity.length === 0 ? (
                  <div className="dash-empty">No activity yet.</div>
                ) : (
                  activity.slice(0, 8).map((a, i) => (
                    <div key={i} className="dash-activity-item">
                      <div className="dash-activity-dot" style={{
                        background: a.action === "ai_note" ? T.blue :
                                   a.action === "appointment_booked" ? T.green :
                                   a.action === "stage_changed" ? T.yellow : T.orange
                      }} />
                      <div>
                        <div className="dash-activity-text">{getActivityText(a)}</div>
                        <div className="dash-activity-time">{timeAgo(a.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right — AI Recommendations */}
          <div className="dash-right">
            <div className="dash-rec-card">
              <div className="dash-label">AI Recommendations</div>
              {recommendations.length === 0 ? (
                <div className="dash-empty">All caught up. No actions needed.</div>
              ) : (
                recommendations.map((r) => (
                  <div key={r.id} className="dash-rec-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div
                        className="dash-rec-badge"
                        style={{ background: `${typeColors[r.type] || "#888"}18`, color: typeColors[r.type] || "#888", border: `1px solid ${typeColors[r.type] || "#888"}30` }}
                      >
                        {typeLabels[r.type] || r.type}
                      </div>
                      <button
                        onClick={() => dismissRec(r.id)}
                        style={{ background: "none", border: "none", color: "rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                        title="Dismiss"
                      >×</button>
                    </div>
                    <div className="dash-rec-title">{r.title}</div>
                    <div className="dash-rec-desc">{r.description}</div>
                    {r.action_label && r.action_href && <Link href={r.action_href} className="dash-rec-action">{r.action_label} →</Link>}
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
