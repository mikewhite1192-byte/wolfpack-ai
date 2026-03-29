"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// ── Ticker ──────────────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { icon: "🤖", text: "New lead received. AI responded in 3 seconds", color: "#007AFF" },
  { icon: "📅", text: "Appointment booked. Michael R., Dallas TX", color: "#2ecc71" },
  { icon: "💬", text: "Day 3 follow-up sent via iMessage. Lead re-engaged", color: "#007AFF" },
  { icon: "🔥", text: "Cold lead from 8 days ago just replied", color: "#E86A2A" },
  { icon: "📞", text: "AI qualified lead. Handed off to agent", color: "#2ecc71" },
  { icon: "⏰", text: "2:47am. Appointment booked while agent slept", color: "#E86A2A" },
  { icon: "💬", text: "Objection handled automatically. Call scheduled", color: "#007AFF" },
  { icon: "📅", text: "Sarah M. booked for Thursday at 2pm", color: "#2ecc71" },
  { icon: "🤖", text: "Blue text delivered. Responded in 4 seconds, no one lifted a finger", color: "#007AFF" },
  { icon: "✅", text: "Jake T. moved to closed. AI followed up 4 times", color: "#2ecc71" },
  { icon: "⏰", text: "Sunday 6am. Lead responded to iMessage. AI booked them instantly.", color: "#E86A2A" },
  { icon: "🔥", text: "3 appointments booked today before 9am", color: "#E86A2A" },
  { icon: "💬", text: "Price objection handled via blue text. Lead asked for next steps", color: "#007AFF" },
  { icon: "📞", text: "Lead qualified in 4 messages. Warm handoff to closer", color: "#2ecc71" },
  { icon: "✅", text: "Maria G. closed. AI nurtured for 11 days via iMessage", color: "#007AFF" },
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
            <span style={{ color: item.color }}>{item.text}</span>
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

