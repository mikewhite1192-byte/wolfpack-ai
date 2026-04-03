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
};

interface Stage {
  id?: string;
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

interface Pipeline {
  id: string;
  name: string;
}

interface GbpConnection {
  id: string;
  connected_email: string | null;
  connected: boolean;
  location_name: string | null;
  auto_post_enabled: boolean;
  auto_review_reply_enabled: boolean;
  monthly_report_enabled: boolean;
  report_phone: string | null;
}

interface Template {
  name: string;
  subject?: string;
  body: string;
}

const STAGE_COLORS = ["#3498db", "#9b59b6", "#E86A2A", "#f39c12", "#2ecc71", "#e74c3c", "#1abc9c", "#e67e22"];

export default function SettingsPage() {
  const [settingsTab, setSettingsTab] = useState<"pipeline" | "sms" | "email" | "account" | "aiAgent">("pipeline");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  // Pipeline
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [allStages, setAllStages] = useState<Record<string, Stage[]>>({});
  const [newStage, setNewStage] = useState("");
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // GBP
  const [gbpConnections, setGbpConnections] = useState<GbpConnection[]>([]);

  // SMS Templates
  const [smsTemplates, setSmsTemplates] = useState<Template[]>([
    { name: "New Lead", body: "" },
    { name: "Follow Up", body: "" },
    { name: "Qualified", body: "" },
  ]);

  // Email Templates
  const [emailTemplates, setEmailTemplates] = useState<Template[]>([
    { name: "New Lead", subject: "", body: "" },
    { name: "Follow Up", subject: "", body: "" },
    { name: "Proposal", subject: "", body: "" },
  ]);

  // Account
  const [account, setAccount] = useState({ name: "", ownerName: "", phone: "", email: "" });

  // Gmail integration
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Daily Reports
  const [reports, setReports] = useState<{ id: string; type: string; content: string; created_at: string }[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);

  // AI Agent
  const [aiConfig, setAiConfig] = useState({
    enabled: true,
    businessName: "",
    businessType: "",
    services: "",
    serviceArea: "",
    uniqueValue: "",
    pricing: "Contact us for a free estimate",
    bookingLink: "",
    bookingInstructions: "",
    businessHours: "Monday-Friday 8am-6pm",
    tone: "friendly" as "professional" | "friendly" | "casual",
    ownerName: "",
    commonObjections: "",
    qualifyingQuestions: "",
    googleReviewLink: "",
    autoGoogleMeet: false,
    followUpEnabled: true,
    followUpHours: [24, 72, 168, 336] as number[],
  });

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();

    // Pipelines & Stages
    if (data.pipelines) {
      setPipelines(data.pipelines);
      if (data.pipelines.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(data.pipelines[0].id);
      }
    }
    if (data.stages) {
      const grouped: Record<string, Stage[]> = {};
      for (const s of data.stages) {
        const pid = s.pipeline_id || "default";
        if (!grouped[pid]) grouped[pid] = [];
        grouped[pid].push({
          id: s.id,
          name: s.name,
          color: s.color || "#3498db",
          isWon: s.is_won,
          isLost: s.is_lost,
        });
      }
      setAllStages(grouped);
      // Set stages for the selected pipeline
      const firstPid = data.pipelines?.[0]?.id || "default";
      setStages(grouped[selectedPipelineId || firstPid] || []);
    }

    // GBP
    if (data.gbpConnections) setGbpConnections(data.gbpConnections);

    // SMS Templates
    if (data.smsTemplates?.length > 0) {
      const defaults = ["New Lead", "Follow Up", "Qualified"];
      setSmsTemplates(defaults.map(name => {
        const existing = data.smsTemplates.find((t: { name: string }) => t.name === name);
        return { name, body: existing?.body || "" };
      }));
    }

    // Email Templates
    if (data.emailTemplates?.length > 0) {
      const defaults = ["New Lead", "Follow Up", "Proposal"];
      setEmailTemplates(defaults.map(name => {
        const existing = data.emailTemplates.find((t: { name: string }) => t.name === name);
        return { name, subject: existing?.subject || "", body: existing?.body || "" };
      }));
    }

    // Account
    if (data.workspace) {
      const b = data.workspace.branding || {};
      setAccount({
        name: data.workspace.name || "",
        ownerName: b.ownerName || "",
        phone: b.phone || "",
        email: b.email || "",
      });
      // Gmail
      setGmailConnected(!!data.workspace.gmail_connected);
      setGmailEmail(data.workspace.gmail_email || null);
      // AI Config
      if (data.workspace.ai_config) {
        setAiConfig(prev => ({ ...prev, ...data.workspace.ai_config }));
      }
    }

    // Fetch daily reports
    try {
      const rRes = await fetch("/api/ai-agent/daily-report");
      const rData = await rRes.json();
      if (rData.reports) setReports(rData.reports);
    } catch { /* ignore */ }

    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function saveSection(section: string, payload: Record<string, unknown>) {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, ...payload }),
    });
    setSaving(false);
    setSaved(section);
    setTimeout(() => setSaved(""), 2000);
  }

  function addStage() {
    if (newStage.trim()) {
      setStages(s => [...s, { name: newStage.trim(), color: STAGE_COLORS[s.length % STAGE_COLORS.length], isWon: false, isLost: false }]);
      setNewStage("");
    }
  }

  async function disconnectGmail() {
    setDisconnecting(true);
    await fetch("/api/email/disconnect", { method: "POST" });
    setGmailConnected(false);
    setGmailEmail(null);
    setDisconnecting(false);
  }

  async function generateReport(type: "morning" | "eod") {
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/ai-agent/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.report) {
        setReports(prev => [{ id: Date.now().toString(), type, content: data.report, created_at: new Date().toISOString() }, ...prev]);
      }
    } catch (e) {
      console.error("[settings] report error:", e);
    }
    setGeneratingReport(false);
  }

  if (loading) return <div style={{ color: T.muted, padding: 40, textAlign: "center" }}>Loading settings...</div>;

  return (
    <div>
      <style>{`
        .settings-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1px; margin-bottom: 24px; }
        .settings-tabs { display: flex; gap: 4px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 4px; margin-bottom: 24px; width: fit-content; }
        .settings-tab { padding: 8px 18px; border-radius: 7px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s; }
        .settings-tab-active { background: ${T.orange}; color: #fff; }
        .settings-tab-inactive { background: transparent; color: ${T.muted}; }
        .settings-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
        .settings-section-title { font-size: 11px; font-weight: 700; color: ${T.orange}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px; }
        .settings-stage-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .settings-stage-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: ${T.surfaceAlt}; border: 1px solid ${T.border}; border-radius: 8px; }
        .settings-stage-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
        .settings-stage-name { flex: 1; font-size: 14px; color: ${T.text}; }
        .settings-stage-badge { font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
        .settings-stage-del { background: none; border: none; color: ${T.muted}; cursor: pointer; font-size: 16px; }
        .settings-stage-del:hover { color: #e74c3c; }
        .settings-add-row { display: flex; gap: 8px; }
        .settings-input { flex: 1; padding: 10px 14px; background: ${T.surfaceAlt}; border: 1px solid ${T.border}; border-radius: 8px; font-size: 13px; color: ${T.text}; font-family: 'Inter', sans-serif; outline: none; }
        .settings-input:focus { border-color: rgba(232,106,42,0.4); }
        .settings-input::placeholder { color: ${T.muted}; }
        textarea.settings-input { resize: vertical; min-height: 100px; }
        .settings-btn { padding: 10px 20px; background: ${T.orange}; color: #fff; font-size: 13px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; }
        .settings-btn:disabled { opacity: 0.5; }
        .settings-save { display: flex; justify-content: flex-end; margin-top: 16px; gap: 10px; align-items: center; }
        .settings-saved { font-size: 12px; color: ${T.green}; }
        .settings-label { font-size: 12px; color: ${T.muted}; margin-bottom: 6px; font-weight: 600; }
        .settings-field { margin-bottom: 16px; }
        .settings-vars { font-size: 11px; color: ${T.muted}; margin-top: 6px; }
        .settings-var { display: inline-block; background: rgba(232,106,42,0.1); border: 1px solid rgba(232,106,42,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 11px; color: ${T.orange}; margin: 2px; }
      `}</style>

      <div className="settings-title">SETTINGS</div>

      <div className="settings-tabs">
        {([["aiAgent", "AI Sales Agent"], ["pipeline", "Pipeline Stages"], ["sms", "SMS Templates"], ["email", "Email Templates"], ["account", "Account"]] as const).map(([key, label]) => (
          <button key={key} className={`settings-tab ${settingsTab === key ? "settings-tab-active" : "settings-tab-inactive"}`} onClick={() => setSettingsTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {settingsTab === "pipeline" && (
        <div>
          {/* Pipeline Selector */}
          <div className="settings-card">
            <div className="settings-section-title">Select Pipeline</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pipelines.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPipelineId(p.id); setStages(allStages[p.id] || []); setEditingStage(null); }}
                  style={{
                    padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${selectedPipelineId === p.id ? T.orange : T.border}`,
                    background: selectedPipelineId === p.id ? `${T.orange}15` : T.surface,
                    color: selectedPipelineId === p.id ? T.orange : T.text,
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Pipeline Stages */}
          <div className="settings-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="settings-section-title" style={{ marginBottom: 0 }}>
                {pipelines.find(p => p.id === selectedPipelineId)?.name || "Pipeline"} — Stages
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>Drag to reorder</div>
            </div>
            <div className="settings-stage-list">
              {stages.map((s, i) => (
                <div
                  key={i}
                  className="settings-stage-row"
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={() => {
                    if (dragIdx === null || dragIdx === i) return;
                    const reordered = [...stages];
                    const [moved] = reordered.splice(dragIdx, 1);
                    reordered.splice(i, 0, moved);
                    setStages(reordered);
                    setDragIdx(null);
                  }}
                  onDragEnd={() => setDragIdx(null)}
                  style={{
                    cursor: "grab",
                    opacity: dragIdx === i ? 0.5 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  <div style={{ color: T.muted, fontSize: 12, cursor: "grab", marginRight: 4 }}>⠿</div>
                  <div className="settings-stage-dot" style={{ background: s.color }} />
                  {editingStage === i ? (
                    <input
                      className="settings-input"
                      style={{ flex: 1, padding: "4px 8px", fontSize: 14 }}
                      value={s.name}
                      autoFocus
                      onChange={e => { const updated = [...stages]; updated[i] = { ...s, name: e.target.value }; setStages(updated); }}
                      onBlur={() => setEditingStage(null)}
                      onKeyDown={e => e.key === "Enter" && setEditingStage(null)}
                    />
                  ) : (
                    <span className="settings-stage-name" onClick={() => setEditingStage(i)} style={{ cursor: "text" }}>{s.name}</span>
                  )}
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => { const updated = [...stages]; updated[i] = { ...s, isWon: !s.isWon, isLost: false }; setStages(updated); }}
                      className="settings-stage-badge"
                      style={{ background: s.isWon ? `${T.green}30` : "rgba(255,255,255,0.05)", color: s.isWon ? T.green : T.muted, border: "none", cursor: "pointer", fontSize: 10 }}
                    >
                      Won
                    </button>
                    <button
                      onClick={() => { const updated = [...stages]; updated[i] = { ...s, isLost: !s.isLost, isWon: false }; setStages(updated); }}
                      className="settings-stage-badge"
                      style={{ background: s.isLost ? "#e74c3c30" : "rgba(255,255,255,0.05)", color: s.isLost ? "#e74c3c" : T.muted, border: "none", cursor: "pointer", fontSize: 10 }}
                    >
                      Lost
                    </button>
                  </div>
                  <button className="settings-stage-del" onClick={() => setStages(st => st.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
            <div className="settings-add-row">
              <input className="settings-input" placeholder="Add new stage..." value={newStage} onChange={e => setNewStage(e.target.value)} onKeyDown={e => e.key === "Enter" && addStage()} />
              <button className="settings-btn" onClick={addStage}>Add</button>
            </div>
            <div className="settings-save">
              {saved === "stages" && <span className="settings-saved">✓ Saved</span>}
              <button className="settings-btn" disabled={saving} onClick={() => saveSection("stages", { stages, pipelineId: selectedPipelineId })}>
                {saving ? "Saving..." : "Save Stages →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsTab === "sms" && (
        <div className="settings-card">
          <div className="settings-section-title">SMS Templates</div>
          <div className="settings-vars">
            Available variables: <span className="settings-var">{"{{first_name}}"}</span><span className="settings-var">{"{{last_name}}"}</span><span className="settings-var">{"{{business_name}}"}</span><span className="settings-var">{"{{agent_name}}"}</span>
          </div>
          {smsTemplates.map((t, i) => (
            <div key={t.name} className="settings-field" style={{ marginTop: 16 }}>
              <div className="settings-label">{t.name} SMS</div>
              <textarea
                className="settings-input"
                placeholder={`Write your ${t.name.toLowerCase()} SMS template...`}
                value={t.body}
                onChange={e => {
                  const updated = [...smsTemplates];
                  updated[i] = { ...t, body: e.target.value };
                  setSmsTemplates(updated);
                }}
              />
            </div>
          ))}
          <div className="settings-save">
            {saved === "smsTemplates" && <span className="settings-saved">✓ Saved</span>}
            <button className="settings-btn" disabled={saving} onClick={() => saveSection("smsTemplates", { templates: smsTemplates })}>
              {saving ? "Saving..." : "Save Templates →"}
            </button>
          </div>
        </div>
      )}

      {settingsTab === "email" && (
        <div className="settings-card">
          <div className="settings-section-title">Email Templates</div>
          <div className="settings-vars">
            Available variables: <span className="settings-var">{"{{first_name}}"}</span><span className="settings-var">{"{{last_name}}"}</span><span className="settings-var">{"{{business_name}}"}</span><span className="settings-var">{"{{agent_name}}"}</span>
          </div>
          {emailTemplates.map((t, i) => (
            <div key={t.name} className="settings-field" style={{ marginTop: 16 }}>
              <div className="settings-label">{t.name} Email — Subject</div>
              <input
                className="settings-input"
                placeholder="Subject line..."
                style={{ marginBottom: 6 }}
                value={t.subject || ""}
                onChange={e => {
                  const updated = [...emailTemplates];
                  updated[i] = { ...t, subject: e.target.value };
                  setEmailTemplates(updated);
                }}
              />
              <div className="settings-label">{t.name} Email — Body</div>
              <textarea
                className="settings-input"
                style={{ minHeight: 120 }}
                placeholder={`Write your ${t.name.toLowerCase()} email body...`}
                value={t.body}
                onChange={e => {
                  const updated = [...emailTemplates];
                  updated[i] = { ...t, body: e.target.value };
                  setEmailTemplates(updated);
                }}
              />
            </div>
          ))}
          <div className="settings-save">
            {saved === "emailTemplates" && <span className="settings-saved">✓ Saved</span>}
            <button className="settings-btn" disabled={saving} onClick={() => saveSection("emailTemplates", { templates: emailTemplates })}>
              {saving ? "Saving..." : "Save Templates →"}
            </button>
          </div>
        </div>
      )}

      {settingsTab === "aiAgent" && (
        <div>
          <div className="settings-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="settings-section-title" style={{ marginBottom: 0 }}>AI Sales Agent</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <span style={{ fontSize: 12, color: aiConfig.enabled ? T.green : T.muted, fontWeight: 600 }}>
                  {aiConfig.enabled ? "Active" : "Disabled"}
                </span>
                <div
                  onClick={() => setAiConfig(c => ({ ...c, enabled: !c.enabled }))}
                  style={{
                    width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "background 0.2s",
                    background: aiConfig.enabled ? T.green : "rgba(255,255,255,0.1)",
                    position: "relative",
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, transition: "left 0.2s",
                    left: aiConfig.enabled ? 20 : 2,
                  }} />
                </div>
              </label>
            </div>
            <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 20 }}>
              Your AI Sales Agent handles inbound leads automatically — qualifying, educating, overcoming objections, and booking appointments. Configure it with your business details so it sells like your best rep.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="settings-field">
                <div className="settings-label">Business Name</div>
                <input className="settings-input" value={aiConfig.businessName} onChange={e => setAiConfig(c => ({ ...c, businessName: e.target.value }))} placeholder="Wolf Pack Roofing" />
              </div>
              <div className="settings-field">
                <div className="settings-label">Business Type</div>
                <input className="settings-input" value={aiConfig.businessType} onChange={e => setAiConfig(c => ({ ...c, businessType: e.target.value }))} placeholder="Roofing, HVAC, Fitness, etc." />
              </div>
              <div className="settings-field">
                <div className="settings-label">Your Name (Agent speaks on behalf of)</div>
                <input className="settings-input" value={aiConfig.ownerName} onChange={e => setAiConfig(c => ({ ...c, ownerName: e.target.value }))} placeholder="Mike" />
              </div>
              <div className="settings-field">
                <div className="settings-label">Service Area</div>
                <input className="settings-input" value={aiConfig.serviceArea} onChange={e => setAiConfig(c => ({ ...c, serviceArea: e.target.value }))} placeholder="Metro Detroit, Southeast Michigan" />
              </div>
            </div>

            <div className="settings-field">
              <div className="settings-label">Services Offered</div>
              <textarea className="settings-input" style={{ minHeight: 80 }} value={aiConfig.services} onChange={e => setAiConfig(c => ({ ...c, services: e.target.value }))} placeholder="Full roof replacements, roof repairs, gutter installation, storm damage inspections..." />
            </div>

            <div className="settings-field">
              <div className="settings-label">What Makes You Different</div>
              <textarea className="settings-input" style={{ minHeight: 60 }} value={aiConfig.uniqueValue} onChange={e => setAiConfig(c => ({ ...c, uniqueValue: e.target.value }))} placeholder="Licensed & insured, 25 year warranty, same-day estimates, financing available..." />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="settings-field">
                <div className="settings-label">Pricing Guidance</div>
                <input className="settings-input" value={aiConfig.pricing} onChange={e => setAiConfig(c => ({ ...c, pricing: e.target.value }))} placeholder="Free estimates, financing available" />
              </div>
              <div className="settings-field">
                <div className="settings-label">Business Hours</div>
                <input className="settings-input" value={aiConfig.businessHours} onChange={e => setAiConfig(c => ({ ...c, businessHours: e.target.value }))} placeholder="Mon-Fri 8am-6pm, Sat 9am-2pm" />
              </div>
              <div className="settings-field">
                <div className="settings-label">Booking Link (optional)</div>
                <input className="settings-input" value={aiConfig.bookingLink || ""} onChange={e => setAiConfig(c => ({ ...c, bookingLink: e.target.value }))} placeholder="https://calendly.com/yourlink" />
              </div>
              <div className="settings-field">
                <div className="settings-label">Booking Instructions</div>
                <input className="settings-input" value={aiConfig.bookingInstructions || ""} onChange={e => setAiConfig(c => ({ ...c, bookingInstructions: e.target.value }))} placeholder="We offer free in-home estimates" />
              </div>
              <div className="settings-field" style={{ gridColumn: "1 / -1" }}>
                <div className="settings-label">Google Review Link</div>
                <input className="settings-input" value={aiConfig.googleReviewLink || ""} onChange={e => setAiConfig(c => ({ ...c, googleReviewLink: e.target.value }))} placeholder="https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID" />
                <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>When a deal closes won, the AI will ask how their experience was. Positive responses get sent this link to leave a Google review.</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", borderTop: `1px solid ${T.border}`, marginTop: 8 }}>
              <div
                onClick={() => setAiConfig(c => ({ ...c, autoGoogleMeet: !c.autoGoogleMeet }))}
                style={{
                  width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "background 0.2s",
                  background: aiConfig.autoGoogleMeet ? T.green : "rgba(255,255,255,0.1)",
                  position: "relative", flexShrink: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, left: aiConfig.autoGoogleMeet ? 20 : 2, transition: "left 0.2s",
                }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Auto-Add Google Meet to All Appointments</div>
                <div style={{ fontSize: 11, color: T.muted }}>Every booking automatically includes a Google Meet video call link. The link is sent in the calendar invite.</div>
              </div>
            </div>

            <div className="settings-field">
              <div className="settings-label">Tone</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["professional", "friendly", "casual"] as const).map(tone => (
                  <button key={tone} onClick={() => setAiConfig(c => ({ ...c, tone }))} style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${aiConfig.tone === tone ? T.orange : T.border}`,
                    background: aiConfig.tone === tone ? `${T.orange}15` : T.surface,
                    color: aiConfig.tone === tone ? T.orange : T.text,
                    fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                  }}>
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-section-title">Objection Handling</div>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
              Teach your AI how to handle common objections. One per line: "Objection → Response"
            </p>
            <div className="settings-field">
              <textarea className="settings-input" style={{ minHeight: 120 }} value={aiConfig.commonObjections || ""} onChange={e => setAiConfig(c => ({ ...c, commonObjections: e.target.value }))} placeholder={`Too expensive → We offer flexible financing and our warranty saves you money long-term
Need to think about it → Totally understand. What would help you decide?
Talking to other companies → Smart move. What matters most to you when comparing?`} />
            </div>
          </div>

          <div className="settings-card">
            <div className="settings-section-title">Qualifying Questions</div>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
              What should the AI learn about each lead? One per line.
            </p>
            <div className="settings-field">
              <textarea className="settings-input" style={{ minHeight: 100 }} value={aiConfig.qualifyingQuestions || ""} onChange={e => setAiConfig(c => ({ ...c, qualifyingQuestions: e.target.value }))} placeholder={`What service do they need?
What's their timeline?
What's their budget range?
Are they the decision maker?
What's the property address?`} />
            </div>
          </div>

          <div className="settings-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="settings-section-title" style={{ marginBottom: 0 }}>Automatic Follow-ups</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <span style={{ fontSize: 12, color: aiConfig.followUpEnabled ? T.green : T.muted, fontWeight: 600 }}>
                  {aiConfig.followUpEnabled ? "On" : "Off"}
                </span>
                <div
                  onClick={() => setAiConfig(c => ({ ...c, followUpEnabled: !c.followUpEnabled }))}
                  style={{
                    width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "background 0.2s",
                    background: aiConfig.followUpEnabled ? T.green : "rgba(255,255,255,0.1)",
                    position: "relative",
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, transition: "left 0.2s",
                    left: aiConfig.followUpEnabled ? 20 : 2,
                  }} />
                </div>
              </label>
            </div>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>
              When a lead goes quiet, the AI will automatically follow up with a different angle each time.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(aiConfig.followUpHours || [24, 72, 168, 336]).map((hours, i) => (
                <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Follow-up {i + 1}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                    {hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="settings-save">
            {saved === "aiAgent" && <span className="settings-saved">✓ Saved</span>}
            <button className="settings-btn" disabled={saving} onClick={() => saveSection("aiAgent", { aiConfig })}>
              {saving ? "Saving..." : "Save AI Agent Settings →"}
            </button>
          </div>
        </div>
      )}

      {settingsTab === "account" && (
        <div>
          <div className="settings-card">
            <div className="settings-section-title">Account Info</div>
            <div className="settings-field">
              <div className="settings-label">Business Name</div>
              <input className="settings-input" value={account.name} onChange={e => setAccount(a => ({ ...a, name: e.target.value }))} placeholder="Your business name" />
            </div>
            <div className="settings-field">
              <div className="settings-label">Your Name</div>
              <input className="settings-input" value={account.ownerName} onChange={e => setAccount(a => ({ ...a, ownerName: e.target.value }))} placeholder="Your full name" />
            </div>
            <div className="settings-field">
              <div className="settings-label">Phone Number</div>
              <input className="settings-input" type="tel" value={account.phone} onChange={e => setAccount(a => ({ ...a, phone: e.target.value }))} placeholder="(000) 000-0000" />
            </div>
            <div className="settings-field">
              <div className="settings-label">Email</div>
              <input className="settings-input" type="email" value={account.email} onChange={e => setAccount(a => ({ ...a, email: e.target.value }))} placeholder="you@yourbusiness.com" />
            </div>
            <div className="settings-save">
              {saved === "account" && <span className="settings-saved">✓ Saved</span>}
              <button className="settings-btn" disabled={saving} onClick={() => saveSection("account", account)}>
                {saving ? "Saving..." : "Save Account →"}
              </button>
            </div>
          </div>

          {/* Gmail Integration */}
          <div className="settings-card">
            <div className="settings-section-title">Integrations</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>📧</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Gmail</div>
                  {gmailConnected ? (
                    <div style={{ fontSize: 12, color: T.green }}>{gmailEmail || "Connected"}</div>
                  ) : (
                    <div style={{ fontSize: 12, color: T.muted }}>Not connected</div>
                  )}
                </div>
              </div>
              {gmailConnected ? (
                <button
                  onClick={disconnectGmail}
                  disabled={disconnecting}
                  style={{
                    padding: "8px 16px",
                    background: "rgba(231,76,60,0.1)",
                    border: "1px solid rgba(231,76,60,0.3)",
                    borderRadius: 8,
                    color: "#e74c3c",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect Gmail"}
                </button>
              ) : (
                <a
                  href="/api/email/connect"
                  style={{
                    padding: "8px 16px",
                    background: T.orange,
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  Connect Gmail
                </a>
              )}
            </div>
          </div>

          {/* Google Business Profile */}
          <div className="settings-card">
            <div className="settings-section-title">Google Business Profile</div>
            {gbpConnections.length > 0 ? (
              gbpConnections.map(conn => (
                <div key={conn.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20 }}>📍</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{conn.location_name || "Google Business Profile"}</div>
                      <div style={{ fontSize: 12, color: conn.connected ? T.green : T.muted }}>{conn.connected ? conn.connected_email || "Connected" : "Not connected"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.muted }}>
                      <span style={{ color: conn.auto_review_reply_enabled ? T.green : T.muted }}>Reviews {conn.auto_review_reply_enabled ? "ON" : "OFF"}</span>
                      <span style={{ color: conn.auto_post_enabled ? T.green : T.muted }}>Posts {conn.auto_post_enabled ? "ON" : "OFF"}</span>
                      <span style={{ color: conn.monthly_report_enabled ? T.green : T.muted }}>Reports {conn.monthly_report_enabled ? "ON" : "OFF"}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Google Business Profile</div>
                    <div style={{ fontSize: 12, color: T.muted }}>Not connected</div>
                  </div>
                </div>
                <a
                  href="/api/gbp/connect"
                  style={{
                    padding: "8px 16px", background: T.orange, borderRadius: 8,
                    color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "inline-block",
                  }}
                >
                  Connect GBP
                </a>
              </div>
            )}
          </div>

          {/* Daily Reports */}
          <div className="settings-card">
            <div className="settings-section-title">Daily Reports</div>
            <p style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>
              Generate an AI-powered morning briefing or end-of-day summary based on your live CRM data.
            </p>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button
                className="settings-btn"
                disabled={generatingReport}
                onClick={() => generateReport("morning")}
                style={{ background: T.orange }}
              >
                {generatingReport ? "Generating..." : "Generate Morning Briefing"}
              </button>
              <button
                className="settings-btn"
                disabled={generatingReport}
                onClick={() => generateReport("eod")}
                style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${T.border}` }}
              >
                {generatingReport ? "Generating..." : "Generate EOD Report"}
              </button>
            </div>
            {reports.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reports.slice(0, 5).map(r => (
                  <div key={r.id} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        color: r.type === "morning" ? T.orange : "#9b59b6",
                        background: r.type === "morning" ? `${T.orange}15` : "rgba(155,89,182,0.15)",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}>
                        {r.type === "morning" ? "Morning Briefing" : "EOD Report"}
                      </span>
                      <span style={{ fontSize: 11, color: T.muted }}>
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {r.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
