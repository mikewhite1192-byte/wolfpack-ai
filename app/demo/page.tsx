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
    <div style={{ minHeight: "100vh", background: "#0D1426", color: "#e8eaf0" }}>
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

        .demo-phone { background: #0D1426; margin: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; min-height: 400px; display: flex; flex-direction: column; }
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
              <h1>See Your <span>AI Sales Agent</span> In Action</h1>
              <p>Enter your phone number and experience exactly what your leads will experience. Our AI will text you, qualify you, handle objections, and book an appointment. All in real time.</p>
            </div>

            <div className="demo-steps">
              <div className="demo-step">
                <div className="demo-step-num">1</div>
                <div className="demo-step-text">Enter your phone number</div>
              </div>
              <div className="demo-step">
                <div className="demo-step-num">2</div>
                <div className="demo-step-text">Get a text from our AI agent</div>
              </div>
              <div className="demo-step">
                <div className="demo-step-num">3</div>
                <div className="demo-step-text">Experience the full sales flow</div>
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

        {/* Live View */}
        {step === "live" && (
          <>
            <div className="demo-live">
              <div className="demo-live-header">
                <div className="demo-live-dot" />
                <div>
                  <div className="demo-live-title">Live Demo Active</div>
                  <div className="demo-live-sub">Check your phone for texts from our AI agent</div>
                </div>
              </div>

              <div className="demo-phone">
                <div className="demo-phone-header">
                  <div className="demo-phone-name">Wolf Pack AI</div>
                  <div className="demo-phone-number">{phone}</div>
                </div>

                <div className="demo-phone-msgs">
                  {messages.length === 0 ? (
                    <div className="demo-waiting">
                      <div className="demo-waiting-text">Waiting for first message...</div>
                      <div className="demo-waiting-sub">The AI is composing your first text right now</div>
                    </div>
                  ) : (
                    <div className="demo-phone-msgs-inner">
                      {messages.map((m, i) => {
                        const next = messages[i + 1];
                        const showTail = !next || next.direction !== m.direction;
                        return (
                          <div key={i} className={`demo-msg-row ${m.direction}${showTail ? " tail" : ""}`}>
                            <div className={`demo-bubble ${m.direction}`}>{m.body}</div>
                            {showTail && (
                              <div className="demo-msg-time">
                                {m.sent_by === "ai" && "AI · "}
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

                <div className="demo-phone-footer">
                  Conversation updates in real time as you text back
                </div>
              </div>
            </div>

            <div className="demo-cta">
              <div className="demo-cta-text">Like what you see? Let's set you up.</div>
              <a href="/book/default" className="demo-cta-btn">Book a Call</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
