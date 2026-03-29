"use client";

import { useState } from "react";
import Link from "next/link";

const T = {
  bg: "#0a0a0a",
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "rgba(232,230,227,0.45)",
  border: "rgba(255,255,255,0.07)",
  blue: "#007AFF",
};

export default function TryPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !name.trim()) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setSending(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    }
    setSending(false);
  }

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .try-input { width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 10px; font-size: 15px; color: ${T.text}; outline: none; font-family: inherit; box-sizing: border-box; }
        .try-input:focus { border-color: ${T.orange}; }
        .try-input::placeholder { color: rgba(255,255,255,0.2); }
        .try-btn { width: 100%; padding: 16px; background: ${T.orange}; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: inherit; }
        .try-btn:hover { background: #ff7b3a; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(232,106,42,0.25); }
        .try-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
      `}</style>

      {/* Logo */}
      <Link href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: T.text, textDecoration: "none", marginBottom: 60 }}>
        THE <span style={{ color: T.orange }}>WOLF</span> PACK
      </Link>

      {!sent ? (
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center", animation: "fadeUp 0.6s ease" }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 8vw, 52px)", lineHeight: 1, margin: "0 0 16px", letterSpacing: 1 }}>
            See What Your Leads<br />Experience in <span style={{ color: T.orange }}>30 Seconds</span>
          </h1>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.6, margin: "0 0 32px" }}>
            Enter your number. The AI texts you back instantly. No signup needed.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <input
              className="try-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="First name"
              required
            />
            <input
              className="try-input"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone number"
              required
            />
            <button className="try-btn" type="submit" disabled={sending || !name.trim() || !phone.trim()}>
              {sending ? "Starting..." : "Text Me Now →"}
            </button>
          </form>

          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>
            Our AI will text you pretending to be an insurance agent. Play along. We promise it's worth it.
          </p>

          {error && <p style={{ color: "#e74c3c", fontSize: 13, marginTop: 12 }}>{error}</p>}

          {/* Stats */}
          <div style={{ display: "flex", gap: 40, justifyContent: "center", marginTop: 48 }}>
            {[
              { num: "3 SEC", label: "Response time" },
              { num: "24/7", label: "Never sleeps" },
              { num: "10X", label: "More appointments" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: T.orange }}>{s.num}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center", animation: "fadeUp 0.6s ease" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>📱</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, margin: "0 0 12px", letterSpacing: 1 }}>
            Check Your Phone
          </h2>
          <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.6, margin: "0 0 8px" }}>
            Maya from Wolf Pack just texted you. Reply naturally and see what happens.
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", marginBottom: 32 }}>
            The whole experience takes about 60 seconds.
          </p>
          <Link href="/" style={{ fontSize: 13, color: T.orange, textDecoration: "none" }}>
            ← Back to home
          </Link>
        </div>
      )}

      {/* Footer */}
      <div style={{ position: "fixed", bottom: 24, left: 0, right: 0, textAlign: "center" }}>
        <Link href="/privacy" style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", textDecoration: "none", marginRight: 16 }}>Privacy</Link>
        <Link href="/terms" style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", textDecoration: "none" }}>Terms</Link>
      </div>
    </div>
  );
}
