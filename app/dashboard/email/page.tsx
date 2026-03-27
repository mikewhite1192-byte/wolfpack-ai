"use client";

import { useEffect, useState, useRef } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  bg: "#0D1426",
  blue: "#3498db",
};

interface Thread {
  id: string;
  subject: string;
  from: string;
  to: string;
  lastFrom: string;
  date: string;
  snippet: string;
  messageCount: number;
  isRead: boolean;
}

interface EmailMsg {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
}

function formatEmailName(raw: string) {
  const match = raw.match(/^"?([^"<]+)"?\s*<?/);
  return match?.[1]?.trim() || raw.split("@")[0] || raw;
}

function formatEmailAddr(raw: string) {
  const match = raw.match(/<([^>]+)>/);
  return match?.[1] || raw;
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "Now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function EmailPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMsg[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<EmailMsg | null>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchThreads();
  }, []);

  async function fetchThreads() {
    setLoading(true);
    const res = await fetch("/api/email/threads");
    const data = await res.json();
    if (data.connected === false) {
      setConnected(false);
    } else {
      setConnected(true);
      setThreads(data.threads || []);
    }
    setLoading(false);
  }

  async function loadThread(threadId: string) {
    setMsgLoading(true);
    setActiveThread(threadId);
    setReplyTo(null);
    const res = await fetch(`/api/email/threads/${threadId}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setMsgLoading(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    // Mark as read in UI
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isRead: true } : t));
  }

  async function handleSend() {
    if (!composeBody.trim()) return;
    setSending(true);

    const payload: Record<string, string | undefined> = {
      to: replyTo ? formatEmailAddr(replyTo.from) : composeTo,
      subject: replyTo ? `Re: ${replyTo.subject}` : composeSubject,
      body: composeBody,
    };

    if (replyTo) {
      payload.threadId = replyTo.threadId;
      payload.inReplyTo = replyTo.id;
    }

    await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSending(false);
    setComposeBody("");
    setComposeTo("");
    setComposeSubject("");
    setShowCompose(false);

    if (replyTo) {
      setReplyTo(null);
      loadThread(replyTo.threadId);
    } else {
      fetchThreads();
    }
  }

  function startReply(msg: EmailMsg) {
    setReplyTo(msg);
    setShowCompose(false);
  }

  function startCompose() {
    setReplyTo(null);
    setShowCompose(true);
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
  }

  const filtered = search
    ? threads.filter(t =>
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.from.toLowerCase().includes(search.toLowerCase()) ||
        t.snippet.toLowerCase().includes(search.toLowerCase())
      )
    : threads;

  // Not connected state
  if (connected === false) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: T.text, letterSpacing: 0.5, marginBottom: 8 }}>
            CONNECT YOUR EMAIL
          </div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 24 }}>
            Connect your Gmail account to see all emails with your leads, reply, forward, and compose right from the CRM.
          </div>
          <a
            href="/api/email/connect"
            style={{
              display: "inline-block", padding: "12px 28px", background: T.orange, color: "#fff",
              borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none",
            }}
          >
            Connect Gmail
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", margin: "-24px", overflow: "hidden" }}>
      <style>{`
        .em-sidebar { width: 360px; border-right: 1px solid ${T.border}; display: flex; flex-direction: column; background: ${T.bg}; flex-shrink: 0; }
        .em-search { padding: 12px; border-bottom: 1px solid ${T.border}; display: flex; gap: 6px; }
        .em-search input { flex: 1; padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 8px; font-size: 13px; color: ${T.text}; outline: none; font-family: 'Inter', sans-serif; box-sizing: border-box; }
        .em-search input::placeholder { color: ${T.muted}; }
        .em-list { flex: 1; overflow-y: auto; }
        .em-item { padding: 14px 16px; border-bottom: 1px solid ${T.border}; cursor: pointer; transition: background 0.15s; }
        .em-item:hover { background: rgba(255,255,255,0.03); }
        .em-item.active { background: rgba(232,106,42,0.08); border-left: 3px solid ${T.orange}; }
        .em-item.unread { border-left: 3px solid ${T.blue}; }
        .em-from { font-size: 13px; font-weight: 600; color: ${T.text}; display: flex; justify-content: space-between; margin-bottom: 2px; }
        .em-from.unread { font-weight: 800; }
        .em-subject { font-size: 13px; color: ${T.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
        .em-snippet { font-size: 12px; color: ${T.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .em-time { font-size: 10px; color: ${T.muted}; flex-shrink: 0; }
        .em-count { font-size: 10px; color: ${T.muted}; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 8px; margin-left: 6px; }

        .em-main { flex: 1; display: flex; flex-direction: column; background: ${T.bg}; min-width: 0; }
        .em-thread-header { padding: 16px 20px; border-bottom: 1px solid ${T.border}; flex-shrink: 0; }
        .em-thread-subject { font-size: 18px; font-weight: 700; color: ${T.text}; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px; }
        .em-msgs { flex: 1; overflow-y: auto; padding: 16px 20px; }
        .em-msg-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
        .em-msg-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .em-msg-from { font-size: 13px; font-weight: 700; color: ${T.text}; }
        .em-msg-to { font-size: 11px; color: ${T.muted}; margin-top: 2px; }
        .em-msg-date { font-size: 11px; color: ${T.muted}; flex-shrink: 0; }
        .em-msg-body { font-size: 13px; color: ${T.text}; line-height: 1.7; white-space: pre-wrap; word-wrap: break-word; }
        .em-msg-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid ${T.border}; }
        .em-action-btn { padding: 6px 14px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 6px; color: ${T.muted}; font-size: 11px; cursor: pointer; }
        .em-action-btn:hover { border-color: ${T.orange}; color: ${T.orange}; }

        .em-reply { padding: 16px 20px; border-top: 1px solid ${T.border}; flex-shrink: 0; }
        .em-reply-header { font-size: 12px; color: ${T.muted}; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
        .em-compose-field { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .em-compose-label { font-size: 12px; color: ${T.muted}; width: 60px; flex-shrink: 0; }
        .em-compose-input { flex: 1; padding: 8px 12px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; color: ${T.text}; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .em-compose-input:focus { border-color: ${T.orange}; }
        .em-reply-textarea { width: 100%; padding: 10px 14px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; color: ${T.text}; font-size: 13px; resize: vertical; outline: none; font-family: 'Inter', sans-serif; min-height: 80px; box-sizing: border-box; }
        .em-reply-textarea:focus { border-color: ${T.orange}; }
        .em-reply-actions { display: flex; justify-content: space-between; margin-top: 8px; }
        .em-send-btn { padding: 8px 20px; background: ${T.orange}; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .em-send-btn:disabled { opacity: 0.5; }
        .em-cancel-btn { padding: 8px 14px; background: none; border: 1px solid ${T.border}; border-radius: 8px; color: ${T.muted}; font-size: 12px; cursor: pointer; }
        .em-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: ${T.muted}; font-size: 14px; }
      `}</style>

      {/* Left — Thread List */}
      <div className="em-sidebar">
        <div className="em-search">
          <input placeholder="Search emails..." value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={startCompose} style={{ padding: "6px 14px", background: T.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Compose</button>
        </div>
        <div className="em-list">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>Loading emails...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>No emails found</div>
          ) : (
            filtered.map(t => (
              <div
                key={t.id}
                className={`em-item ${activeThread === t.id ? "active" : ""} ${!t.isRead ? "unread" : ""}`}
                onClick={() => loadThread(t.id)}
              >
                <div className={`em-from ${!t.isRead ? "unread" : ""}`}>
                  <span>
                    {formatEmailName(t.from)}
                    {t.messageCount > 1 && <span className="em-count">{t.messageCount}</span>}
                  </span>
                  <span className="em-time">{timeAgo(t.date)}</span>
                </div>
                <div className="em-subject">{t.subject}</div>
                <div className="em-snippet">{t.snippet}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right — Thread Detail or Compose */}
      <div className="em-main">
        {showCompose ? (
          <>
            <div className="em-thread-header">
              <div className="em-thread-subject">NEW EMAIL</div>
            </div>
            <div style={{ padding: 20, flex: 1 }}>
              <div className="em-compose-field">
                <span className="em-compose-label">To:</span>
                <input className="em-compose-input" value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="em-compose-field">
                <span className="em-compose-label">Subject:</span>
                <input className="em-compose-input" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject" />
              </div>
              <textarea
                className="em-reply-textarea"
                style={{ minHeight: 200, marginTop: 8 }}
                placeholder="Write your email..."
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
              />
              <div className="em-reply-actions">
                <button className="em-cancel-btn" onClick={() => setShowCompose(false)}>Cancel</button>
                <button className="em-send-btn" onClick={handleSend} disabled={sending || !composeTo.trim() || !composeBody.trim()}>
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : !activeThread ? (
          <div className="em-empty">Select an email to read</div>
        ) : (
          <>
            <div className="em-thread-header">
              <div className="em-thread-subject">
                {messages[0]?.subject || "Loading..."}
              </div>
            </div>
            <div className="em-msgs">
              {msgLoading ? (
                <div style={{ textAlign: "center", color: T.muted, padding: 40 }}>Loading...</div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className="em-msg-card">
                    <div className="em-msg-header">
                      <div>
                        <div className="em-msg-from">{formatEmailName(m.from)}</div>
                        <div className="em-msg-to">to {formatEmailName(m.to)}</div>
                      </div>
                      <div className="em-msg-date">{fullDate(m.date)}</div>
                    </div>
                    <div className="em-msg-body">{m.body.substring(0, 2000)}</div>
                    <div className="em-msg-actions">
                      <button className="em-action-btn" onClick={() => startReply(m)}>Reply</button>
                      <button className="em-action-btn" onClick={() => {
                        setComposeTo("");
                        setComposeSubject(`Fwd: ${m.subject}`);
                        setComposeBody(`\n\n---------- Forwarded message ----------\nFrom: ${m.from}\nDate: ${m.date}\nSubject: ${m.subject}\n\n${m.body}`);
                        setShowCompose(true);
                        setReplyTo(null);
                        setActiveThread(null);
                      }}>Forward</button>
                    </div>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>

            {/* Reply Box */}
            {replyTo && (
              <div className="em-reply">
                <div className="em-reply-header">
                  <span>Replying to {formatEmailName(replyTo.from)}</span>
                  <button className="em-cancel-btn" onClick={() => setReplyTo(null)} style={{ padding: "3px 10px" }}>Cancel</button>
                </div>
                <textarea
                  className="em-reply-textarea"
                  placeholder="Write your reply..."
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  autoFocus
                />
                <div className="em-reply-actions">
                  <div />
                  <button className="em-send-btn" onClick={handleSend} disabled={sending || !composeBody.trim()}>
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
