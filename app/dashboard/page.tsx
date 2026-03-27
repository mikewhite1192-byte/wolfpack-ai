"use client";

import { useEffect, useState } from "react";
import OnboardingChat from "./components/OnboardingChat";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
};

interface Stats {
  pipelineValue: number;
  closedThisMonth: number;
  closedCount: number;
  conversionRate: number;
  avgDealSize: number;
  totalLeads: number;
  activeLeads: number;
}

interface Stage {
  name: string;
  color: string;
  count: string;
}

interface Activity {
  action: string;
  details: Record<string, string> | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function fmtMoney(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return "$" + fmt(n);
}

function getActivityText(a: Activity) {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || "Someone";
  const d = a.details || {};
  switch (a.action) {
    case "stage_changed": return `${name} moved from ${d.from} → ${d.to}`;
    case "note_added": return `Note added for ${name}: "${(d.text || "").substring(0, 60)}${(d.text || "").length > 60 ? "..." : ""}"`;
    case "call_made": return `Call made to ${name}`;
    case "email_sent": return `Email sent to ${name}`;
    case "sms_sent": return `SMS sent to ${name}`;
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
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(data => {
        setStats(data.stats);
        setStages(data.stages || []);
        setActivity(data.activity || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Check if onboarding is needed
    fetch("/api/ai-agent/onboard")
      .then(r => r.json())
      .then(data => {
        if (!data.done) setShowOnboarding(true);
        setOnboardingChecked(true);
      })
      .catch(() => setOnboardingChecked(true));
  }, []);

  const maxStageCount = Math.max(...stages.map(s => parseInt(s.count) || 0), 1);

  const statCards = stats ? [
    { label: "Pipeline Value", value: fmtMoney(stats.pipelineValue), sub: "Total open deals", color: T.orange },
    { label: "Closed This Month", value: fmtMoney(stats.closedThisMonth), sub: `${stats.closedCount} deal${stats.closedCount !== 1 ? "s" : ""} won`, color: T.green },
    { label: "Conversion Rate", value: `${stats.conversionRate}%`, sub: "Leads → closed won", color: T.orange },
    { label: "Avg Deal Size", value: fmtMoney(stats.avgDealSize), sub: "Per closed deal", color: T.text },
    { label: "Total Leads", value: fmt(stats.totalLeads), sub: "All time", color: T.text },
    { label: "Active Leads", value: fmt(stats.activeLeads), sub: "In pipeline now", color: T.orange },
  ] : [];

  return (
    <div>
      {showOnboarding && onboardingChecked && (
        <OnboardingChat onComplete={() => setShowOnboarding(false)} />
      )}
      <style>{`
        .dash-section-title { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; color: ${T.orange}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 14px; }
        .dash-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 28px; }
        .dash-stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 22px 20px; }
        .dash-stat-val { font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 1px; line-height: 1; margin-bottom: 6px; }
        .dash-stat-label { font-size: 12px; font-weight: 600; color: ${T.text}; margin-bottom: 2px; }
        .dash-stat-sub { font-size: 11px; color: ${T.muted}; }

        .dash-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .dash-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 22px; }

        .dash-stage-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid ${T.border}; }
        .dash-stage-row:last-child { border-bottom: none; }
        .dash-stage-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dash-stage-name { font-size: 13px; color: ${T.muted}; min-width: 110px; }
        .dash-stage-count { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: ${T.text}; min-width: 30px; text-align: right; }
        .dash-stage-bar-wrap { flex: 1; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; }
        .dash-stage-bar { height: 4px; border-radius: 2px; transition: width 0.5s ease; }

        .dash-empty { text-align: center; padding: 40px 0; color: ${T.muted}; font-size: 13px; }
        .dash-activity-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid ${T.border}; align-items: flex-start; }
        .dash-activity-item:last-child { border-bottom: none; }
        .dash-activity-dot { width: 8px; height: 8px; border-radius: 50%; background: ${T.orange}; flex-shrink: 0; margin-top: 5px; }
        .dash-activity-text { font-size: 13px; color: ${T.muted}; line-height: 1.5; }
        .dash-activity-time { font-size: 11px; color: rgba(255,255,255,0.2); margin-top: 2px; }
        .dash-loading { text-align: center; padding: 60px; color: ${T.muted}; font-size: 14px; }

        @media (max-width: 900px) { .dash-stats { grid-template-columns: repeat(2, 1fr); } .dash-row { grid-template-columns: 1fr; } }
      `}</style>

      {loading ? (
        <div className="dash-loading">Loading dashboard...</div>
      ) : (
        <>
          {/* Stats */}
          <div className="dash-section-title">Overview</div>
          <div className="dash-stats">
            {statCards.map(s => (
              <div key={s.label} className="dash-stat">
                <div className="dash-stat-val" style={{ color: s.color }}>{s.value}</div>
                <div className="dash-stat-label">{s.label}</div>
                <div className="dash-stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="dash-row">
            {/* Pipeline breakdown */}
            <div className="dash-card">
              <div className="dash-section-title">Pipeline Breakdown</div>
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
              <div className="dash-section-title">Recent Activity</div>
              {activity.length === 0 ? (
                <div className="dash-empty">No activity yet. Add your first lead to get started.</div>
              ) : (
                activity.map((a, i) => (
                  <div key={i} className="dash-activity-item">
                    <div className="dash-activity-dot" />
                    <div>
                      <div className="dash-activity-text">{getActivityText(a)}</div>
                      <div className="dash-activity-time">{timeAgo(a.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
