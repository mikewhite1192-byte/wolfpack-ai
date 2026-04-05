"use client";

import { useEffect, useState, useRef } from "react";
import { Send } from "lucide-react";

interface ChatMessage { role: "bot" | "user"; text: string; }

export default function OnboardingChat({ onComplete }: { onComplete: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(9);
  const [done, setDone] = useState(false);
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/ai-agent/onboard");
        const data = await res.json();
        if (data.error) { setMessages([{ role: "bot", text: "Something went wrong loading onboarding. Try refreshing the page." }]); return; }
        if (data.done) { onComplete(); return; }
        setStep(typeof data.step === "number" ? data.step : 0);
        setTotalSteps(typeof data.totalSteps === "number" && data.totalSteps > 0 ? data.totalSteps : 9);
        if (data.firstMessage) { setTyping(true); await delay(800); setMessages([{ role: "bot", text: data.firstMessage }]); setTyping(false); }
        else if (data.currentQuestion) { setMessages([{ role: "bot", text: data.currentQuestion }]); }
      } catch { setMessages([{ role: "bot", text: "Connection error. Please refresh the page." }]); }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput(""); setMessages(prev => [...prev, { role: "user", text: userMsg }]); setSending(true); setTyping(true);
    try {
      const res = await fetch("/api/ai-agent/onboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: userMsg }) });
      if (!res.ok) { await delay(600); setTyping(false); setMessages(prev => [...prev, { role: "bot", text: "Something went wrong. Please try again." }]); setSending(false); return; }
      let data; try { data = await res.json(); } catch { await delay(600); setTyping(false); setMessages(prev => [...prev, { role: "bot", text: "Got an unexpected response. Please try again." }]); setSending(false); return; }
      if (data.error) { await delay(600); setTyping(false); setMessages(prev => [...prev, { role: "bot", text: "Something went wrong. Please try again." }]); setSending(false); return; }
      await delay(600 + Math.random() * 800); setTyping(false);
      setMessages(prev => [...prev, { role: "bot", text: data.botMessage || "Sorry, I didn't catch that. Could you try again?" }]);
      if (typeof data.step === "number") setStep(data.step);
      if (typeof data.totalSteps === "number" && data.totalSteps > 0) setTotalSteps(data.totalSteps);
      setSending(false);
      if (data.done) { setDone(true); await delay(2000); onComplete(); }
    } catch { setTyping(false); setMessages(prev => [...prev, { role: "bot", text: "Connection error. Please try again." }]); setSending(false); }
  }

  const progress = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-[500] flex items-center justify-center">
      <style>{`@keyframes ob-dot-pulse { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } }`}</style>

      <div className="w-[520px] max-w-[95vw] h-[600px] max-h-[90vh] bg-[#0a0a0a] border border-white/[0.07] rounded-2xl flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center gap-3.5 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#E86A2A]/20 text-[#E86A2A] flex items-center justify-center text-lg font-bold font-display">WP</div>
          <div className="flex-1">
            <div className="text-base font-bold text-[#e8eaf0] font-display tracking-wider">AI AGENT SETUP</div>
            <div className="text-[11px] text-[#b0b4c8]">Step {Math.min((step || 0) + 1, totalSteps)} of {totalSteps}</div>
          </div>
          {!done && (
            <button onClick={async () => { await fetch("/api/ai-agent/onboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "__SKIP__", skip: true }) }).catch(() => {}); onComplete(); }}
              className="bg-transparent border border-white/[0.07] rounded-md text-[#b0b4c8] text-[11px] px-3 py-1.5 cursor-pointer hover:border-white/[0.15] hover:text-[#e8eaf0] transition-colors">
              Skip
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-[3px] bg-white/5 flex-shrink-0">
          <div className="h-full bg-[#E86A2A] rounded-sm transition-all duration-400" style={{ width: `${progress}%` }} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === "bot" ? "items-start pr-10" : "items-end pl-10"} ${i === messages.length - 1 ? "mb-1" : "mb-0.5"}`}>
              <div className={`w-fit max-w-[90%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                m.role === "bot" ? "bg-slate-800 text-[#e8eaf0] rounded-2xl rounded-bl-sm" : "bg-[#E86A2A] text-white rounded-2xl rounded-br-sm"
              }`}>{m.text}</div>
            </div>
          ))}
          {typing && (
            <div className="flex items-start pr-10">
              <div className="px-4 py-2.5 bg-slate-800 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                {[0, 150, 300].map(d => <span key={d} className="w-[7px] h-[7px] rounded-full bg-[#b0b4c8]" style={{ animation: "ob-dot-pulse 1.2s ease-in-out infinite", animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        {!done && (
          <div className="px-4 py-3 border-t border-white/[0.07] flex gap-2 flex-shrink-0">
            <textarea placeholder="Type your answer..." value={input} onChange={e => setInput(e.target.value)} rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              className="flex-1 px-3.5 py-2.5 bg-[#111] border border-white/[0.07] rounded-xl text-[#e8eaf0] text-sm resize-none outline-none min-h-[42px] max-h-[100px] focus:border-[#E86A2A] transition-colors" />
            <button onClick={handleSend} disabled={sending || !input.trim()}
              className={`px-6 py-2.5 bg-[#E86A2A] text-white border-none rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap transition-colors ${sending || !input.trim() ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Done */}
        {done && (
          <div className="px-5 py-4 border-t border-white/[0.07] text-center flex-shrink-0">
            <div className="text-sm text-emerald-400 font-semibold mb-2">Your AI Sales Agent is live!</div>
            <button onClick={onComplete} className="px-7 py-2.5 bg-[#E86A2A] text-white border-none rounded-xl text-sm font-bold cursor-pointer hover:bg-[#ff7b3a] transition-colors">
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
