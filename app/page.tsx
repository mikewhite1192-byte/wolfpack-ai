"use client";

import React from "react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// ── Ticker ──────────────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { icon: "📅", text: "Appointment booked — Michael R., Dallas TX" },
  { icon: "🤖", text: "New lead texted back in 3 seconds" },
  { icon: "💬", text: "Objection handled automatically" },
  { icon: "📅", text: "Sarah M. booked for Thursday 2pm" },
  { icon: "⏰", text: "2:47am — appointment booked while agent slept" },
  { icon: "🔵", text: "Blue text delivered — no carrier filtering" },
  { icon: "📅", text: "3 appointments booked before 9am" },
  { icon: "🤖", text: "Lead qualified in 4 messages. Appointment set." },
  { icon: "💬", text: "Price objection handled. Lead booked next day." },
  { icon: "⏰", text: "Sunday 6am. AI booked appointment instantly." },
  { icon: "🔵", text: "iMessage delivered. Lead responded in 30 seconds." },
  { icon: "📅", text: "Maria G. booked — AI nurtured for 11 days" },
];

function Ticker() {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div style={{ overflow: "hidden", position: "relative", padding: "20px 0" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(to right, #0a0a0a, transparent)", zIndex: 2 }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, background: "linear-gradient(to left, #0a0a0a, transparent)", zIndex: 2 }} />
      <div ref={ref} className="ticker-track">
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <div key={i} className="ticker-item">
            <span>{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scramble Text ───────────────────────────────────────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";

function ScrambleText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [display, setDisplay] = useState(text.replace(/[A-Za-z0-9]/g, " "));
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let iteration = 0;
    const max = text.length * 3;
    const interval = setInterval(() => {
      setDisplay(
        text.split("").map((char, i) => {
          if (char === " " || char === "." || char === "'") return char;
          if (i < iteration / 3) return text[i];
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join("")
      );
      iteration++;
      if (iteration > max) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [started, text]);

  return <>{display}</>;
}

// ── FAQ ─────────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(!open)} style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "24px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: "#e8eaf0" }}>{q}</div>
        <span style={{ color: "#E86A2A", fontSize: 20, fontWeight: 300, flexShrink: 0, transition: "transform 0.3s", transform: open ? "rotate(45deg)" : "rotate(0)" }}>+</span>
      </div>
      <div style={{ maxHeight: open ? 200 : 0, overflow: "hidden", transition: "max-height 0.4s ease" }}>
        <div style={{ fontSize: 14, color: "rgba(232,230,227,0.5)", lineHeight: 1.7, paddingTop: 12 }}>{a}</div>
      </div>
    </div>
  );
}

// ── Demo Modal ──────────────────────────────────────────────────────────────
function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/try", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setSending(false);
    } else {
      setSent(true);
      setSending(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 36, maxWidth: 420, width: "100%", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", color: "rgba(232,230,227,0.3)", fontSize: 20, cursor: "pointer" }}>×</button>

        {!sent ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 1, color: "#e8eaf0", marginBottom: 8 }}>
                SEE IT <span style={{ color: "#E86A2A" }}>WORK ON YOU</span>
              </div>
              <p style={{ fontSize: 14, color: "rgba(232,230,227,0.4)", lineHeight: 1.6, margin: 0 }}>
                Enter your number. Maya will text you in 3 seconds.
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
                placeholder="(555) 000-0000"
                style={{ width: "100%", padding: "12px 16px", background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#e8eaf0", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {error && <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={sending || !name.trim() || !phone.trim()}
              style={{ width: "100%", padding: 14, background: "#E86A2A", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.5 : 1 }}
            >
              {sending ? "Sending..." : "Text Me Now →"}
            </button>

            <div style={{ fontSize: 11, color: "rgba(232,230,227,0.2)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
              By clicking, you agree to receive a text message. Standard rates apply.
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📱</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "#e8eaf0", marginBottom: 8 }}>CHECK YOUR PHONE</div>
            <p style={{ fontSize: 14, color: "rgba(232,230,227,0.4)", lineHeight: 1.6, margin: "0 0 20px" }}>
              Maya just texted you. Reply naturally and see the AI appointment setter in action.
            </p>
            <button onClick={onClose} style={{ padding: "10px 28px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(232,230,227,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat Widget ─────────────────────────────────────────────────────────────
function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setSending(true);

    const res = await fetch("/api/chat-widget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: messages }),
    });
    const data = await res.json();
    setMessages([...updated, { role: "assistant", content: data.reply }]);
    setSending(false);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56,
          borderRadius: "50%", background: "#E86A2A", border: "2px solid rgba(255,255,255,0.1)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 24px rgba(232,106,42,0.35)", zIndex: 9998,
          color: "#fff", transition: "all 0.3s ease",
          transform: open ? "rotate(45deg) scale(0.95)" : "none",
          animation: open ? "none" : "chatPulse 2.5s ease-in-out infinite",
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 24, width: 360, maxWidth: "calc(100vw - 48px)",
          height: 460, maxHeight: "calc(100vh - 120px)",
          background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
          display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 9998,
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        }}>
          {/* Header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(232,106,42,0.2)", color: "#E86A2A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>M</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf0" }}>Maya</div>
              <div style={{ fontSize: 11, color: "rgba(232,230,227,0.4)" }}>Wolf Pack AI Assistant</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ background: "rgba(232,106,42,0.08)", borderRadius: "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, color: "#e8eaf0", lineHeight: 1.5, maxWidth: "85%" }}>
                Hey! I'm Maya. Got questions about Wolf Pack AI? Ask me anything.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", padding: "10px 14px", fontSize: 13, lineHeight: 1.5, borderRadius: 14,
                  background: m.role === "user" ? "#E86A2A" : "rgba(255,255,255,0.06)",
                  color: m.role === "user" ? "#fff" : "#e8eaf0",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ fontSize: 12, color: "rgba(232,230,227,0.3)", padding: "4px 8px" }}>Maya is typing...</div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask Maya anything..."
              style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 13, color: "#e8eaf0", outline: "none" }}
            />
            <button onClick={send} disabled={sending || !input.trim()} style={{ padding: "10px 16px", background: "#E86A2A", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.5 : 1 }}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Home() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div style={{ background: "#0a0a0a", color: "#e8eaf0", minHeight: "100vh", fontFamily: "Inter, system-ui, -apple-system, sans-serif", overflowX: "hidden", position: "relative" }}>
      {/* Grain texture overlay */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.035, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px" }} />

      {/* Ambient gradient orbs — fixed, layered behind content */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Top-left warm glow */}
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%", borderRadius: "50%", background: "radial-gradient(circle, rgba(232,106,42,0.06) 0%, transparent 70%)", filter: "blur(80px)" }} />
        {/* Center-right blue glow */}
        <div style={{ position: "absolute", top: "30%", right: "-5%", width: "40%", height: "40%", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,122,255,0.04) 0%, transparent 70%)", filter: "blur(80px)" }} />
        {/* Bottom-center warm glow */}
        <div style={{ position: "absolute", bottom: "5%", left: "30%", width: "45%", height: "35%", borderRadius: "50%", background: "radial-gradient(circle, rgba(232,106,42,0.04) 0%, transparent 70%)", filter: "blur(100px)" }} />
      </div>

      {/* Dot grid pattern — very subtle */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.025, backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      {/* Wolf silhouettes — layered behind content */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Howling wolf — behind problem/difference section */}
        <svg viewBox="0 0 400 500" style={{ position: "absolute", top: "12%", right: "-2%", width: 500, height: 600, opacity: 0.025 }} fill="white">
          <path d="M200,480 L200,320 Q180,300 160,260 Q140,220 150,180 Q155,160 170,145 L175,120 Q170,100 180,80 Q190,60 200,50 Q205,40 200,25 L210,40 Q220,35 225,20 L225,45 Q235,55 240,70 Q250,90 245,110 L250,130 Q265,145 275,165 Q290,200 280,240 Q265,280 240,310 L240,480 Z M170,145 Q160,150 145,145 Q130,138 125,125 Q128,132 135,135 Q145,138 155,135 Q162,140 170,145 Z M250,130 Q260,135 275,130 Q290,123 295,110 Q292,117 285,120 Q275,123 265,120 Q258,125 250,130 Z M175,120 Q178,115 185,112 Q192,112 198,118 M245,110 Q242,105 235,102 Q228,102 222,108 M190,95 Q195,85 200,80 Q205,85 210,95 Q205,92 200,90 Q195,92 190,95 Z" />
        </svg>

        {/* Wolf head profile — behind outcomes section, left side */}
        <svg viewBox="0 0 300 300" style={{ position: "absolute", top: "28%", left: "-3%", width: 400, height: 400, opacity: 0.02 }} fill="white">
          <path d="M60,280 Q70,240 90,210 Q100,195 100,175 Q95,155 100,135 Q105,120 115,110 L110,80 Q115,60 130,45 Q135,35 130,15 L145,35 Q155,25 160,10 L158,40 Q170,50 180,65 Q195,85 195,110 Q200,125 210,140 Q225,160 235,180 Q245,200 240,225 Q235,245 220,260 Q200,275 175,280 Z M115,110 Q105,108 95,100 Q88,90 90,80 Q92,88 98,92 Q106,96 112,95 Q114,102 115,110 Z M130,75 Q135,65 140,60 Q145,65 148,75 Q143,72 140,70 Q135,72 130,75 Z" />
        </svg>

        {/* Paw prints — scattered near pricing */}
        <svg viewBox="0 0 120 120" style={{ position: "absolute", top: "68%", right: "5%", width: 120, height: 120, opacity: 0.03 }} fill="white">
          <ellipse cx="60" cy="75" rx="22" ry="28" />
          <ellipse cx="35" cy="42" rx="12" ry="15" transform="rotate(-15 35 42)" />
          <ellipse cx="60" cy="32" rx="11" ry="14" />
          <ellipse cx="85" cy="42" rx="12" ry="15" transform="rotate(15 85 42)" />
        </svg>
        <svg viewBox="0 0 120 120" style={{ position: "absolute", top: "72%", right: "12%", width: 80, height: 80, opacity: 0.02, transform: "rotate(-20deg)" }} fill="white">
          <ellipse cx="60" cy="75" rx="22" ry="28" />
          <ellipse cx="35" cy="42" rx="12" ry="15" transform="rotate(-15 35 42)" />
          <ellipse cx="60" cy="32" rx="11" ry="14" />
          <ellipse cx="85" cy="42" rx="12" ry="15" transform="rotate(15 85 42)" />
        </svg>

        {/* Pack of wolves silhouette — behind FAQ/final CTA area */}
        <svg viewBox="0 0 800 300" style={{ position: "absolute", bottom: "3%", left: "50%", transform: "translateX(-50%)", width: 900, height: 340, opacity: 0.018 }} fill="white">
          {/* Wolf 1 — left, howling */}
          <path d="M80,280 L80,200 Q70,180 65,155 Q60,130 70,110 L72,85 Q68,70 75,55 Q82,42 88,35 Q90,28 87,18 L95,30 Q100,25 103,15 L102,35 Q110,45 115,60 Q120,78 116,95 L120,110 Q130,130 125,160 Q118,185 110,200 L110,280 Z" />
          {/* Wolf 2 — center-left, standing alert */}
          <path d="M220,280 L220,195 Q210,175 210,155 Q212,135 220,120 L218,95 Q215,80 222,65 Q228,52 235,45 Q237,38 235,28 L242,38 Q248,32 250,22 L249,42 Q256,52 260,65 Q265,82 262,100 L265,118 Q275,138 272,160 Q268,180 260,198 L260,280 Z" />
          {/* Wolf 3 — center, head down */}
          <path d="M380,280 L380,210 Q370,195 368,175 Q368,155 375,140 Q378,128 385,120 L382,100 Q380,85 385,72 Q392,58 398,52 Q400,45 398,38 L405,48 Q410,42 412,35 L411,52 Q418,60 422,72 Q426,88 424,105 L428,122 Q435,140 432,162 Q428,182 420,200 L420,280 Z" />
          {/* Wolf 4 — center-right, looking right */}
          <path d="M540,280 L540,200 Q530,182 528,162 Q528,142 535,125 L533,105 Q530,88 536,74 Q542,60 548,52 Q550,44 548,34 L555,45 Q560,38 563,28 L562,48 Q568,58 572,72 Q577,90 574,108 L578,128 Q586,148 582,170 Q577,190 568,205 L568,280 Z" />
          {/* Wolf 5 — right, howling up */}
          <path d="M680,280 L680,195 Q668,175 662,150 Q658,125 668,105 L665,80 Q662,65 668,50 Q675,38 682,30 Q684,22 682,12 L690,25 Q695,18 698,8 L697,28 Q705,40 710,55 Q715,72 712,90 L715,108 Q725,130 720,155 Q714,180 705,198 L705,280 Z" />
        </svg>

        {/* Single large wolf eye — behind dashboard mockup */}
        <svg viewBox="0 0 200 80" style={{ position: "absolute", top: "48%", left: "50%", transform: "translateX(-50%)", width: 300, height: 120, opacity: 0.02 }} fill="white">
          <path d="M10,40 Q50,5 100,5 Q150,5 190,40 Q150,75 100,75 Q50,75 10,40 Z" />
          <circle cx="100" cy="40" r="20" fill="#0a0a0a" />
          <circle cx="100" cy="40" r="10" fill="white" />
        </svg>
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes heroIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes heroZoom { from { transform: scale(1); } to { transform: scale(1.08); } }
        @keyframes chatPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(232,106,42,0.4); } 50% { box-shadow: 0 0 0 12px rgba(232,106,42,0); } }
        @keyframes ctaPulse { 0%, 100% { box-shadow: 0 4px 20px rgba(232,106,42,0.3); } 50% { box-shadow: 0 4px 32px rgba(232,106,42,0.5); } }
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

        .ticker-track { display: flex; gap: 40px; white-space: nowrap; animation: scroll 30s linear infinite; }
        .ticker-item { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; flex-shrink: 0; color: rgba(232,230,227,0.7); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 18px; }

        .wp-nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; max-width: 1100px; margin: 0 auto; }
        .wp-nav a { color: rgba(232,230,227,0.4); text-decoration: none; font-size: 13px; font-weight: 500; transition: color 0.2s; letter-spacing: 0.5px; }
        .wp-nav a:hover { color: #e8eaf0; }

        .wp-cta { display: inline-flex; align-items: center; gap: 8px; padding: 16px 36px; background: #E86A2A; color: #fff; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 700; transition: all 0.3s; border: none; cursor: pointer; animation: ctaPulse 3s ease-in-out infinite; letter-spacing: 0.3px; }
        .wp-cta:hover { background: #ff7b3a; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(232,106,42,0.35); animation: none; }
        .wp-ghost { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: transparent; border: 1px solid rgba(255,255,255,0.15); color: rgba(232,230,227,0.5); border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 500; transition: all 0.3s; cursor: pointer; }
        .wp-ghost:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

        .wp-outcome { padding: 36px; border-radius: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); transition: all 0.4s ease; position: relative; overflow: hidden; }
        .wp-outcome::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(232,106,42,0.3), transparent); opacity: 0; transition: opacity 0.4s; }
        .wp-outcome:hover { border-color: rgba(232,106,42,0.2); background: rgba(232,106,42,0.03); transform: translateY(-2px); }
        .wp-outcome:hover::before { opacity: 1; }
        .wp-outcome-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 20px; background: rgba(232,106,42,0.08); border: 1px solid rgba(232,106,42,0.15); }
        .wp-step { flex: 1; min-width: 260; padding: 36px; border-radius: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); position: relative; transition: all 0.4s ease; }
        .wp-step:hover { border-color: rgba(232,106,42,0.15); background: rgba(232,106,42,0.02); }
        .wp-step-num { font-family: 'Bebas Neue', sans-serif; font-size: 48px; color: #E86A2A; line-height: 1; margin-bottom: 16px; opacity: 0.9; }
        .wp-step-connector { display: flex; align-items: center; color: rgba(232,106,42,0.3); font-size: 24px; padding: 0 4px; }
        .wp-proof-bar { max-width: 900px; margin: 0 auto; padding: 48px 40px; display: flex; justify-content: center; gap: 48px; flex-wrap: wrap; }
        .wp-proof-item { text-align: center; }
        .wp-proof-num { font-family: 'Bebas Neue', sans-serif; font-size: 44px; color: #E86A2A; line-height: 1; }
        .wp-proof-label { font-size: 12px; color: rgba(232,230,227,0.35); margin-top: 6px; letter-spacing: 0.5px; }
        @media (max-width: 768px) {
          .wp-step-connector { display: none !important; }
          .wp-proof-bar { gap: 32px !important; padding: 32px 20px !important; }
          .wp-dash-sidebar { display: none !important; }
          .wp-dash-wrap { transform: none !important; }
        }

        .wp-price-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 36px; transition: all 0.3s; }
        .wp-price-card:hover { border-color: rgba(232,106,42,0.2); }
        .wp-price-card.featured { border-color: #E86A2A; background: rgba(232,106,42,0.03); }

        .wp-problem-stat { text-align: center; flex: 1; min-width: 180px; }
        .wp-problem-num { font-family: 'Bebas Neue', sans-serif; font-size: 56px; color: #E86A2A; line-height: 1; }
        .wp-problem-label { font-size: 13px; color: rgba(232,230,227,0.4); line-height: 1.5; margin-top: 8px; }

        @media (max-width: 768px) {
          .wp-hero-grid { flex-direction: column !important; text-align: center !important; }
          .wp-hero-grid h1 { font-size: 48px !important; }
          .wp-outcomes-grid { grid-template-columns: 1fr !important; }
          .wp-price-grid { flex-direction: column !important; }
          .wp-nav-links { display: none !important; }
          .wp-mobile-menu { display: flex !important; }
          .wp-stats { flex-direction: column !important; gap: 32px !important; padding: 50px 20px !important; }
          .wp-stats > div { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 24px !important; }
          .wp-stats > div:last-child { border-bottom: none; padding-bottom: 0 !important; }
          .wp-problem-stats { flex-direction: column !important; gap: 32px !important; }
          .wp-section-title { font-size: 36px !important; }
          .wp-nav { padding: 16px 20px !important; }
          .wp-hero-section { height: auto !important; min-height: 100vh !important; padding: 0 !important; }
          .wp-hero-section > div:last-child { padding: 100px 24px 60px !important; }
          .wp-hero-title { font-size: 48px !important; }
          .wp-section-pad { padding-left: 20px !important; padding-right: 20px !important; }
          .wp-how-steps { flex-direction: column !important; }
          .wp-price-card { max-width: 100% !important; }
          .wp-price-card > div { flex-direction: column !important; }
          .wp-price-card .wp-price-features { grid-template-columns: 1fr !important; }
          .wp-price-bottom { grid-template-columns: 1fr !important; }
          .wp-footer-links { flex-wrap: wrap !important; gap: 16px !important; }
        }
        @media (max-width: 480px) {
          .wp-hero-title { font-size: 38px !important; }
          .wp-problem-num { font-size: 44px !important; }
          .wp-section-heading { font-size: 32px !important; }
          .wp-stats > div > div:first-child { font-size: 52px !important; }
        }
      `}</style>

      {/* Nav */}
      <nav className="wp-nav">
        <Link href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: "#e8eaf0", textDecoration: "none" }}>
          THE <span style={{ color: "#E86A2A" }}>WOLF</span> PACK
        </Link>
        <div className="wp-nav-links" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <a href="#how">How It Works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <a href="#" onClick={e => { e.preventDefault(); setDemoOpen(true); }} style={{ color: "#E86A2A" }}>Live Demo</a>
          <Link href="/sign-in" style={{ color: "rgba(232,230,227,0.4)" }}>Sign In</Link>
          <Link href="/sign-up" className="wp-cta" style={{ padding: "8px 20px", fontSize: 12 }}>Get Started</Link>
        </div>
        <div className="wp-mobile-menu" style={{ display: "none", gap: 12, alignItems: "center" }}>
          <Link href="/sign-in" style={{ color: "rgba(232,230,227,0.5)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>Sign In</Link>
          <Link href="/sign-up" className="wp-cta" style={{ padding: "8px 16px", fontSize: 12 }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="wp-hero-section" style={{ position: "relative", height: "92vh", minHeight: 600, maxHeight: 900, display: "flex", alignItems: "center", overflow: "hidden" }}>
        {/* Wolf image — pushed right, high contrast */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: "url(/images/hero-wolf.png)",
          backgroundSize: "cover",
          backgroundPosition: "70% 35%",
          opacity: 0.7,
          filter: "contrast(1.3) brightness(0.9)",
          animation: "heroIn 2s ease both",
        }} />
        {/* Left-to-right gradient — dark left (text area) fading to transparent right (wolf) */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: "linear-gradient(to right, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.85) 25%, rgba(10,10,10,0.5) 55%, rgba(10,10,10,0.2) 80%, rgba(10,10,10,0.15) 100%)",
        }} />
        {/* Bottom fade to black */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: "linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(10,10,10,0.7) 85%, rgba(10,10,10,1) 100%)",
        }} />
        {/* Top subtle vignette */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: "radial-gradient(ellipse at 70% 40%, transparent 30%, rgba(10,10,10,0.4) 100%)",
        }} />

        <div style={{ position: "relative", zIndex: 2, maxWidth: 1200, width: "100%", margin: "0 auto", padding: "0 60px" }}>
          <div style={{ maxWidth: 580 }}>
            <div style={{ animation: "heroIn 0.6s ease 0.2s both" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", background: "rgba(232,106,42,0.15)", border: "1px solid rgba(232,106,42,0.3)", borderRadius: 20, fontSize: 11, fontWeight: 600, color: "#E86A2A", letterSpacing: 1, textTransform: "uppercase", marginBottom: 28, backdropFilter: "blur(8px)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E86A2A", display: "inline-block" }} />
                AI Appointment Setter
              </div>
            </div>
            <h1 className="wp-hero-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, lineHeight: 0.92, margin: "0 0 28px", letterSpacing: 1, animation: "heroIn 0.8s ease 0.4s both", textShadow: "0 4px 60px rgba(0,0,0,0.8)" }}>
              <ScrambleText text="STOP CHASING LEADS." delay={600} />
              <br />
              <span style={{ color: "#E86A2A" }}><ScrambleText text="START CLOSING THEM." delay={1400} /></span>
            </h1>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: 1.8, maxWidth: 500, margin: "0 0 20px", animation: "heroIn 0.8s ease 2s both", textShadow: "0 1px 20px rgba(0,0,0,0.6)" }}>
              Your AI appointment setter texts leads in 3 seconds, qualifies them, and books on your calendar. 24/7. No staff. No missed leads.
            </p>
            <p style={{ fontSize: 16, color: "#e8eaf0", maxWidth: 500, margin: "0 0 40px", animation: "heroIn 0.8s ease 2.3s both", lineHeight: 1.7, fontWeight: 600 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,122,255,0.15)", border: "1px solid rgba(0,122,255,0.3)", borderRadius: 20, padding: "4px 14px", fontSize: 14, fontWeight: 700, color: "#007AFF", marginRight: 6, verticalAlign: "middle", backdropFilter: "blur(8px)" }}>🔵 iMessage</span>
              texts. No A2P registration. No carrier filtering. <span style={{ color: "rgba(255,255,255,0.9)" }}>Your leads actually hear from you first.</span>
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", animation: "heroIn 0.8s ease 2.6s both" }}>
              <button onClick={() => setDemoOpen(true)} className="wp-cta">See It Work On You →</button>
              <Link href="/book-demo" className="wp-ghost" style={{ backdropFilter: "blur(8px)", borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}>Book a Demo</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="wp-stats" style={{ display: "flex", justifyContent: "center", maxWidth: 1000, margin: "0 auto", padding: "80px 40px" }}>
        {[
          { num: "3 SEC", label: "Response time" },
          { num: "24/7", label: "Never misses a lead" },
          { num: "10X", label: "More appointments booked" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", padding: "0 20px", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 72, color: "#E86A2A", letterSpacing: 2, lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontSize: 13, color: "rgba(232,230,227,0.35)", marginTop: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Ticker */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", margin: "20px 0" }}>
        <Ticker />
      </div>

      {/* Problem Section */}
      <div style={{ position: "relative" }}>
        {/* Section ambient glow */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "70%", height: "100%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(232,106,42,0.04) 0%, transparent 60%)", pointerEvents: "none", filter: "blur(60px)" }} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 40px 60px", textAlign: "center", position: "relative" }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 12px", letterSpacing: 1, lineHeight: 1 }}>
          EVERY MINUTE YOU WAIT{" "}
          <span style={{ color: "#E86A2A" }}>YOUR LEAD IS TEXTING SOMEONE ELSE</span>
        </h2>
        <p style={{ fontSize: 15, color: "rgba(232,230,227,0.4)", margin: "0 0 48px" }}>
          The first person to respond wins. Always. Are you first?
        </p>
        <div className="wp-problem-stats" style={{ display: "flex", gap: 48, justifyContent: "center", flexWrap: "wrap" }}>
          <div className="wp-problem-stat">
            <div className="wp-problem-num">78%</div>
            <div className="wp-problem-label">Buy from the<br />first responder</div>
          </div>
          <div className="wp-problem-stat">
            <div className="wp-problem-num">5 MIN</div>
            <div className="wp-problem-label">Response time drops<br />conversion 80%</div>
          </div>
          <div className="wp-problem-stat">
            <div className="wp-problem-num">48%</div>
            <div className="wp-problem-label">Never follow<br />up at all</div>
          </div>
        </div>
      </div>
      </div>

      {/* The Difference — emotional hook, comes first */}
      <div style={{ position: "relative" }}>
        {/* Section ambient glow */}
        <div style={{ position: "absolute", top: "20%", right: "0%", width: "50%", height: "60%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,122,255,0.03) 0%, transparent 60%)", pointerEvents: "none", filter: "blur(80px)" }} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "80px 40px 60px", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#E86A2A", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>The Difference</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, margin: "0 0 14px", letterSpacing: 1, lineHeight: 1.05 }}>
            THIS ISN&#39;T SOFTWARE. <span style={{ color: "#E86A2A" }}>IT&#39;S A CLOSER.</span>
          </h2>
          <p style={{ fontSize: 15, color: "rgba(232,230,227,0.35)", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
            You didn&#39;t start your business to sit in a CRM. Wolf Pack handles the grind so you handle the deals.
          </p>
        </div>
        <div className="wp-outcomes-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            {
              icon: "📅",
              title: "Your phone buzzes with booked appointments",
              desc: "Not notifications to follow up. Not reminders you missed something. Actual confirmed appointments, already on your calendar, with qualified leads ready to talk.",
            },
            {
              icon: "🌙",
              title: "2am lead? Handled before you wake up",
              desc: "Sunday night. Holiday weekend. Middle of a closing. Doesn't matter. The AI responds in 3 seconds, every single time. Your competitors respond Monday morning. You already booked it.",
            },
            {
              icon: "🔵",
              title: "Blue bubble. Not spam folder.",
              desc: "Your competitors send green SMS texts that get filtered by carriers. You send real iMessages through Apple's network. No registration. No filtering. The message actually lands.",
            },
            {
              icon: "🔁",
              title: "The lead you forgot about? We didn't.",
              desc: "Day 1, 3, 7, 14 — different angle every time. The AI came back on a lead 11 days later and booked them. That's revenue you would've lost.",
            },
          ].map((o, i) => (
            <div key={i} className="wp-outcome">
              <div className="wp-outcome-icon">{o.icon}</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: "#e8eaf0", marginBottom: 10, lineHeight: 1.3 }}>{o.title}</div>
              <div style={{ fontSize: 14, color: "rgba(232,230,227,0.45)", lineHeight: 1.75 }}>{o.desc}</div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* Proof Bar */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", margin: "20px 0" }}>
        <div className="wp-proof-bar">
          {[
            { num: "47", label: "Appointments booked in 30 days" },
            { num: "3 SEC", label: "Average response time" },
            { num: "11 DAYS", label: "Longest nurture to booking" },
            { num: "$0", label: "Extra staff needed" },
          ].map((p, i) => (
            <div key={i} className="wp-proof-item">
              <div className="wp-proof-num">{p.num}</div>
              <div className="wp-proof-label">{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard Preview */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 40px 20px", perspective: 1200 }}>
        <div className="wp-dash-wrap" style={{ transform: "rotateX(4deg) rotateY(-1deg)", transformOrigin: "center center", position: "relative" }}>
          {/* Glow behind */}
          <div style={{ position: "absolute", inset: -40, background: "radial-gradient(ellipse at center, rgba(232,106,42,0.08) 0%, transparent 70%)", zIndex: 0, borderRadius: 40, filter: "blur(40px)" }} />

          {/* Dashboard frame */}
          <div className="wp-dash" style={{
            position: "relative", zIndex: 1, background: "rgba(17,17,17,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 0, overflow: "hidden",
            boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>
            {/* Title bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500, letterSpacing: 0.5 }}>Wolf Pack AI — Dashboard</div>
              <div style={{ width: 50 }} />
            </div>

            <div style={{ display: "flex", minHeight: 340 }}>
              {/* Sidebar */}
              <div className="wp-dash-sidebar" style={{ width: 180, borderRight: "1px solid rgba(255,255,255,0.06)", padding: "16px 12px", flexShrink: 0, background: "rgba(0,0,0,0.2)" }}>
                {[
                  { icon: "📊", label: "Dashboard", active: true },
                  { icon: "💬", label: "Conversations", badge: 3 },
                  { icon: "📋", label: "Pipeline" },
                  { icon: "📅", label: "Calendar" },
                  { icon: "👥", label: "Contacts" },
                  { icon: "📧", label: "Email" },
                  { icon: "⚙️", label: "Settings" },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, marginBottom: 2, fontSize: 12, fontWeight: 500,
                    background: item.active ? "rgba(232,106,42,0.12)" : "transparent",
                    color: item.active ? "#E86A2A" : "rgba(255,255,255,0.35)",
                  }}>
                    <span style={{ fontSize: 13 }}>{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span style={{ marginLeft: "auto", background: "#E86A2A", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8 }}>{item.badge}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div style={{ flex: 1, padding: 20, overflow: "hidden" }}>
                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Appointments Today", value: "6", color: "#E86A2A" },
                    { label: "Active Conversations", value: "12", color: "#007AFF" },
                    { label: "Pipeline Value", value: "$34.2k", color: "#2ecc71" },
                    { label: "Response Time", value: "3s", color: "#f5a623" },
                  ].map((stat, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 0.5 }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Recent conversations */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#E86A2A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Live Conversations</div>
                    {[
                      { name: "Marcus J.", msg: "Yeah Thursday at 2 works for me", time: "Just now", blue: true },
                      { name: "Sarah K.", msg: "What's the pricing for a full rewire?", time: "2m ago", blue: true },
                      { name: "David R.", msg: "Sounds good, send me the calendar link", time: "5m ago", blue: false },
                    ].map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `rgba(232,106,42,${0.15 + i * 0.05})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#E86A2A", flexShrink: 0 }}>
                          {c.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{c.name}</span>
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{c.time}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.blue && <span style={{ color: "#007AFF", marginRight: 4, fontSize: 8 }}>●</span>}
                            {c.msg}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pipeline mini */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#E86A2A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Pipeline</div>
                    {[
                      { stage: "New Lead", count: 8, color: "#007AFF", width: "85%" },
                      { stage: "Qualified", count: 5, color: "#E86A2A", width: "55%" },
                      { stage: "Appointment Set", count: 4, color: "#f5a623", width: "45%" },
                      { stage: "Proposal Sent", count: 2, color: "#9b59b6", width: "25%" },
                      { stage: "Won", count: 3, color: "#2ecc71", width: "35%" },
                    ].map((s, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{s.stage}</span>
                          <span style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.count}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 2, background: s.color, width: s.width, opacity: 0.6 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Appointment ticker at bottom */}
                <div style={{ marginTop: 12, display: "flex", gap: 8, overflow: "hidden" }}>
                  {[
                    { name: "Marcus J.", time: "Thu 2:00 PM", status: "Confirmed" },
                    { name: "Lisa M.", time: "Fri 10:00 AM", status: "Confirmed" },
                    { name: "James W.", time: "Fri 3:30 PM", status: "Pending" },
                  ].map((a, i) => (
                    <div key={i} style={{ flex: 1, background: "rgba(46,204,113,0.06)", border: "1px solid rgba(46,204,113,0.12)", borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{a.time} · <span style={{ color: a.status === "Confirmed" ? "#2ecc71" : "#f5a623" }}>{a.status}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how" style={{ maxWidth: 960, margin: "0 auto", padding: "80px 40px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#E86A2A", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>How It Works</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, margin: "0 0 12px", letterSpacing: 1, lineHeight: 1.05 }}>
            THREE STEPS. <span style={{ color: "#E86A2A" }}>ONE FULL CALENDAR.</span>
          </h2>
          <p style={{ fontSize: 15, color: "rgba(232,230,227,0.35)", maxWidth: 440, margin: "0 auto" }}>You don&#39;t learn software. You just get appointments.</p>
        </div>
        <div className="wp-how-steps" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          {[
            { num: "01", title: "Lead comes in", desc: "Ads, website, referral, Google — doesn't matter where. The AI picks it up before you even see the notification." },
            { num: "02", title: "AI books the appointment", desc: "Texts back in 3 seconds via iMessage. Qualifies. Handles objections. Sends the calendar invite. Done." },
            { num: "03", title: "You show up and close", desc: "Calendar invite with Google Meet link. The lead is warmed up, qualified, and expecting your call." },
          ].map((s, i) => (
            <React.Fragment key={i}>
              <div className="wp-step">
                <div className="wp-step-num">{s.num}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#e8eaf0", marginBottom: 10 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: "rgba(232,230,227,0.4)", lineHeight: 1.7 }}>{s.desc}</div>
              </div>
              {i < 2 && <div className="wp-step-connector">&#8594;</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Demo CTA */}
      <div style={{ padding: "60px 40px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: "60px 40px", borderRadius: 20, border: "1px solid rgba(232,106,42,0.3)", background: "#0a0a0a" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, margin: "0 0 12px" }}>SEE IT <span style={{ color: "#E86A2A" }}>WORK ON YOU</span></h2>
          <p style={{ fontSize: 15, color: "rgba(232,230,227,0.4)", margin: "0 0 28px", lineHeight: 1.6 }}>Enter your number. Wolf Pack AI texts you back in 3 seconds, qualifies you, and books an appointment on your calendar. Experience exactly what your leads will.</p>
          <button onClick={() => setDemoOpen(true)} className="wp-cta">Text Me Now →</button>
        </div>
      </div>

      {/* Pricing */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: "60%", height: "50%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(232,106,42,0.05) 0%, transparent 60%)", pointerEvents: "none", filter: "blur(80px)" }} />
      <div id="pricing" style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 40px", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#E86A2A", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>Pricing</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 12px", letterSpacing: 1, lineHeight: 1.05 }}>
            ONE MISSED APPOINTMENT COSTS MORE THAN THIS.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(232,230,227,0.35)", maxWidth: 480, margin: "0 auto" }}>No contracts. Cancel anytime. Set up in 10 minutes.</p>
        </div>
        {/* Main plan — full width on top */}
        <div style={{ maxWidth: 680, margin: "0 auto 20px" }}>
          <div className="wp-price-card featured" style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#E86A2A", color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 14px", borderRadius: 20, letterSpacing: 0.5 }}>ALL-IN-ONE</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,230,227,0.3)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>WOLF PACK AI</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: "#e8eaf0", lineHeight: 1 }}>$97<span style={{ fontSize: 15, color: "rgba(232,230,227,0.3)", fontFamily: "Inter, sans-serif" }}>/mo</span></div>
                <p style={{ fontSize: 14, color: "rgba(232,230,227,0.4)", margin: "12px 0 20px" }}>Everything you need. Blue texts, AI agent, CRM. One price.</p>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/stripe/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ plan: "pro" }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  }}
                  className="wp-cta"
                  style={{ width: "100%", justifyContent: "center", boxSizing: "border-box", display: "flex", fontFamily: "inherit", fontSize: "inherit" }}
                >
                  Get Started
                </button>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  {["AI Appointment Setter", "iMessage (Blue Texts)", "No A2P Registration", "No Carrier Filtering", "Unlimited Conversations", "Pipeline CRM", "Auto Follow-ups", "Gmail Integration", "Calendar + Booking", "Call Recording", "Self-Learning AI", "CSV Import", "Analytics"].map((f, j) => (
                    <div key={j} style={{ fontSize: 13, color: "rgba(232,230,227,0.5)", padding: "5px 0", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#2ecc71", fontWeight: 700, fontSize: 11 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row — GBP + Agency side by side */}
        <div className="wp-price-bottom" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 680, margin: "0 auto" }}>
          <div className="wp-price-card" style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "rgba(232,106,42,0.2)", color: "#E86A2A", fontSize: 10, fontWeight: 700, padding: "4px 14px", borderRadius: 20, letterSpacing: 0.5, border: "1px solid rgba(232,106,42,0.3)" }}>ADD-ON</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,230,227,0.3)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>GBP MANAGEMENT</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: "#e8eaf0" }}>$49<span style={{ fontSize: 15, color: "rgba(232,230,227,0.3)", fontFamily: "Inter, sans-serif" }}>/mo</span></div>
            <p style={{ fontSize: 13, color: "rgba(232,230,227,0.35)", margin: "8px 0 20px" }}>Your Google Business Profile on autopilot. More visibility, more calls.</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}>
              {["Weekly Auto Posts", "AI Review Replies", "Negative Review Alerts", "Monthly Performance Report", "Search + Maps Tracking", "Call + Direction Tracking", "Top Search Terms", "Photo Management", "Business Info Updates", "Service Area Management", "Review Request Sequence", "Competitor-Level Presence"].map((f, j) => (
                <li key={j} style={{ fontSize: 12, color: "rgba(232,230,227,0.5)", padding: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#2ecc71", fontWeight: 700, fontSize: 10 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <Link href="/book-demo" className="wp-ghost" style={{ width: "100%", justifyContent: "center", boxSizing: "border-box", display: "flex" }}>
              Add to Plan
            </Link>
          </div>

          <div className="wp-price-card" style={{ position: "relative" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,230,227,0.3)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>AGENCY</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: "#e8eaf0" }}>Custom</div>
            <p style={{ fontSize: 13, color: "rgba(232,230,227,0.35)", margin: "8px 0 20px" }}>For agencies managing multiple clients.</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}>
              {["Everything in Wolf Pack AI", "GBP Management Included", "Multiple Numbers", "White Label Branding", "Custom Domain", "Team Management", "API Access", "Dedicated Support", "Facebook Lead Integration", "Volume Discounts"].map((f, j) => (
                <li key={j} style={{ fontSize: 12, color: "rgba(232,230,227,0.5)", padding: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#2ecc71", fontWeight: 700, fontSize: 10 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <Link href="/book-demo" className="wp-ghost" style={{ width: "100%", justifyContent: "center", boxSizing: "border-box", display: "flex" }}>
              Contact Us
            </Link>
          </div>
        </div>
      </div>
      </div>

      {/* FAQ */}
      <div id="faq" style={{ maxWidth: 640, margin: "0 auto", padding: "60px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, margin: 0, letterSpacing: 1 }}>Questions? We Got You.</h2>
        </div>
        <FaqItem q="How does the AI set appointments?" a="The moment a lead comes in, the AI texts them within seconds. It qualifies them with natural questions, handles any objections, and books directly on your calendar with a Google Meet link. You just show up." />
        <FaqItem q="Will leads know they're talking to AI?" a="No. It texts like a real person on your team. No dashes, no bullet points, no robotic grammar. It mirrors the lead's energy and tone. Most leads have no idea." />
        <FaqItem q="What's the difference between blue and green texts?" a="Green texts (SMS) require A2P registration and get filtered by carriers — your leads might never see them. Blue texts (iMessage) go through Apple's network directly. No registration. No filtering. Higher response rates. Our Pro plan includes blue texts." />
        <FaqItem q="Can I take over a conversation from the AI?" a="Yes. Every conversation has an AI toggle. Turn it off and you're in control. Turn it back on and the AI picks up where you left off." />
        <FaqItem q="How fast does the AI respond?" a="3 seconds. The moment a lead comes in, the AI is texting them. That speed alone puts you ahead of 90% of your competition." />
        <FaqItem q="Do I need any technical skills?" a="No. When you sign up, the AI walks you through setup with a few questions about your business. You can be live in minutes." />
        <FaqItem q="What happens if a lead goes cold?" a="The AI follows up automatically on day 1, 3, 7, and 14 with a different approach each time. No lead gets forgotten. The AI came back on a lead 11 days later and booked them." />
      </div>

      {/* Final CTA */}
      <div style={{ padding: "60px 40px 80px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, margin: "0 0 16px", letterSpacing: 1, lineHeight: 1.1 }}>
          STOP LOSING APPOINTMENTS TO<br />
          <span style={{ color: "#E86A2A" }}>WHOEVER RESPONDED FASTER</span>
        </h2>
        <p style={{ fontSize: 15, color: "rgba(232,230,227,0.35)", margin: "0 0 32px" }}>Your competitors are texting your leads right now.</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setDemoOpen(true)} className="wp-cta">See It Work On You →</button>
          <Link href="/book-demo" className="wp-ghost">Book a Demo</Link>
        </div>
      </div>

      {/* Demo Modal */}
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />

      {/* Chat Widget */}
      <ChatWidget />

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "80px 40px 40px" }}>
        {/* Closing CTA line */}
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: 1, color: "rgba(232,230,227,0.6)", marginBottom: 16 }}>
            YOUR COMPETITION ISN&apos;T WAITING.
          </div>
          <button onClick={() => setDemoOpen(true)} className="wp-cta" style={{ fontSize: 16, padding: "16px 40px" }}>See It Work On You →</button>
        </div>

        {/* Big logo */}
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(32px, 10vw, 140px)", letterSpacing: "clamp(2px, 0.5vw, 6px)", textAlign: "center", lineHeight: 0.9, marginBottom: 32, color: "rgba(255,255,255,0.04)", userSelect: "none" }}>
          THE <span style={{ color: "rgba(232,106,42,0.08)" }}>WOLF</span> PACK
        </div>

        {/* Nav links */}
        <div className="wp-footer-links" style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 24 }}>
          {[
            { label: "How It Works", href: "#how" },
            { label: "Pricing", href: "#pricing" },
            { label: "Book a Demo", href: "/book-demo" },
            { label: "FAQ", href: "#faq" },
          ].map(link => (
            <Link key={link.label} href={link.href} style={{ color: "rgba(232,230,227,0.3)", textDecoration: "none", fontSize: 13, fontWeight: 500, transition: "color 0.2s" }}>{link.label}</Link>
          ))}
        </div>

        {/* Legal */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, alignItems: "center" }}>
          <Link href="/privacy" style={{ color: "rgba(232,230,227,0.2)", textDecoration: "none", fontSize: 11 }}>Privacy</Link>
          <Link href="/terms" style={{ color: "rgba(232,230,227,0.2)", textDecoration: "none", fontSize: 11 }}>Terms</Link>
          <span style={{ fontSize: 11, color: "rgba(232,230,227,0.12)" }}>© {new Date().getFullYear()} The Wolf Pack AI</span>
        </div>
      </div>
      </div>
    </div>
  );
}
