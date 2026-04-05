"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import DealPanel from "../components/DealPanel";

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

  useEffect(() => {
    fetch("/api/pipelines").then(r => r.json()).then(data => {
      const pipes = data.pipelines || [];
      setPipelines(pipes);
      const defaultPipe = pipes.find((p: Pipeline) => p.is_default) || pipes[0];
      if (defaultPipe) {
        setActivePipeline(defaultPipe.id);
      } else {
        fetch("/api/pipeline/stages").then(r => r.json()).then(d => { setStages(d.stages || []); setLoading(false); });
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

  useEffect(() => { if (activePipeline) fetchPipeline(); }, [activePipeline, fetchPipeline]);

  async function createPipeline() {
    if (!newPipelineName.trim()) return;
    const res = await fetch("/api/pipelines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newPipelineName.trim() }) });
    const data = await res.json();
    if (data.pipeline) { setPipelines(prev => [...prev, data.pipeline]); setActivePipeline(data.pipeline.id); setShowNewPipeline(false); setNewPipelineName(""); }
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
    setStages(prev => {
      const updated = prev.map(s => ({ ...s, deals: s.deals.filter(d => d.id !== dealId) }));
      const deal = prev.flatMap(s => s.deals).find(d => d.id === dealId);
      if (deal) { const target = updated.find(s => s.id === newStageId); if (target) target.deals.push({ ...deal, stage_id: newStageId }); }
      return updated;
    });
    await fetch(`/api/deals/${dealId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId: newStageId }) });
  }

  async function markDead(dealId: string) {
    const lostStage = stages.find(s => s.is_lost);
    if (!lostStage) return;
    setStages(prev => prev.map(s => ({ ...s, deals: s.deals.filter(d => d.id !== dealId) })));
    await fetch(`/api/deals/${dealId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId: lostStage.id }) });
  }

  function handleDragStart(e: React.DragEvent, dealId: string) { setDragDealId(dealId); e.dataTransfer.effectAllowed = "move"; }
  function handleDragOver(e: React.DragEvent, stageId: string) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stageId); }
  function handleDragLeave() { setDragOverStage(null); }
  function handleDrop(e: React.DragEvent, stageId: string) { e.preventDefault(); setDragOverStage(null); setDragOverDead(false); if (dragDealId) { moveDeal(dragDealId, stageId); setDragDealId(null); } }
  function handleDeadDrop(e: React.DragEvent) { e.preventDefault(); setDragOverDead(false); if (dragDealId) { markDead(dragDealId); setDragDealId(null); } }

  function daysAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days}d ago`;
  }

  function totalValue(deals: Deal[]) { return deals.reduce((sum, d) => sum + (d.value ? parseFloat(d.value) : 0), 0); }

  if (loading) return <div className="text-[#b0b4c8] py-10 text-center text-sm">Loading pipeline...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {pipelines.map(p => (
            <div key={p.id} className="flex items-center gap-0.5">
              <button onClick={() => setActivePipeline(p.id)}
                className={`px-4 py-2 rounded-md text-sm font-semibold cursor-pointer border-none transition-all duration-150 ${
                  activePipeline === p.id ? "bg-[#E86A2A]/12 text-[#E86A2A]" : "bg-transparent text-[#b0b4c8] hover:bg-white/[0.04]"
                }`}>
                {p.name}
              </button>
              {!p.is_default && (
                <button onClick={() => deletePipeline(p.id)} title="Delete pipeline"
                  className="bg-transparent border-none text-[#b0b4c8] cursor-pointer p-1 rounded opacity-50 hover:opacity-100 hover:text-red-400 transition-all">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {showNewPipeline ? (
            <div className="flex gap-1.5 items-center">
              <input value={newPipelineName} onChange={e => setNewPipelineName(e.target.value)} onKeyDown={e => e.key === "Enter" && createPipeline()}
                placeholder="Pipeline name..." autoFocus
                className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.07] rounded-md text-xs text-[#e8eaf0] outline-none w-[150px] focus:border-[#E86A2A]/40 transition-colors" />
              <button onClick={createPipeline} className="px-3 py-1.5 bg-[#E86A2A] text-white border-none rounded-md text-[11px] font-bold cursor-pointer hover:bg-[#ff7b3a] transition-colors">Add</button>
              <button onClick={() => { setShowNewPipeline(false); setNewPipelineName(""); }} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowNewPipeline(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-dashed border-white/[0.07] rounded-md text-xs text-[#b0b4c8] cursor-pointer hover:border-white/[0.15] transition-colors">
              <Plus className="w-3 h-3" /> New Pipeline
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map(stage => (
          <div key={stage.id} className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg mb-2" style={{ background: `${stage.color}18` }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
              <div className="text-xs font-bold text-[#e8eaf0]">{stage.name}</div>
              <div className="text-[11px] text-[#b0b4c8] ml-auto bg-white/[0.06] px-2 py-0.5 rounded-full">{stage.deals.length}</div>
            </div>
            {totalValue(stage.deals) > 0 && (
              <div className="text-[11px] text-[#b0b4c8] px-3 mb-1">${totalValue(stage.deals).toLocaleString()}</div>
            )}
            <div
              className={`flex flex-col gap-2 min-h-[400px] p-1 rounded-b-lg transition-all duration-200 ${
                dragOverStage === stage.id ? "bg-[#E86A2A]/[0.08] border border-dashed border-[#E86A2A]/30 rounded-lg" : ""
              }`}
              onDragOver={e => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, stage.id)}
            >
              {stage.deals.length === 0 ? (
                <div className="bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl p-6 text-center text-xs text-white/15">No leads</div>
              ) : (
                stage.deals.map(deal => (
                  <div
                    key={deal.id}
                    className={`bg-[#111] border border-white/[0.07] rounded-xl p-3.5 cursor-grab transition-all duration-150 hover:border-[#E86A2A]/30 ${
                      dragDealId === deal.id ? "opacity-50 scale-95" : ""
                    }`}
                    draggable
                    onDragStart={e => handleDragStart(e, deal.id)}
                    onDragEnd={() => setDragDealId(null)}
                    onClick={() => setSelectedDeal(deal.id)}
                  >
                    <div className="text-sm font-semibold text-[#e8eaf0] mb-0.5">
                      {[deal.first_name, deal.last_name].filter(Boolean).join(" ") || deal.title || "Untitled"}
                    </div>
                    {deal.company && <div className="text-[11px] text-[#b0b4c8] mb-2">{deal.company}</div>}
                    {deal.value && <div className="font-display text-lg text-[#E86A2A] tracking-wider">${parseFloat(deal.value).toLocaleString()}</div>}
                    <div className="text-[11px] text-[#b0b4c8] mt-2 flex justify-between items-center">
                      <span>{daysAgo(deal.created_at)}</span>
                      {deal.lead_score > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{
                          background: deal.lead_score >= 70 ? "rgba(46,204,113,0.12)" : deal.lead_score >= 40 ? "rgba(232,106,42,0.12)" : "rgba(231,76,60,0.12)",
                          color: deal.lead_score >= 70 ? "#2ecc71" : deal.lead_score >= 40 ? "#E86A2A" : "#e74c3c",
                        }}>
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

      {/* Dead Zone */}
      {dragDealId && (
        <div
          className={`fixed bottom-0 left-0 right-0 h-[70px] flex items-center justify-center gap-2.5 z-50 transition-all duration-200 text-sm font-bold ${
            dragOverDead ? "bg-red-500/20 border-t-2 border-red-500 text-red-400" : "bg-red-500/[0.08] border-t-2 border-dashed border-red-500/30 text-red-400"
          }`}
          onDragOver={e => { e.preventDefault(); setDragOverDead(true); }}
          onDragLeave={() => setDragOverDead(false)}
          onDrop={handleDeadDrop}
        >
          <Trash2 className="w-4 h-4" /> Drop here to mark as Dead
        </div>
      )}

      {selectedDeal && <DealPanel dealId={selectedDeal} onClose={() => setSelectedDeal(null)} onUpdate={fetchPipeline} />}
    </div>
  );
}
