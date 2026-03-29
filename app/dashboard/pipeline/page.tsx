"use client";

import { useEffect, useState, useCallback } from "react";
import DealPanel from "../components/DealPanel";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  surfaceAlt: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
};

interface Deal {
  id: string;
  title: string | null;
  value: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  lead_score: number;
  created_at: string;
  stage_id: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  deals: Deal[];
}

interface Pipeline { id: string; name: string; is_default: boolean; deal_count: string; }

export default function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipeline, setActivePipeline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragDealId, setDragDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [dragOverDead, setDragOverDead] = useState(false);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");

  // Load pipelines, then fetch stages for the default one
  useEffect(() => {
    fetch("/api/pipelines").then(r => r.json()).then(data => {
      const pipes = data.pipelines || [];
      setPipelines(pipes);
      const defaultPipe = pipes.find((p: Pipeline) => p.is_default) || pipes[0];
      if (defaultPipe) {
        setActivePipeline(defaultPipe.id);
      } else {
        // No pipelines exist — just load stages without filter
        fetch("/api/pipeline/stages").then(r => r.json()).then(d => {
          setStages(d.stages || []);
          setLoading(false);
        });
      }
    }).catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPipeline = useCallback(async () => {
    if (!activePipeline) return;
    const res = await fetch(`/api/pipeline/stages?pipelineId=${activePipeline}`);
    const data = await res.json();
    setStages(data.stages || []);
    setLoading(false);
  }, [activePipeline]);

  useEffect(() => {
    if (activePipeline) fetchPipeline();
  }, [activePipeline, fetchPipeline]);

  async function createPipeline() {
    if (!newPipelineName.trim()) return;
    const res = await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPipelineName.trim() }),
    });
    const data = await res.json();
    if (data.pipeline) {
      setPipelines(prev => [...prev, data.pipeline]);
      setActivePipeline(data.pipeline.id);
      setShowNewPipeline(false);
      setNewPipelineName("");
    }
  }

  async function deletePipeline(pipeId: string) {
    if (!confirm("Delete this pipeline? Deals will be moved to the default pipeline.")) return;
    const res = await fetch(`/api/pipelines/${pipeId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setPipelines(prev => prev.filter(p => p.id !== pipeId));
    const defaultPipe = pipelines.find(p => p.is_default);
    if (defaultPipe) setActivePipeline(defaultPipe.id);
  }

  async function moveDeal(dealId: string, newStageId: string) {
    // Optimistic update
    setStages(prev => {
      const updated = prev.map(s => ({
        ...s,
        deals: s.deals.filter(d => d.id !== dealId),
      }));
      const deal = prev.flatMap(s => s.deals).find(d => d.id === dealId);
      if (deal) {
        const targetStage = updated.find(s => s.id === newStageId);
        if (targetStage) {
          targetStage.deals.push({ ...deal, stage_id: newStageId });
        }
      }
      return updated;
    });

    // API call
    await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: newStageId }),
    });
  }

  async function markDead(dealId: string) {
    // Find the Closed Lost stage
    const lostStage = stages.find(s => s.is_lost);
    if (!lostStage) return;

    // Optimistic: remove from board
    setStages(prev => prev.map(s => ({
      ...s,
      deals: s.deals.filter(d => d.id !== dealId),
    })));

    // Move to Closed Lost + tag as dead
    await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: lostStage.id }),
    });
  }

  function handleDragStart(e: React.DragEvent, dealId: string) {
    setDragDealId(dealId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  }

  function handleDragLeave() {
    setDragOverStage(null);
  }

  function handleDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    setDragOverStage(null);
    setDragOverDead(false);
    if (dragDealId) {
      moveDeal(dragDealId, stageId);
      setDragDealId(null);
    }
  }

  function handleDeadDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOverDead(false);
    if (dragDealId) {
      markDead(dragDealId);
      setDragDealId(null);
    }
  }

  function daysAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days}d ago`;
  }

  function totalValue(deals: Deal[]) {
    return deals.reduce((sum, d) => sum + (d.value ? parseFloat(d.value) : 0), 0);
  }

  if (loading) {
    return <div style={{ color: T.muted, padding: 40, textAlign: "center" }}>Loading pipeline...</div>;
  }

  return (
    <div>
      <style>{`
        .pipe-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .pipe-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1px; }
        .pipe-board { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 16px; }
        .pipe-col { flex: 1; min-width: 200px; }
        .pipe-col-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px 8px 0 0; margin-bottom: 8px; }
        .pipe-col-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .pipe-col-name { font-size: 12px; font-weight: 700; color: ${T.text}; }
        .pipe-col-count { font-size: 11px; color: ${T.muted}; margin-left: auto; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 10px; }
        .pipe-col-body { display: flex; flex-direction: column; gap: 8px; min-height: 400px; padding: 4px; border-radius: 0 0 8px 8px; transition: background 0.2s; }
        .pipe-col-body.drag-over { background: rgba(232,106,42,0.08); border: 1px dashed rgba(232,106,42,0.3); border-radius: 8px; }
        .pipe-empty { background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08); border-radius: 10px; padding: 24px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.15); }
        .pipe-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 14px; cursor: grab; transition: border-color 0.2s, transform 0.15s, opacity 0.15s; }
        .pipe-card:hover { border-color: rgba(232,106,42,0.3); }
        .pipe-card.dragging { opacity: 0.5; transform: scale(0.95); }
        .pipe-card-name { font-size: 14px; font-weight: 600; color: ${T.text}; margin-bottom: 2px; }
        .pipe-card-company { font-size: 11px; color: ${T.muted}; margin-bottom: 8px; }
        .pipe-card-val { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: ${T.orange}; letter-spacing: 0.5px; }
        .pipe-card-meta { font-size: 11px; color: ${T.muted}; margin-top: 8px; display: flex; justify-content: space-between; align-items: center; }
        .pipe-card-score { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 10px; font-weight: 700; }
        .pipe-total { font-size: 11px; color: ${T.muted}; margin-top: 4px; padding: 0 12px; }
        .pipe-dead-zone { position: fixed; bottom: 0; left: 0; right: 0; height: 70px; display: flex; align-items: center; justify-content: center; gap: 10px; background: rgba(231,76,60,0.08); border-top: 2px dashed rgba(231,76,60,0.3); z-index: 50; transition: all 0.2s; font-size: 14px; font-weight: 700; color: ${T.red}; }
        .pipe-dead-zone.drag-over { background: rgba(231,76,60,0.2); border-top-color: ${T.red}; }
        .pipe-dead-zone.hidden { display: none; }
      `}</style>

      <div className="pipe-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {pipelines.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button
                onClick={() => setActivePipeline(p.id)}
                style={{
                  padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                  background: activePipeline === p.id ? "rgba(232,106,42,0.12)" : "transparent",
                  color: activePipeline === p.id ? T.orange : T.muted,
                  transition: "all 0.15s",
                }}
              >
                {p.name}
              </button>
              {!p.is_default && (
                <button
                  onClick={() => deletePipeline(p.id)}
                  style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 12, padding: "4px 6px", borderRadius: 4, opacity: 0.5, transition: "opacity 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = T.red; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.color = T.muted; }}
                  title="Delete pipeline"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {showNewPipeline ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={newPipelineName}
                onChange={e => setNewPipelineName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createPipeline()}
                placeholder="Pipeline name..."
                autoFocus
                style={{ padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, color: T.text, outline: "none", width: 150 }}
              />
              <button onClick={createPipeline} style={{ padding: "6px 12px", background: T.orange, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Add</button>
              <button onClick={() => { setShowNewPipeline(false); setNewPipelineName(""); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewPipeline(true)}
              style={{ padding: "6px 12px", background: "none", border: `1px dashed ${T.border}`, borderRadius: 6, fontSize: 12, color: T.muted, cursor: "pointer" }}
            >
              + New Pipeline
            </button>
          )}
        </div>
      </div>

      <div className="pipe-board">
        {stages.map(stage => (
          <div key={stage.id} className="pipe-col">
            <div className="pipe-col-header" style={{ background: `${stage.color}18` }}>
              <div className="pipe-col-dot" style={{ background: stage.color }} />
              <div className="pipe-col-name">{stage.name}</div>
              <div className="pipe-col-count">{stage.deals.length}</div>
            </div>
            {totalValue(stage.deals) > 0 && (
              <div className="pipe-total">${totalValue(stage.deals).toLocaleString()}</div>
            )}
            <div
              className={`pipe-col-body ${dragOverStage === stage.id ? "drag-over" : ""}`}
              onDragOver={e => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, stage.id)}
            >
              {stage.deals.length === 0 ? (
                <div className="pipe-empty">No leads</div>
              ) : (
                stage.deals.map(deal => (
                  <div
                    key={deal.id}
                    className={`pipe-card ${dragDealId === deal.id ? "dragging" : ""}`}
                    draggable
                    onDragStart={e => handleDragStart(e, deal.id)}
                    onDragEnd={() => setDragDealId(null)}
                    onClick={() => setSelectedDeal(deal.id)}
                  >
                    <div className="pipe-card-name">
                      {[deal.first_name, deal.last_name].filter(Boolean).join(" ") || deal.title || "Untitled"}
                    </div>
                    {deal.company && <div className="pipe-card-company">{deal.company}</div>}
                    {deal.value && (
                      <div className="pipe-card-val">${parseFloat(deal.value).toLocaleString()}</div>
                    )}
                    <div className="pipe-card-meta">
                      <span>{daysAgo(deal.created_at)}</span>
                      {deal.lead_score > 0 && (
                        <span
                          className="pipe-card-score"
                          style={{
                            background: deal.lead_score >= 70 ? `${T.green}20` : deal.lead_score >= 40 ? `${T.orange}20` : `${T.red}20`,
                            color: deal.lead_score >= 70 ? T.green : deal.lead_score >= 40 ? T.orange : T.red,
                          }}
                        >
                          {deal.lead_score}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dead Zone — appears when dragging */}
      <div
        className={`pipe-dead-zone ${!dragDealId ? "hidden" : ""} ${dragOverDead ? "drag-over" : ""}`}
        onDragOver={e => { e.preventDefault(); setDragOverDead(true); }}
        onDragLeave={() => setDragOverDead(false)}
        onDrop={handleDeadDrop}
      >
        🗑️ Drop here to mark as Dead
      </div>

      {/* Deal Detail Panel */}
      {selectedDeal && (
        <DealPanel
          dealId={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={fetchPipeline}
        />
      )}
    </div>
  );
}
