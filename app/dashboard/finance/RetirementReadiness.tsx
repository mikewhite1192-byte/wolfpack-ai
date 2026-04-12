"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Target, Award, AlertCircle, Sliders, Clock } from "lucide-react";
import {
  retirementNumber, futureValue, monthlyContributionNeeded,
  runMonteCarlo, costOfWaiting, getMilestones,
} from "@/lib/finance/retirement-engine";

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
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function RetirementReadiness() {
  // Setup inputs
  const [currentAge, setCurrentAge] = useState(30);
  const [targetAge, setTargetAge] = useState(65);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [monthlyContrib, setMonthlyContrib] = useState(500);
  const [annualSpend, setAnnualSpend] = useState(60000);
  const [socialSecurity, setSocialSecurity] = useState(1500); // monthly
  const [returnRate, setReturnRate] = useState(0.07);

  const yearsToRetirement = Math.max(1, targetAge - currentAge);
  const yearsInRetirement = 30;

  // Calculations
  const myRetirementNumber = useMemo(
    () => retirementNumber(annualSpend, socialSecurity * 12),
    [annualSpend, socialSecurity],
  );

  const projectedBalance = useMemo(
    () => futureValue(currentBalance, monthlyContrib, returnRate, yearsToRetirement),
    [currentBalance, monthlyContrib, returnRate, yearsToRetirement],
  );

  const gap = myRetirementNumber - projectedBalance;
  const onTrackPct = Math.min(100, (projectedBalance / myRetirementNumber) * 100);
  const isOnTrack = gap <= 0;

  const neededMonthly = useMemo(
    () => monthlyContributionNeeded(currentBalance, myRetirementNumber, returnRate, yearsToRetirement),
    [currentBalance, myRetirementNumber, returnRate, yearsToRetirement],
  );

  const annualWithdrawal = annualSpend - socialSecurity * 12;
  const monteCarlo = useMemo(
    () => runMonteCarlo(currentBalance, monthlyContrib, yearsToRetirement, yearsInRetirement, annualWithdrawal, returnRate),
    [currentBalance, monthlyContrib, yearsToRetirement, yearsInRetirement, annualWithdrawal, returnRate],
  );

  const waitingCost = useMemo(
    () => costOfWaiting(monthlyContrib, returnRate, yearsToRetirement),
    [monthlyContrib, returnRate, yearsToRetirement],
  );

  const milestones = useMemo(
    () => getMilestones(currentBalance, myRetirementNumber),
    [currentBalance, myRetirementNumber],
  );

  const nextMilestone = milestones.find((m) => !m.reached);

  return (
    <div>
      {/* Setup inputs */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Your Retirement Setup</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
          {[
            { label: "Current Age", value: currentAge, set: setCurrentAge, min: 18, max: 75, step: 1 },
            { label: "Target Retirement Age", value: targetAge, set: setTargetAge, min: 40, max: 80, step: 1 },
            { label: "Current Savings ($)", value: currentBalance, set: setCurrentBalance, min: 0, max: 5000000, step: 1000 },
            { label: "Monthly Contribution ($)", value: monthlyContrib, set: setMonthlyContrib, min: 0, max: 5000, step: 50 },
            { label: "Annual Lifestyle ($)", value: annualSpend, set: setAnnualSpend, min: 20000, max: 200000, step: 5000 },
            { label: "Social Security ($/mo)", value: socialSecurity, set: setSocialSecurity, min: 0, max: 4000, step: 100 },
          ].map((input) => (
            <div key={input.label}>
              <label style={{ fontSize: 10, color: T.muted, display: "block", marginBottom: 4, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{input.label}</label>
              <input type="number" value={input.value} onChange={(e) => input.set(Number(e.target.value))} min={input.min} max={input.max} step={input.step}
                style={{ width: "100%", padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 14, fontWeight: 700 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Your Number + Projection */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(myRetirementNumber)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Your Retirement Number</div>
          <div style={{ fontSize: 10, color: T.muted }}>25x ({fmt(annualSpend)} - {fmt(socialSecurity * 12)} SS)</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: isOnTrack ? T.green : T.yellow, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(projectedBalance)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Projected at {targetAge}</div>
          <div style={{ fontSize: 10, color: T.muted }}>{fmt(monthlyContrib)}/mo × {yearsToRetirement} years @ {(returnRate * 100).toFixed(0)}%</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${isOnTrack ? T.green : T.red}30`, borderRadius: 12, padding: 22, textAlign: "center" }}>
          {isOnTrack ? (
            <>
              <div style={{ fontSize: 36, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>ON TRACK</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.green }}>You're {fmt(Math.abs(gap))} ahead</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 36, fontWeight: 700, color: T.red, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(gap)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Gap to Close</div>
              <div style={{ fontSize: 10, color: T.muted }}>Need {fmt(neededMonthly)}/mo to close</div>
            </>
          )}
        </div>
      </div>

      {/* Retirement age slider */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Sliders style={{ width: 16, height: 16, color: T.blue }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: "uppercase" }}>Retirement Age Slider</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: T.muted }}>45</span>
          <input type="range" min={45} max={75} value={targetAge} onChange={(e) => setTargetAge(parseInt(e.target.value))} style={{ flex: 1, accentColor: T.blue }} />
          <span style={{ fontSize: 12, color: T.muted }}>75</span>
        </div>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <span style={{ fontSize: 48, fontWeight: 700, color: T.blue, fontFamily: "'Bebas Neue', sans-serif" }}>{targetAge}</span>
          <span style={{ fontSize: 14, color: T.muted, marginLeft: 8 }}>years old · {yearsToRetirement} years from now</span>
        </div>
        <div style={{ textAlign: "center", fontSize: 13, color: onTrackPct >= 100 ? T.green : T.yellow, marginTop: 8 }}>
          {onTrackPct.toFixed(0)}% funded at age {targetAge}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Monte Carlo */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.green, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Monte Carlo Simulation</div>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: monteCarlo.successRate >= 80 ? T.green : monteCarlo.successRate >= 60 ? T.yellow : T.red, fontFamily: "'Bebas Neue', sans-serif" }}>
              {monteCarlo.successRate.toFixed(0)}%
            </div>
            <div style={{ fontSize: 12, color: T.muted }}>success rate across {monteCarlo.simulations} simulations</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.muted }}>Best case (90th pct)</span>
              <span style={{ color: T.green }}>{fmt(monteCarlo.bestCase)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.muted }}>Expected (50th pct)</span>
              <span style={{ color: T.text }}>{fmt(monteCarlo.medianBalance)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.muted }}>Worst case (10th pct)</span>
              <span style={{ color: T.red }}>{fmt(monteCarlo.worstCase)}</span>
            </div>
          </div>
        </div>

        {/* Cost of Waiting */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Clock style={{ width: 14, height: 14, color: T.red }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: T.red, letterSpacing: 1.5, textTransform: "uppercase" }}>Cost of Waiting</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={waitingCost}>
              <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="projectedBalance" fill={T.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {waitingCost.length > 1 && (
            <div style={{ textAlign: "center", fontSize: 12, color: T.red, marginTop: 8 }}>
              Waiting 1 year costs you {fmt(waitingCost[1]?.costOfDelay || 0)} at retirement
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Award style={{ width: 16, height: 16, color: T.orange }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase" }}>Milestones</div>
          {nextMilestone && (
            <div style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>Next: {nextMilestone.label} ({nextMilestone.progressPct.toFixed(0)}%)</div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {milestones.map((m) => (
            <div key={m.label} style={{ padding: "12px 14px", background: m.reached ? "rgba(46,204,113,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${m.reached ? "rgba(46,204,113,0.2)" : T.border}`, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: m.reached ? T.green : T.text }}>{m.label}</span>
                {m.reached && <span style={{ fontSize: 10, color: T.green }}>✓</span>}
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>{fmt(m.target)}</div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div style={{ height: 4, borderRadius: 2, width: `${Math.min(100, m.progressPct)}%`, background: m.reached ? T.green : T.orange, transition: "width 0.3s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
