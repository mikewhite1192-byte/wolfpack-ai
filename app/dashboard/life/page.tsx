"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Edit3, Dumbbell, Moon } from "lucide-react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  yellow: "#f5a623",
  blue: "#3B82F6",
  bg: "#0a0a0a",
};

const ADMIN_EMAILS = ["info@thewolfpackco.com", "mikewhite1192@gmail.com"];

interface DayData {
  steps?: number;
  gym?: boolean;
  weight?: number;
  meals?: string;
  reading?: string;
  gratitude?: string;
  affirmation?: string;
}

interface Goals {
  workouts: number;
  targetWeight: number;
}

interface HealthData {
  days: Record<string, DayData>;
  goals: Goals;
}

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dayScore(d: DayData | undefined): number {
  if (!d) return 0;
  let score = 0;
  if (d.steps && d.steps > 0) score++;
  if (d.gym !== undefined) score++;
  if (d.weight && d.weight > 0) score++;
  if (d.meals?.trim()) score++;
  if (d.reading?.trim()) score++;
  if (d.gratitude?.trim()) score++;
  if (d.affirmation?.trim()) score++;
  return score;
}

function scoreColor(score: number): string {
  if (score >= 5) return T.green;
  if (score >= 3) return T.yellow;
  if (score >= 1) return T.blue;
  return "transparent";
}

// Data loaded from Neon DB via /api/health, not localStorage

type View = "month" | "day" | "goals";

