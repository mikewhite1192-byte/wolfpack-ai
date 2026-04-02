"use client";

import { useState, useEffect, useRef } from "react";

type Trade = "plumber" | "roofing" | "hvac" | "electrician";

const TRADE_LABELS: Record<Trade, { company: string; greeting: string }> = {
  plumber: { company: "Metro Plumbing Co", greeting: "Need a plumber? Ask me anything!" },
  roofing: { company: "Summit Roofing & Exteriors", greeting: "Need roof work? I can help!" },
  hvac: { company: "Comfort Zone Heating & Cooling", greeting: "Need HVAC service? Ask me anything!" },
  electrician: { company: "Volt Electric Services", greeting: "Need electrical work? I can help!" },
};

export default function TradeChatWidget({ trade, accentColor }: { trade: Trade; accentColor: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "text">("chat");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Text demo state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [textSending, setTextSending] = useState(false);
  const [textSent, setTextSent] = useState(false);
  const [textError, setTextError] = useState("");

  const info = TRADE_LABELS[trade];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendChat() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setSending(true);

    try {
      const res = await fetch("/api/chat-widget/trade-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages, trade }),
      });
      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([...updated, { role: "assistant", content: "Sorry, something went wrong. Try again!" }]);
    }
    setSending(false);
  }

  async function startTextDemo() {
    if (!name.trim() || !phone.trim()) return;
    setTextSending(true);
    setTextError("");

    try {
      const res = await fetch("/api/chat-widget/trade-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start-text-demo", name, phone, trade }),
      });
      const data = await res.json();
      if (data.error) {
        setTextError(data.error);
      } else {
        setTextSent(true);
      }
    } catch {
      setTextError("Something went wrong. Try again.");
    }
    setTextSending(false);
  }

  return (
    <>
      <style>{`@keyframes dotPulse { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }`}</style>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56,
          borderRadius: "50%", background: accentColor, border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 20px ${accentColor}66`, zIndex: 9998,
          fontSize: 24, color: "#fff", transition: "transform 0.2s",
          transform: open ? "rotate(45deg)" : "none",
        }}
      >
        {open ? "+" : "\u{1F4AC}"}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 24, width: 380, maxWidth: "calc(100vw - 48px)",
          height: 500, maxHeight: "calc(100vh - 120px)",
          background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
          display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 9998,
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${accentColor}33`, color: accentColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
              {info.company[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf0" }}>{info.company}</div>
              <div style={{ fontSize: 11, color: "rgba(232,230,227,0.4)" }}>Usually responds instantly</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => setTab("chat")}
              style={{
                flex: 1, padding: "10px 0", background: "none", border: "none",
                color: tab === "chat" ? accentColor : "rgba(232,230,227,0.4)",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                borderBottom: tab === "chat" ? `2px solid ${accentColor}` : "2px solid transparent",
              }}
            >
              Chat Now
            </button>
            <button
              onClick={() => setTab("text")}
              style={{
                flex: 1, padding: "10px 0", background: "none", border: "none",
                color: tab === "text" ? accentColor : "rgba(232,230,227,0.4)",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                borderBottom: tab === "text" ? `2px solid ${accentColor}` : "2px solid transparent",
              }}
            >
              Text Me Instead
            </button>
          </div>

          {tab === "chat" ? (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {messages.length === 0 && (
                  <div style={{ background: `${accentColor}14`, borderRadius: "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, color: "#e8eaf0", lineHeight: 1.5, maxWidth: "85%" }}>
                    {info.greeting}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "85%", padding: "10px 14px", fontSize: 13, lineHeight: 1.5, borderRadius: 14,
                      background: m.role === "user" ? accentColor : "rgba(255,255,255,0.06)",
                      color: m.role === "user" ? "#fff" : "#e8eaf0",
                    }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div style={{ display: "flex", gap: 4, padding: "10px 14px", background: "rgba(255,255,255,0.06)", borderRadius: "14px 14px 14px 4px", width: "fit-content" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor, opacity: 0.6, animation: "dotPulse 1.4s ease-in-out infinite" }} />
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor, opacity: 0.6, animation: "dotPulse 1.4s ease-in-out 0.2s infinite" }} />
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor, opacity: 0.6, animation: "dotPulse 1.4s ease-in-out 0.4s infinite" }} />
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder="Type a message..."
                  style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 13, color: "#e8eaf0", outline: "none" }}
                />
                <button onClick={sendChat} disabled={sending || !input.trim()} style={{ padding: "10px 16px", background: accentColor, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.5 : 1 }}>
                  Send
                </button>
              </div>
            </>
          ) : (
            /* Text Me tab */
            <div style={{ flex: 1, padding: "24px 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {!textSent ? (
                <>
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1, color: "#e8eaf0", marginBottom: 8 }}>
                      EXPERIENCE IT <span style={{ color: accentColor }}>VIA TEXT</span>
                    </div>
                    <p style={{ fontSize: 13, color: "rgba(232,230,227,0.4)", lineHeight: 1.6, margin: 0 }}>
                      Enter your number and we'll text you as if you were a customer. See the AI in action on your phone.
                    </p>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(232,230,227,0.4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Your Name</div>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="John Smith"
                      style={{ width: "100%", padding: "12px 16px", background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#e8eaf0", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(232,230,227,0.4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Phone Number</div>
                    <input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      type="tel"
                      placeholder="(586) 555-0000"
                      style={{ width: "100%", padding: "12px 16px", background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#e8eaf0", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  {textError && <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{textError}</div>}

                  <button
                    onClick={startTextDemo}
                    disabled={textSending || !name.trim() || !phone.trim()}
                    style={{ width: "100%", padding: 14, background: accentColor, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: textSending ? 0.5 : 1 }}
                  >
                    {textSending ? "Sending..." : "Text Me Now"}
                  </button>

                  <div style={{ fontSize: 11, color: "rgba(232,230,227,0.2)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                    By clicking, you agree to receive a text message. Standard rates apply.
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>{"\u{1F4F1}"}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "#e8eaf0", marginBottom: 8 }}>CHECK YOUR PHONE</div>
                  <p style={{ fontSize: 14, color: "rgba(232,230,227,0.4)", lineHeight: 1.6, margin: "0 0 20px" }}>
                    We just texted you as {info.company}. Reply naturally and experience the AI in action.
                  </p>
                  <button onClick={() => { setTextSent(false); setName(""); setPhone(""); }} style={{ padding: "10px 28px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(232,230,227,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
