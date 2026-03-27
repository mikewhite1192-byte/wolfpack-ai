"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  surfaceAlt: "#0f1a2e",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  bg: "#0D1426",
  blue: "#3498db",
  purple: "#9b59b6",
};

interface DealDetail {
  id: string;
  contact_id: string;
  title: string | null;
  value: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  source_detail: string | null;
  lead_score: number;
  tags: string[] | null;
  stage_id: string;
  stage_name: string;
  stage_color: string;
  created_at: string;
  contact_created_at: string;
  notes: string | null;
}

interface Activity {
  id: string;
  action: string;
  details: Record<string, string> | null;
  created_at: string;
}

interface Message {
  id: string;
  direction: string;
  channel: string;
  body: string | null;
  sent_by: string | null;
  status: string;
  created_at: string;
}

interface Call {
  id: string;
  direction: string;
  duration_seconds: number | null;
  ai_summary: string | null;
  ai_score: number | null;
  created_at: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface EmailThread {
  id: string;
  subject: string;
  from: string;
  to: string;
  lastFrom: string;
  date: string;
  snippet: string;
  messageCount: number;
}

interface EmailDetail {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
}

interface DealPanelProps {
  dealId: string;
  onClose: () => void;
  onUpdate?: () => void;
  onTextContact?: (contactId: string) => void;
}

export default function DealPanel({ dealId, onClose, onUpdate }: DealPanelProps) {
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"notes" | "timeline" | "messages" | "calls" | "emails">("notes");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editingValue, setEditingValue] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Email state
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [emailDetails, setEmailDetails] = useState<Record<string, EmailDetail[]>>({});
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);

  // AI toggle state
  const [chatAiEnabled, setChatAiEnabled] = useState(true);
  const [togglingAi, setTogglingAi] = useState(false);

  // Chat state
  const [chatConvId, setChatConvId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchDeal = useCallback(async () => {
    const res = await fetch(`/api/deals/${dealId}/activity`);
    const data = await res.json();
    setDeal(data.deal);
    setActivity(data.activity || []);
    setMessages(data.messages || []);
    setCalls(data.calls || []);
    setStages(data.stages || []);
    setEmailThreads(data.emailThreads || []);
    setEditValue(data.deal?.value || "");
    if (data.deal?.email) setComposeTo(data.deal.email);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    fetchDeal();
  }, [fetchDeal]);

  // Load chat when opened
  useEffect(() => {
    if (!showChat || !deal) return;
    async function loadChat() {
      setChatLoading(true);
      const listRes = await fetch("/api/conversations?status=all");
      const listData = await listRes.json();
      const existing = (listData.conversations || []).find(
        (c: { contact_id: string }) => c.contact_id === deal!.contact_id
      );
      if (existing) {
        setChatConvId(existing.id);
        setChatAiEnabled(existing.ai_enabled ?? true);
        const msgRes = await fetch(`/api/conversations/${existing.id}/messages`);
        const msgData = await msgRes.json();
        setChatMessages(msgData.messages || []);
      } else {
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: deal!.contact_id }),
        });
        const createData = await createRes.json();
        if (createData.conversation) setChatConvId(createData.conversation.id);
        setChatMessages([]);
      }
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
    loadChat();
  }, [showChat, deal]);

  // Poll chat messages
  useEffect(() => {
    if (!chatConvId || !showChat) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/conversations/${chatConvId}/messages`);
      const data = await res.json();
      setChatMessages(data.messages || []);
    }, 5000);
    return () => clearInterval(interval);
  }, [chatConvId, showChat]);

  async function handleChatSend() {
    if (!chatInput.trim() || !chatConvId) return;
    setChatSending(true);
    await fetch(`/api/conversations/${chatConvId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: chatInput, channel: "sms" }),
    });
    setChatInput("");
    setChatSending(false);
    const res = await fetch(`/api/conversations/${chatConvId}/messages`);
    const data = await res.json();
    setChatMessages(data.messages || []);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function handleStageChange(newStageId: string) {
    await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: newStageId }),
    });
    fetchDeal();
    onUpdate?.();
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    await fetch(`/api/deals/${dealId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setNote("");
    setSavingNote(false);
    fetchDeal();
  }

  async function handleUpdateValue() {
    await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: editValue || null }),
    });
    setEditingValue(false);
    fetchDeal();
    onUpdate?.();
  }

  async function handleToggleChatAi() {
    if (!chatConvId || togglingAi) return;
    setTogglingAi(true);
    const newVal = !chatAiEnabled;
    await fetch(`/api/conversations/${chatConvId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiEnabled: newVal }),
    });
    setChatAiEnabled(newVal);
    setTogglingAi(false);
  }

  async function handleExpandEmail(threadId: string) {
    if (expandedEmail === threadId) {
      setExpandedEmail(null);
      return;
    }
    setExpandedEmail(threadId);
    if (emailDetails[threadId]) return;
    try {
      const res = await fetch(`/api/email/threads/${threadId}`);
      const data = await res.json();
      setEmailDetails(prev => ({ ...prev, [threadId]: data.messages || [] }));
    } catch {
      // ignore
    }
  }

  async function handleSendEmail() {
    if (!composeTo.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody }),
    });
    setComposeSending(false);
    setShowCompose(false);
    setComposeSubject("");
    setComposeBody("");
    fetchDeal();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatTime(d: string) {
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function formatMsgTime(d: string) {
    return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function getActivityIcon(action: string) {
    switch (action) {
      case "stage_changed": return "↗";
      case "note_added": return "📝";
      case "call_made": return "📞";
      case "email_sent": return "📧";
      case "sms_sent": return "💬";
      default: return "•";
    }
  }

  function getActivityText(a: Activity) {
    const d = a.details || {};
    switch (a.action) {
      case "stage_changed": return `Moved from ${d.from} to ${d.to}`;
      case "note_added": return d.text || "Note added";
      case "call_made": return "Call made";
      case "email_sent": return "Email sent";
      case "sms_sent": return "SMS sent";
      default: return a.action;
    }
  }

  function sourceLabel(source: string | null, detail: string | null) {
    if (!source) return "Unknown";
    const labels: Record<string, string> = {
      manual: "Manual Entry",
      landing_page: "Landing Page",
      import: "CSV Import",
      api: "API",
      facebook: "Facebook Lead",
      google: "Google Lead",
    };
    const label = labels[source] || source;
    return detail ? `${label} — ${detail}` : label;
  }

  if (loading) {
    return (
      <div className="deal-panel-overlay" onClick={onClose}>
        <div className="deal-panel" onClick={e => e.stopPropagation()}>
          <div style={{ padding: 60, textAlign: "center", color: T.muted }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!deal) return null;

  const fullName = [deal.first_name, deal.last_name].filter(Boolean).join(" ") || "Unknown";
  const initials = (deal.first_name?.[0] || "") + (deal.last_name?.[0] || "");
  const notes = activity.filter(a => a.action === "note_added");
  const timelineActivity = activity.filter(a => a.action !== "note_added");
  const timeline = [
    ...timelineActivity.map(a => ({ type: "activity" as const, data: a, time: a.created_at })),
    ...messages.map(m => ({ type: "message" as const, data: m, time: m.created_at })),
    ...calls.map(c => ({ type: "call" as const, data: c, time: c.created_at })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <>
      <style>{`
        .deal-panel-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; justify-content: flex-end; }
        .deal-panel-container { display: flex; height: 100vh; }
        .deal-panel { width: 480px; max-width: 50vw; height: 100vh; background: ${T.bg}; border-left: 1px solid ${T.border}; overflow-y: auto; display: flex; flex-direction: column; position: relative; }
        .dp-chat-panel { width: 400px; max-width: 45vw; height: 100vh; background: ${T.bg}; border-left: 1px solid ${T.border}; display: flex; flex-direction: column; }
        .dp-chat-header { padding: 14px 18px; border-bottom: 1px solid ${T.border}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .dp-chat-title { font-size: 16px; font-weight: 700; color: ${T.text}; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px; }
        .dp-chat-sub { font-size: 11px; color: ${T.muted}; }
        .dp-chat-close { background: none; border: none; color: ${T.muted}; font-size: 18px; cursor: pointer; padding: 2px 8px; border-radius: 4px; }
        .dp-chat-close:hover { color: ${T.text}; background: rgba(255,255,255,0.05); }
        .dp-chat-messages { flex: 1; overflow-y: auto; padding: 14px 10px; display: flex; flex-direction: column; gap: 1px; min-height: 0; }
        .dp-chat-msgs-inner { display: flex; flex-direction: column; gap: 1px; margin-top: auto; }
        .dp-cm-row { display: flex; flex-direction: column; margin-bottom: 1px; }
        .dp-cm-row.inbound { align-items: flex-start; padding-left: 8px; padding-right: 40px; }
        .dp-cm-row.outbound { align-items: flex-end; padding-right: 8px; padding-left: 40px; }
        .dp-cm-row.show-tail { margin-bottom: 6px; }
        .dp-cm-bubble { width: fit-content; max-width: 80%; padding: 8px 12px; font-size: 13px; line-height: 1.4; word-wrap: break-word; white-space: pre-wrap; }
        .dp-cm-bubble.inbound { background: #1E293B; color: ${T.text}; border-radius: 16px; }
        .dp-cm-row.show-tail .dp-cm-bubble.inbound { border-radius: 16px 16px 16px 4px; }
        .dp-cm-bubble.outbound { background: ${T.orange}; color: #fff; border-radius: 16px; }
        .dp-cm-row.show-tail .dp-cm-bubble.outbound { border-radius: 16px 16px 4px 16px; }
        .dp-cm-meta { font-size: 10px; color: ${T.muted}; margin-top: 2px; padding: 0 4px; }
        .dp-chat-input { padding: 12px; border-top: 1px solid ${T.border}; display: flex; gap: 8px; flex-shrink: 0; }
        .dp-chat-textarea { flex: 1; padding: 8px 12px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; color: ${T.text}; font-size: 13px; resize: none; outline: none; font-family: 'Inter', sans-serif; min-height: 38px; max-height: 80px; }
        .dp-chat-textarea:focus { border-color: ${T.orange}; }
        .dp-chat-send { padding: 8px 16px; background: ${T.orange}; color: #fff; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .dp-chat-send:disabled { opacity: 0.5; }
        .dp-chat-footer { padding: 10px 14px; border-top: 1px solid ${T.border}; flex-shrink: 0; display: flex; align-items: center; }
        .dp-chat-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: ${T.muted}; font-size: 13px; text-align: center; padding: 30px; }
        .dp-header { padding: 24px; border-bottom: 1px solid ${T.border}; position: relative; }
        .dp-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: ${T.muted}; font-size: 24px; cursor: pointer; padding: 4px 10px; border-radius: 6px; z-index: 10; }
        .dp-close:hover { background: rgba(255,255,255,0.05); color: ${T.text}; }
        .dp-avatar { width: 48px; height: 48px; border-radius: 50%; background: ${T.orange}20; color: ${T.orange}; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; font-family: 'Bebas Neue', sans-serif; letter-spacing: 1px; }
        .dp-name { font-size: 22px; font-weight: 700; color: ${T.text}; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px; }
        .dp-company { font-size: 13px; color: ${T.muted}; margin-top: 2px; }
        .dp-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .dp-info-item { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; padding: 8px 12px; }
        .dp-info-label { font-size: 10px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
        .dp-info-value { font-size: 13px; color: ${T.text}; word-break: break-all; }
        .dp-info-link { font-size: 13px; color: ${T.orange}; text-decoration: none; }
        .dp-info-link:hover { text-decoration: underline; }
        .dp-actions { display: flex; gap: 8px; margin-top: 14px; }
        .dp-action-btn { flex: 1; padding: 9px; border-radius: 8px; border: 1px solid ${T.border}; background: ${T.surface}; color: ${T.text}; font-size: 12px; font-weight: 600; cursor: pointer; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .dp-action-btn:hover { border-color: ${T.orange}; }
        .dp-action-btn.active { border-color: ${T.orange}; background: ${T.orange}15; color: ${T.orange}; }
        .dp-section { padding: 16px 24px; border-bottom: 1px solid ${T.border}; }
        .dp-section-title { font-size: 11px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
        .dp-stage-select { width: 100%; padding: 7px 10px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; color: ${T.text}; font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; }
        .dp-value-row { display: flex; gap: 8px; align-items: center; }
        .dp-value-display { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: ${T.orange}; cursor: pointer; letter-spacing: 0.5px; }
        .dp-value-input { flex: 1; padding: 7px 10px; background: ${T.surface}; border: 1px solid ${T.orange}; border-radius: 8px; color: ${T.text}; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; }
        .dp-value-save { padding: 7px 14px; background: ${T.orange}; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 700; }
        .dp-tabs { display: flex; gap: 0; border-bottom: 1px solid ${T.border}; }
        .dp-tab { flex: 1; padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: ${T.muted}; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
        .dp-tab:hover { color: ${T.text}; }
        .dp-tab.active { color: ${T.orange}; border-bottom-color: ${T.orange}; }
        .dp-timeline { flex: 1; overflow-y: auto; padding: 14px 20px; }
        .dp-tl-item { display: flex; gap: 10px; margin-bottom: 14px; }
        .dp-tl-icon { width: 26px; height: 26px; border-radius: 50%; background: ${T.surface}; border: 1px solid ${T.border}; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
        .dp-tl-content { flex: 1; }
        .dp-tl-text { font-size: 13px; color: ${T.text}; line-height: 1.5; }
        .dp-tl-time { font-size: 11px; color: ${T.muted}; margin-top: 2px; }
        .dp-tl-msg { padding: 8px 12px; border-radius: 10px; font-size: 13px; line-height: 1.5; max-width: 85%; }
        .dp-tl-msg.inbound { background: ${T.surface}; color: ${T.text}; border: 1px solid ${T.border}; }
        .dp-tl-msg.outbound { background: ${T.orange}18; color: ${T.text}; border: 1px solid ${T.orange}30; margin-left: auto; }
        .dp-note-input { display: flex; gap: 8px; padding: 12px 20px; border-top: 1px solid ${T.border}; background: ${T.bg}; }
        .dp-note-textarea { flex: 1; padding: 8px 12px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; color: ${T.text}; font-size: 13px; resize: none; outline: none; font-family: 'Inter', sans-serif; min-height: 36px; }
        .dp-note-textarea:focus { border-color: ${T.orange}; }
        .dp-note-btn { padding: 8px 14px; background: ${T.orange}; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .dp-note-btn:disabled { opacity: 0.5; }
        .dp-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
        .dp-score { margin-top: 10px; display: flex; align-items: center; gap: 8px; }
        .dp-score-bar { flex: 1; height: 6px; background: ${T.surface}; border-radius: 3px; overflow: hidden; }
        .dp-score-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
      `}</style>

      <div className="deal-panel-overlay" onClick={onClose}>
        <div className="deal-panel-container" onClick={e => e.stopPropagation()}>

          {/* Chat Panel — appears to the LEFT of the deal card */}
          {showChat && (
            <div className="dp-chat-panel">
              <div className="dp-chat-header">
                <div>
                  <div className="dp-chat-title">{fullName}</div>
                  <div className="dp-chat-sub">{deal.phone} · SMS</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6, cursor: togglingAi ? "wait" : "pointer" }}
                    onClick={handleToggleChatAi}
                    title={chatAiEnabled ? "AI Auto-Reply is ON" : "AI Auto-Reply is OFF"}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: chatAiEnabled ? T.green : T.muted,
                      boxShadow: chatAiEnabled ? `0 0 6px ${T.green}` : "none",
                      transition: "all 0.2s",
                    }} />
                    <div style={{
                      width: 34, height: 18, borderRadius: 9, padding: 2,
                      background: chatAiEnabled ? T.green : "rgba(255,255,255,0.15)",
                      transition: "background 0.2s", position: "relative",
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: "50%", background: "#fff",
                        transition: "transform 0.2s",
                        transform: chatAiEnabled ? "translateX(16px)" : "translateX(0)",
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: chatAiEnabled ? T.green : T.muted, fontWeight: 600 }}>AI</span>
                  </div>
                  <button className="dp-chat-close" onClick={() => setShowChat(false)}>×</button>
                </div>
              </div>
              <div className="dp-chat-messages">
                {chatLoading ? (
                  <div className="dp-chat-empty">Loading messages...</div>
                ) : chatMessages.length === 0 ? (
                  <div className="dp-chat-empty">No messages yet.<br />Send a text to start.</div>
                ) : (
                  <div className="dp-chat-msgs-inner">
                    {chatMessages.map((m, i) => {
                      const next = chatMessages[i + 1];
                      const showTail = !next || next.direction !== m.direction;
                      const statusLabel = m.direction === "outbound"
                        ? (m.status === "delivered" ? "Delivered"
                          : m.status === "sent" ? "Sent"
                          : m.status === "failed" ? "Not Delivered"
                          : "")
                        : "";
                      return (
                        <div key={m.id} className={`dp-cm-row ${m.direction}${showTail ? " show-tail" : ""}`}>
                          <div className={`dp-cm-bubble ${m.direction}`}>{m.body}</div>
                          {showTail && (
                            <div className="dp-cm-meta">
                              {m.sent_by === "ai" && <span style={{ color: T.green }}>AI · </span>}
                              {formatMsgTime(m.created_at)}
                              {statusLabel && <span> · {statusLabel}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>
              <div className="dp-chat-input">
                <textarea
                  className="dp-chat-textarea"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  rows={1}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                />
                <button className="dp-chat-send" onClick={handleChatSend} disabled={chatSending || !chatInput.trim()}>
                  {chatSending ? "..." : "Send"}
                </button>
              </div>
              <div className="dp-chat-footer">
                <span style={{ fontSize: 11, color: T.muted }}>SMS · {deal.phone}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: chatAiEnabled ? T.green : T.muted, fontWeight: 600 }}>
                  {chatAiEnabled ? "AI Auto-Reply On" : "AI Off"}
                </span>
              </div>
            </div>
          )}

          {/* Deal Info Panel — always on the RIGHT */}
          <div className="deal-panel">
            <button className="dp-close" onClick={onClose}>×</button>

            <div className="dp-header">
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 10 }}>
                <div className="dp-avatar">{initials || "?"}</div>
                <div>
                  <div className="dp-name">{fullName}</div>
                  {deal.company && <div className="dp-company">{deal.company}</div>}
                </div>
              </div>

              <div className="dp-info-grid">
                <div className="dp-info-item">
                  <div className="dp-info-label">Phone</div>
                  {deal.phone ? (
                    <div className="dp-info-value">{deal.phone}</div>
                  ) : (
                    <div className="dp-info-value" style={{ color: T.muted }}>—</div>
                  )}
                </div>
                <div className="dp-info-item">
                  <div className="dp-info-label">Email</div>
                  {deal.email ? (
                    <a href={`mailto:${deal.email}`} className="dp-info-link">{deal.email}</a>
                  ) : (
                    <div className="dp-info-value" style={{ color: T.muted }}>—</div>
                  )}
                </div>
                <div className="dp-info-item">
                  <div className="dp-info-label">Source</div>
                  <div className="dp-info-value">{sourceLabel(deal.source, deal.source_detail)}</div>
                </div>
                <div className="dp-info-item">
                  <div className="dp-info-label">Added</div>
                  <div className="dp-info-value">{formatDate(deal.contact_created_at)}</div>
                </div>
              </div>

              <div className="dp-actions">
                {deal.phone && (
                  <button className="dp-action-btn">
                    📞 Call
                  </button>
                )}
                {deal.phone && (
                  <button className={`dp-action-btn ${showChat ? "active" : ""}`} onClick={() => setShowChat(!showChat)}>
                    💬 Text
                  </button>
                )}
                {deal.email && (
                  <a href={`mailto:${deal.email}`} className="dp-action-btn" style={{ textDecoration: "none" }}>
                    📧 Email
                  </a>
                )}
              </div>

              {deal.lead_score > 0 && (
                <div className="dp-score">
                  <span style={{ fontSize: 11, color: T.muted, fontWeight: 700 }}>SCORE</span>
                  <div className="dp-score-bar">
                    <div
                      className="dp-score-fill"
                      style={{
                        width: `${deal.lead_score}%`,
                        background: deal.lead_score >= 70 ? T.green : deal.lead_score >= 40 ? T.orange : T.red,
                      }}
                    />
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: deal.lead_score >= 70 ? T.green : deal.lead_score >= 40 ? T.orange : T.red,
                  }}>{deal.lead_score}</span>
                </div>
              )}
            </div>

            <div className="dp-section">
              <div className="dp-section-title">Deal</div>
              <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Stage</div>
                  <select className="dp-stage-select" value={deal.stage_id} onChange={e => handleStageChange(e.target.value)}>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Value</div>
                  {editingValue ? (
                    <div className="dp-value-row">
                      <input className="dp-value-input" type="number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => e.key === "Enter" && handleUpdateValue()} />
                      <button className="dp-value-save" onClick={handleUpdateValue}>Save</button>
                    </div>
                  ) : (
                    <div className="dp-value-display" onClick={() => setEditingValue(true)}>
                      {deal.value ? `$${parseFloat(deal.value).toLocaleString()}` : "$0"}
                      <span style={{ fontSize: 11, color: T.muted, marginLeft: 6, fontFamily: "Inter" }}>✎</span>
                    </div>
                  )}
                </div>
              </div>
              {deal.tags && deal.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {deal.tags.map(tag => (
                    <span key={tag} className="dp-badge" style={{ background: `${T.blue}20`, color: T.blue }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="dp-tabs">
              <div className={`dp-tab ${tab === "notes" ? "active" : ""}`} onClick={() => setTab("notes")}>Notes ({notes.length})</div>
              <div className={`dp-tab ${tab === "timeline" ? "active" : ""}`} onClick={() => setTab("timeline")}>Timeline ({timeline.length})</div>
              <div className={`dp-tab ${tab === "messages" ? "active" : ""}`} onClick={() => setTab("messages")}>Msgs ({messages.length})</div>
              <div className={`dp-tab ${tab === "calls" ? "active" : ""}`} onClick={() => setTab("calls")}>Calls ({calls.length})</div>
              <div className={`dp-tab ${tab === "emails" ? "active" : ""}`} onClick={() => setTab("emails")}>Emails ({emailThreads.length})</div>
            </div>

            <div className="dp-timeline">
              {tab === "notes" && (
                notes.length === 0 ? (
                  <div style={{ textAlign: "center", color: T.muted, padding: 30, fontSize: 13 }}>No notes yet. Add one below.</div>
                ) : (
                  notes.map((n, i) => (
                    <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{(n.details as Record<string, string>)?.text || ""}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>{formatTime(n.created_at)}</div>
                    </div>
                  ))
                )
              )}

              {tab === "timeline" && (
                timeline.length === 0 ? (
                  <div style={{ textAlign: "center", color: T.muted, padding: 30, fontSize: 13 }}>No activity yet.</div>
                ) : (
                  timeline.map((item, i) => {
                    if (item.type === "activity") {
                      const a = item.data as Activity;
                      return (
                        <div key={`a-${i}`} className="dp-tl-item">
                          <div className="dp-tl-icon">{getActivityIcon(a.action)}</div>
                          <div className="dp-tl-content">
                            <div className="dp-tl-text">{getActivityText(a)}</div>
                            <div className="dp-tl-time">{formatTime(a.created_at)}</div>
                          </div>
                        </div>
                      );
                    }
                    if (item.type === "message") {
                      const m = item.data as Message;
                      return (
                        <div key={`m-${i}`} className="dp-tl-item">
                          <div className="dp-tl-icon">{m.channel === "sms" ? "💬" : "📧"}</div>
                          <div className="dp-tl-content">
                            <div className={`dp-tl-msg ${m.direction}`}>{m.body || "(no content)"}</div>
                            <div className="dp-tl-time">{m.direction === "inbound" ? "Received" : m.sent_by === "ai" ? "AI sent" : "Sent"} · {formatTime(m.created_at)}</div>
                          </div>
                        </div>
                      );
                    }
                    if (item.type === "call") {
                      const c = item.data as Call;
                      return (
                        <div key={`c-${i}`} className="dp-tl-item">
                          <div className="dp-tl-icon">📞</div>
                          <div className="dp-tl-content">
                            <div className="dp-tl-text">
                              {c.direction === "inbound" ? "Inbound call" : "Outbound call"}
                              {c.duration_seconds ? ` · ${Math.floor(c.duration_seconds / 60)}:${(c.duration_seconds % 60).toString().padStart(2, "0")}` : ""}
                              {c.ai_score ? ` · Score: ${c.ai_score}` : ""}
                            </div>
                            {c.ai_summary && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{c.ai_summary}</div>}
                            <div className="dp-tl-time">{formatTime(c.created_at)}</div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })
                )
              )}

              {tab === "messages" && (
                messages.length === 0 ? (
                  <div style={{ textAlign: "center", color: T.muted, padding: 30, fontSize: 13 }}>No messages yet.</div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div className={`dp-tl-msg ${m.direction}`}>{m.body || "(no content)"}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 3, textAlign: m.direction === "outbound" ? "right" : "left" }}>
                        {m.sent_by === "ai" ? "AI" : m.direction === "inbound" ? "Contact" : "You"} · {formatTime(m.created_at)}
                      </div>
                    </div>
                  ))
                )
              )}

              {tab === "calls" && (
                calls.length === 0 ? (
                  <div style={{ textAlign: "center", color: T.muted, padding: 30, fontSize: 13 }}>No calls yet.</div>
                ) : (
                  calls.map((c, i) => (
                    <div key={i} className="dp-tl-item">
                      <div className="dp-tl-icon">📞</div>
                      <div className="dp-tl-content">
                        <div className="dp-tl-text">
                          {c.direction === "inbound" ? "Inbound" : "Outbound"} call
                          {c.duration_seconds ? ` · ${Math.floor(c.duration_seconds / 60)}:${(c.duration_seconds % 60).toString().padStart(2, "0")}` : " · Missed"}
                        </div>
                        {c.ai_score && (
                          <span className="dp-badge" style={{ background: c.ai_score >= 70 ? `${T.green}20` : `${T.red}20`, color: c.ai_score >= 70 ? T.green : T.red, marginTop: 4 }}>
                            Score: {c.ai_score}
                          </span>
                        )}
                        {c.ai_summary && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{c.ai_summary}</div>}
                        <div className="dp-tl-time">{formatTime(c.created_at)}</div>
                      </div>
                    </div>
                  ))
                )
              )}

              {tab === "emails" && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <button
                      onClick={() => setShowCompose(!showCompose)}
                      style={{ padding: "8px 16px", background: T.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      {showCompose ? "Cancel" : "Compose Email"}
                    </button>
                  </div>

                  {showCompose && (
                    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>To</div>
                        <input
                          value={composeTo}
                          onChange={e => setComposeTo(e.target.value)}
                          placeholder="email@example.com"
                          style={{ width: "100%", padding: "7px 10px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 13, outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Subject</div>
                        <input
                          value={composeSubject}
                          onChange={e => setComposeSubject(e.target.value)}
                          placeholder="Subject"
                          style={{ width: "100%", padding: "7px 10px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 13, outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Body</div>
                        <textarea
                          value={composeBody}
                          onChange={e => setComposeBody(e.target.value)}
                          placeholder="Write your email..."
                          rows={5}
                          style={{ width: "100%", padding: "8px 10px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 13, outline: "none", fontFamily: "'Inter', sans-serif", resize: "vertical", boxSizing: "border-box" }}
                        />
                      </div>
                      <button
                        onClick={handleSendEmail}
                        disabled={composeSending || !composeTo.trim() || !composeBody.trim()}
                        style={{ padding: "8px 20px", background: T.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: composeSending || !composeTo.trim() || !composeBody.trim() ? 0.5 : 1 }}
                      >
                        {composeSending ? "Sending..." : "Send Email"}
                      </button>
                    </div>
                  )}

                  {emailThreads.length === 0 ? (
                    <div style={{ textAlign: "center", color: T.muted, padding: 30, fontSize: 13 }}>
                      {deal?.email ? "No email threads found." : "No email address on file."}
                    </div>
                  ) : (
                    emailThreads.map((et) => (
                      <div key={et.id} style={{ marginBottom: 8 }}>
                        <div
                          onClick={() => handleExpandEmail(et.id)}
                          style={{
                            background: T.surface, border: `1px solid ${expandedEmail === et.id ? T.orange + "50" : T.border}`,
                            borderRadius: 10, padding: 12, cursor: "pointer", transition: "border-color 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {et.subject}
                              </div>
                              <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>
                                {et.from?.split("<")[0]?.trim() || et.from} → {et.to?.split("<")[0]?.trim() || et.to}
                              </div>
                              <div style={{ fontSize: 12, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {et.snippet}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 10, color: T.muted }}>{et.date ? new Date(et.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</div>
                              {et.messageCount > 1 && (
                                <span className="dp-badge" style={{ background: `${T.blue}20`, color: T.blue, marginTop: 4 }}>{et.messageCount}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {expandedEmail === et.id && emailDetails[et.id] && (
                          <div style={{ marginTop: 4, marginLeft: 12, borderLeft: `2px solid ${T.orange}30`, paddingLeft: 12 }}>
                            {emailDetails[et.id].map((em, i) => (
                              <div key={i} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, marginBottom: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{em.from?.split("<")[0]?.trim()}</div>
                                    <div style={{ fontSize: 10, color: T.muted }}>To: {em.to?.split("<")[0]?.trim()}</div>
                                  </div>
                                  <div style={{ fontSize: 10, color: T.muted }}>{em.date ? new Date(em.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</div>
                                </div>
                                {em.subject && <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontStyle: "italic" }}>{em.subject}</div>}
                                <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto" }}>
                                  {em.body || em.snippet || "(no content)"}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {expandedEmail === et.id && !emailDetails[et.id] && (
                          <div style={{ textAlign: "center", color: T.muted, padding: 12, fontSize: 12 }}>Loading...</div>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            <div className="dp-note-input">
              <textarea className="dp-note-textarea" placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} rows={1} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }} />
              <button className="dp-note-btn" onClick={handleAddNote} disabled={savingNote || !note.trim()}>{savingNote ? "..." : "Add Note"}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
