"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowLeft, Plus, Send, X } from "lucide-react";

interface Conversation {
  id: string; contact_id: string; channel: string; status: string; ai_enabled: boolean;
  last_message_at: string | null; first_name: string | null; last_name: string | null;
  phone: string | null; email: string | null; company: string | null;
  last_message: string | null; unread_count: string; deal_id: string | null;
}

interface Message { id: string; direction: string; channel: string; body: string | null; sent_by: string | null; status: string; created_at: string; }

interface ContactDetail {
  id: string; first_name: string | null; last_name: string | null; phone: string | null;
  email: string | null; company: string | null; source: string | null; lead_score: number;
  created_at: string; stage_name: string | null; stage_color: string | null;
  deal_value: string | null; deal_id: string | null;
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
  const [mobilePanel, setMobilePanel] = useState<"list" | "thread" | "detail">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations?status=open");
    const data = await res.json();
    setConversations(data.conversations || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConversations(); const i = setInterval(fetchConversations, 5000); return () => clearInterval(i); }, [fetchConversations]);

  async function loadMessages(convId: string) {
    setMsgLoading(true); setActiveConvo(convId);
    const conv = conversations.find(c => c.id === convId);
    setActiveContact(conv || null);
    const res = await fetch(`/api/conversations/${convId}/messages`);
    const data = await res.json();
    setMessages(data.messages || []); setMsgLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    if (conv?.contact_id) { const cRes = await fetch(`/api/contacts/${conv.contact_id}`); const cData = await cRes.json(); setContactDetail(cData.contact || null); }
    if (conv?.deal_id) {
      const aRes = await fetch(`/api/deals/${conv.deal_id}/activity`); const aData = await aRes.json();
      setNotes((aData.activity || []).filter((a: {action: string}) => a.action === "note_added").map((a: {details: Record<string, string> | null; created_at: string}) => ({ text: a.details?.text || "", created_at: a.created_at })));
    } else { setNotes([]); }
  }

  useEffect(() => { if (!activeConvo) return; const i = setInterval(async () => { const res = await fetch(`/api/conversations/${activeConvo}/messages`); const data = await res.json(); setMessages(data.messages || []); }, 5000); return () => clearInterval(i); }, [activeConvo]);

  async function openNewConvo() { setShowNewConvo(true); const res = await fetch("/api/contacts?status=all"); const data = await res.json(); setContactsList(data.contacts || []); }
  async function startConvo(contactId: string) { const res = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId }) }); const data = await res.json(); if (data.conversation) { setShowNewConvo(false); setContactSearch(""); await fetchConversations(); loadMessages(data.conversation.id); } }
  async function handleSend() { if (!input.trim() || !activeConvo) return; setSending(true); await fetch(`/api/conversations/${activeConvo}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: input, channel: "sms" }) }); setInput(""); setSending(false); const res = await fetch(`/api/conversations/${activeConvo}/messages`); const data = await res.json(); setMessages(data.messages || []); fetchConversations(); setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }
  async function handleAddNote() { if (!note.trim() || !activeContact?.deal_id) return; setSavingNote(true); await fetch(`/api/deals/${activeContact.deal_id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) }); setNote(""); setSavingNote(false); const aRes = await fetch(`/api/deals/${activeContact.deal_id}/activity`); const aData = await aRes.json(); setNotes((aData.activity || []).filter((a: {action: string}) => a.action === "note_added").map((a: {details: Record<string, string> | null; created_at: string}) => ({ text: a.details?.text || "", created_at: a.created_at }))); }
  async function handleToggleAi() { if (!activeConvo || !activeContact || togglingAi) return; setTogglingAi(true); const newVal = !activeContact.ai_enabled; await fetch(`/api/conversations/${activeConvo}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aiEnabled: newVal }) }); setActiveContact({ ...activeContact, ai_enabled: newVal }); setConversations(prev => prev.map(c => c.id === activeConvo ? { ...c, ai_enabled: newVal } : c)); setTogglingAi(false); }

  function contactName(c: Conversation | {first_name: string | null; last_name: string | null; phone: string | null}) { return [c.first_name, c.last_name].filter(Boolean).join(" ") || ('phone' in c ? c.phone : null) || "Unknown"; }
  function formatTime(d: string) { const diff = Date.now() - new Date(d).getTime(); if (diff < 60000) return "Now"; if (diff < 3600000) return `${Math.floor(diff / 60000)}m`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function formatMsgTime(d: string) { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function formatDate(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  function formatNoteTime(d: string) { return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

  const filtered = search ? conversations.filter(c => contactName(c).toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)) : conversations;
  const cd = contactDetail;

  return (
    <div className="flex h-[calc(100vh-60px)] -m-6 overflow-hidden relative">

      {/* ── Left: Conversation List ── */}
      <div className={`w-[280px] border-r border-white/[0.07] flex flex-col bg-[#0a0a0a] flex-shrink-0 ${mobilePanel !== "list" ? "max-md:hidden" : ""} max-md:w-full max-md:absolute max-md:inset-0 max-md:z-10`}>
        <div className="p-3 border-b border-white/[0.07] flex gap-1.5">
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
          <button onClick={openNewConvo} className="px-3 py-2 bg-[#E86A2A] text-white border-none rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap hover:bg-[#ff7b3a] transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-10 text-center text-[#b0b4c8] text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-[#b0b4c8] text-sm">No conversations yet.<br />They appear when leads text your number.</div>
          ) : (
            filtered.map(c => (
              <div key={c.id} onClick={() => { loadMessages(c.id); setMobilePanel("thread"); }}
                className={`flex gap-2.5 px-3.5 py-3 border-b border-white/[0.07] cursor-pointer transition-colors hover:bg-white/[0.03] ${activeConvo === c.id ? "bg-[#E86A2A]/[0.08] border-l-[3px] border-l-[#E86A2A]" : ""}`}>
                <div className="w-9 h-9 rounded-full bg-[#E86A2A]/20 text-[#E86A2A] flex items-center justify-center text-[13px] font-bold font-display flex-shrink-0">
                  {(c.first_name?.[0] || "") + (c.last_name?.[0] || "") || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#e8eaf0] flex justify-between">
                    <span>{contactName(c)}{c.ai_enabled && <span className="text-[10px] text-emerald-400 ml-1">AI</span>}</span>
                    {c.last_message_at && <span className="text-[10px] text-[#b0b4c8] flex-shrink-0">{formatTime(c.last_message_at)}</span>}
                  </div>
                  <div className="text-xs text-[#b0b4c8] whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">{c.last_message || "No messages yet"}</div>
                </div>
                {parseInt(c.unread_count) > 0 && <span className="bg-[#E86A2A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full self-center">{c.unread_count}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Middle: Message Thread ── */}
      <div className={`w-[380px] flex-shrink-0 flex flex-col bg-[#0a0a0a] border-r border-white/[0.07] ${mobilePanel === "thread" ? "max-md:flex" : "max-md:hidden"} max-md:w-full max-md:absolute max-md:inset-0 max-md:z-20`}>
        {!activeConvo ? (
          <div className="flex-1 flex items-center justify-center text-[#b0b4c8] text-sm">Select a conversation</div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-white/[0.07] flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <button onClick={() => setMobilePanel("list")} className="hidden max-md:block bg-transparent border-none text-[#b0b4c8] cursor-pointer p-0">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="text-[15px] font-bold text-[#e8eaf0] font-display tracking-wider cursor-pointer" onClick={() => setMobilePanel("detail")}>{activeContact ? contactName(activeContact) : ""}</div>
                  <div className="text-[11px] text-[#b0b4c8]">{activeContact?.phone || ""} · SMS</div>
                </div>
              </div>
              {/* AI Toggle */}
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={handleToggleAi} title={activeContact?.ai_enabled ? "AI ON — click to disable" : "AI OFF — click to enable"}>
                <div className={`w-2 h-2 rounded-full transition-all ${activeContact?.ai_enabled ? "bg-emerald-400 shadow-[0_0_6px_#2ecc71]" : "bg-[#b0b4c8]"}`} />
                <div className={`w-[34px] h-[18px] rounded-full p-0.5 transition-colors relative ${activeContact?.ai_enabled ? "bg-emerald-400" : "bg-white/15"}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${activeContact?.ai_enabled ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <span className={`text-[10px] font-semibold ${activeContact?.ai_enabled ? "text-emerald-400" : "text-[#b0b4c8]"}`}>AI</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-2.5 py-3.5 flex flex-col min-h-0">
              {msgLoading ? (
                <div className="text-center text-[#b0b4c8] py-5 text-sm">Loading...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-[#b0b4c8] py-5 text-sm">No messages yet. Send one to start.</div>
              ) : (
                <div className="flex flex-col gap-px mt-auto">
                  {messages.map((m, i) => {
                    const next = messages[i + 1];
                    const showTail = !next || next.direction !== m.direction;
                    const statusLabel = m.direction === "outbound" ? (m.status === "delivered" ? "Delivered" : m.status === "sent" ? "Sent" : m.status === "failed" ? "Not Delivered" : "") : "";
                    return (
                      <div key={m.id} className={`flex flex-col ${showTail ? "mb-1.5" : "mb-px"} ${m.direction === "inbound" ? "items-start pl-2 pr-10" : "items-end pr-2 pl-10"}`}>
                        <div className={`w-fit max-w-[85%] px-3 py-[7px] text-[13px] leading-snug break-words whitespace-pre-wrap ${
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
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-white/[0.07] flex gap-2 flex-shrink-0">
              <textarea placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)} rows={1}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                className="flex-1 px-3 py-2 bg-[#111] border border-white/[0.07] rounded-xl text-[#e8eaf0] text-sm resize-none outline-none min-h-[36px] max-h-[80px] focus:border-[#E86A2A] transition-colors" />
              <button onClick={handleSend} disabled={sending || !input.trim()}
                className={`px-4 py-2 bg-[#E86A2A] text-white border-none rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap transition-all ${sending || !input.trim() ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2.5 border-t border-white/[0.07] flex items-center gap-2.5 flex-shrink-0">
              <span className="text-[11px] text-[#b0b4c8]">{activeContact?.channel === "imessage" ? "iMessage" : "SMS"} · {activeContact?.phone}</span>
              <span className={`ml-auto text-[11px] font-semibold cursor-pointer ${activeContact?.ai_enabled ? "text-emerald-400" : "text-[#b0b4c8]"}`} onClick={handleToggleAi}>
                {activeContact?.ai_enabled ? "AI Auto-Reply On" : "AI Off"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Right: Contact Detail ── */}
      {activeConvo && activeContact && (
        <div className={`flex-1 min-w-0 bg-[#0a0a0a] overflow-y-auto flex flex-col ${mobilePanel === "detail" ? "max-md:flex" : "max-md:hidden"} max-md:absolute max-md:inset-0 max-md:z-30`}>
          <div className="py-5 px-5 border-b border-white/[0.07] text-center">
            <button onClick={() => setMobilePanel("thread")} className="hidden max-md:block bg-transparent border-none text-[#b0b4c8] text-sm cursor-pointer mb-2">
              <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
            </button>
            <div className="w-[52px] h-[52px] rounded-full bg-[#E86A2A]/20 text-[#E86A2A] flex items-center justify-center text-[19px] font-bold font-display mx-auto mb-2.5">
              {(activeContact.first_name?.[0] || "") + (activeContact.last_name?.[0] || "") || "?"}
            </div>
            <div className="text-lg font-bold text-[#e8eaf0] font-display tracking-wider">{contactName(activeContact)}</div>
            {activeContact.company && <div className="text-xs text-[#b0b4c8] mt-0.5">{activeContact.company}</div>}
            {cd?.stage_name && (
              <div className="mt-2">
                <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: `${cd.stage_color || "#3498db"}20`, color: cd.stage_color || "#3498db" }}>
                  {cd.stage_name}
                </span>
              </div>
            )}
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-2 p-3.5 border-b border-white/[0.07]">
            {[
              { label: "Phone", value: activeContact.phone || "—" },
              { label: "Email", value: activeContact.email || "—", small: true },
              { label: "Deal Value", value: cd?.deal_value ? `$${parseFloat(cd.deal_value).toLocaleString()}` : "$0", accent: true },
              { label: "Source", value: cd?.source || "—" },
            ].map(item => (
              <div key={item.label} className="bg-[#111] border border-white/[0.07] rounded-lg px-2.5 py-2">
                <div className="text-[9px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-0.5">{item.label}</div>
                <div className={`text-xs ${item.accent ? "text-[#E86A2A] font-display text-base" : "text-[#e8eaf0]"} ${item.small ? "text-[11px]" : ""} break-all`}>{item.value}</div>
              </div>
            ))}
            {cd?.lead_score && cd.lead_score > 0 ? (
              <div className="col-span-2 bg-[#111] border border-white/[0.07] rounded-lg px-2.5 py-2">
                <div className="text-[9px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-1">Lead Score</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[5px] bg-[#111] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${cd.lead_score}%`, background: cd.lead_score >= 70 ? "#2ecc71" : cd.lead_score >= 40 ? "#E86A2A" : "#e74c3c" }} />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: cd.lead_score >= 70 ? "#2ecc71" : cd.lead_score >= 40 ? "#E86A2A" : "#e74c3c" }}>{cd.lead_score}</span>
                </div>
              </div>
            ) : null}
            <div className="col-span-2 bg-[#111] border border-white/[0.07] rounded-lg px-2.5 py-2">
              <div className="text-[9px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-0.5">Added</div>
              <div className="text-xs text-[#e8eaf0]">{cd ? formatDate(cd.created_at) : "—"}</div>
            </div>
          </div>

          {/* Notes */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="text-[10px] font-bold text-[#b0b4c8] uppercase tracking-wider px-5 pt-3 pb-2">Notes ({notes.length})</div>
            <div className="flex-1 overflow-y-auto px-5">
              {notes.length === 0 ? (
                <div className="text-center text-[#b0b4c8] text-xs py-5">No notes yet</div>
              ) : (
                notes.map((n, i) => (
                  <div key={i} className="bg-[#111] border border-white/[0.07] rounded-lg p-2.5 mb-1.5">
                    <div className="text-xs text-[#e8eaf0] leading-relaxed whitespace-pre-wrap">{n.text}</div>
                    <div className="text-[10px] text-[#b0b4c8] mt-1">{formatNoteTime(n.created_at)}</div>
                  </div>
                ))
              )}
            </div>
            {activeContact.deal_id && (
              <div className="flex gap-1.5 px-5 py-2.5 border-t border-white/[0.07] flex-shrink-0">
                <textarea placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} rows={1}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                  className="flex-1 px-2.5 py-[7px] bg-[#111] border border-white/[0.07] rounded-lg text-[#e8eaf0] text-xs resize-none outline-none min-h-[32px] focus:border-[#E86A2A] transition-colors" />
                <button onClick={handleAddNote} disabled={savingNote || !note.trim()}
                  className={`px-3 py-[7px] bg-[#E86A2A] text-white border-none rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap ${savingNote || !note.trim() ? "opacity-50" : "hover:bg-[#ff7b3a]"} transition-colors`}>
                  {savingNote ? "..." : "Add"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── New Conversation Modal ── */}
      {showNewConvo && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center" onClick={() => setShowNewConvo(false)}>
          <div className="w-[400px] max-w-[90vw] max-h-[70vh] bg-[#111] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 border-b border-white/[0.07] flex justify-between items-start">
              <div>
                <div className="font-display text-xl text-[#e8eaf0] tracking-wider mb-3">NEW CONVERSATION</div>
                <input placeholder="Search contacts..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} autoFocus
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
              </div>
              <button onClick={() => setShowNewConvo(false)} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {contactsList
                .filter(c => { if (!contactSearch) return true; const name = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase(); return name.includes(contactSearch.toLowerCase()) || c.phone?.includes(contactSearch); })
                .map(c => (
                  <div key={c.id} onClick={() => startConvo(c.id)}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer border-b border-white/[0.07] hover:bg-white/[0.03] transition-colors">
                    <div className="w-9 h-9 rounded-full bg-[#E86A2A]/20 text-[#E86A2A] flex items-center justify-center text-[13px] font-bold font-display flex-shrink-0">
                      {(c.first_name?.[0] || "") + (c.last_name?.[0] || "") || "?"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#e8eaf0]">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown"}</div>
                      <div className="text-xs text-[#b0b4c8]">{c.phone || "No phone"}</div>
                    </div>
                  </div>
                ))}
              {contactsList.length === 0 && <div className="p-10 text-center text-[#b0b4c8] text-sm">No contacts found. Add a contact first.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
