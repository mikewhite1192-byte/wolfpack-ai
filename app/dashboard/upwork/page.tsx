"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Settings,
  Star,
  DollarSign,
  TrendingUp,
  X,
  Loader2,
} from "lucide-react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  yellow: "#f5a623",
  bg: "#0a0a0a",
};

const ADMIN_EMAILS = ["info@thewolfpackco.com"];

interface UpworkJob {
  id: string;
  upwork_id: string;
  title: string;
  description: string;
  budget: string | null;
  job_type: string | null;
  skills: string[];
  client_country: string | null;
  client_rating: number | null;
  client_hire_rate: number | null;
  client_payment_verified: boolean;
  job_url: string;
  posted_at: string | null;
  ai_score: number | null;
  ai_reasoning: string | null;
  ai_proposal: string | null;
  status: string;
  applied_at: string | null;
  won_at: string | null;
  contract_value: number | null;
  notes: string | null;
  created_at: string;
}

interface Counts {
  new_count: string;
  new_high_count: string;
  applied_count: string;
  interviewing_count: string;
  won_count: string;
  lost_count: string;
  skipped_count: string;
  total: string;
  total_revenue: string;
}

type FilterTab = "all" | "new_high" | "new" | "applied" | "interviewing" | "won" | "lost" | "skipped";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new_high", label: "New (7+)" },
  { key: "new", label: "New" },
  { key: "applied", label: "Applied" },
  { key: "interviewing", label: "Interviewing" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "skipped", label: "Skipped" },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function scoreBadgeColor(score: number | null): string {
  if (score === null) return T.muted;
  if (score >= 8) return T.green;
  if (score >= 6) return T.yellow;
  return T.red;
}