export default function LifePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
  const isAdmin = isLoaded && ADMIN_EMAILS.includes(email);

  const [view, setView] = useState<View>("month");
  const [currentMonth, setCurrentMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [data, setData] = useState<HealthData>({ days: {}, goals: { workouts: 20, targetWeight: 180 } });
  const [dayForm, setDayForm] = useState<DayData>({});
  const [goalsForm, setGoalsForm] = useState<Goals>({ workouts: 20, targetWeight: 180 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isLoaded && !isAdmin) router.push("/dashboard");
  }, [isLoaded, isAdmin, router]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/health?year=${currentMonth.year}&month=${currentMonth.month + 1}`);
      const d = await res.json();
      setData({
        days: d.days || {},
        goals: {
          workouts: d.goals?.workouts || 20,
          targetWeight: parseFloat(String(d.goals?.target_weight)) || 180,
        },
      });
      setGoalsForm({
        workouts: d.goals?.workouts || 20,
        targetWeight: parseFloat(String(d.goals?.target_weight)) || 180,
      });
    } catch { /* silent */ }
  }, [currentMonth.year, currentMonth.month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { year, month } = currentMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month).toLocaleString("en-US", { month: "long", year: "numeric" });
  const todayKey = dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  // Stats for the month
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => dateKey(year, month, i + 1));
  const loggedDays = monthDays.filter((k) => dayScore(data.days[k]) > 0);
  const workoutsThisMonth = monthDays.filter((k) => data.days[k]?.gym === true).length;
  const totalSteps = monthDays.reduce((s, k) => s + (data.days[k]?.steps || 0), 0);
  const stepsGoal = daysInMonth * 10000;
  const latestWeight = [...monthDays].reverse().find((k) => data.days[k]?.weight)
    ? data.days[[...monthDays].reverse().find((k) => data.days[k]?.weight)!]?.weight
    : null;

  function openDay(key: string) {
    setSelectedDay(key);
    setDayForm(data.days[key] || {});
    setView("day");
    setSaved(false);
  }

  async function saveDay() {
    try {
      await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_day", date: selectedDay, ...dayForm }),
      });
      setData((prev) => ({ ...prev, days: { ...prev.days, [selectedDay]: dayForm } }));
      setSaved(true);
      setTimeout(() => { setView("month"); setSaved(false); fetchData(); }, 700);
    } catch { /* silent */ }
  }

  async function saveGoals() {
    try {
      await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_goals", workouts: goalsForm.workouts, target_weight: goalsForm.targetWeight }),
      });
      setData((prev) => ({ ...prev, goals: goalsForm }));
      setView("month");
    } catch { /* silent */ }
  }

  function prevMonth() {
    setCurrentMonth((p) => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  }
  function nextMonth() {
    setCurrentMonth((p) => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  }

  if (!isLoaded) return <div style={{ textAlign: "center", padding: 80, color: T.muted }}>Loading...</div>;
  if (!isAdmin) return null;

  const inputStyle = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, fontFamily: "inherit" };
  const labelStyle = { fontSize: 11, fontWeight: 700 as const, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: T.muted, marginBottom: 6, display: "block" as const, fontFamily: "monospace" };

  // ═══════════════════════════════════════════════════════════════
  // GOALS VIEW
  // ═══════════════════════════════════════════════════════════════
  if (view === "goals") {
    return (
      <div>
        <button onClick={() => setView("month")} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", padding: "0 0 16px", display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> {monthName}
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: "0 0 24px" }}>Edit Goals</h2>
        <div style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Workout goal (sessions/month)</label>
            <input type="number" value={goalsForm.workouts} onChange={(e) => setGoalsForm({ ...goalsForm, workouts: parseInt(e.target.value) || 0 })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Target weight (lbs)</label>
            <input type="number" value={goalsForm.targetWeight} onChange={(e) => setGoalsForm({ ...goalsForm, targetWeight: parseInt(e.target.value) || 0 })} style={inputStyle} />
          </div>
          <button onClick={saveGoals} style={{ padding: "12px 0", fontSize: 14, fontWeight: 700, background: T.orange, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", width: "100%" }}>
            Save Goals
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DAY VIEW
  // ═══════════════════════════════════════════════════════════════
  if (view === "day") {
    const dayDate = new Date(selectedDay + "T12:00:00");
    const dayOfWeek = dayDate.toLocaleDateString("en-US", { weekday: "long" });
    const dayDisplay = dayDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    return (
      <div>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <button onClick={() => setView("month")} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", padding: "0 0 8px", display: "flex", alignItems: "center", gap: 4 }}>
            <ChevronLeft style={{ width: 14, height: 14 }} /> {monthName}
          </button>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>{dayOfWeek}</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: "0 0 24px" }}>{dayDisplay}</h2>
        </div>

        <div style={{ maxWidth: 500, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Gym toggle */}
          <div>
            <label style={labelStyle}>Gym Session</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setDayForm({ ...dayForm, gym: true })}
                style={{ padding: "12px 0", fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: dayForm.gym === true ? `${T.green}20` : "rgba(255,255,255,0.04)", border: `1px solid ${dayForm.gym === true ? T.green : T.border}`, color: dayForm.gym === true ? T.green : T.muted }}>
                <Dumbbell style={{ width: 14, height: 14 }} /> Went
              </button>
              <button onClick={() => setDayForm({ ...dayForm, gym: false })}
                style={{ padding: "12px 0", fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: dayForm.gym === false ? `${T.red}20` : "rgba(255,255,255,0.04)", border: `1px solid ${dayForm.gym === false ? T.red : T.border}`, color: dayForm.gym === false ? T.red : T.muted }}>
                <Moon style={{ width: 14, height: 14 }} /> Rest day
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Steps</label>
            <input type="number" placeholder="0" value={dayForm.steps || ""} onChange={(e) => setDayForm({ ...dayForm, steps: parseInt(e.target.value) || 0 })} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Weight (lbs)</label>
            <input type="number" step="0.1" placeholder="0" value={dayForm.weight || ""} onChange={(e) => setDayForm({ ...dayForm, weight: parseFloat(e.target.value) || 0 })} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Meals</label>
            <textarea rows={2} placeholder="What did you eat today?" value={dayForm.meals || ""} onChange={(e) => setDayForm({ ...dayForm, meals: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div>
            <label style={labelStyle}>Reading</label>
            <textarea rows={2} placeholder="What did you read today?" value={dayForm.reading || ""} onChange={(e) => setDayForm({ ...dayForm, reading: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div>
            <label style={labelStyle}>Gratitude</label>
            <textarea rows={2} placeholder="What are you grateful for?" value={dayForm.gratitude || ""} onChange={(e) => setDayForm({ ...dayForm, gratitude: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div>
            <label style={labelStyle}>Affirmation</label>
            <textarea rows={2} placeholder="I am..." value={dayForm.affirmation || ""} onChange={(e) => setDayForm({ ...dayForm, affirmation: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <button onClick={saveDay}
            style={{ padding: "14px 0", fontSize: 14, fontWeight: 700, borderRadius: 8, cursor: "pointer", width: "100%", border: "none", background: saved ? T.green : T.orange, color: "#fff", transition: "background 0.3s" }}>
            {saved ? "✓ Saved" : "Save Day"}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MONTH VIEW (default)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: "0 0 16px" }}>Health</h2>

      {/* Stats card */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 20, position: "relative" }}>
        <button onClick={() => { setGoalsForm(data.goals); setView("goals"); }}
          style={{ position: "absolute", top: 16, right: 16, padding: "6px 14px", fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Edit3 style={{ width: 12, height: 12 }} /> Edit goals
        </button>

        {/* Weight */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
            {latestWeight || "—"}
          </span>
          <span style={{ fontSize: 14, color: T.muted, marginLeft: 6 }}>lbs</span>
          {data.goals.targetWeight > 0 && (
            <span style={{ fontSize: 12, color: T.muted, marginLeft: 12 }}>
              Goal: {data.goals.targetWeight} lbs
              {latestWeight && (
                <span style={{ color: latestWeight <= data.goals.targetWeight ? T.green : T.yellow, marginLeft: 6 }}>
                  ({latestWeight <= data.goals.targetWeight ? "✓ At goal" : `${(latestWeight - data.goals.targetWeight).toFixed(1)} to go`})
                </span>
              )}
            </span>
          )}
        </div>

        {/* Workouts progress */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginBottom: 4 }}>
            <span>Workouts</span>
            <span>{workoutsThisMonth} / {data.goals.workouts}</span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
            <div style={{ height: 5, borderRadius: 3, background: T.green, width: `${Math.min(100, (workoutsThisMonth / Math.max(1, data.goals.workouts)) * 100)}%`, transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Steps progress */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginBottom: 4 }}>
            <span>Steps</span>
            <span>{totalSteps.toLocaleString()} / {stepsGoal.toLocaleString()}</span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
            <div style={{ height: 5, borderRadius: 3, background: T.blue, width: `${Math.min(100, (totalSteps / stepsGoal) * 100)}%`, transition: "width 0.3s" }} />
          </div>
        </div>
      </div>

      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 6 }}>
          <ChevronLeft style={{ width: 18, height: 18 }} />
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{monthName}</div>
        <button onClick={nextMonth} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 6 }}>
          <ChevronRight style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 4 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 11, fontFamily: "monospace", color: T.muted, padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {/* Empty cells before month start */}
        {Array.from({ length: firstDayOfWeek }, (_, i) => (
          <div key={`empty-${i}`} style={{ aspectRatio: "1", borderRadius: 8 }} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = dateKey(year, month, day);
          const dayData = data.days[key];
          const score = dayScore(dayData);
          const color = scoreColor(score);
          const isToday = key === todayKey;

          return (
            <button
              key={day}
              onClick={() => openDay(key)}
              style={{
                aspectRatio: "1",
                borderRadius: 8,
                background: score > 0 ? `${color}12` : "rgba(255,255,255,0.02)",
                border: `1px solid ${isToday ? T.orange : score > 0 ? `${color}30` : T.border}`,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                transition: "all 0.15s",
                position: "relative",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: score > 0 ? color : T.muted }}>{day}</span>
              {score > 0 && (
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({ length: Math.min(score, 5) }, (_, j) => (
                    <div key={j} style={{ width: 3, height: 3, borderRadius: "50%", background: color }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 16, fontSize: 11, fontFamily: "monospace", color: T.muted }}>
        {[
          { label: "1–2 items", color: T.blue },
          { label: "3–4 items", color: T.yellow },
          { label: "5+ items", color: T.green },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
