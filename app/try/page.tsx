"use client";

import { useState } from "react";
import Link from "next/link";

export default function TryPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
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
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), industry: industry || "insurance" }),
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
    <div style={{ background: "#0a0a0a", color: "#e8eaf0", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px 100px" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .try-input { width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; font-size: 15px; color: #e8eaf0; outline: none; font-family: inherit; box-sizing: border-box; }
        .try-input:focus { border-color: #F97316; }
        .try-input::placeholder { color: rgba(255,255,255,0.2); }
        .try-select { width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; font-size: 15px; color: #e8eaf0; outline: none; font-family: inherit; box-sizing: border-box; cursor: pointer; -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23888' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 16px center; }
        .try-select:focus { border-color: #F97316; }
        .try-select option { background: #111; color: #e8eaf0; }
        .try-btn { width: 100%; padding: 16px; background: #F97316; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: inherit; letter-spacing: 0.5px; }
        .try-btn:hover { background: #fb923c; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(249,115,22,0.3); }
        .try-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
      `}</style>

      {/* Logo */}
      <Link href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: "#e8eaf0", textDecoration: "none", marginBottom: 60 }}>
        THE <span style={{ color: "#F97316" }}>WOLF</span> PACK
      </Link>

      {!sent ? (
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center", animation: "fadeUp 0.6s ease" }}>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 8vw, 52px)", lineHeight: 1, margin: "0 0 16px", letterSpacing: 1, color: "#fff" }}>
            See What Your Leads<br />Experience in <span style={{ color: "#F97316" }}>30 Seconds</span>
          </h1>
          <p style={{ fontSize: 16, color: "#fff", lineHeight: 1.6, margin: "0 0 32px" }}>
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
            <select
              className="try-select"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
            >
              <option value="">What industry are you in?</option>
              <option value="insurance">Insurance</option>
              <option value="real_estate">Real Estate</option>
              <option value="mortgage">Mortgage</option>
              <option value="roofing">Roofing / Home Services</option>
              <option value="fitness">Fitness / Gym</option>
              <option value="med_spa">Med Spa / Beauty</option>
              <option value="solar">Solar</option>
              <option value="other">Other</option>
            </select>
            <button className="try-btn" type="submit" disabled={sending || !name.trim() || !phone.trim()}>
              {sending ? "Starting..." : "Text Me Now →"}
            </button>
          </form>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 20, fontSize: 12, color: "#fff", lineHeight: 1.5, marginTop: 4 }}>
            <span>🎭</span> Our AI will text you pretending to be a sales lead. Play along. We promise it's worth it.
          </div>

          {error && <p style={{ color: "#e74c3c", fontSize: 13, marginTop: 12 }}>{error}</p>}

          {/* Stats */}
          <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 48, flexWrap: "wrap" as const }}>
            {[
              { num: "3 SEC", label: "Response time" },
              { num: "24/7", label: "Never sleeps" },
              { num: "10X", label: "More appointments" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#F97316" }}>{s.num}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 48 }}>
            <Link href="/privacy" style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textDecoration: "none", marginRight: 16 }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>Terms</Link>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center", animation: "fadeUp 0.6s ease" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>📱</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, margin: "0 0 12px", letterSpacing: 1, color: "#fff" }}>
            Check Your Phone
          </h2>
          <p style={{ fontSize: 16, color: "#fff", lineHeight: 1.6, margin: "0 0 8px" }}>
            Maya from Wolf Pack just texted you. Reply naturally and see what happens.
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 32 }}>
            The whole experience takes about 60 seconds.
          </p>
          <Link href="/" style={{ fontSize: 13, color: "#F97316", textDecoration: "none" }}>
            ← Back to home
          </Link>
        </div>
      )}
    </div>
  );
}
