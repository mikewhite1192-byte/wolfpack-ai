"use client";
import { useState, useEffect, useCallback } from "react";
import { GripVertical, X, Mail, MapPin, Check } from "lucide-react";

interface Stage { id?: string; name: string; color: string; isWon: boolean; isLost: boolean; }
interface Pipeline { id: string; name: string; }
interface GbpConnection { id: string; connected_email: string | null; connected: boolean; location_name: string | null; auto_post_enabled: boolean; auto_review_reply_enabled: boolean; monthly_report_enabled: boolean; report_phone: string | null; }
interface Template { name: string; subject?: string; body: string; }

const STAGE_COLORS = ["#3498db", "#9b59b6", "#E86A2A", "#f39c12", "#2ecc71", "#e74c3c", "#1abc9c", "#e67e22"];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-[#E86A2A] tracking-[1.5px] uppercase mb-4">{children}</div>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#111] border border-white/[0.07] rounded-xl p-6 mb-4 ${className}`}>{children}</div>;
}

function SaveBar({ section, saved, saving, onClick }: { section: string; saved: string; saving: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end items-center gap-2.5 mt-4">
      {saved === section && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
      <button onClick={onClick} disabled={saving}
        className={`px-5 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer transition-colors ${saving ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
        {saving ? "Saving..." : `Save ${section === "stages" ? "Stages" : section === "smsTemplates" ? "Templates" : section === "emailTemplates" ? "Templates" : section === "aiAgent" ? "AI Agent Settings" : "Account"} →`}
      </button>
    </div>
  );
}

const inputClass = "w-full px-3.5 py-2.5 bg-[#111] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors";
const textareaClass = `${inputClass} resize-y min-h-[100px]`;
const labelClass = "text-xs text-[#b0b4c8] font-semibold mb-1.5 block";

export default function SettingsPage() {
  const [settingsTab, setSettingsTab] = useState<"pipeline" | "sms" | "email" | "account" | "aiAgent">("aiAgent");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [allStages, setAllStages] = useState<Record<string, Stage[]>>({});
  const [newStage, setNewStage] = useState("");
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [gbpConnections, setGbpConnections] = useState<GbpConnection[]>([]);
  const [smsTemplates, setSmsTemplates] = useState<Template[]>([{ name: "New Lead", body: "" }, { name: "Follow Up", body: "" }, { name: "Qualified", body: "" }]);
  const [emailTemplates, setEmailTemplates] = useState<Template[]>([{ name: "New Lead", subject: "", body: "" }, { name: "Follow Up", subject: "", body: "" }, { name: "Proposal", subject: "", body: "" }]);
  const [account, setAccount] = useState({ name: "", ownerName: "", phone: "", email: "" });
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reports, setReports] = useState<{ id: string; type: string; content: string; created_at: string }[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    enabled: true, businessName: "", businessType: "", services: "", serviceArea: "", uniqueValue: "",
    pricing: "Contact us for a free estimate", bookingLink: "", bookingInstructions: "",
    businessHours: "Monday-Friday 8am-6pm", tone: "friendly" as "professional" | "friendly" | "casual",
    ownerName: "", commonObjections: "", qualifyingQuestions: "", googleReviewLink: "",
    autoGoogleMeet: false, followUpEnabled: true, followUpHours: [24, 72, 168, 336] as number[],
  });

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/settings"); const data = await res.json();
    if (data.pipelines) { setPipelines(data.pipelines); if (data.pipelines.length > 0 && !selectedPipelineId) setSelectedPipelineId(data.pipelines[0].id); }
    if (data.stages) {
      const grouped: Record<string, Stage[]> = {};
      for (const s of data.stages) { const pid = s.pipeline_id || "default"; if (!grouped[pid]) grouped[pid] = []; grouped[pid].push({ id: s.id, name: s.name, color: s.color || "#3498db", isWon: s.is_won, isLost: s.is_lost }); }
      setAllStages(grouped); setStages(grouped[selectedPipelineId || data.pipelines?.[0]?.id || "default"] || []);
    }
    if (data.gbpConnections) setGbpConnections(data.gbpConnections);
    if (data.smsTemplates?.length > 0) setSmsTemplates(["New Lead", "Follow Up", "Qualified"].map(name => { const e = data.smsTemplates.find((t: { name: string }) => t.name === name); return { name, body: e?.body || "" }; }));
    if (data.emailTemplates?.length > 0) setEmailTemplates(["New Lead", "Follow Up", "Proposal"].map(name => { const e = data.emailTemplates.find((t: { name: string }) => t.name === name); return { name, subject: e?.subject || "", body: e?.body || "" }; }));
    if (data.workspace) {
      const b = data.workspace.branding || {};
      setAccount({ name: data.workspace.name || "", ownerName: b.ownerName || "", phone: b.phone || "", email: b.email || "" });
      setGmailConnected(!!data.workspace.gmail_connected); setGmailEmail(data.workspace.gmail_email || null);
      if (data.workspace.ai_config) setAiConfig(prev => ({ ...prev, ...data.workspace.ai_config }));
    }
    try { const rRes = await fetch("/api/ai-agent/daily-report"); const rData = await rRes.json(); if (rData.reports) setReports(rData.reports); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function saveSection(section: string, payload: Record<string, unknown>) { setSaving(true); await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section, ...payload }) }); setSaving(false); setSaved(section); setTimeout(() => setSaved(""), 2000); }
  function addStage() { if (newStage.trim()) { setStages(s => [...s, { name: newStage.trim(), color: STAGE_COLORS[s.length % STAGE_COLORS.length], isWon: false, isLost: false }]); setNewStage(""); } }
  async function disconnectGmail() { setDisconnecting(true); await fetch("/api/email/disconnect", { method: "POST" }); setGmailConnected(false); setGmailEmail(null); setDisconnecting(false); }
  async function generateReport(type: "morning" | "eod") { setGeneratingReport(true); try { const res = await fetch("/api/ai-agent/daily-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) }); const data = await res.json(); if (data.report) setReports(prev => [{ id: Date.now().toString(), type, content: data.report, created_at: new Date().toISOString() }, ...prev]); } catch {} setGeneratingReport(false); }

  function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
      <div onClick={onClick} className={`w-10 h-[22px] rounded-full cursor-pointer transition-colors relative flex-shrink-0 ${on ? "bg-emerald-400" : "bg-white/10"}`}>
        <div className={`w-[18px] h-[18px] rounded-full bg-white absolute top-0.5 transition-all ${on ? "left-5" : "left-0.5"}`} />
      </div>
    );
  }

  if (loading) return <div className="text-[#b0b4c8] py-10 text-center">Loading settings...</div>;

  const TABS = [["aiAgent", "AI Sales Agent"], ["pipeline", "Pipeline Stages"], ["sms", "SMS Templates"], ["email", "Email Templates"], ["account", "Account"]] as const;

  return (
    <div>
      <div className="font-display text-[28px] text-[#e8eaf0] tracking-wide mb-6">SETTINGS</div>

      <div className="flex gap-1 bg-[#111] border border-white/[0.07] rounded-xl p-1 mb-6 w-fit flex-wrap">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setSettingsTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer border-none transition-all ${settingsTab === key ? "bg-[#E86A2A] text-white" : "bg-transparent text-[#b0b4c8] hover:text-[#e8eaf0]"}`}>{label}</button>
        ))}
      </div>

      {/* ── Pipeline ── */}
      {settingsTab === "pipeline" && (<>
        <Card>
          <SectionTitle>Select Pipeline</SectionTitle>
          <div className="flex gap-2 flex-wrap">
            {pipelines.map(p => (
              <button key={p.id} onClick={() => { setSelectedPipelineId(p.id); setStages(allStages[p.id] || []); setEditingStage(null); }}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border transition-all ${selectedPipelineId === p.id ? "border-[#E86A2A] bg-[#E86A2A]/15 text-[#E86A2A]" : "border-white/[0.07] bg-[#111] text-[#e8eaf0] hover:border-white/[0.15]"}`}>{p.name}</button>
            ))}
          </div>
        </Card>
        <Card>
          <div className="flex justify-between items-center mb-4">
            <SectionTitle>{pipelines.find(p => p.id === selectedPipelineId)?.name || "Pipeline"} — Stages</SectionTitle>
            <div className="text-[11px] text-[#b0b4c8]">Drag to reorder</div>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {stages.map((s, i) => (
              <div key={i} draggable onDragStart={() => setDragIdx(i)} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragIdx === null || dragIdx === i) return; const r = [...stages]; const [m] = r.splice(dragIdx, 1); r.splice(i, 0, m); setStages(r); setDragIdx(null); }} onDragEnd={() => setDragIdx(null)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 bg-[#111] border border-white/[0.07] rounded-lg cursor-grab transition-opacity ${dragIdx === i ? "opacity-50" : ""}`}>
                <GripVertical className="w-3.5 h-3.5 text-[#b0b4c8]" />
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {editingStage === i ? (
                  <input className={`${inputClass} flex-1 !py-1 !px-2 text-sm`} value={s.name} autoFocus onChange={e => { const u = [...stages]; u[i] = { ...s, name: e.target.value }; setStages(u); }} onBlur={() => setEditingStage(null)} onKeyDown={e => e.key === "Enter" && setEditingStage(null)} />
                ) : (
                  <span className="flex-1 text-sm text-[#e8eaf0] cursor-text" onClick={() => setEditingStage(i)}>{s.name}</span>
                )}
                <button onClick={() => { const u = [...stages]; u[i] = { ...s, isWon: !s.isWon, isLost: false }; setStages(u); }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer border-none ${s.isWon ? "bg-emerald-400/20 text-emerald-400" : "bg-white/5 text-[#b0b4c8]"}`}>Won</button>
                <button onClick={() => { const u = [...stages]; u[i] = { ...s, isLost: !s.isLost, isWon: false }; setStages(u); }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer border-none ${s.isLost ? "bg-red-400/20 text-red-400" : "bg-white/5 text-[#b0b4c8]"}`}>Lost</button>
                <button onClick={() => setStages(st => st.filter((_, j) => j !== i))} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inputClass} placeholder="Add new stage..." value={newStage} onChange={e => setNewStage(e.target.value)} onKeyDown={e => e.key === "Enter" && addStage()} />
            <button onClick={addStage} className="px-5 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer hover:bg-[#ff7b3a] transition-colors">Add</button>
          </div>
          <SaveBar section="stages" saved={saved} saving={saving} onClick={() => saveSection("stages", { stages, pipelineId: selectedPipelineId })} />
        </Card>
      </>)}

      {/* ── SMS Templates ── */}
      {settingsTab === "sms" && (
        <Card>
          <SectionTitle>SMS Templates</SectionTitle>
          <div className="text-[11px] text-[#b0b4c8] mb-4">
            Variables: {["first_name", "last_name", "business_name", "agent_name"].map(v => <span key={v} className="inline-block bg-[#E86A2A]/10 border border-[#E86A2A]/20 rounded px-1.5 py-0.5 font-mono text-[11px] text-[#E86A2A] mx-0.5">{`{{${v}}}`}</span>)}
          </div>
          {smsTemplates.map((t, i) => (
            <div key={t.name} className="mt-4">
              <label className={labelClass}>{t.name} SMS</label>
              <textarea className={textareaClass} placeholder={`Write your ${t.name.toLowerCase()} SMS template...`} value={t.body} onChange={e => { const u = [...smsTemplates]; u[i] = { ...t, body: e.target.value }; setSmsTemplates(u); }} />
            </div>
          ))}
          <SaveBar section="smsTemplates" saved={saved} saving={saving} onClick={() => saveSection("smsTemplates", { templates: smsTemplates })} />
        </Card>
      )}

      {/* ── Email Templates ── */}
      {settingsTab === "email" && (
        <Card>
          <SectionTitle>Email Templates</SectionTitle>
          <div className="text-[11px] text-[#b0b4c8] mb-4">
            Variables: {["first_name", "last_name", "business_name", "agent_name"].map(v => <span key={v} className="inline-block bg-[#E86A2A]/10 border border-[#E86A2A]/20 rounded px-1.5 py-0.5 font-mono text-[11px] text-[#E86A2A] mx-0.5">{`{{${v}}}`}</span>)}
          </div>
          {emailTemplates.map((t, i) => (
            <div key={t.name} className="mt-4">
              <label className={labelClass}>{t.name} Email — Subject</label>
              <input className={`${inputClass} mb-1.5`} placeholder="Subject line..." value={t.subject || ""} onChange={e => { const u = [...emailTemplates]; u[i] = { ...t, subject: e.target.value }; setEmailTemplates(u); }} />
              <label className={labelClass}>{t.name} Email — Body</label>
              <textarea className={`${textareaClass} !min-h-[120px]`} placeholder={`Write your ${t.name.toLowerCase()} email body...`} value={t.body} onChange={e => { const u = [...emailTemplates]; u[i] = { ...t, body: e.target.value }; setEmailTemplates(u); }} />
            </div>
          ))}
          <SaveBar section="emailTemplates" saved={saved} saving={saving} onClick={() => saveSection("emailTemplates", { templates: emailTemplates })} />
        </Card>
      )}

      {/* ── AI Agent ── */}
      {settingsTab === "aiAgent" && (<>
        <Card>
          <div className="flex justify-between items-center mb-4">
            <SectionTitle>AI Sales Agent</SectionTitle>
            <div className="flex items-center gap-2 cursor-pointer">
              <span className={`text-xs font-semibold ${aiConfig.enabled ? "text-emerald-400" : "text-[#b0b4c8]"}`}>{aiConfig.enabled ? "Active" : "Disabled"}</span>
              <Toggle on={aiConfig.enabled} onClick={() => setAiConfig(c => ({ ...c, enabled: !c.enabled }))} />
            </div>
          </div>
          <p className="text-xs text-[#b0b4c8] leading-relaxed mb-5">Your AI Sales Agent handles inbound leads automatically — qualifying, educating, overcoming objections, and booking appointments.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Business Name", key: "businessName", ph: "Wolf Pack Roofing" },
              { label: "Business Type", key: "businessType", ph: "Roofing, HVAC, Fitness, etc." },
              { label: "Your Name", key: "ownerName", ph: "Mike" },
              { label: "Service Area", key: "serviceArea", ph: "Metro Detroit, Southeast Michigan" },
            ].map(f => (
              <div key={f.key}>
                <label className={labelClass}>{f.label}</label>
                <input className={inputClass} value={(aiConfig as unknown as Record<string, string>)[f.key] || ""} onChange={e => setAiConfig(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.ph} />
              </div>
            ))}
          </div>

          {[
            { label: "Services Offered", key: "services", ph: "Full roof replacements, roof repairs..." },
            { label: "What Makes You Different", key: "uniqueValue", ph: "Licensed & insured, 25 year warranty..." },
          ].map(f => (
            <div key={f.key} className="mt-4">
              <label className={labelClass}>{f.label}</label>
              <textarea className={`${textareaClass} !min-h-[80px]`} value={(aiConfig as unknown as Record<string, string>)[f.key] || ""} onChange={e => setAiConfig(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.ph} />
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {[
              { label: "Pricing Guidance", key: "pricing", ph: "Free estimates, financing available" },
              { label: "Business Hours", key: "businessHours", ph: "Mon-Fri 8am-6pm, Sat 9am-2pm" },
              { label: "Booking Link", key: "bookingLink", ph: "https://calendly.com/yourlink" },
              { label: "Booking Instructions", key: "bookingInstructions", ph: "We offer free in-home estimates" },
            ].map(f => (
              <div key={f.key}>
                <label className={labelClass}>{f.label}</label>
                <input className={inputClass} value={(aiConfig as unknown as Record<string, string>)[f.key] || ""} onChange={e => setAiConfig(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.ph} />
              </div>
            ))}
            <div className="md:col-span-2">
              <label className={labelClass}>Google Review Link</label>
              <input className={inputClass} value={aiConfig.googleReviewLink || ""} onChange={e => setAiConfig(c => ({ ...c, googleReviewLink: e.target.value }))} placeholder="https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID" />
              <div className="text-[11px] text-[#b0b4c8] mt-1">Positive responses after a won deal get sent this link to leave a review.</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 py-3.5 border-t border-white/[0.07] mt-4">
            <Toggle on={aiConfig.autoGoogleMeet} onClick={() => setAiConfig(c => ({ ...c, autoGoogleMeet: !c.autoGoogleMeet }))} />
            <div>
              <div className="text-sm font-semibold text-[#e8eaf0]">Auto-Add Google Meet to All Appointments</div>
              <div className="text-[11px] text-[#b0b4c8]">Every booking includes a Google Meet video call link.</div>
            </div>
          </div>

          <div className="mt-4">
            <label className={labelClass}>Tone</label>
            <div className="flex gap-2">
              {(["professional", "friendly", "casual"] as const).map(tone => (
                <button key={tone} onClick={() => setAiConfig(c => ({ ...c, tone }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border capitalize transition-all ${aiConfig.tone === tone ? "border-[#E86A2A] bg-[#E86A2A]/15 text-[#E86A2A]" : "border-white/[0.07] text-[#e8eaf0] hover:border-white/[0.15]"}`}>{tone}</button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>Objection Handling</SectionTitle>
          <p className="text-xs text-[#b0b4c8] mb-3">Teach your AI how to handle common objections. One per line: &quot;Objection → Response&quot;</p>
          <textarea className={`${textareaClass} !min-h-[120px]`} value={aiConfig.commonObjections || ""} onChange={e => setAiConfig(c => ({ ...c, commonObjections: e.target.value }))} placeholder={`Too expensive → We offer flexible financing\nNeed to think about it → What would help you decide?`} />
        </Card>

        <Card>
          <SectionTitle>Qualifying Questions</SectionTitle>
          <p className="text-xs text-[#b0b4c8] mb-3">What should the AI learn about each lead? One per line.</p>
          <textarea className={`${textareaClass} !min-h-[100px]`} value={aiConfig.qualifyingQuestions || ""} onChange={e => setAiConfig(c => ({ ...c, qualifyingQuestions: e.target.value }))} placeholder={`What service do they need?\nWhat's their timeline?\nAre they the decision maker?`} />
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-4">
            <SectionTitle>Automatic Follow-ups</SectionTitle>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${aiConfig.followUpEnabled ? "text-emerald-400" : "text-[#b0b4c8]"}`}>{aiConfig.followUpEnabled ? "On" : "Off"}</span>
              <Toggle on={aiConfig.followUpEnabled} onClick={() => setAiConfig(c => ({ ...c, followUpEnabled: !c.followUpEnabled }))} />
            </div>
          </div>
          <p className="text-xs text-[#b0b4c8] mb-4">When a lead goes quiet, the AI follows up with a different angle each time.</p>
          <div className="flex gap-3 flex-wrap">
            {(aiConfig.followUpHours || [24, 72, 168, 336]).map((hours, i) => (
              <div key={i} className="bg-[#111] border border-white/[0.07] rounded-lg px-3.5 py-2 text-center">
                <div className="text-[10px] text-[#b0b4c8] font-bold uppercase mb-1">Follow-up {i + 1}</div>
                <div className="text-sm font-bold text-[#e8eaf0]">{hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`}</div>
              </div>
            ))}
          </div>
        </Card>

        <SaveBar section="aiAgent" saved={saved} saving={saving} onClick={() => saveSection("aiAgent", { aiConfig })} />
      </>)}

      {/* ── Account ── */}
      {settingsTab === "account" && (<>
        <Card>
          <SectionTitle>Account Info</SectionTitle>
          {[
            { label: "Business Name", key: "name", ph: "Your business name" },
            { label: "Your Name", key: "ownerName", ph: "Your full name" },
            { label: "Phone Number", key: "phone", ph: "(000) 000-0000", type: "tel" },
            { label: "Email", key: "email", ph: "you@yourbusiness.com", type: "email" },
          ].map(f => (
            <div key={f.key} className="mb-4">
              <label className={labelClass}>{f.label}</label>
              <input className={inputClass} type={f.type || "text"} value={account[f.key as keyof typeof account]} onChange={e => setAccount(a => ({ ...a, [f.key]: e.target.value }))} placeholder={f.ph} />
            </div>
          ))}
          <SaveBar section="account" saved={saved} saving={saving} onClick={() => saveSection("account", account)} />
        </Card>

        <Card>
          <SectionTitle>Integrations</SectionTitle>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#E86A2A]" />
              <div>
                <div className="text-sm font-semibold text-[#e8eaf0]">Gmail</div>
                <div className={`text-xs ${gmailConnected ? "text-emerald-400" : "text-[#b0b4c8]"}`}>{gmailConnected ? gmailEmail || "Connected" : "Not connected"}</div>
              </div>
            </div>
            {gmailConnected ? (
              <button onClick={disconnectGmail} disabled={disconnecting}
                className="px-4 py-2 bg-red-400/10 border border-red-400/30 rounded-lg text-red-400 text-xs font-bold cursor-pointer hover:bg-red-400/20 transition-colors">
                {disconnecting ? "Disconnecting..." : "Disconnect Gmail"}
              </button>
            ) : (
              <a href="/api/email/connect" className="px-4 py-2 bg-[#E86A2A] rounded-lg text-white text-xs font-bold no-underline hover:bg-[#ff7b3a] transition-colors">Connect Gmail</a>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle>Google Business Profile</SectionTitle>
          {gbpConnections.length > 0 ? gbpConnections.map(conn => (
            <div key={conn.id} className="flex items-center justify-between py-3 border-b border-white/[0.07] last:border-b-0">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-[#E86A2A]" />
                <div>
                  <div className="text-sm font-semibold text-[#e8eaf0]">{conn.location_name || "Google Business Profile"}</div>
                  <div className={`text-xs ${conn.connected ? "text-emerald-400" : "text-[#b0b4c8]"}`}>{conn.connected ? conn.connected_email || "Connected" : "Not connected"}</div>
                </div>
              </div>
              <div className="flex gap-3 text-[11px] text-[#b0b4c8]">
                <span className={conn.auto_review_reply_enabled ? "text-emerald-400" : ""}>Reviews {conn.auto_review_reply_enabled ? "ON" : "OFF"}</span>
                <span className={conn.auto_post_enabled ? "text-emerald-400" : ""}>Posts {conn.auto_post_enabled ? "ON" : "OFF"}</span>
              </div>
            </div>
          )) : (
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-[#b0b4c8]" />
                <div><div className="text-sm font-semibold text-[#e8eaf0]">Google Business Profile</div><div className="text-xs text-[#b0b4c8]">Not connected</div></div>
              </div>
              <a href="/api/gbp/connect" className="px-4 py-2 bg-[#E86A2A] rounded-lg text-white text-xs font-bold no-underline hover:bg-[#ff7b3a] transition-colors">Connect GBP</a>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Daily Reports</SectionTitle>
          <p className="text-xs text-[#b0b4c8] mb-4">Generate an AI-powered morning briefing or end-of-day summary.</p>
          <div className="flex gap-2.5 mb-5">
            <button onClick={() => generateReport("morning")} disabled={generatingReport}
              className={`px-5 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer transition-colors ${generatingReport ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
              {generatingReport ? "Generating..." : "Morning Briefing"}
            </button>
            <button onClick={() => generateReport("eod")} disabled={generatingReport}
              className={`px-5 py-2.5 bg-white/[0.08] text-[#e8eaf0] text-sm font-semibold border border-white/[0.07] rounded-lg cursor-pointer transition-colors ${generatingReport ? "opacity-50" : "hover:bg-white/[0.12]"}`}>
              {generatingReport ? "Generating..." : "EOD Report"}
            </button>
          </div>
          {reports.length > 0 && (
            <div className="flex flex-col gap-3">
              {reports.slice(0, 5).map(r => (
                <div key={r.id} className="bg-[#111] border border-white/[0.07] rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${r.type === "morning" ? "bg-[#E86A2A]/15 text-[#E86A2A]" : "bg-purple-500/15 text-purple-400"}`}>
                      {r.type === "morning" ? "Morning Briefing" : "EOD Report"}
                    </span>
                    <span className="text-[11px] text-[#b0b4c8]">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-[#e8eaf0] leading-relaxed whitespace-pre-wrap">{r.content}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </>)}
    </div>
  );
}
