"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { X, Send } from "lucide-react";

interface Message { id: string; direction: string; channel: string; body: string | null; sent_by: string | null; status: string; created_at: string; }
interface ChatDrawerProps { contactId: string; contactName: string; contactPhone?: string | null; onClose: () => void; }

export default function ChatDrawer({ contactId, contactName, contactPhone, onClose }: ChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => { setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const listRes = await fetch("/api/conversations?status=all");
      const listData = await listRes.json();
      const existing = (listData.conversations || []).find((c: { contact_id: string }) => c.contact_id === contactId);
      if (existing) { setConvId(existing.id); const msgRes = await fetch(`/api/conversations/${existing.id}/messages`); const msgData = await msgRes.json(); setMessages(msgData.messages || []); }
      else { const createRes = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId }) }); const createData = await createRes.json(); if (createData.conversation) setConvId(createData.conversation.id); setMessages([]); }
      setLoading(false); scrollToBottom();
    }
    init();
  }, [contactId, scrollToBottom]);

  useEffect(() => { if (!convId) return; const i = setInterval(async () => { const res = await fetch(`/api/conversations/${convId}/messages`); const data = await res.json(); setMessages(data.messages || []); }, 5000); return () => clearInterval(i); }, [convId]);

  async function handleSend() {
    if (!input.trim() || !convId) return;
    setSending(true);
    await fetch(`/api/conversations/${convId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: input, channel: "sms" }) });
    setInput(""); setSending(false);
    const res = await fetch(`/api/conversations/${convId}/messages`); const data = await res.json(); setMessages(data.messages || []); scrollToBottom();
  }

  function formatMsgTime(d: string) { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }

  return (
    <div className="fixed inset-0 bg-black/50 z-[250] flex justify-end" onClick={onClose}>
      <div className="w-[420px] max-w-full h-screen bg-[#0a0a0a] border-l border-white/[0.07] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-lg font-bold text-[#e8eaf0] font-display tracking-wider">{contactName}</div>
            {contactPhone && <div className="text-xs text-[#b0b4c8]">{contactPhone} - SMS</div>}
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer p-1.5 rounded-md hover:bg-white/5 hover:text-[#e8eaf0] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-0.5">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-[#b0b4c8] text-sm">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[#b0b4c8] text-sm text-center px-10">No messages yet.<br />Send a text to start the conversation.</div>
          ) : (
            messages.map((m, i) => {
              const next = messages[i + 1];
              const showTail = !next || next.direction !== m.direction;
              const statusLabel = m.direction === "outbound" ? (m.status === "delivered" ? "Delivered" : m.status === "sent" || m.status === "received" ? "Sent" : m.status === "failed" ? "Not Delivered" : "") : "";
              return (
                <div key={m.id} className={`flex flex-col ${showTail ? "mb-1.5" : "mb-px"} ${m.direction === "inbound" ? "items-start" : "items-end"}`}>
                  <div className={`w-fit max-w-[75%] px-3 py-2 text-sm leading-snug break-words whitespace-pre-wrap ${
                    m.direction === "inbound"
                      ? `bg-slate-800 text-[#e8eaf0] ${showTail ? "rounded-2xl rounded-bl-sm" : "rounded-2xl"}`
                      : `bg-[#E86A2A] text-white ${showTail ? "rounded-2xl rounded-br-sm" : "rounded-2xl"}`
                  }`}>{m.body}</div>
                  {showTail && (
                    <div className="text-[10px] text-[#b0b4c8] mt-0.5 px-1">
                      {m.sent_by === "ai" && <span className="text-emerald-400">AI · </span>}
                      {formatMsgTime(m.created_at)}
                      {statusLabel && <span className={m.status === "failed" ? "text-red-400" : ""}> · {statusLabel}</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3.5 border-t border-white/[0.07] flex gap-2.5 flex-shrink-0">
          <textarea
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={1}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1 px-3.5 py-2.5 bg-[#111] border border-white/[0.07] rounded-xl text-[#e8eaf0] text-sm resize-none outline-none min-h-[42px] max-h-[100px] focus:border-[#E86A2A] transition-colors"
          />
          <button onClick={handleSend} disabled={sending || !input.trim()}
            className={`px-5 py-2.5 bg-[#E86A2A] text-white border-none rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap transition-colors ${sending || !input.trim() ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
