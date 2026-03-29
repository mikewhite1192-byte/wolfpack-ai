"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  bg: "#0a0a0a",
  blue: "#3498db",
};

interface Conversation {
  id: string;
  contact_id: string;
  channel: string;
  status: string;
  ai_enabled: boolean;
  last_message_at: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  last_message: string | null;
  unread_count: string;
  deal_id: string | null;
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

interface ContactDetail {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string | null;
  lead_score: number;
  created_at: string;
  stage_name: string | null;
  stage_color: string | null;
  deal_value: string | null;
  deal_id: string | null;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeContact, setActiveContact] = useState<Conversation | null>(null);
  const [contactDetail, setContactDetail] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [contactsList, setContactsList] = useState<{id: string; first_name: string | null; last_name: string | null; phone: string | null; deal_id: string | null}[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [notes, setNotes] = useState<{text: string; created_at: string}[]>([]);
  const [togglingAi, setTogglingAi] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations?status=open");
    const data = await res.json();
    setConversations(data.conversations || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  async function loadMessages(convId: string) {
    setMsgLoading(true);
    setActiveConvo(convId);
    const conv = conversations.find(c => c.id === convId);
    setActiveContact(conv || null);
    const res = await fetch(`/api/conversations/${convId}/messages`);
    const data = await res.json();
    setMessages(data.messages || []);
    setMsgLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    // Load contact detail + notes
    if (conv?.contact_id) {
      const cRes = await fetch(`/api/contacts/${conv.contact_id}`);
      const cData = await cRes.json();
      setContactDetail(cData.contact || null);
    }
    if (conv?.deal_id) {
      const aRes = await fetch(`/api/deals/${conv.deal_id}/activity`);
      const aData = await aRes.json();
      const noteItems = (aData.activity || [])
        .filter((a: {action: string; details: Record<string, string> | null}) => a.action === "note_added")
        .map((a: {details: Record<string, string> | null; created_at: string}) => ({
          text: a.details?.text || "",
          created_at: a.created_at,
        }));
      setNotes(noteItems);
    } else {
      setNotes([]);
    }
  }

  useEffect(() => {
    if (!activeConvo) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/conversations/${activeConvo}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeConvo]);

  async function openNewConvo() {
    setShowNewConvo(true);
    const res = await fetch("/api/contacts?status=all");
    const data = await res.json();
    setContactsList(data.contacts || []);
  }

  async function startConvo(contactId: string) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    const data = await res.json();
    if (data.conversation) {
      setShowNewConvo(false);
      setContactSearch("");
      await fetchConversations();
      loadMessages(data.conversation.id);
    }
  }

  async function handleSend() {
    if (!input.trim() || !activeConvo) return;
    setSending(true);
    await fetch(`/api/conversations/${activeConvo}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: input, channel: "sms" }),
    });
    setInput("");
    setSending(false);
    const res = await fetch(`/api/conversations/${activeConvo}/messages`);
    const data = await res.json();
    setMessages(data.messages || []);
    fetchConversations();
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function handleAddNote() {
    if (!note.trim() || !activeContact?.deal_id) return;
    setSavingNote(true);
    await fetch(`/api/deals/${activeContact.deal_id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setNote("");
    setSavingNote(false);
    // Refresh notes
    const aRes = await fetch(`/api/deals/${activeContact.deal_id}/activity`);
    const aData = await aRes.json();
    const noteItems = (aData.activity || [])
      .filter((a: {action: string}) => a.action === "note_added")
      .map((a: {details: Record<string, string> | null; created_at: string}) => ({
        text: a.details?.text || "",
        created_at: a.created_at,
      }));
    setNotes(noteItems);
  }

  async function handleToggleAi() {
    if (!activeConvo || !activeContact || togglingAi) return;
    setTogglingAi(true);
    const newVal = !activeContact.ai_enabled;
    await fetch(`/api/conversations/${activeConvo}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiEnabled: newVal }),
    });
    setActiveContact({ ...activeContact, ai_enabled: newVal });
    setConversations(prev => prev.map(c => c.id === activeConvo ? { ...c, ai_enabled: newVal } : c));
    setTogglingAi(false);
  }

  function contactName(c: Conversation) {
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.phone || "Unknown";
  }

  function formatTime(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "Now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatMsgTime(d: string) {
    return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatNoteTime(d: string) {
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  const filtered = search
    ? conversations.filter(c => contactName(c).toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
    : conversations;

  const cd = contactDetail;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", margin: "-24px", overflow: "hidden" }}>
      <style>{`
        .cv-sidebar { width: 280px; border-right: 1px solid ${T.border}; display: flex; flex-direction: column; background: ${T.bg}; flex-shrink: 0; }
        .cv-search { padding: 12px; border-bottom: 1px solid ${T.border}; }
        .cv-search input { width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 8px; font-size: 13px; color: ${T.text}; outline: none; font-family: 'Inter', sans-serif; box-sizing: border-box; }
        .cv-search input::placeholder { color: ${T.muted}; }
        .cv-list { flex: 1; overflow-y: auto; }
        .cv-item { display: flex; gap: 10px; padding: 12px 14px; border-bottom: 1px solid ${T.border}; cursor: pointer; transition: background 0.15s; }
        .cv-item:hover { background: rgba(255,255,255,0.03); }
        .cv-item.active { background: rgba(232,106,42,0.08); border-left: 3px solid ${T.orange}; }
        .cv-avatar { width: 36px; height: 36px; border-radius: 50%; background: ${T.orange}20; color: ${T.orange}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; font-family: 'Bebas Neue', sans-serif; }
        .cv-info { flex: 1; min-width: 0; }
        .cv-name { font-size: 13px; font-weight: 600; color: ${T.text}; display: flex; justify-content: space-between; }
        .cv-preview { font-size: 12px; color: ${T.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
        .cv-time { font-size: 10px; color: ${T.muted}; flex-shrink: 0; }
        .cv-unread { background: ${T.orange}; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }

        .cv-thread { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; background: ${T.bg}; border-right: 1px solid ${T.border}; }
        .cv-thread-header { padding: 12px 16px; border-bottom: 1px solid ${T.border}; flex-shrink: 0; }
        .cv-thread-name { font-size: 15px; font-weight: 700; color: ${T.text}; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px; }
        .cv-thread-phone { font-size: 11px; color: ${T.muted}; }
        .cv-msgs { flex: 1; overflow-y: auto; padding: 14px 10px; display: flex; flex-direction: column; gap: 1px; min-height: 0; }
        .cv-msgs-inner { display: flex; flex-direction: column; gap: 1px; margin-top: auto; }
        .cv-msg-row { display: flex; flex-direction: column; margin-bottom: 1px; }
        .cv-msg-row.inbound { align-items: flex-start; padding-left: 8px; padding-right: 40px; }
        .cv-msg-row.outbound { align-items: flex-end; padding-right: 8px; padding-left: 40px; }
        .cv-msg-row.show-tail { margin-bottom: 5px; }
        .cv-bubble { width: fit-content; max-width: 85%; padding: 7px 11px; font-size: 13px; line-height: 1.4; word-wrap: break-word; white-space: pre-wrap; }
        .cv-bubble.inbound { background: #1E293B; color: ${T.text}; border-radius: 16px; }
        .cv-msg-row.show-tail .cv-bubble.inbound { border-radius: 16px 16px 16px 4px; }
        .cv-bubble.outbound { background: ${T.orange}; color: #fff; border-radius: 16px; }
        .cv-msg-row.show-tail .cv-bubble.outbound { border-radius: 16px 16px 4px 16px; }
        .cv-meta { font-size: 10px; color: ${T.muted}; margin-top: 2px; padding: 0 4px; }
        .cv-input { padding: 10px 12px; border-top: 1px solid ${T.border}; display: flex; gap: 8px; flex-shrink: 0; }
        .cv-input textarea { flex: 1; padding: 8px 11px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; color: ${T.text}; font-size: 13px; resize: none; outline: none; font-family: 'Inter', sans-serif; min-height: 36px; max-height: 80px; }
        .cv-input textarea:focus { border-color: ${T.orange}; }
        .cv-send { padding: 8px 16px; background: ${T.orange}; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .cv-send:disabled { opacity: 0.5; }
        .cv-thread-footer { padding: 10px 14px; border-top: 1px solid ${T.border}; flex-shrink: 0; display: flex; gap: 10px; align-items: center; }
        .cv-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: ${T.muted}; font-size: 14px; }

        .cv-detail { flex: 1; min-width: 0; background: ${T.bg}; overflow-y: auto; display: flex; flex-direction: column; }
        .cv-detail-header { padding: 20px 18px; border-bottom: 1px solid ${T.border}; text-align: center; }
        .cv-detail-avatar { width: 52px; height: 52px; border-radius: 50%; background: ${T.orange}20; color: ${T.orange}; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; font-family: 'Bebas Neue', sans-serif; margin: 0 auto 10px; }
        .cv-detail-name { font-size: 18px; font-weight: 700; color: ${T.text}; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px; }
        .cv-detail-company { font-size: 12px; color: ${T.muted}; margin-top: 2px; }
        .cv-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 14px 18px; border-bottom: 1px solid ${T.border}; }
        .cv-detail-item { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; padding: 8px 10px; }
        .cv-detail-label { font-size: 9px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
        .cv-detail-val { font-size: 12px; color: ${T.text}; word-break: break-all; }
        .cv-stage-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .cv-notes-section { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .cv-notes-title { font-size: 10px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px 18px 8px; }
        .cv-notes-list { flex: 1; overflow-y: auto; padding: 0 18px; }
        .cv-note-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; padding: 10px; margin-bottom: 6px; }
        .cv-note-text { font-size: 12px; color: ${T.text}; line-height: 1.5; white-space: pre-wrap; }
        .cv-note-time { font-size: 10px; color: ${T.muted}; margin-top: 4px; }
        .cv-note-input { display: flex; gap: 6px; padding: 10px 18px; border-top: 1px solid ${T.border}; flex-shrink: 0; }
        .cv-note-textarea { flex: 1; padding: 7px 10px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; color: ${T.text}; font-size: 12px; resize: none; outline: none; font-family: 'Inter', sans-serif; min-height: 32px; }
        .cv-note-textarea:focus { border-color: ${T.orange}; }
        .cv-note-btn { padding: 7px 12px; background: ${T.orange}; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .cv-note-btn:disabled { opacity: 0.5; }
      `}</style>

      {/* Left — Conversation List */}
      <div className="cv-sidebar">
        <div className="cv-search" style={{ display: "flex", gap: 6 }}>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <button onClick={openNewConvo} style={{ padding: "6px 12px", background: T.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ New</button>
        </div>
        <div className="cv-list">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>
              No conversations yet.<br />They appear when leads text your number.
            </div>
          ) : (
            filtered.map(c => (
              <div key={c.id} className={`cv-item ${activeConvo === c.id ? "active" : ""}`} onClick={() => loadMessages(c.id)}>
                <div className="cv-avatar">{(c.first_name?.[0] || "") + (c.last_name?.[0] || "") || "?"}</div>
                <div className="cv-info">
                  <div className="cv-name">
                    <span>{contactName(c)}{c.ai_enabled && <span style={{ fontSize: 10, color: T.green, marginLeft: 4 }}>AI</span>}</span>
                    {c.last_message_at && <span className="cv-time">{formatTime(c.last_message_at)}</span>}
                  </div>
                  <div className="cv-preview">{c.last_message || "No messages yet"}</div>
                </div>
                {parseInt(c.unread_count) > 0 && <span className="cv-unread">{c.unread_count}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Middle — Message Thread */}
      <div className="cv-thread">
        {!activeConvo ? (
          <div className="cv-empty">Select a conversation to view messages</div>
        ) : (
          <>
            <div className="cv-thread-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="cv-thread-name">{activeContact ? contactName(activeContact) : ""}</div>
                <div className="cv-thread-phone">
                  {activeContact?.phone || ""} · SMS
                </div>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: togglingAi ? "wait" : "pointer" }}
                onClick={handleToggleAi}
                title={activeContact?.ai_enabled ? "AI Auto-Reply is ON — click to disable" : "AI Auto-Reply is OFF — click to enable"}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: activeContact?.ai_enabled ? T.green : T.muted,
                  boxShadow: activeContact?.ai_enabled ? `0 0 6px ${T.green}` : "none",
                  transition: "all 0.2s",
                }} />
                <div style={{
                  width: 34, height: 18, borderRadius: 9, padding: 2,
                  background: activeContact?.ai_enabled ? T.green : "rgba(255,255,255,0.15)",
                  transition: "background 0.2s", position: "relative",
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%", background: "#fff",
                    transition: "transform 0.2s",
                    transform: activeContact?.ai_enabled ? "translateX(16px)" : "translateX(0)",
                  }} />
                </div>
                <span style={{ fontSize: 10, color: activeContact?.ai_enabled ? T.green : T.muted, fontWeight: 600 }}>AI</span>
              </div>
            </div>
            <div className="cv-msgs">
              {msgLoading ? (
                <div style={{ textAlign: "center", color: T.muted, padding: 20, fontSize: 13 }}>Loading...</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: "center", color: T.muted, padding: 20, fontSize: 13 }}>No messages yet. Send one to start.</div>
              ) : (
                <div className="cv-msgs-inner">
                  {messages.map((m, i) => {
                    const next = messages[i + 1];
                    const showTail = !next || next.direction !== m.direction;
                    const statusLabel = m.direction === "outbound"
                      ? (m.status === "delivered" ? "Delivered"
                        : m.status === "sent" ? "Sent"
                        : m.status === "failed" ? "Not Delivered"
                        : "")
                      : "";
                    return (
                      <div key={m.id} className={`cv-msg-row ${m.direction}${showTail ? " show-tail" : ""}`}>
                        <div className={`cv-bubble ${m.direction}`}>{m.body}</div>
                        {showTail && (
                          <div className="cv-meta">
                            {m.sent_by === "ai" && <span style={{ color: T.green }}>AI · </span>}
                            {formatMsgTime(m.created_at)}
                            {statusLabel && <span style={{ color: m.status === "failed" ? T.red : T.muted }}> · {statusLabel}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            <div className="cv-input">
              <textarea
                placeholder="Type a message..."
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={1}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <button className="cv-send" onClick={handleSend} disabled={sending || !input.trim()}>
                {sending ? "..." : "Send"}
              </button>
            </div>
            <div className="cv-thread-footer">
              <span style={{ fontSize: 11, color: T.muted }}>
                {activeContact?.channel === "imessage" ? "iMessage" : "SMS"} · {activeContact?.phone}
              </span>
              <span
                style={{ marginLeft: "auto", fontSize: 11, color: activeContact?.ai_enabled ? T.green : T.muted, fontWeight: 600, cursor: "pointer" }}
                onClick={handleToggleAi}
              >
                {activeContact?.ai_enabled ? "AI Auto-Reply On" : "AI Off"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right — Contact Info Card */}
      {activeConvo && activeContact && (
        <div className="cv-detail">
          <div className="cv-detail-header">
            <div className="cv-detail-avatar">
              {(activeContact.first_name?.[0] || "") + (activeContact.last_name?.[0] || "") || "?"}
            </div>
            <div className="cv-detail-name">{contactName(activeContact)}</div>
            {activeContact.company && <div className="cv-detail-company">{activeContact.company}</div>}
            {cd?.stage_name && (
              <div style={{ marginTop: 8 }}>
                <span className="cv-stage-badge" style={{ background: `${cd.stage_color || T.blue}20`, color: cd.stage_color || T.blue }}>
                  {cd.stage_name}
                </span>
              </div>
            )}
          </div>

          <div className="cv-detail-grid">
            <div className="cv-detail-item">
              <div className="cv-detail-label">Phone</div>
              <div className="cv-detail-val">{activeContact.phone || "—"}</div>
            </div>
            <div className="cv-detail-item">
              <div className="cv-detail-label">Email</div>
              <div className="cv-detail-val" style={{ fontSize: 11 }}>{activeContact.email || "—"}</div>
            </div>
            <div className="cv-detail-item">
              <div className="cv-detail-label">Deal Value</div>
              <div className="cv-detail-val" style={{ color: T.orange, fontFamily: "'Bebas Neue', sans-serif", fontSize: 16 }}>
                {cd?.deal_value ? `$${parseFloat(cd.deal_value).toLocaleString()}` : "$0"}
              </div>
            </div>
            <div className="cv-detail-item">
              <div className="cv-detail-label">Source</div>
              <div className="cv-detail-val">{cd?.source || "—"}</div>
            </div>
            {cd?.lead_score && cd.lead_score > 0 ? (
              <div className="cv-detail-item" style={{ gridColumn: "1 / -1" }}>
                <div className="cv-detail-label">Lead Score</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <div style={{ flex: 1, height: 5, background: T.surface, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${cd.lead_score}%`, borderRadius: 3, background: cd.lead_score >= 70 ? T.green : cd.lead_score >= 40 ? T.orange : T.red }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cd.lead_score >= 70 ? T.green : cd.lead_score >= 40 ? T.orange : T.red }}>{cd.lead_score}</span>
                </div>
              </div>
            ) : null}
            <div className="cv-detail-item" style={{ gridColumn: "1 / -1" }}>
              <div className="cv-detail-label">Added</div>
              <div className="cv-detail-val">{cd ? formatDate(cd.created_at) : "—"}</div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="cv-notes-section">
            <div className="cv-notes-title">Notes ({notes.length})</div>
            <div className="cv-notes-list">
              {notes.length === 0 ? (
                <div style={{ textAlign: "center", color: T.muted, fontSize: 12, padding: 20 }}>No notes yet</div>
              ) : (
                notes.map((n, i) => (
                  <div key={i} className="cv-note-card">
                    <div className="cv-note-text">{n.text}</div>
                    <div className="cv-note-time">{formatNoteTime(n.created_at)}</div>
                  </div>
                ))
              )}
            </div>
            {activeContact.deal_id && (
              <div className="cv-note-input">
                <textarea
                  className="cv-note-textarea"
                  placeholder="Add a note..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={1}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                />
                <button className="cv-note-btn" onClick={handleAddNote} disabled={savingNote || !note.trim()}>
                  {savingNote ? "..." : "Add"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConvo && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowNewConvo(false)}>
          <div style={{ width: 400, maxWidth: "90vw", maxHeight: "70vh", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: T.text, letterSpacing: 0.5, marginBottom: 12 }}>NEW CONVERSATION</div>
              <input
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                autoFocus
                style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.text, outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {contactsList
                .filter(c => {
                  if (!contactSearch) return true;
                  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase();
                  return name.includes(contactSearch.toLowerCase()) || c.phone?.includes(contactSearch);
                })
                .map(c => (
                  <div
                    key={c.id}
                    onClick={() => startConvo(c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${T.orange}20`, color: T.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", flexShrink: 0 }}>
                      {(c.first_name?.[0] || "") + (c.last_name?.[0] || "") || "?"}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                        {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown"}
                      </div>
                      <div style={{ fontSize: 12, color: T.muted }}>{c.phone || "No phone"}</div>
                    </div>
                  </div>
                ))
              }
              {contactsList.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>No contacts found. Add a contact first.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
