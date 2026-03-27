"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  bg: "#0D1426",
};

interface Message {
  id: string;
  direction: string;
  channel: string;
  body: string | null;
  sent_by: string | null;
  status: string;
  created_at: string;
}

interface ChatDrawerProps {
  contactId: string;
  contactName: string;
  contactPhone?: string | null;
  onClose: () => void;
}

export default function ChatDrawer({ contactId, contactName, contactPhone, onClose }: ChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // Find or create conversation for this contact
  useEffect(() => {
    async function init() {
      setLoading(true);
      // Try to find existing conversation
      const listRes = await fetch(`/api/conversations?status=all`);
      const listData = await listRes.json();
      const existing = (listData.conversations || []).find(
        (c: { contact_id: string }) => c.contact_id === contactId
      );

      if (existing) {
        setConvId(existing.id);
        const msgRes = await fetch(`/api/conversations/${existing.id}/messages`);
        const msgData = await msgRes.json();
        setMessages(msgData.messages || []);
      } else {
        // Create new conversation
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        });
        const createData = await createRes.json();
        if (createData.conversation) {
          setConvId(createData.conversation.id);
        }
        setMessages([]);
      }
      setLoading(false);
      scrollToBottom();
    }
    init();
  }, [contactId, scrollToBottom]);

  // Poll for new messages
  useEffect(() => {
    if (!convId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
    }, 5000);
    return () => clearInterval(interval);
  }, [convId]);

  async function handleSend() {
    if (!input.trim() || !convId) return;
    setSending(true);
    await fetch(`/api/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: input, channel: "sms" }),
    });
    setInput("");
    setSending(false);
    const res = await fetch(`/api/conversations/${convId}/messages`);
    const data = await res.json();
    setMessages(data.messages || []);
    scrollToBottom();
  }

  function formatMsgTime(d: string) {
    return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <>
      <style>{`
        .chat-drawer-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 250; display: flex; justify-content: flex-end; }
        .chat-drawer { width: 420px; max-width: 100vw; height: 100vh; background: ${T.bg}; border-left: 1px solid ${T.border}; display: flex; flex-direction: column; }
        .cd-header { padding: 16px 20px; border-bottom: 1px solid ${T.border}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .cd-header-info { }
        .cd-name { font-size: 18px; font-weight: 700; color: ${T.text}; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px; }
        .cd-phone { font-size: 12px; color: ${T.muted}; }
        .cd-close { background: none; border: none; color: ${T.muted}; font-size: 24px; cursor: pointer; padding: 4px 10px; border-radius: 6px; }
        .cd-close:hover { background: rgba(255,255,255,0.05); color: ${T.text}; }
        .cd-messages { flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 2px; }
        .cd-msg-row { display: flex; flex-direction: column; margin-bottom: 1px; }
        .cd-msg-row.inbound { align-items: flex-start; }
        .cd-msg-row.outbound { align-items: flex-end; }
        .cd-msg-row.show-tail { margin-bottom: 6px; }
        .cd-msg { width: fit-content; max-width: 75%; padding: 8px 12px; font-size: 14px; line-height: 1.4; word-wrap: break-word; white-space: pre-wrap; }
        .cd-msg.inbound { background: #1E293B; color: ${T.text}; border-radius: 18px; }
        .cd-msg-row.show-tail .cd-msg.inbound { border-radius: 18px 18px 18px 4px; }
        .cd-msg.outbound { background: ${T.orange}; color: #fff; border-radius: 18px; }
        .cd-msg-row.show-tail .cd-msg.outbound { border-radius: 18px 18px 4px 18px; }
        .cd-msg-meta { font-size: 10px; color: ${T.muted}; margin-top: 2px; padding: 0 4px; }
        .cd-input { padding: 14px 16px; border-top: 1px solid ${T.border}; display: flex; gap: 10px; flex-shrink: 0; }
        .cd-textarea { flex: 1; padding: 10px 14px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; color: ${T.text}; font-size: 13px; resize: none; outline: none; font-family: 'Inter', sans-serif; min-height: 42px; max-height: 100px; }
        .cd-textarea:focus { border-color: ${T.orange}; }
        .cd-send { padding: 10px 20px; background: ${T.orange}; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .cd-send:disabled { opacity: 0.5; }
        .cd-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: ${T.muted}; font-size: 13px; text-align: center; padding: 40px; }
      `}</style>

      <div className="chat-drawer-overlay" onClick={onClose}>
        <div className="chat-drawer" onClick={e => e.stopPropagation()}>
          <div className="cd-header">
            <div className="cd-header-info">
              <div className="cd-name">{contactName}</div>
              {contactPhone && <div className="cd-phone">{contactPhone} - SMS</div>}
            </div>
            <button className="cd-close" onClick={onClose}>x</button>
          </div>

          <div className="cd-messages">
            {loading ? (
              <div className="cd-empty">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="cd-empty">
                No messages yet.<br />Send a text to start the conversation.
              </div>
            ) : (
              messages.map((m, i) => {
                const next = messages[i + 1];
                const showTail = !next || next.direction !== m.direction;
                const statusLabel = m.direction === "outbound"
                  ? m.status === "delivered" ? "Delivered"
                  : m.status === "sent" ? "Sent"
                  : m.status === "failed" ? "Not Delivered"
                  : m.status === "received" ? "Sent"
                  : ""
                  : "";
                return (
                  <div key={m.id} className={`cd-msg-row ${m.direction}${showTail ? " show-tail" : ""}`}>
                    <div className={`cd-msg ${m.direction}`}>{m.body}</div>
                    {showTail && (
                      <div className="cd-msg-meta">
                        {m.sent_by === "ai" && <span style={{ color: T.green }}>AI · </span>}
                        {formatMsgTime(m.created_at)}
                        {statusLabel && <span style={{ color: m.status === "failed" ? "#e74c3c" : T.muted }}> · {statusLabel}</span>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="cd-input">
            <textarea
              className="cd-textarea"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={1}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button className="cd-send" onClick={handleSend} disabled={sending || !input.trim()}>
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
