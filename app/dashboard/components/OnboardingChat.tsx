"use client";

import { useEffect, useState, useRef } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  bg: "#0D1426",
};

interface ChatMessage {
  role: "bot" | "user";
  text: string;
}

export default function OnboardingChat({ onComplete }: { onComplete: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(9);
  const [done, setDone] = useState(false);
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load initial state
  useEffect(() => {
    async function init() {
      const res = await fetch("/api/ai-agent/onboard");
      const data = await res.json();
      if (data.done) {
        onComplete();
        return;
      }
      setStep(data.step);
      setTotalSteps(data.totalSteps);
      if (data.firstMessage) {
        setTyping(true);
        await delay(800);
        setMessages([{ role: "bot", text: data.firstMessage }]);
        setTyping(false);
      } else if (data.currentQuestion) {
        setMessages([{ role: "bot", text: data.currentQuestion }]);
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setSending(true);
    setTyping(true);

    const res = await fetch("/api/ai-agent/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg }),
    });
    const data = await res.json();

    // Simulate typing delay
    await delay(600 + Math.random() * 800);
    setTyping(false);

    setMessages(prev => [...prev, { role: "bot", text: data.botMessage }]);
    setStep(data.step);
    setSending(false);

    if (data.done) {
      setDone(true);
      await delay(2000);
      onComplete();
    }
  }

  const progress = Math.round((step / totalSteps) * 100);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 520, maxWidth: "95vw", height: 600, maxHeight: "90vh",
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", background: `${T.orange}20`,
            color: T.orange, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif",
          }}>
            WP
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: T.text,
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 0.5,
            }}>
              AI AGENT SETUP
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>
              Step {Math.min((step || 0) + 1, totalSteps)} of {totalSteps}
            </div>
          </div>
          {!done && (
            <button
              onClick={async () => {
                await fetch("/api/ai-agent/onboard", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message: "__SKIP__", skip: true }),
                }).catch(() => {});
                onComplete();
              }}
              style={{
                background: "none", border: `1px solid ${T.border}`, borderRadius: 6,
                color: T.muted, fontSize: 11, padding: "5px 12px", cursor: "pointer",
              }}
            >
              Skip
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div style={{
            height: "100%", width: `${progress}%`, background: T.orange,
            borderRadius: 2, transition: "width 0.4s ease",
          }} />
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "20px 20px 10px",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const isBot = m.role === "bot";
            return (
              <div key={i} style={{
                display: "flex", flexDirection: "column",
                alignItems: isBot ? "flex-start" : "flex-end",
                paddingLeft: isBot ? 0 : 40,
                paddingRight: isBot ? 40 : 0,
                marginBottom: isLast ? 4 : 2,
              }}>
                <div style={{
                  width: "fit-content", maxWidth: "90%",
                  padding: "9px 14px", fontSize: 14, lineHeight: 1.5,
                  whiteSpace: "pre-wrap", wordWrap: "break-word",
                  borderRadius: isBot ? "16px 16px 16px 4px" : "16px 16px 4px 16px",
                  background: isBot ? "#1E293B" : T.orange,
                  color: isBot ? T.text : "#fff",
                }}>
                  {m.text}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typing && (
            <div style={{
              display: "flex", alignItems: "flex-start", paddingRight: 40,
            }}>
              <div style={{
                padding: "10px 16px", borderRadius: "16px 16px 16px 4px",
                background: "#1E293B", display: "flex", gap: 4, alignItems: "center",
              }}>
                <span style={{ ...dotStyle, animationDelay: "0ms" }} />
                <span style={{ ...dotStyle, animationDelay: "150ms" }} />
                <span style={{ ...dotStyle, animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input */}
        {!done && (
          <div style={{
            padding: "12px 16px", borderTop: `1px solid ${T.border}`,
            display: "flex", gap: 8, flexShrink: 0,
          }}>
            <textarea
              style={{
                flex: 1, padding: "10px 14px", background: T.surface,
                border: `1px solid ${T.border}`, borderRadius: 10,
                color: T.text, fontSize: 14, resize: "none", outline: "none",
                fontFamily: "'Inter', sans-serif", minHeight: 42, maxHeight: 100,
              }}
              placeholder="Type your answer..."
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={1}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onFocus={e => (e.target.style.borderColor = T.orange)}
              onBlur={e => (e.target.style.borderColor = T.border)}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              style={{
                padding: "10px 22px", background: T.orange, color: "#fff",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: sending || !input.trim() ? "default" : "pointer",
                opacity: sending || !input.trim() ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        )}

        {/* Done state */}
        {done && (
          <div style={{
            padding: "16px 20px", borderTop: `1px solid ${T.border}`,
            textAlign: "center", flexShrink: 0,
          }}>
            <div style={{
              fontSize: 13, color: T.green, fontWeight: 600, marginBottom: 8,
            }}>
              Your AI Sales Agent is live!
            </div>
            <button
              onClick={onComplete}
              style={{
                padding: "10px 28px", background: T.orange, color: "#fff",
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Typing animation keyframes */}
      <style>{`
        @keyframes ob-dot-pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

const dotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#b0b4c8",
  animation: "ob-dot-pulse 1.2s ease-in-out infinite",
};