export default function UpworkPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [jobs, setJobs] = useState<UpworkJob[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("new_high");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingProposal, setEditingProposal] = useState<string | null>(null);
  const [proposalText, setProposalText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedUrlsText, setFeedUrlsText] = useState("");
  const [autoPoll, setAutoPoll] = useState(false);
  const [minScore, setMinScore] = useState(7);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [wonModalId, setWonModalId] = useState<string | null>(null);
  const [wonValue, setWonValue] = useState("");

  const isAdmin =
    isLoaded &&
    user?.primaryEmailAddress?.emailAddress &&
    ADMIN_EMAILS.includes(user.primaryEmailAddress.emailAddress.toLowerCase());

  const fetchJobs = useCallback(async () => {
    try {
      const statusParam = tab === "all" ? "" : `&status=${tab}`;
      const res = await fetch(`/api/upwork/jobs?limit=100${statusParam}`);
      const data = await res.json();
      setJobs(data.jobs || []);
      setCounts(data.counts || null);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.push("/dashboard");
      return;
    }
    fetchJobs();
  }, [isLoaded, isAdmin, router, fetchJobs]);

  async function handlePoll() {
    setPolling(true);
    try {
      const res = await fetch("/api/upwork/jobs", { method: "POST" });
      const data = await res.json();
      if (data.error) alert(data.error);
      else alert(`Found ${data.newJobs} new jobs`);
      fetchJobs();
    } catch {
      alert("Poll failed");
    } finally {
      setPolling(false);
    }
  }

  async function handleScoreAll() {
    setScoring(true);
    try {
      const res = await fetch("/api/upwork/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      alert(`Scored ${data.scored} jobs`);
      fetchJobs();
    } catch {
      alert("Scoring failed");
    } finally {
      setScoring(false);
    }
  }

  async function updateJob(id: string, updates: Record<string, unknown>) {
    try {
      await fetch(`/api/upwork/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      fetchJobs();
    } catch (err) {
      console.error("Failed to update job:", err);
    }
  }

  async function handleMarkApplied(id: string) {
    await updateJob(id, { status: "applied" });
  }

  async function handleSkip(id: string) {
    await updateJob(id, { status: "skipped" });
  }

  async function handleStatusChange(id: string, newStatus: string) {
    if (newStatus === "won") {
      setWonModalId(id);
      return;
    }
    await updateJob(id, { status: newStatus });
  }

  async function handleWonConfirm() {
    if (!wonModalId) return;
    await updateJob(wonModalId, {
      status: "won",
      contract_value: wonValue ? parseFloat(wonValue) : null,
    });
    setWonModalId(null);
    setWonValue("");
  }

  function handleCopyProposal(id: string, proposal: string) {
    navigator.clipboard.writeText(proposal);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleSaveProposal(id: string) {
    await updateJob(id, { ai_proposal: proposalText });
    setEditingProposal(null);
  }

  async function loadSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/upwork/settings");
      const data = await res.json();
      setFeedUrlsText((data.feed_urls || []).join("\n"));
      setAutoPoll(data.auto_poll || false);
      setMinScore(data.min_score_threshold || 7);
    } catch {
      // Settings may not be configured yet
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveSettings() {
    setSettingsLoading(true);
    try {
      const urls = feedUrlsText
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      await fetch("/api/upwork/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feed_urls: urls,
          auto_poll: autoPoll,
          min_score_threshold: minScore,
        }),
      });
      setSettingsOpen(false);
    } catch {
      alert("Failed to save settings");
    } finally {
      setSettingsLoading(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="text-center py-20" style={{ color: T.muted }}>
        Loading...
      </div>
    );
  }

  if (!isAdmin) return null;

  const totalApplied =
    parseInt(counts?.applied_count || "0") +
    parseInt(counts?.interviewing_count || "0") +
    parseInt(counts?.won_count || "0") +
    parseInt(counts?.lost_count || "0");
  const winCount = parseInt(counts?.won_count || "0");
  const winRate = totalApplied > 0 ? ((winCount / totalApplied) * 100).toFixed(0) : "0";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5" style={{ color: T.orange }} />
          <h1 className="text-xl font-bold" style={{ color: T.text }}>
            Upwork Pipeline
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSettingsOpen(true);
              loadSettings();
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.border}`,
              color: T.muted,
            }}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
          <button
            onClick={handleScoreAll}
            disabled={scoring}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.border}`,
              color: T.muted,
            }}
          >
            {scoring ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Star className="w-3.5 h-3.5" />
            )}
            Score All
          </button>
          <button
            onClick={handlePoll}
            disabled={polling}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            style={{
              background: T.orange,
              border: "none",
              color: "#fff",
            }}
          >
            {polling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Poll Feeds
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {counts && (
        <div
          className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6 p-4 rounded-xl"
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
          }}
        >
          <StatCard label="New" value={counts.new_count} />
          <StatCard label="Applied" value={counts.applied_count} />
          <StatCard label="Interviewing" value={counts.interviewing_count} />
          <StatCard label="Won" value={counts.won_count} color={T.green} />
          <StatCard
            label="Revenue"
            value={`$${parseInt(counts.total_revenue).toLocaleString()}`}
            color={T.green}
          />
          <StatCard label="Win Rate" value={`${winRate}%`} color={T.orange} />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {FILTER_TABS.map((ft) => (
          <button
            key={ft.key}
            onClick={() => setTab(ft.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors"
            style={{
              background: tab === ft.key ? `${T.orange}1f` : "rgba(255,255,255,0.04)",
              border:
                tab === ft.key
                  ? `1px solid ${T.orange}40`
                  : `1px solid ${T.border}`,
              color: tab === ft.key ? T.orange : T.muted,
            }}
          >
            {ft.label}
            {ft.key === "new_high" && counts
              ? ` (${counts.new_high_count})`
              : ft.key === "applied" && counts
              ? ` (${counts.applied_count})`
              : ""}
          </button>
        ))}
      </div>

      {/* Job Cards */}
      {loading ? (
        <div className="text-center py-20" style={{ color: T.muted }}>
          Loading jobs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20" style={{ color: T.muted }}>
          No jobs found. Add RSS feed URLs in Settings and click Poll Feeds.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => {
            const isExpanded = expandedId === job.id;
            const isEditingThis = editingProposal === job.id;

            return (
              <div
                key={job.id}
                className="rounded-xl p-4"
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <a
                        href={job.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold hover:underline truncate"
                        style={{ color: T.text }}
                      >
                        {job.title}
                      </a>
                      {/* Score badge */}
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: `${scoreBadgeColor(job.ai_score)}20`,
                          color: scoreBadgeColor(job.ai_score),
                          border: `1px solid ${scoreBadgeColor(job.ai_score)}40`,
                        }}
                      >
                        {job.ai_score !== null ? `${job.ai_score}/10` : "Unscored"}
                      </span>
                      {/* Status badge */}
                      {job.status !== "new" && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            color: T.muted,
                          }}
                        >
                          {job.status}
                        </span>
                      )}
                    </div>
                    {/* Meta line */}
                    <div
                      className="flex items-center gap-3 text-[11px] flex-wrap"
                      style={{ color: T.muted }}
                    >
                      {job.budget && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {job.budget}
                        </span>
                      )}
                      {job.job_type && <span>{job.job_type}</span>}
                      {job.posted_at && <span>{timeAgo(job.posted_at)}</span>}
                      {job.client_country && <span>{job.client_country}</span>}
                      {job.client_rating !== null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3" />
                          {Number(job.client_rating).toFixed(1)}
                        </span>
                      )}
                      {job.client_hire_rate !== null && (
                        <span className="flex items-center gap-0.5">
                          <TrendingUp className="w-3 h-3" />
                          {Number(job.client_hire_rate).toFixed(0)}% hire
                        </span>
                      )}
                      {job.client_payment_verified && (
                        <span
                          className="flex items-center gap-0.5"
                          style={{ color: T.green }}
                        >
                          <Check className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Expand toggle */}
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : job.id)
                    }
                    className="p-1 rounded cursor-pointer"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.muted,
                    }}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Skills */}
                {job.skills && job.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {job.skills.slice(0, 8).map((skill, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${T.border}`,
                          color: T.muted,
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                    {job.skills.length > 8 && (
                      <span
                        className="text-[10px] px-2 py-0.5"
                        style={{ color: T.muted }}
                      >
                        +{job.skills.length - 8} more
                      </span>
                    )}
                  </div>
                )}

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                    {/* AI Reasoning */}
                    {job.ai_reasoning && (
                      <div className="mb-3">
                        <div
                          className="text-[10px] uppercase tracking-wider font-semibold mb-1"
                          style={{ color: T.orange }}
                        >
                          AI Analysis
                        </div>
                        <div
                          className="text-xs leading-relaxed"
                          style={{ color: T.muted }}
                        >
                          {job.ai_reasoning}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {job.description && (
                      <div className="mb-3">
                        <div
                          className="text-[10px] uppercase tracking-wider font-semibold mb-1"
                          style={{ color: T.muted }}
                        >
                          Description
                        </div>
                        <div
                          className="text-xs leading-relaxed max-h-40 overflow-y-auto"
                          style={{ color: T.text }}
                        >
                          {job.description}
                        </div>
                      </div>
                    )}

                    {/* Proposal */}
                    {(job.ai_proposal || isEditingThis) && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <div
                            className="text-[10px] uppercase tracking-wider font-semibold"
                            style={{ color: T.orange }}
                          >
                            Proposal
                          </div>
                          {!isEditingThis && job.ai_proposal && (
                            <button
                              onClick={() => {
                                setEditingProposal(job.id);
                                setProposalText(job.ai_proposal || "");
                              }}
                              className="text-[10px] cursor-pointer"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: T.muted,
                              }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {isEditingThis ? (
                          <div>
                            <textarea
                              value={proposalText}
                              onChange={(e) => setProposalText(e.target.value)}
                              rows={8}
                              className="w-full rounded-lg px-3 py-2 text-xs resize-y outline-none"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                border: `1px solid ${T.border}`,
                                color: T.text,
                              }}
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleSaveProposal(job.id)}
                                className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
                                style={{
                                  background: T.orange,
                                  border: "none",
                                  color: "#fff",
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingProposal(null)}
                                className="px-3 py-1 rounded text-xs cursor-pointer"
                                style={{
                                  background: "rgba(255,255,255,0.04)",
                                  border: `1px solid ${T.border}`,
                                  color: T.muted,
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="text-xs leading-relaxed whitespace-pre-wrap"
                            style={{ color: T.text }}
                          >
                            {job.ai_proposal}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {job.notes && (
                      <div className="mb-3">
                        <div
                          className="text-[10px] uppercase tracking-wider font-semibold mb-1"
                          style={{ color: T.muted }}
                        >
                          Notes
                        </div>
                        <div
                          className="text-xs leading-relaxed"
                          style={{ color: T.text }}
                        >
                          {job.notes}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {!job.ai_proposal && (
                        <button
                          disabled={generatingId === job.id}
                          onClick={async () => {
                            setGeneratingId(job.id);
                            try {
                              const res = await fetch("/api/upwork/score", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ jobId: job.id }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, ai_score: data.score ?? j.ai_score, ai_reasoning: data.reasoning ?? j.ai_reasoning, ai_proposal: data.proposal ?? j.ai_proposal } : j));
                              }
                            } catch {}
                            setGeneratingId(null);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                          style={{
                            background: generatingId === job.id ? `${T.orange}10` : `${T.orange}20`,
                            border: `1px solid ${T.orange}40`,
                            color: T.orange,
                            opacity: generatingId === job.id ? 0.6 : 1,
                          }}
                        >
                          {generatingId === job.id ? "Writing..." : "Write Proposal"}
                        </button>
                      )}
                      {job.ai_proposal && (
                        <button
                          onClick={() =>
                            handleCopyProposal(job.id, job.ai_proposal!)
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                          style={{
                            background:
                              copiedId === job.id
                                ? `${T.green}20`
                                : "rgba(255,255,255,0.04)",
                            border:
                              copiedId === job.id
                                ? `1px solid ${T.green}40`
                                : `1px solid ${T.border}`,
                            color: copiedId === job.id ? T.green : T.muted,
                          }}
                        >
                          {copiedId === job.id ? (
                            <>
                              <Check className="w-3 h-3" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy Proposal
                            </>
                          )}
                        </button>
                      )}

                      {job.status === "new" && (
                        <>
                          <button
                            onClick={() => handleMarkApplied(job.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                            style={{
                              background: `${T.orange}20`,
                              border: `1px solid ${T.orange}40`,
                              color: T.orange,
                            }}
                          >
                            Mark Applied
                          </button>
                          <button
                            onClick={() => handleSkip(job.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: `1px solid ${T.border}`,
                              color: T.muted,
                            }}
                          >
                            Skip
                          </button>
                        </>
                      )}

                      {job.status === "applied" && (
                        <button
                          onClick={() =>
                            handleStatusChange(job.id, "interviewing")
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                          style={{
                            background: `${T.yellow}20`,
                            border: `1px solid ${T.yellow}40`,
                            color: T.yellow,
                          }}
                        >
                          Interviewing
                        </button>
                      )}

                      {(job.status === "applied" ||
                        job.status === "interviewing") && (
                        <>
                          <button
                            onClick={() => handleStatusChange(job.id, "won")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                            style={{
                              background: `${T.green}20`,
                              border: `1px solid ${T.green}40`,
                              color: T.green,
                            }}
                          >
                            Won
                          </button>
                          <button
                            onClick={() => handleStatusChange(job.id, "lost")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                            style={{
                              background: `${T.red}20`,
                              border: `1px solid ${T.red}40`,
                              color: T.red,
                            }}
                          >
                            Lost
                          </button>
                        </>
                      )}

                      <a
                        href={job.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 no-underline transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${T.border}`,
                          color: T.muted,
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open on Upwork
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Won Value Modal */}
      {wonModalId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-sm"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
          >
            <h3
              className="text-sm font-bold mb-4"
              style={{ color: T.text }}
            >
              Contract Value
            </h3>
            <input
              type="number"
              placeholder="Enter contract value ($)"
              value={wonValue}
              onChange={(e) => setWonValue(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
                color: T.text,
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setWonModalId(null);
                  setWonValue("");
                }}
                className="px-4 py-2 rounded-lg text-xs cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                  color: T.muted,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleWonConfirm}
                className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
                style={{ background: T.green, border: "none", color: "#fff" }}
              >
                Mark Won
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-lg"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-sm font-bold"
                style={{ color: T.text }}
              >
                Upwork Settings
              </h3>
              <button
                onClick={() => setSettingsOpen(false)}
                className="cursor-pointer"
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.muted,
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {settingsLoading ? (
              <div
                className="text-center py-8 text-xs"
                style={{ color: T.muted }}
              >
                Loading...
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label
                    className="text-xs font-medium block mb-1"
                    style={{ color: T.muted }}
                  >
                    RSS Feed URLs (one per line)
                  </label>
                  <textarea
                    value={feedUrlsText}
                    onChange={(e) => setFeedUrlsText(e.target.value)}
                    rows={5}
                    placeholder="https://www.upwork.com/ab/feed/jobs/rss?q=next.js+AI&budget=500-&sort=recency"
                    className="w-full rounded-lg px-3 py-2 text-xs resize-y outline-none font-mono"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${T.border}`,
                      color: T.text,
                    }}
                  />
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPoll}
                      onChange={(e) => setAutoPoll(e.target.checked)}
                      className="accent-[#E86A2A]"
                    />
                    <span className="text-xs" style={{ color: T.text }}>
                      Auto-poll enabled (every 30 minutes)
                    </span>
                  </label>
                </div>

                <div className="mb-4">
                  <label
                    className="text-xs font-medium block mb-1"
                    style={{ color: T.muted }}
                  >
                    Min score threshold for highlights
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={minScore}
                    onChange={(e) => setMinScore(parseInt(e.target.value) || 7)}
                    className="w-20 rounded-lg px-3 py-1.5 text-xs outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${T.border}`,
                      color: T.text,
                    }}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs cursor-pointer"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${T.border}`,
                      color: T.muted,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSettings}
                    className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
                    style={{
                      background: T.orange,
                      border: "none",
                      color: "#fff",
                    }}
                  >
                    Save Settings
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div
        className="text-lg font-bold"
        style={{ color: color || T.text }}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>
        {label}
      </div>
    </div>
  );
}
