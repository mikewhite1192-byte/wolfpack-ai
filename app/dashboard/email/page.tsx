"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Mail, Pen, Reply, Forward, Send, X } from "lucide-react";

interface Thread { id: string; subject: string; from: string; to: string; lastFrom: string; date: string; snippet: string; messageCount: number; isRead: boolean; }
interface EmailMsg { id: string; threadId: string; from: string; to: string; subject: string; body: string; date: string; isRead: boolean; }

function formatEmailName(raw: string) { const match = raw.match(/^"?([^"<]+)"?\s*<?/); return match?.[1]?.trim() || raw.split("@")[0] || raw; }
function formatEmailAddr(raw: string) { const match = raw.match(/<([^>]+)>/); return match?.[1] || raw; }
function timeAgo(dateStr: string) { const d = new Date(dateStr); const diff = Date.now() - d.getTime(); if (diff < 60000) return "Now"; if (diff < 3600000) return `${Math.floor(diff / 60000)}m`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`; if (diff < 604800000) return d.toLocaleDateString("en-US", { weekday: "short" }); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function fullDate(dateStr: string) { return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }

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

  useEffect(() => { fetchThreads(); }, []);

  async function fetchThreads() { setLoading(true); const res = await fetch("/api/email/threads"); const data = await res.json(); if (data.connected === false) { setConnected(false); } else { setConnected(true); setThreads(data.threads || []); } setLoading(false); }
  async function loadThread(threadId: string) { setMsgLoading(true); setActiveThread(threadId); setReplyTo(null); const res = await fetch(`/api/email/threads/${threadId}`); const data = await res.json(); setMessages(data.messages || []); setMsgLoading(false); setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100); setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isRead: true } : t)); }
  async function handleSend() { if (!composeBody.trim()) return; setSending(true); const payload: Record<string, string | undefined> = { to: replyTo ? formatEmailAddr(replyTo.from) : composeTo, subject: replyTo ? `Re: ${replyTo.subject}` : composeSubject, body: composeBody }; if (replyTo) { payload.threadId = replyTo.threadId; payload.inReplyTo = replyTo.id; } await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); setSending(false); setComposeBody(""); setComposeTo(""); setComposeSubject(""); setShowCompose(false); if (replyTo) { setReplyTo(null); loadThread(replyTo.threadId); } else { fetchThreads(); } }
  function startReply(msg: EmailMsg) { setReplyTo(msg); setShowCompose(false); }
  function startCompose() { setReplyTo(null); setShowCompose(true); setComposeTo(""); setComposeSubject(""); setComposeBody(""); }

  const filtered = search ? threads.filter(t => t.subject.toLowerCase().includes(search.toLowerCase()) || t.from.toLowerCase().includes(search.toLowerCase()) || t.snippet.toLowerCase().includes(search.toLowerCase())) : threads;

  if (connected === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-[400px]">
          <Mail className="w-12 h-12 text-[#E86A2A] mx-auto mb-4" />
          <div className="font-display text-2xl text-[#e8eaf0] tracking-wider mb-2">CONNECT YOUR EMAIL</div>
          <div className="text-sm text-[#b0b4c8] leading-relaxed mb-6">Connect your Gmail account to see all emails with your leads, reply, forward, and compose right from the CRM.</div>
          <a href="/api/email/connect" className="inline-block px-7 py-3 bg-[#E86A2A] text-white rounded-xl text-sm font-bold no-underline hover:bg-[#ff7b3a] transition-colors">Connect Gmail</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-60px)] -m-6 overflow-hidden relative">
      {/* Left — Thread List */}
      <div className={`w-full md:w-[340px] border-r border-white/[0.07] flex flex-col bg-[#0a0a0a] flex-shrink-0 overflow-hidden ${activeThread ? "max-md:hidden" : ""}`}>
        <div className="p-3 border-b border-white/[0.07] flex gap-1.5">
          <input placeholder="Search emails..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
          <button onClick={startCompose} className="flex items-center gap-1 px-3.5 py-2 bg-[#E86A2A] text-white border-none rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap hover:bg-[#ff7b3a] transition-colors">
            <Pen className="w-3 h-3" /> Compose
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-10 text-center text-[#b0b4c8] text-sm">Loading emails...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-[#b0b4c8] text-sm">No emails found</div>
          ) : (
            filtered.map(t => (
              <div key={t.id} onClick={() => loadThread(t.id)}
                className={`px-4 py-3.5 border-b border-white/[0.07] cursor-pointer transition-colors hover:bg-white/[0.03] ${activeThread === t.id ? "bg-[#E86A2A]/[0.08] border-l-[3px] border-l-[#E86A2A]" : ""} ${!t.isRead ? "border-l-[3px] border-l-blue-400" : ""}`}>
                <div className={`text-[13px] text-[#e8eaf0] flex justify-between mb-0.5 ${!t.isRead ? "font-extrabold" : "font-semibold"}`}>
                  <span>{formatEmailName(t.from)}{t.messageCount > 1 && <span className="text-[10px] text-[#b0b4c8] bg-white/[0.06] px-1.5 py-0.5 rounded-md ml-1.5">{t.messageCount}</span>}</span>
                  <span className="text-[10px] text-[#b0b4c8] flex-shrink-0">{timeAgo(t.date)}</span>
                </div>
                <div className="text-[13px] text-[#e8eaf0] whitespace-nowrap overflow-hidden text-ellipsis mb-0.5">{t.subject}</div>
                <div className="text-xs text-[#b0b4c8] whitespace-nowrap overflow-hidden text-ellipsis">{t.snippet}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right — Thread or Compose */}
      <div className={`flex-1 flex flex-col bg-[#0a0a0a] min-w-0 overflow-hidden ${!activeThread && !showCompose ? "max-md:hidden" : ""}`}>
        {showCompose ? (
          <>
            <div className="px-5 py-4 border-b border-white/[0.07] flex-shrink-0 flex justify-between items-center">
              <div className="font-display text-lg text-[#e8eaf0] tracking-wider">NEW EMAIL</div>
              <button onClick={() => setShowCompose(false)} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-2">
              {[{ label: "To:", value: composeTo, set: setComposeTo, ph: "email@example.com" }, { label: "Subject:", value: composeSubject, set: setComposeSubject, ph: "Subject" }].map(f => (
                <div key={f.label} className="flex gap-2 items-center">
                  <span className="text-xs text-[#b0b4c8] w-[60px] flex-shrink-0">{f.label}</span>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                    className="flex-1 px-3 py-2 bg-[#111] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A] transition-colors" />
                </div>
              ))}
              <textarea placeholder="Write your email..." value={composeBody} onChange={e => setComposeBody(e.target.value)}
                className="w-full flex-1 px-3.5 py-2.5 bg-[#111] border border-white/[0.07] rounded-xl text-sm text-[#e8eaf0] resize-y outline-none min-h-[200px] focus:border-[#E86A2A] transition-colors mt-2" />
              <div className="flex justify-between mt-2">
                <button onClick={() => setShowCompose(false)} className="px-3.5 py-2 bg-transparent border border-white/[0.07] rounded-lg text-xs text-[#b0b4c8] cursor-pointer hover:bg-white/[0.04] transition-colors">Cancel</button>
                <button onClick={handleSend} disabled={sending || !composeTo.trim() || !composeBody.trim()}
                  className={`flex items-center gap-1.5 px-5 py-2 bg-[#E86A2A] text-white border-none rounded-lg text-sm font-bold cursor-pointer transition-colors ${sending ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
                  <Send className="w-3.5 h-3.5" /> {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : !activeThread ? (
          <div className="flex-1 flex items-center justify-center text-[#b0b4c8] text-sm">Select an email to read</div>
        ) : (
          <>
            <div className="px-4 sm:px-5 py-4 border-b border-white/[0.07] flex items-center gap-3 flex-shrink-0">
              <button onClick={() => { setActiveThread(null); setReplyTo(null); }} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer p-2 rounded hover:bg-white/[0.04] transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="font-display text-lg text-[#e8eaf0] tracking-wider overflow-hidden text-ellipsis whitespace-nowrap">
                {messages[0]?.subject || "Loading..."}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
              {msgLoading ? (
                <div className="text-center text-[#b0b4c8] py-10">Loading...</div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className="bg-[#111] border border-white/[0.07] rounded-xl p-4 mb-3 overflow-hidden max-w-full hover:border-white/[0.12] transition-colors">
                    <div className="flex justify-between items-start mb-2.5">
                      <div>
                        <div className="text-sm font-bold text-[#e8eaf0]">{formatEmailName(m.from)}</div>
                        <div className="text-[11px] text-[#b0b4c8] mt-0.5">to {formatEmailName(m.to)}</div>
                      </div>
                      <div className="text-[11px] text-[#b0b4c8] flex-shrink-0">{fullDate(m.date)}</div>
                    </div>
                    <div className="text-sm text-[#e8eaf0] leading-relaxed whitespace-pre-wrap break-words overflow-hidden">{m.body.substring(0, 2000)}</div>
                    <div className="flex gap-2 mt-3 pt-2.5 border-t border-white/[0.07]">
                      <button onClick={() => startReply(m)} className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.07] rounded-md text-[11px] text-[#b0b4c8] cursor-pointer hover:border-[#E86A2A] hover:text-[#E86A2A] transition-colors">
                        <Reply className="w-3 h-3" /> Reply
                      </button>
                      <button onClick={() => { setComposeTo(""); setComposeSubject(`Fwd: ${m.subject}`); setComposeBody(`\n\n---------- Forwarded message ----------\nFrom: ${m.from}\nDate: ${m.date}\nSubject: ${m.subject}\n\n${m.body}`); setShowCompose(true); setReplyTo(null); setActiveThread(null); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.07] rounded-md text-[11px] text-[#b0b4c8] cursor-pointer hover:border-[#E86A2A] hover:text-[#E86A2A] transition-colors">
                        <Forward className="w-3 h-3" /> Forward
                      </button>
                    </div>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>

            {replyTo && (
              <div className="px-5 py-4 border-t border-white/[0.07] flex-shrink-0">
                <div className="text-xs text-[#b0b4c8] mb-2 flex justify-between items-center">
                  <span>Replying to {formatEmailName(replyTo.from)}</span>
                  <button onClick={() => setReplyTo(null)} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer hover:text-white transition-colors"><X className="w-3 h-3" /></button>
                </div>
                <textarea placeholder="Write your reply..." value={composeBody} onChange={e => setComposeBody(e.target.value)} autoFocus
                  className="w-full px-3.5 py-2.5 bg-[#111] border border-white/[0.07] rounded-xl text-sm text-[#e8eaf0] resize-y outline-none min-h-[80px] focus:border-[#E86A2A] transition-colors" />
                <div className="flex justify-end mt-2">
                  <button onClick={handleSend} disabled={sending || !composeBody.trim()}
                    className={`flex items-center gap-1.5 px-5 py-2 bg-[#E86A2A] text-white border-none rounded-lg text-sm font-bold cursor-pointer transition-colors ${sending ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
                    <Send className="w-3.5 h-3.5" /> {sending ? "Sending..." : "Send Reply"}
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
