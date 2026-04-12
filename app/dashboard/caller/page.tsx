"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneOff,
  Play,
  Pause,
  Square,
  Calendar,
  Clock,
  Users,
  MessageSquare,
  PhoneCall,
  PhoneMissed,
  CheckCircle,
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

interface CallerStats {
  calls_made: number;
  pickups: number;
  voicemails: number;
  not_interested: number;
  demos_booked: number;
}

interface CallerSession {
  id: string;
  status: "running" | "paused" | "stopped";
  started_at: string;
  ended_at: string | null;
}

interface CurrentLead {
  id: string;
  business_name: string;
  contractor_type: string;
  city: string;
  phone: string;
  call_started_at: string;
}

interface DemoEntry {
  id: string;
  business_name: string;
  contractor_type: string;
  city: string;
  demo_time: string | null;
  called_at: string;
}

interface CallLogEntry {
  id: string;
  business_name: string;
  phone: string;
  outcome: string | null;
  duration_seconds: number | null;
  called_at: string;
  contractor_type: string;
  city: string;
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return phone || "---";
  return "***-***-" + phone.slice(-4);
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(ts: string): string {
  if (!ts) return "---";
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function outcomeBadge(outcome: string | null) {
  const base = "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider";
  switch (outcome) {
    case "demo_booked":
      return <span className={`${base} bg-emerald-500/15 text-emerald-400`}>Demo Booked</span>;
    case "voicemail":
      return <span className={`${base} bg-white/[0.06] text-[#b0b4c8]`}>Voicemail</span>;
    case "not_interested":
      return <span className={`${base} bg-red-500/15 text-red-400`}>Not Interested</span>;
    case "hung_up":
      return <span className={`${base} bg-yellow-500/15 text-yellow-400`}>Hung Up</span>;
    case "pickup":
      return <span className={`${base} bg-blue-500/15 text-blue-400`}>Pickup</span>;
    default:
      return <span className={`${base} bg-white/[0.06] text-[#b0b4c8]`}>{outcome || "---"}</span>;
  }
}

export default function CallerPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [session, setSession] = useState<CallerSession | null>(null);
  const [stats, setStats] = useState<CallerStats>({
    calls_made: 0,
    pickups: 0,
    voicemails: 0,
    not_interested: 0,
    demos_booked: 0,
  });
  const [currentLead, setCurrentLead] = useState<CurrentLead | null>(null);
  const [demos, setDemos] = useState<DemoEntry[]>([]);
  const [callLog, setCallLog] = useState<CallLogEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [commanding, setCommanding] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dialerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastDialerMsg, setLastDialerMsg] = useState<string>("");

  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
  const isAdmin = ADMIN_EMAILS.includes(email);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/caller/status");
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
      setStats(data.stats || stats);
      setCurrentLead(data.currentLead);
      setDemos(data.demos || []);
      setCallLog(data.callLog || []);
      setPendingCount(data.pendingCount || 0);
    } catch {
      /* ignore polling errors */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.push("/dashboard");
      return;
    }
    fetchStatus().then(() => setLoading(false));

    // Poll every 3 seconds
    pollRef.current = setInterval(fetchStatus, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoaded, isAdmin, router, fetchStatus]);

  // ── Dialer trigger loop ──────────────────────────────────────
  // While the campaign is RUNNING, poll /api/caller/start-call every 30
  // seconds. The endpoint will either place a call (if a lead is due AND
  // spacing / timezone / DNC checks pass) or return placed=false with a
  // reason like "spacing" or "outside_hours". The server-side queue has
  // its own 5-minute spacing so polling fast is safe — most polls will
  // just no-op until the next call is allowed.
  useEffect(() => {
    const running = session?.status === "running";

    // Clear any existing interval before deciding what to do
    if (dialerRef.current) {
      clearInterval(dialerRef.current);
      dialerRef.current = null;
    }

    if (!running) {
      setLastDialerMsg("");
      return;
    }

    async function tick() {
      try {
        const res = await fetch("/api/caller/start-call", { method: "POST" });
        const data = await res.json();
        if (data.placed) {
          setLastDialerMsg(`📞 Placing call to ${data.businessName || "lead"}…`);
          // Refresh stats immediately so the new call shows in the UI
          fetchStatus();
        } else if (data.reason === "spacing") {
          setLastDialerMsg("⏳ Waiting 5 min between calls…");
        } else if (data.reason === "outside_hours") {
          setLastDialerMsg("🕙 Outside calling hours (8am–5pm local)");
        } else if (data.reason === "empty") {
          setLastDialerMsg("📭 Queue empty — import more leads");
        } else if (data.error) {
          setLastDialerMsg(`⚠ ${data.error}${data.message ? `: ${data.message}` : ""}`);
        }
      } catch {
        setLastDialerMsg("⚠ Dialer error — retrying…");
      }
    }

    // Fire immediately on start (no 30s wait for the first attempt),
    // then every 30 seconds while running.
    tick();
    dialerRef.current = setInterval(tick, 30_000);

    return () => {
      if (dialerRef.current) {
        clearInterval(dialerRef.current);
        dialerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

  // Call duration timer
  useEffect(() => {
    if (currentLead?.call_started_at) {
      const startTime = new Date(currentLead.call_started_at).getTime();
      const tick = () => setCallTimer(Math.floor((Date.now() - startTime) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setCallTimer(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentLead]);

  async function sendCommand(action: "start" | "pause" | "stop") {
    setCommanding(true);
    try {
      const res = await fetch("/api/caller/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
      }
      await fetchStatus();
    } catch {
      /* ignore */
    }
    setCommanding(false);
    setConfirmStop(false);
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-[#b0b4c8] text-sm">
        Loading AI Caller...
      </div>
    );
  }

  if (!isAdmin) return null;

  const status = session?.status || "stopped";
  const isRunning = status === "running";
  const isPaused = status === "paused";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5" style={{ color: T.orange }} />
          <h1 className="text-lg font-bold tracking-wide" style={{ color: T.text }}>
            AI Caller
          </h1>
          {/* Status indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: isRunning ? "rgba(46,204,113,0.12)" : isPaused ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.04)",
              color: isRunning ? T.green : isPaused ? T.yellow : T.muted,
            }}>
            <span className="w-2 h-2 rounded-full" style={{
              background: isRunning ? T.green : isPaused ? T.yellow : T.muted,
            }} />
            {isRunning ? "Running" : isPaused ? "Paused" : "Stopped"}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!isRunning && !isPaused && (
            <button
              onClick={() => sendCommand("start")}
              disabled={commanding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border-none cursor-pointer transition-all disabled:opacity-50"
              style={{ background: T.green, color: "#fff" }}>
              <Play className="w-3.5 h-3.5" /> Start Campaign
            </button>
          )}
          {isPaused && (
            <button
              onClick={() => sendCommand("start")}
              disabled={commanding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border-none cursor-pointer transition-all disabled:opacity-50"
              style={{ background: T.green, color: "#fff" }}>
              <Play className="w-3.5 h-3.5" /> Resume
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => sendCommand("pause")}
              disabled={commanding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border-none cursor-pointer transition-all disabled:opacity-50"
              style={{ background: T.yellow, color: "#fff" }}>
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          )}
          {(isRunning || isPaused) && !confirmStop && (
            <button
              onClick={() => setConfirmStop(true)}
              disabled={commanding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border-none cursor-pointer transition-all disabled:opacity-50"
              style={{ background: T.red, color: "#fff" }}>
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}
          {confirmStop && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(231,76,60,0.12)", border: `1px solid ${T.red}40` }}>
              <span className="text-[11px] font-medium" style={{ color: T.red }}>Stop campaign?</span>
              <button
                onClick={() => sendCommand("stop")}
                disabled={commanding}
                className="px-3 py-1 rounded text-[11px] font-bold border-none cursor-pointer"
                style={{ background: T.red, color: "#fff" }}>
                Confirm
              </button>
              <button
                onClick={() => setConfirmStop(false)}
                className="px-3 py-1 rounded text-[11px] font-bold border-none cursor-pointer"
                style={{ background: "rgba(255,255,255,0.06)", color: T.muted }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Calls Made", value: stats.calls_made, icon: PhoneCall, color: T.orange },
          { label: "Pickups", value: stats.pickups, icon: Phone, color: T.green },
          { label: "Voicemails", value: stats.voicemails, icon: MessageSquare, color: T.muted },
          { label: "Not Interested", value: stats.not_interested, icon: PhoneMissed, color: T.red },
          { label: "Demos Booked", value: stats.demos_booked, icon: CheckCircle, color: T.green },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl p-4"
              style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                  {s.label}
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ color: T.text }}>
                {s.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Currently Calling + Schedule Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Currently Calling */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <PhoneCall className="w-4 h-4" style={{ color: T.orange }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.orange }}>
              Currently Calling
            </span>
          </div>
          {currentLead ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-base font-bold mb-1" style={{ color: T.text }}>
                  {currentLead.business_name}
                </div>
                <div className="text-xs" style={{ color: T.muted }}>
                  {currentLead.contractor_type} &middot; {currentLead.city}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: T.green }} />
                  <span className="text-sm font-mono font-bold" style={{ color: T.green }}>
                    {formatDuration(callTimer)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm" style={{ color: T.muted }}>
              {isRunning ? "Waiting for next call..." : "No active call"}
            </div>
          )}
          {isRunning && lastDialerMsg && (
            <div
              className="mt-3 text-xs"
              style={{
                color: T.muted,
                paddingTop: 10,
                borderTop: `1px solid ${T.border}`,
              }}
            >
              {lastDialerMsg}
            </div>
          )}
        </div>

        {/* Schedule */}
        <div
          className="rounded-xl p-5"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4" style={{ color: T.orange }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.orange }}>
              Schedule
            </span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: T.muted }}>
                Today&apos;s Window
              </div>
              <div className="text-sm font-medium" style={{ color: T.text }}>
                8:00 AM - 5:00 PM ET
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: T.muted }}>
                Calls Remaining
              </div>
              <div className="text-sm font-medium" style={{ color: T.text }}>
                <Users className="w-3 h-3 inline mr-1" style={{ color: T.orange }} />
                {pendingCount} leads pending
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: T.muted }}>
                Status
              </div>
              <div className="text-sm font-medium" style={{
                color: isRunning ? T.green : isPaused ? T.yellow : T.muted,
              }}>
                {isRunning ? "Dialing in progress" : isPaused ? "Campaign paused" : "Campaign stopped"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demos Booked + Call Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Demos Booked */}
        <div
          className="rounded-xl p-5"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4" style={{ color: T.green }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.green }}>
              Demos Booked Today
            </span>
            <span className="ml-auto text-xs font-bold" style={{ color: T.green }}>
              {demos.length}
            </span>
          </div>
          {demos.length === 0 ? (
            <div className="text-sm" style={{ color: T.muted }}>No demos booked yet today</div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {demos.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: "rgba(46,204,113,0.06)", border: `1px solid rgba(46,204,113,0.12)` }}>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: T.text }}>
                      {d.business_name}
                    </div>
                    <div className="text-[11px]" style={{ color: T.muted }}>
                      {d.contractor_type} &middot; {d.city}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium" style={{ color: T.green }}>
                      {d.demo_time ? new Date(d.demo_time).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }) : "TBD"}
                    </div>
                    <div className="text-[10px]" style={{ color: T.muted }}>
                      Called {formatTime(d.called_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Call Log */}
        <div
          className="rounded-xl p-5"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 mb-4">
            <PhoneOff className="w-4 h-4" style={{ color: T.orange }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.orange }}>
              Call Log
            </span>
            <span className="ml-auto text-xs font-bold" style={{ color: T.muted }}>
              {callLog.length} calls
            </span>
          </div>
          {callLog.length === 0 ? (
            <div className="text-sm" style={{ color: T.muted }}>No calls made today</div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_90px_60px_70px] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.muted }}>
                <span>Business</span>
                <span>Phone</span>
                <span>Outcome</span>
                <span>Duration</span>
                <span>Time</span>
              </div>
              {callLog.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_80px_90px_60px_70px] gap-2 px-3 py-2 rounded-lg items-center hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div>
                    <div className="text-xs font-medium truncate" style={{ color: T.text }}>
                      {c.business_name}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: T.muted }}>
                      {c.contractor_type} &middot; {c.city}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono" style={{ color: T.muted }}>
                    {maskPhone(c.phone)}
                  </span>
                  {outcomeBadge(c.outcome)}
                  <span className="text-[11px] font-mono" style={{ color: T.muted }}>
                    {formatDuration(c.duration_seconds)}
                  </span>
                  <span className="text-[11px]" style={{ color: T.muted }}>
                    {formatTime(c.called_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
