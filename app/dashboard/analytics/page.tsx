"use client";
import { useState, useEffect, useCallback } from "react";

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
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div style={{ color: T.muted, padding: 40, textAlign: "center" }}>Loading analytics...</div>;
  if (!data) return <div style={{ color: T.red, padding: 40, textAlign: "center" }}>Failed to load analytics.</div>;

  const totalDeals = data.stageBreakdown.reduce((sum, s) => sum + s.count, 0);
  const totalValue = data.stageBreakdown.reduce((sum, s) => sum + s.totalValue, 0);
  const maxFunnelCount = Math.max(...data.funnel.map(f => f.count), 1);

  return (
    <div>
      <style>{`
        .an-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1px; margin-bottom: 24px; }
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

      <div className="an-title">PIPELINE ANALYTICS</div>

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
    </div>
  );
}
