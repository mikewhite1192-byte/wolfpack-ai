"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  direction: string;
  body: string;
  sent_by: string;
  status: string;
  created_at: string;
}

export default function DemoPage() {
  const [step, setStep] = useState<"intro" | "form" | "live" | "done">("intro");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [starting, setStarting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Poll for new messages during live demo
  useEffect(() => {
    if (!conversationId || step !== "live") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/demo?conversationId=${conversationId}`);
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    }, 3000);
    return () => clearInterval(interval);
  }, [conversationId, step]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startDemo() {
    if (!name.trim() || !phone.trim()) return;
    setStarting(true);
    setError("");

    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, businessType }),
    });
    const data = await res.json();

    if (data.error) {
      setError(data.error);
      setStarting(false);
      return;
    }

    setConversationId(data.conversationId);
    setStep("live");
    setStarting(false);
  }

  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e8eaf0" }}>
      <style>{`
        .demo-wrap { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
        .demo-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 2px; text-align: center; margin-bottom: 40px; }
        .demo-logo span { color: #E86A2A; }

        .demo-hero { text-align: center; margin-bottom: 48px; }
        .demo-hero h1 { font-family: 'Bebas Neue', sans-serif; font-size: 42px; letter-spacing: 1px; line-height: 1.1; margin: 0 0 16px; }
        .demo-hero h1 span { color: #E86A2A; }
        .demo-hero p { font-size: 16px; color: #b0b4c8; line-height: 1.6; max-width: 480px; margin: 0 auto; }

        .demo-steps { display: flex; gap: 24px; margin-bottom: 40px; justify-content: center; }
        .demo-step { text-align: center; flex: 1; max-width: 160px; }
        .demo-step-num { width: 36px; height: 36px; border-radius: 50%; background: rgba(232,106,42,0.15); color: #E86A2A; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; margin: 0 auto 10px; }
        .demo-step-text { font-size: 13px; color: #b0b4c8; line-height: 1.5; }

        .demo-form { background: #111827; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 32px; }
        .demo-field { margin-bottom: 16px; }
        .demo-label { font-size: 12px; font-weight: 600; color: #b0b4c8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .demo-input { width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; font-size: 14px; color: #e8eaf0; outline: none; box-sizing: border-box; font-family: inherit; }
        .demo-input:focus { border-color: #E86A2A; }
        .demo-input::placeholder { color: #666; }
        .demo-btn { width: 100%; padding: 14px; background: #E86A2A; color: #fff; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 8px; }
        .demo-btn:disabled { opacity: 0.5; cursor: default; }
        .demo-btn:hover:not(:disabled) { background: #d45a1a; }
        .demo-error { color: #e74c3c; font-size: 13px; margin-top: 8px; }
        .demo-disclaimer { font-size: 11px; color: #666; text-align: center; margin-top: 12px; line-height: 1.5; }

        .demo-live { background: #111827; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; }
        .demo-live-header { padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; gap: 12px; }
        .demo-live-dot { width: 10px; height: 10px; border-radius: 50%; background: #2ecc71; animation: demo-pulse 2s infinite; }
        .demo-live-title { font-size: 14px; font-weight: 700; color: #e8eaf0; }
        .demo-live-sub { font-size: 12px; color: #b0b4c8; }

        .demo-phone { background: #0a0a0a; margin: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; min-height: 400px; display: flex; flex-direction: column; }
        .demo-phone-header { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); text-align: center; }
        .demo-phone-name { font-size: 14px; font-weight: 700; color: #e8eaf0; }
        .demo-phone-number { font-size: 11px; color: #b0b4c8; }
        .demo-phone-msgs { flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; max-height: 350px; }
        .demo-phone-msgs-inner { display: flex; flex-direction: column; gap: 2px; margin-top: auto; }

        .demo-msg-row { display: flex; flex-direction: column; margin-bottom: 1px; }
        .demo-msg-row.inbound { align-items: flex-start; padding-left: 8px; padding-right: 40px; }
        .demo-msg-row.outbound { align-items: flex-end; padding-right: 8px; padding-left: 40px; }
        .demo-msg-row.tail { margin-bottom: 6px; }
        .demo-bubble { width: fit-content; max-width: 85%; padding: 8px 12px; font-size: 14px; line-height: 1.4; word-wrap: break-word; white-space: pre-wrap; }
        .demo-bubble.inbound { background: #1E293B; color: #e8eaf0; border-radius: 16px 16px 16px 4px; }
        .demo-bubble.outbound { background: #E86A2A; color: #fff; border-radius: 16px 16px 4px 16px; }
        .demo-msg-time { font-size: 10px; color: #b0b4c8; margin-top: 2px; padding: 0 4px; }

        .demo-waiting { text-align: center; padding: 60px 20px; color: #b0b4c8; }
        .demo-waiting-text { font-size: 14px; margin-bottom: 8px; }
        .demo-waiting-sub { font-size: 12px; color: #666; }

        .demo-phone-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.07); text-align: center; font-size: 11px; color: #666; }

        .demo-cta { text-align: center; margin-top: 24px; }
        .demo-cta-text { font-size: 15px; color: #b0b4c8; margin-bottom: 12px; }
        .demo-cta-btn { display: inline-block; padding: 14px 36px; background: #E86A2A; color: #fff; border-radius: 12px; font-size: 15px; font-weight: 700; text-decoration: none; }
        .demo-cta-btn:hover { background: #d45a1a; }

        @keyframes demo-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <div className="demo-wrap">
        <div className="demo-logo">THE <span>WOLF</span> PACK AI</div>

        {/* Intro */}
        {step === "intro" && (
          <>
            <div className="demo-hero">
              <h1>See Your <span>AI Appointment Setter</span> In Action</h1>
              <p>Enter your number. Maya will text you in 3 seconds and show you exactly how the AI appointment setter works. Experience it as your leads would.</p>
            </div>

            <div className="demo-steps">
              <div className="demo-step">
                <div className="demo-step-num">1</div>
                <div className="demo-step-text">Enter your phone number</div>
              </div>
              <div className="demo-step">
                <div className="demo-step-num">2</div>
                <div className="demo-step-text">Get a text from Maya in 3 seconds</div>
              </div>
              <div className="demo-step">
                <div className="demo-step-num">3</div>
                <div className="demo-step-text">See why it works</div>
              </div>
            </div>

            <div className="demo-form">
              <div className="demo-field">
                <div className="demo-label">Your Name</div>
                <input className="demo-input" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" />
              </div>
              <div className="demo-field">
                <div className="demo-label">Phone Number</div>
                <input className="demo-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" />
              </div>
              <div className="demo-field">
                <div className="demo-label">Your Business Type (optional)</div>
                <input className="demo-input" value={businessType} onChange={e => setBusinessType(e.target.value)} placeholder="Roofing, HVAC, Fitness, etc." />
              </div>

              {error && <div className="demo-error">{error}</div>}

              <button className="demo-btn" onClick={() => { if (name && phone) setStep("form"); }} disabled={!name.trim() || !phone.trim()}>
                Start Live Demo
              </button>

              <div className="demo-disclaimer">
                By clicking Start, you agree to receive a text message from our AI sales agent for demo purposes. Standard message rates apply.
              </div>
            </div>
          </>
        )}

        {/* Confirm */}
        {step === "form" && (
          <div className="demo-form" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>📱</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ready?</h2>
            <p style={{ fontSize: 14, color: "#b0b4c8", marginBottom: 24, lineHeight: 1.6 }}>
              Our AI sales agent is about to text <strong style={{ color: "#E86A2A" }}>{phone}</strong> and start a real sales conversation with you. Reply naturally, just like a real lead would.
            </p>

            <button className="demo-btn" onClick={startDemo} disabled={starting}>
              {starting ? "Starting..." : "Send Me a Text Now"}
            </button>

            <button onClick={() => setStep("intro")} style={{ background: "none", border: "none", color: "#b0b4c8", fontSize: 13, cursor: "pointer", marginTop: 12, display: "block", width: "100%" }}>
              ← Go back
            </button>
          </div>
        )}

        {/* Live View — Full CRM experience */}
        {step === "live" && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0a0a0a", zIndex: 1000, display: "flex" }}>
            {/* Sidebar */}
            <div style={{ width: 220, background: "#080f1e", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#e8eaf0", letterSpacing: 1.5 }}>THE <span style={{ color: "#E86A2A" }}>WOLF</span> PACK AI</div>
                <div style={{ fontSize: 10, color: "#b0b4c8", marginTop: 2 }}>Live Demo</div>
              </div>
              <div style={{ flex: 1, padding: "12px 10px" }}>
                {["Dashboard", "Pipeline", "Conversations", "Email", "Calendar", "Contacts"].map((item, i) => (
                  <div key={item} style={{
                    padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 2,
                    color: item === "Conversations" ? "#E86A2A" : "#b0b4c8",
                    background: item === "Conversations" ? "rgba(232,106,42,0.12)" : "transparent",
                  }}>
                    {["▦", "⬡", "💬", "📧", "📅", "👥"][i]} {item}
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ padding: "10px 12px", borderRadius: 8, fontSize: 13, color: "#2ecc71", background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.2)" }}>
                  📞 Dial Out
                </div>
              </div>
            </div>

            {/* Conversation List */}
            <div style={{ width: 280, borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <input placeholder="Search..." style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, fontSize: 13, color: "#e8eaf0", outline: "none", boxSizing: "border-box" }} readOnly />
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {/* Active demo conversation */}
                <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(232,106,42,0.08)", borderLeft: "3px solid #E86A2A" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(232,106,42,0.2)", color: "#E86A2A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", flexShrink: 0 }}>
                    {name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e8eaf0", display: "flex", justifyContent: "space-between" }}>
                      <span>{name} <span style={{ fontSize: 10, color: "#2ecc71" }}>AI</span></span>
                      <span style={{ fontSize: 10, color: "#b0b4c8" }}>Now</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#b0b4c8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                      {messages.length > 0 ? messages[messages.length - 1].body?.substring(0, 40) : "Starting conversation..."}
                    </div>
                  </div>
                </div>
                {/* Fake other conversations */}
                {[{ name: "Marcus Johnson", preview: "Thursday at 10 works", time: "2h" }, { name: "Tony Russo", preview: "Saturday works great Tony", time: "5h" }, { name: "David Williams", preview: "We have a few different programs", time: "1d" }].map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", opacity: 0.5 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(232,106,42,0.2)", color: "#E86A2A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", flexShrink: 0 }}>
                      {c.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e8eaf0", display: "flex", justifyContent: "space-between" }}>
                        <span>{c.name}</span><span style={{ fontSize: 10, color: "#b0b4c8" }}>{c.time}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#b0b4c8", marginTop: 2 }}>{c.preview}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message Thread */}
            <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e8eaf0", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 0.5 }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#b0b4c8" }}>{phone} · SMS</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ecc71", boxShadow: "0 0 6px #2ecc71" }} />
                  <div style={{ width: 34, height: 18, borderRadius: 9, background: "#2ecc71", position: "relative", padding: 2 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", transform: "translateX(16px)" }} />
                  </div>
                  <span style={{ fontSize: 10, color: "#2ecc71", fontWeight: 600 }}>AI</span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "14px 10px", display: "flex", flexDirection: "column", minHeight: 0 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#b0b4c8", padding: 40, fontSize: 13, margin: "auto 0" }}>
                    Waiting for first message...<br />
                    <span style={{ fontSize: 11, color: "#666" }}>Check your phone</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: "auto" }}>
                    {messages.map((m, i) => {
                      const next = messages[i + 1];
                      const showTail = !next || next.direction !== m.direction;
                      return (
                        <div key={i} style={{
                          display: "flex", flexDirection: "column", marginBottom: showTail ? 6 : 1,
                          alignItems: m.direction === "inbound" ? "flex-start" : "flex-end",
                          paddingLeft: m.direction === "inbound" ? 8 : 40,
                          paddingRight: m.direction === "outbound" ? 8 : 40,
                        }}>
                          <div style={{
                            width: "fit-content", maxWidth: "85%", padding: "8px 12px", fontSize: 13, lineHeight: 1.4,
                            wordWrap: "break-word", whiteSpace: "pre-wrap",
                            background: m.direction === "inbound" ? "#1E293B" : "#E86A2A",
                            color: m.direction === "inbound" ? "#e8eaf0" : "#fff",
                            borderRadius: m.direction === "inbound"
                              ? (showTail ? "16px 16px 16px 4px" : "16px")
                              : (showTail ? "16px 16px 4px 16px" : "16px"),
                          }}>
                            {m.body}
                          </div>
                          {showTail && (
                            <div style={{ fontSize: 10, color: "#b0b4c8", marginTop: 2, padding: "0 4px" }}>
                              {m.sent_by === "ai" && <span style={{ color: "#2ecc71" }}>AI · </span>}
                              {formatTime(m.created_at)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={endRef} />
                  </div>
                )}
              </div>

              <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, flexShrink: 0 }}>
                <div style={{ flex: 1, padding: "9px 12px", background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, color: "#666", fontSize: 13 }}>
                  Type a message...
                </div>
                <div style={{ padding: "9px 18px", background: "#E86A2A", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
                  Send
                </div>
              </div>
              <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", fontSize: 11, color: "#b0b4c8" }}>
                SMS · {phone}
                <span style={{ marginLeft: "auto", color: "#2ecc71", fontWeight: 600 }}>AI Auto-Reply On</span>
              </div>
            </div>

            {/* Contact Card */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(232,106,42,0.2)", color: "#E86A2A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", margin: "0 auto 10px" }}>
                  {name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 0.5 }}>{name}</div>
                {businessType && <div style={{ fontSize: 12, color: "#b0b4c8", marginTop: 2 }}>{businessType}</div>}
                <div style={{ marginTop: 8 }}>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "rgba(52,152,219,0.2)", color: "#3498db" }}>New Lead</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#b0b4c8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Phone</div>
                  <div style={{ fontSize: 12, color: "#e8eaf0" }}>{phone}</div>
                </div>
                <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#b0b4c8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Source</div>
                  <div style={{ fontSize: 12, color: "#e8eaf0" }}>Live Demo</div>
                </div>
                <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#b0b4c8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Deal Value</div>
                  <div style={{ fontSize: 16, color: "#E86A2A", fontFamily: "'Bebas Neue', sans-serif" }}>$0</div>
                </div>
                <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#b0b4c8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Added</div>
                  <div style={{ fontSize: 12, color: "#e8eaf0" }}>Just now</div>
                </div>
              </div>

              <div style={{ padding: "14px 18px", flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#b0b4c8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Notes (0)</div>
                <div style={{ textAlign: "center", color: "#b0b4c8", fontSize: 12, padding: 20 }}>No notes yet</div>
              </div>

              {/* CTA Banner */}
              <div style={{ padding: "16px 18px", borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "center", background: "rgba(232,106,42,0.05)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf0", marginBottom: 6 }}>This is YOUR CRM</div>
                <div style={{ fontSize: 12, color: "#b0b4c8", marginBottom: 12, lineHeight: 1.5 }}>Every lead gets this experience automatically</div>
                <a href="/book-demo" style={{ display: "inline-block", padding: "10px 28px", background: "#E86A2A", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Book a Call</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