// ── Page ────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div style={{ background: "#0a0a0a", color: "#e8eaf0", minHeight: "100vh", fontFamily: "Inter, system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes heroIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

        .ticker-track { display: flex; gap: 32px; white-space: nowrap; animation: scroll 14s linear infinite; }
        .ticker-item { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; flex-shrink: 0; }

        .wp-nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; max-width: 1100px; margin: 0 auto; }
        .wp-nav a { color: rgba(232,230,227,0.4); text-decoration: none; font-size: 13px; font-weight: 500; transition: color 0.2s; letter-spacing: 0.5px; }
        .wp-nav a:hover { color: #e8eaf0; }

        .wp-cta { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: #E86A2A; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 700; transition: all 0.3s; border: none; cursor: pointer; }
        .wp-cta:hover { background: #ff7b3a; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(232,106,42,0.25); }
        .wp-ghost { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(232,230,227,0.6); border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; transition: all 0.3s; cursor: pointer; }
        .wp-ghost:hover { border-color: rgba(232,106,42,0.4); color: #E86A2A; }

        .wp-outcome { padding: 40px; border-radius: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); transition: border-color 0.3s; }
        .wp-outcome:hover { border-color: rgba(232,106,42,0.15); }

        .wp-price-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 36px; transition: all 0.3s; }
        .wp-price-card:hover { border-color: rgba(232,106,42,0.2); }
        .wp-price-card.featured { border-color: #E86A2A; background: rgba(232,106,42,0.03); }

        @media (max-width: 768px) {
          .wp-hero-grid { flex-direction: column !important; text-align: center !important; }
          .wp-hero-grid h1 { font-size: 48px !important; }
          .wp-outcomes-grid { grid-template-columns: 1fr !important; }
          .wp-price-grid { flex-direction: column !important; }
          .wp-nav-links { display: none !important; }
          .wp-stats { flex-direction: column !important; gap: 20px !important; }
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
          <Link href="/demo" style={{ color: "#E86A2A" }}>Live Demo</Link>
          <Link href="/sign-in" className="wp-cta" style={{ padding: "8px 20px", fontSize: 12 }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "100px 40px 60px", textAlign: "center" }}>
        <div style={{ animation: "heroIn 0.6s ease 0.2s both" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 14px", background: "rgba(0,122,255,0.08)", border: "1px solid rgba(0,122,255,0.2)", borderRadius: 20, fontSize: 11, fontWeight: 600, color: "#007AFF", letterSpacing: 1, textTransform: "uppercase", marginBottom: 28 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#007AFF", display: "inline-block" }} />
            iMessage Powered
          </div>
        </div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, lineHeight: 0.92, margin: "0 0 28px", letterSpacing: 1, animation: "heroIn 0.8s ease 0.4s both" }}>
          <ScrambleText text="BLUE TEXTS." delay={600} />
          <br />
          <span style={{ color: "#007AFF" }}><ScrambleText text="NOT GREEN." delay={1400} /></span>
        </h1>
        <p style={{ fontSize: 17, color: "rgba(232,230,227,0.45)", lineHeight: 1.8, maxWidth: 560, margin: "0 auto 40px", animation: "heroIn 0.8s ease 2s both" }}>
          Your competitors send green texts and hope they land. You send blue iMessages directly through Apple. No A2P registration. No carrier filtering. An AI sales agent that qualifies leads, handles objections, and books appointments on your calendar. All while you sleep.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", animation: "heroIn 0.8s ease 2.6s both" }}>
          <Link href="/demo" className="wp-cta">See It In Action →</Link>
          <Link href="/book/default" className="wp-ghost">Book a Demo</Link>
        </div>
      </div>

      {/* Ticker */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", margin: "20px 0" }}>
        <Ticker />
      </div>

      {/* Stats */}
      <div className="wp-stats" style={{ display: "flex", gap: 60, justifyContent: "center", padding: "50px 40px", maxWidth: 700, margin: "0 auto" }}>
        {[
          { num: "3 SEC", label: "Average response time" },
          { num: "24/7", label: "Never misses a lead" },
          { num: "10X", label: "More appointments booked" },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: "#E86A2A", letterSpacing: 1 }}>{s.num}</div>
            <div style={{ fontSize: 12, color: "rgba(232,230,227,0.35)", marginTop: 4, letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Outcomes (replaces feature bullets) */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, margin: "0 0 12px", letterSpacing: 1 }}>What Changes When You Turn It On</h2>
          <p style={{ fontSize: 14, color: "rgba(232,230,227,0.35)", maxWidth: 480, margin: "0 auto" }}>Not features. Outcomes.</p>
        </div>
        <div className="wp-outcomes-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { title: "Leads get a text in seconds", desc: "Not minutes. Not hours. The moment a lead comes in from Facebook, Google, or your website, the AI is already texting them. You're first. Every time." },
            { title: "Objections don't kill your deals", desc: "\"I need to think about it.\" \"What's the price?\" \"I'm talking to other people.\" The AI handles all of it without getting emotional, defensive, or pushy." },
            { title: "Your calendar fills itself", desc: "The AI's only goal is to book an appointment on your calendar. It gets their email, picks a time, sends the invite with a Google Meet link. You just show up." },
            { title: "No lead gets forgotten", desc: "Day 1, 3, 7, 14. Every cold lead gets a follow-up with a different angle. The AI came back on a lead 11 days later and booked them. That's money you were leaving on the table." },
          ].map((o, i) => (
            <div key={i} className="wp-outcome">
              <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0", marginBottom: 10 }}>{o.title}</div>
              <div style={{ fontSize: 14, color: "rgba(232,230,227,0.4)", lineHeight: 1.7 }}>{o.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div id="how" style={{ maxWidth: 900, margin: "0 auto", padding: "60px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, margin: 0, letterSpacing: 1 }}>Three Steps. Zero Effort.</h2>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { num: "01", title: "Lead Comes In", desc: "From ads, your website, referrals. Doesn't matter. The AI picks it up instantly." },
            { num: "02", title: "AI Starts Selling", desc: "Texts within seconds. Qualifies. Handles objections. Builds trust. All using proven sales psychology." },
            { num: "03", title: "Appointment Booked", desc: "Calendar invite sent. Google Meet link attached. You just show up and close." },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, minWidth: 240, padding: "32px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: "#E86A2A", marginBottom: 12 }}>{s.num}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e8eaf0", marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "rgba(232,230,227,0.4)", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Demo CTA */}
      <div style={{ padding: "60px 40px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: "60px 40px", borderRadius: 20, border: "1px solid rgba(232,106,42,0.3)", background: "#0a0a0a" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, margin: "0 0 12px" }}>See It Work On <span style={{ color: "#E86A2A" }}>You</span></h2>
          <p style={{ fontSize: 15, color: "rgba(232,230,227,0.4)", margin: "0 0 28px", lineHeight: 1.6 }}>Enter your phone number. The AI will text you, qualify you, and book an appointment. Experience it firsthand.</p>
          <Link href="/demo" className="wp-cta">Try the Live Demo →</Link>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, margin: "0 0 8px", letterSpacing: 1 }}>Simple. Transparent.</h2>
          <p style={{ fontSize: 14, color: "rgba(232,230,227,0.3)" }}>No contracts. Cancel anytime.</p>
        </div>
        <div className="wp-price-grid" style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { name: "STARTER", price: "$49", period: "/mo", desc: "Everything you need to start.", featured: false, plan: "starter", features: ["AI Sales Agent", "1 Phone Number (SMS + Voice)", "Unlimited Conversations", "Pipeline CRM", "Auto Follow-ups", "Gmail Integration", "Calendar + Booking", "Call Recording", "Analytics"], cta: "Get Started" },
            { name: "PRO", price: "$289", period: "/mo", desc: "Blue texts. Maximum deliverability.", featured: true, badge: "MOST POPULAR", plan: "pro", features: ["Everything in Starter", "iMessage (Blue Texts)", "RCS Messaging", "No A2P Registration", "Higher Deliverability", "Priority Support", "Self-Learning AI", "Google Review Automation", "CSV Import"], cta: "Get Started" },
            { name: "AGENCY", price: "Custom", period: "", desc: "For agencies managing clients.", featured: false, plan: null, features: ["Everything in Pro", "Multiple Numbers", "White Label Branding", "Custom Domain", "Team Management", "API Access", "Dedicated Support", "Facebook Lead Integration", "Volume Discounts"], cta: "Contact Us" },
          ].map((p, i) => (
            <div key={i} className={`wp-price-card ${p.featured ? "featured" : ""}`} style={{ flex: 1, minWidth: 260, maxWidth: 320, position: "relative" }}>
              {p.badge && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#E86A2A", color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 14px", borderRadius: 20, letterSpacing: 0.5 }}>{p.badge}</div>}
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,230,227,0.3)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{p.name}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: "#e8eaf0" }}>{p.price}<span style={{ fontSize: 15, color: "rgba(232,230,227,0.3)", fontFamily: "Inter, sans-serif" }}>{p.period}</span></div>
              <p style={{ fontSize: 13, color: "rgba(232,230,227,0.35)", margin: "8px 0 24px" }}>{p.desc}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
                {p.features.map((f, j) => (
                  <li key={j} style={{ fontSize: 13, color: "rgba(232,230,227,0.5)", padding: "5px 0", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#2ecc71", fontWeight: 700, fontSize: 11 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              {p.plan ? (
                <button
                  onClick={async () => {
                    const res = await fetch("/api/stripe/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ plan: p.plan }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  }}
                  className={p.featured ? "wp-cta" : "wp-ghost"}
                  style={{ width: "100%", justifyContent: "center", boxSizing: "border-box", display: "flex", fontFamily: "inherit", fontSize: "inherit" }}
                >
                  {p.cta}
                </button>
              ) : (
                <Link href="/book/default" className="wp-ghost" style={{ width: "100%", justifyContent: "center", boxSizing: "border-box", display: "flex" }}>
                  {p.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" style={{ maxWidth: 640, margin: "0 auto", padding: "60px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, margin: 0, letterSpacing: 1 }}>Questions? We Got You.</h2>
        </div>
        <FaqItem q="How does the AI know what to say?" a="It's trained on proven sales methodology (NEPQ). It asks the right questions, listens to answers, handles objections naturally, and guides leads to book an appointment. It gets smarter with every conversation." />
        <FaqItem q="Will leads know they're talking to AI?" a="No. It texts like a real person on your team. No dashes, no bullet points, no robotic grammar. It mirrors the lead's energy and tone. Most leads have no idea." />
        <FaqItem q="What's the difference between green and blue texts?" a="Green texts (SMS) require A2P registration and can get filtered by carriers. Blue texts (iMessage) go through Apple's network directly. No registration needed, higher deliverability, and a more trusted look. Our Pro plan includes blue texts." />
        <FaqItem q="Can I take over a conversation from the AI?" a="Yes. Every conversation has an AI toggle. Turn it off and you're in control. Turn it back on and the AI picks up where you left off." />
        <FaqItem q="How fast does the AI respond to new leads?" a="Within seconds. The moment a lead comes in, the AI is texting them. That speed alone puts you ahead of 90% of your competition." />
        <FaqItem q="Do I need any technical skills?" a="No. When you sign up, the AI walks you through setup with a few questions about your business. You can be live in minutes." />
        <FaqItem q="What happens if a lead goes cold?" a="The AI follows up automatically with a different approach each time. Day 1, 3, 7, 14. Each message uses a different angle. No lead gets forgotten." />
      </div>

      {/* Final CTA */}
      <div style={{ padding: "60px 40px 80px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 16px", letterSpacing: 1 }}>Stop Losing Leads. <span style={{ color: "#E86A2A" }}>Start Today.</span></h2>
        <p style={{ fontSize: 15, color: "rgba(232,230,227,0.35)", margin: "0 0 32px" }}>Your competitors are already following up faster than you.</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/demo" className="wp-cta">Try the Live Demo →</Link>
          <Link href="/book/default" className="wp-ghost">Book a Call</Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "40px 40px 24px" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(32px, 10vw, 160px)", letterSpacing: "clamp(2px, 0.5vw, 6px)", textAlign: "center", lineHeight: 0.9, marginBottom: 24, color: "rgba(255,255,255,0.06)", userSelect: "none" }}>
          THE <span style={{ color: "rgba(232,106,42,0.12)" }}>WOLF</span> PACK
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, alignItems: "center" }}>
          <Link href="/privacy" style={{ color: "rgba(232,230,227,0.25)", textDecoration: "none", fontSize: 12 }}>Privacy</Link>
          <Link href="/terms" style={{ color: "rgba(232,230,227,0.25)", textDecoration: "none", fontSize: 12 }}>Terms</Link>
          <span style={{ fontSize: 11, color: "rgba(232,230,227,0.15)" }}>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}
