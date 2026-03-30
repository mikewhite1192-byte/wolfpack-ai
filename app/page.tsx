"use client";

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

// ── Page ────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div style={{ background: "#0a0a0a", color: "#e8eaf0", minHeight: "100vh", fontFamily: "Inter, system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes heroIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

        .ticker-track { display: flex; gap: 32px; white-space: nowrap; animation: scroll 18s linear infinite; }
        .ticker-item { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; flex-shrink: 0; color: rgba(232,230,227,0.5); }

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

        .wp-problem-stat { text-align: center; flex: 1; min-width: 180px; }
        .wp-problem-num { font-family: 'Bebas Neue', sans-serif; font-size: 56px; color: #E86A2A; line-height: 1; }
        .wp-problem-label { font-size: 13px; color: rgba(232,230,227,0.4); line-height: 1.5; margin-top: 8px; }

        @media (max-width: 768px) {
          .wp-hero-grid { flex-direction: column !important; text-align: center !important; }
          .wp-hero-grid h1 { font-size: 48px !important; }
          .wp-outcomes-grid { grid-template-columns: 1fr !important; }
          .wp-price-grid { flex-direction: column !important; }
          .wp-nav-links { display: none !important; }
          .wp-stats { flex-direction: column !important; gap: 20px !important; }
          .wp-problem-stats { flex-direction: column !important; gap: 32px !important; }
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
            AI Appointment Setter
          </div>
        </div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, lineHeight: 0.92, margin: "0 0 28px", letterSpacing: 1, animation: "heroIn 0.8s ease 0.4s both" }}>
          <ScrambleText text="STOP CHASING LEADS." delay={600} />
          <br />
          <span style={{ color: "#E86A2A" }}><ScrambleText text="START CLOSING THEM." delay={1400} /></span>
        </h1>
        <p style={{ fontSize: 17, color: "rgba(232,230,227,0.45)", lineHeight: 1.8, maxWidth: 600, margin: "0 auto 20px", animation: "heroIn 0.8s ease 2s both" }}>
          Your AI appointment setter texts new leads in 3 seconds, qualifies them, and books the appointment on your calendar. 24/7. No staff. No missed leads. No lost deals.
        </p>
        <p style={{ fontSize: 14, color: "#007AFF", maxWidth: 520, margin: "0 auto 40px", animation: "heroIn 0.8s ease 2.3s both", lineHeight: 1.6 }}>
          Blue iMessage texts. No A2P registration. No carrier filtering. Your leads actually hear from you first.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", animation: "heroIn 0.8s ease 2.6s both" }}>
          <Link href="/demo" className="wp-cta">See It Work On You →</Link>
          <Link href="/book/default" className="wp-ghost">Book a Demo</Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="wp-stats" style={{ display: "flex", gap: 60, justifyContent: "center", padding: "50px 40px", maxWidth: 700, margin: "0 auto" }}>
        {[
          { num: "3 SEC", label: "Response time" },
          { num: "24/7", label: "Never misses a lead" },
          { num: "10X", label: "More appointments booked" },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: "#E86A2A", letterSpacing: 1 }}>{s.num}</div>
            <div style={{ fontSize: 12, color: "rgba(232,230,227,0.35)", marginTop: 4, letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Ticker */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", margin: "20px 0" }}>
        <Ticker />
      </div>

      {/* Problem Section */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 40px 60px", textAlign: "center" }}>
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

      {/* How It Works */}
      <div id="how" style={{ maxWidth: 900, margin: "0 auto", padding: "60px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 8px", letterSpacing: 1 }}>THREE STEPS. ONE FULL CALENDAR.</h2>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { num: "01", title: "Lead Comes In", desc: "From ads, your website, referrals — doesn't matter. The AI picks it up instantly." },
            { num: "02", title: "AI Sets The Appointment", desc: "Texts back in 3 seconds via iMessage. Qualifies. Handles objections. Books directly on your calendar." },
            { num: "03", title: "You Just Show Up", desc: "Calendar invite sent. Google Meet link attached. You just show up and close." },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, minWidth: 240, padding: "32px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: "#E86A2A", marginBottom: 12 }}>{s.num}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e8eaf0", marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "rgba(232,230,227,0.4)", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Outcomes */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 12px", letterSpacing: 1 }}>WHAT CHANGES WHEN YOU TURN IT ON</h2>
          <p style={{ fontSize: 14, color: "rgba(232,230,227,0.35)", maxWidth: 480, margin: "0 auto" }}>Not features. Appointments.</p>
        </div>
        <div className="wp-outcomes-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { title: "Your calendar fills itself", desc: "The AI's only job is booking appointments. It texts, qualifies, handles objections, and sends the calendar invite. You just show up." },
            { title: "Leads stop going cold", desc: "3 second response time every single time. 2am Sunday, middle of a closing, driving between appointments. The AI never misses." },
            { title: "Blue texts get through", desc: "Your competitors send green SMS texts that get filtered. You send iMessages through Apple's network directly. No registration. No filtering. No competition." },
            { title: "No lead gets forgotten", desc: "Day 1, 3, 7, 14. Every cold lead gets a follow up with a different angle every time. The AI came back on a lead 11 days later and booked them." },
          ].map((o, i) => (
            <div key={i} className="wp-outcome">
              <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0", marginBottom: 10 }}>{o.title}</div>
              <div style={{ fontSize: 14, color: "rgba(232,230,227,0.4)", lineHeight: 1.7 }}>{o.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Demo CTA */}
      <div style={{ padding: "60px 40px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: "60px 40px", borderRadius: 20, border: "1px solid rgba(232,106,42,0.3)", background: "#0a0a0a" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, margin: "0 0 12px" }}>SEE IT SET AN APPOINTMENT <span style={{ color: "#E86A2A" }}>ON YOU</span></h2>
          <p style={{ fontSize: 15, color: "rgba(232,230,227,0.4)", margin: "0 0 28px", lineHeight: 1.6 }}>Enter your number. The AI texts you back in 3 seconds pretending to be an insurance agent. Play along — you'll understand exactly why it works.</p>
          <Link href="/demo" className="wp-cta">Text Me Now →</Link>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 8px", letterSpacing: 1 }}>
            YOUR APPOINTMENT SETTER.<br />
            <span style={{ color: "#E86A2A" }}>STARTING AT $49/MONTH.</span>
          </h2>
          <p style={{ fontSize: 14, color: "rgba(232,230,227,0.3)" }}>No contracts. Cancel anytime.</p>
        </div>
        <div className="wp-price-grid" style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { name: "STARTER", price: "$49", period: "/mo", desc: "Everything you need to start filling your calendar.", featured: false, plan: "starter", features: ["AI Appointment Setter", "1 Phone Number (SMS)", "Unlimited Conversations", "Pipeline CRM", "Auto Follow-ups", "Gmail Integration", "Calendar + Booking", "Call Recording", "Analytics"], cta: "Get Started" },
            { name: "PRO", price: "$199", period: "/mo", desc: "Blue texts. Maximum deliverability. More appointments.", featured: true, badge: "MOST POPULAR", plan: "pro", features: ["Everything in Starter", "iMessage (Blue Texts)", "No A2P Registration", "No Carrier Filtering", "Higher Deliverability", "Priority Support", "Self-Learning AI", "Google Review Automation", "CSV Import"], cta: "Get Started" },
            { name: "AGENCY", price: "Custom", period: "", desc: "For agencies managing multiple clients.", featured: false, plan: null, features: ["Everything in Pro", "Multiple Numbers", "White Label Branding", "Custom Domain", "Team Management", "API Access", "Dedicated Support", "Facebook Lead Integration", "Volume Discounts"], cta: "Contact Us" },
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
          <Link href="/demo" className="wp-cta">See It Work On You →</Link>
          <Link href="/book/default" className="wp-ghost">Book a Demo</Link>
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
