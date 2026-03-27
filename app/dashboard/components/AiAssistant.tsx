"use client";

import { useState, useRef, useEffect } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  bg: "#0D1426",
};

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

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

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, typing]);

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return;
    const userMsg = text.trim();
    setInput("");
    const newHistory = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newHistory);
    setSending(true);
    setTyping(true);

    try {
      const res = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: messages }),
      });
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
      <style>{`
        @keyframes ai-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(232,106,42,0.4); } 50% { box-shadow: 0 0 0 8px rgba(232,106,42,0); } }
        @keyframes ai-dot-pulse { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } }
        .ai-fab { position: fixed; bottom: 24px; right: 24px; width: 20px; height: 20px; border-radius: 50%; background: ${T.orange}; border: none; cursor: pointer; z-index: 400; display: flex; align-items: center; justify-content: center; font-size: 0; color: transparent; animation: ai-pulse 2s infinite; transition: transform 0.2s; padding: 0; }
        .ai-fab:hover { transform: scale(1.1); }
        .ai-panel { position: fixed; bottom: 90px; right: 24px; width: 400px; max-width: calc(100vw - 48px); height: 520px; max-height: calc(100vh - 120px); background: ${T.bg}; border: 1px solid ${T.border}; border-radius: 14px; z-index: 400; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .ai-header { padding: 14px 18px; border-bottom: 1px solid ${T.border}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .ai-title { font-size: 15px; font-weight: 700; color: ${T.text}; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
        .ai-title-dot { width: 8px; height: 8px; border-radius: 50%; background: ${T.green}; }
        .ai-close { background: none; border: none; color: ${T.muted}; font-size: 20px; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
        .ai-close:hover { color: ${T.text}; background: rgba(255,255,255,0.05); }
        .ai-msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 3px; }
        .ai-msg { width: fit-content; max-width: 88%; padding: 9px 13px; font-size: 13px; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap; }
        .ai-msg.user { background: ${T.orange}; color: #fff; border-radius: 16px 16px 4px 16px; align-self: flex-end; }
        .ai-msg.assistant { background: #1E293B; color: ${T.text}; border-radius: 16px 16px 16px 4px; align-self: flex-start; }
        .ai-quick { padding: 10px 14px; border-top: 1px solid ${T.border}; display: flex; gap: 6px; overflow-x: auto; flex-shrink: 0; }
        .ai-quick::-webkit-scrollbar { display: none; }
        .ai-quick-btn { padding: 6px 12px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 20px; color: ${T.muted}; font-size: 11px; white-space: nowrap; cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
        .ai-quick-btn:hover { border-color: ${T.orange}; color: ${T.orange}; }
        .ai-input { padding: 10px 14px; border-top: 1px solid ${T.border}; display: flex; gap: 8px; flex-shrink: 0; }
        .ai-textarea { flex: 1; padding: 8px 12px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; color: ${T.text}; font-size: 13px; resize: none; outline: none; font-family: 'Inter', sans-serif; min-height: 36px; max-height: 80px; }
        .ai-textarea:focus { border-color: ${T.orange}; }
        .ai-send { padding: 8px 16px; background: ${T.orange}; color: #fff; border: none; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .ai-send:disabled { opacity: 0.5; }
        .ai-welcome { padding: 30px 20px; text-align: center; }
        .ai-welcome-title { font-size: 16px; font-weight: 700; color: ${T.text}; font-family: 'Bebas Neue', sans-serif; margin-bottom: 6px; }
        .ai-welcome-sub { font-size: 12px; color: ${T.muted}; line-height: 1.6; }
      `}</style>

      {/* Floating Button */}
      <button
        className="ai-fab"
        onClick={() => setOpen(!open)}
        title="AI Assistant"
        style={open ? { width: 40, height: 40, fontSize: 18, color: "#fff", animation: "none" } : {}}
      >
        {open ? "\u00D7" : ""}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="ai-panel">
          <div className="ai-header">
            <div className="ai-title">
              <span className="ai-title-dot" />
              AI ASSISTANT
            </div>
            <button className="ai-close" onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="ai-msgs">
            {messages.length === 0 && !typing && (
              <div className="ai-welcome">
                <div className="ai-welcome-title">Your AI Sales Assistant</div>
                <div className="ai-welcome-sub">
                  Ask me about your pipeline, who to call next,<br />
                  leads going cold, or get your daily briefing.
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                {m.content}
              </div>
            ))}

            {typing && (
              <div className="ai-msg assistant" style={{ display: "flex", gap: 4, alignItems: "center", padding: "12px 16px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.muted, animation: "ai-dot-pulse 1.2s ease-in-out infinite", animationDelay: "0ms" }} />
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.muted, animation: "ai-dot-pulse 1.2s ease-in-out infinite", animationDelay: "150ms" }} />
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.muted, animation: "ai-dot-pulse 1.2s ease-in-out infinite", animationDelay: "300ms" }} />
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Quick Actions — show when no messages */}
          {messages.length === 0 && (
            <div className="ai-quick">
              {QUICK_ACTIONS.map((a, i) => (
                <button key={i} className="ai-quick-btn" onClick={() => sendMessage(a.msg)}>
                  {a.label}
                </button>
              ))}
            </div>
          )}

          <div className="ai-input">
            <textarea
              className="ai-textarea"
              placeholder="Ask anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={1}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
            />
            <button className="ai-send" onClick={() => sendMessage(input)} disabled={sending || !input.trim()}>
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
