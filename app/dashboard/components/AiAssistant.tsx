"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send } from "lucide-react";

interface ChatMsg { role: "user" | "assistant"; content: string; }

const QUICK_ACTIONS = [
  { label: "Morning Briefing", msg: "Give me my morning briefing. What should I focus on today?" },
  { label: "EOD Report", msg: "Give me my end of day report. What happened today?" },
  { label: "Who Should I Call?", msg: "Which leads have the highest chance of closing? Who should I call right now and why?" },
  { label: "Cold Leads", msg: "Which leads are going cold? What should I do to re-engage them?" },
  { label: "Pipeline Health", msg: "How's my pipeline looking? Any bottlenecks or concerns?" },
];

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open, typing]);

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return;
    const userMsg = text.trim();
    setInput("");
    const newHistory = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newHistory);
    setSending(true); setTyping(true);
    try {
      const res = await fetch("/api/ai-agent/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: userMsg, history: messages }) });
      const data = await res.json();
      setTyping(false);
      setMessages([...newHistory, { role: "assistant", content: data.reply || "Sorry, something went wrong." }]);
    } catch {
      setTyping(false);
      setMessages([...newHistory, { role: "assistant", content: "Connection error. Try again." }]);
    }
    setSending(false);
  }

  return (
    <>
      <style>{`@keyframes ai-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(232,106,42,0.4); } 50% { box-shadow: 0 0 0 8px rgba(232,106,42,0); } }`}</style>

      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        title="AI Assistant"
        className={`fixed bottom-6 right-6 rounded-full bg-[#E86A2A] border-none cursor-pointer z-[400] flex items-center justify-center text-white transition-transform hover:scale-110 ${
          open ? "w-10 h-10" : "w-5 h-5"
        }`}
        style={!open ? { animation: "ai-pulse 2s infinite", padding: 0 } : { padding: 0 }}
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-0 h-0" />}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-[90px] right-6 w-[400px] max-w-[calc(100vw-48px)] h-[520px] max-h-[calc(100vh-120px)] bg-[#0a0a0a] border border-white/[0.07] rounded-2xl z-[400] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between flex-shrink-0">
            <div className="text-[15px] font-bold text-[#e8eaf0] font-display tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              AI ASSISTANT
            </div>
            <button onClick={() => setOpen(false)} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer p-1 rounded hover:text-[#e8eaf0] hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3.5 flex flex-col gap-1">
            {messages.length === 0 && !typing && (
              <div className="py-8 px-5 text-center">
                <div className="text-base font-bold text-[#e8eaf0] font-display mb-1.5">Your AI Sales Assistant</div>
                <div className="text-xs text-[#b0b4c8] leading-relaxed">Ask me about your pipeline, who to call next, leads going cold, or get your daily briefing.</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`w-fit max-w-[88%] px-3.5 py-2.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap ${
                m.role === "user" ? "bg-[#E86A2A] text-white rounded-2xl rounded-br-sm self-end" : "bg-slate-800 text-[#e8eaf0] rounded-2xl rounded-bl-sm self-start"
              }`}>{m.content}</div>
            ))}
            {typing && (
              <div className="bg-slate-800 text-[#e8eaf0] rounded-2xl rounded-bl-sm self-start flex gap-1 items-center px-4 py-3">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-[#b0b4c8]" style={{ animation: `ai-pulse 1.2s ease-in-out infinite`, animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick Actions */}
          {messages.length === 0 && (
            <div className="px-3.5 py-2.5 border-t border-white/[0.07] flex gap-1.5 overflow-x-auto flex-shrink-0 [&::-webkit-scrollbar]:hidden">
              {QUICK_ACTIONS.map((a, i) => (
                <button key={i} onClick={() => sendMessage(a.msg)}
                  className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.07] rounded-full text-[#b0b4c8] text-[11px] whitespace-nowrap cursor-pointer flex-shrink-0 hover:border-[#E86A2A] hover:text-[#E86A2A] transition-colors">
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3.5 py-2.5 border-t border-white/[0.07] flex gap-2 flex-shrink-0">
            <textarea
              placeholder="Ask anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              className="flex-1 px-3 py-2 bg-[#111] border border-white/[0.07] rounded-xl text-[#e8eaf0] text-sm resize-none outline-none min-h-[36px] max-h-[80px] focus:border-[#E86A2A] transition-colors"
            />
            <button onClick={() => sendMessage(input)} disabled={sending || !input.trim()}
              className={`px-4 py-2 bg-[#E86A2A] text-white border-none rounded-xl text-xs font-bold cursor-pointer transition-colors ${sending ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
