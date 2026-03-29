"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(!open)} style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "24px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: "#f5f3f0" }}>{q}</div>
        <span style={{ color: "#E86A2A", fontSize: 24, fontWeight: 300, flexShrink: 0, transition: "transform 0.3s", transform: open ? "rotate(45deg)" : "rotate(0)" }}>+</span>
      </div>
      <div style={{ maxHeight: open ? 200 : 0, overflow: "hidden", transition: "max-height 0.4s ease" }}>
        <div style={{ fontSize: 15, color: "rgba(245,243,240,0.6)", lineHeight: 1.7, paddingTop: 12 }}>{a}</div>
      </div>
    </div>
  );
}

// Phone conversation
const DEMO_MSGS = [
  { from: "ai", text: "Hey Mike! Saw you were interested in a roof inspection. What's going on?" },
  { from: "lead", text: "Been leaking for a few months" },
  { from: "ai", text: "How has that been affecting things inside?" },
  { from: "lead", text: "Ceiling stain getting bigger. Worried about mold" },
  { from: "ai", text: "What would it mean if that was taken care of?" },
  { from: "lead", text: "Huge relief honestly" },
  { from: "ai", text: "We do free inspections. Thursday at 10 or Friday at 2?" },
  { from: "lead", text: "Thursday works!" },
  { from: "ai", text: "You're all set! Calendar invite heading to your email 👍" },
];

function PhoneMockup() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [visibleCount, showTyping]);

  useEffect(() => {
    if (visibleCount >= DEMO_MSGS.length) {
      const t = setTimeout(() => { setVisibleCount(0); setShowTyping(false); }, 6000);
      return () => clearTimeout(t);
    }
    const wait = visibleCount === 0 ? 1500 : 2500;
    const next = DEMO_MSGS[visibleCount];
    if (next.from === "lead") {
      const t1 = setTimeout(() => setShowTyping(true), 500);
      const t2 = setTimeout(() => { setShowTyping(false); setVisibleCount(c => c + 1); }, wait);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const t = setTimeout(() => setVisibleCount(c => c + 1), wait);
    return () => clearTimeout(t);
  }, [visibleCount]);

  return (
    <div style={{ width: 250, height: 520, background: "#111", borderRadius: 44, padding: 3, boxShadow: "0 40px 100px rgba(232,106,42,0.15), 0 0 0 1px rgba(255,255,255,0.05)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, background: "#fff", borderRadius: 41, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", width: 70, height: 20, background: "#000", borderRadius: 12, zIndex: 10 }} />
        <div style={{ padding: "32px 14px 8px", textAlign: "center", background: "#f2f2f7", borderBottom: "0.5px solid #d1d1d6" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#007AFF", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, margin: "0 auto 2px" }}>WP</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#000" }}>Wolf Pack AI</div>
          <div style={{ fontSize: 9, color: "#8e8e93" }}>iMessage</div>
        </div>
        <div ref={msgsRef} style={{ flex: 1, padding: "8px 8px", overflowY: "auto", overflowX: "hidden", background: "#fff", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {DEMO_MSGS.slice(0, visibleCount).map((m, i) => {
              const isAi = m.from === "ai";
              const next = DEMO_MSGS[i + 1];
              const isTail = !next || i + 1 >= visibleCount || next.from !== m.from;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isAi ? "flex-end" : "flex-start", paddingLeft: isAi ? 40 : 4, paddingRight: isAi ? 4 : 40, marginBottom: isTail ? 4 : 1, opacity: 0, animation: "fadeUp 0.3s ease forwards" }}>
                  <div style={{
                    width: "fit-content", maxWidth: "85%", padding: "6px 11px", fontSize: 12, lineHeight: 1.35,
                    background: isAi ? "#007AFF" : "#e9e9eb", color: isAi ? "#fff" : "#000",
                    borderRadius: isAi ? (isTail ? "16px 16px 4px 16px" : "16px") : (isTail ? "16px 16px 16px 4px" : "16px"),
                  }}>{m.text}</div>
                </div>
              );
            })}
            {showTyping && (
              <div style={{ display: "flex", gap: 3, padding: "8px 12px", background: "#e9e9eb", borderRadius: "16px 16px 16px 4px", width: "fit-content", marginLeft: 4 }}>
                <span className="lp-tdot" style={{ animationDelay: "0s" }} /><span className="lp-tdot" style={{ animationDelay: "0.15s" }} /><span className="lp-tdot" style={{ animationDelay: "0.3s" }} />
              </div>
            )}
          </div>
        </div>
        <div style={{ background: "#f2f2f7", padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, borderTop: "0.5px solid #d1d1d6" }}>
          <span style={{ color: "#007AFF", fontSize: 18, fontWeight: 300 }}>+</span>
          <div style={{ flex: 1, background: "#fff", border: "0.5px solid #c7c7cc", borderRadius: 16, padding: "5px 12px", fontSize: 11, color: "#8e8e93" }}>iMessage</div>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#007AFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>↑</div>
        </div>
      </div>
      <div style={{ width: 100, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 100, margin: "6px auto 2px" }} />
    </div>
  );
}

function AnimatedCounter({ target, suffix = "" }: { target: string; suffix?: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: "#E86A2A", opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.6s ease" }}>{target}{suffix}</div>;
}

function ScrambleText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [display, setDisplay] = useState(text.replace(/[A-Za-z]/g, " "));
  const [started, setStarted] = useState(false);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&";

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let iteration = 0;
    const maxIterations = text.length * 3;
    const interval = setInterval(() => {
      setDisplay(
        text.split("").map((char, i) => {
          if (char === " " || char === "." || char === "'") return char;
          if (i < iteration / 3) return text[i];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join("")
      );
      iteration++;
      if (iteration > maxIterations) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [started, text]);

  return <>{display}</>;
}

export default function Home() {
  return (
    <div style={{ background: "#0D1426", color: "#f5f3f0", minHeight: "100vh", fontFamily: "Inter, system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes phoneDrop { 0% { opacity: 0; transform: translateY(-120px) rotate(-3deg); } 60% { opacity: 1; transform: translateY(8px) rotate(1deg); } 80% { transform: translateY(-4px) rotate(0deg); } 100% { opacity: 1; transform: translateY(0) rotate(0deg); } }
        @keyframes heroFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(232,106,42,0.4); } 50% { box-shadow: 0 0 40px 10px rgba(232,106,42,0.1); } }
        .lp-tdot { width: 5px; height: 5px; border-radius: 50%; background: #8e8e93; animation: tdot 1.2s ease-in-out infinite; }
        @keyframes tdot { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } }

        .lp-nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; max-width: 1200px; margin: 0 auto; }
        .lp-nav a { color: rgba(245,243,240,0.6); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
        .lp-nav a:hover { color: #f5f3f0; }

        .lp-section { max-width: 1100px; margin: 0 auto; padding: 0 40px; }

        .lp-feature-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 28px; transition: all 0.3s; }
        .lp-feature-card:hover { border-color: rgba(232,106,42,0.3); transform: translateY(-4px); box-shadow: 0 20px 40px rgba(232,106,42,0.05); }

        .lp-price-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 36px; transition: all 0.3s; }
        .lp-price-card:hover { border-color: rgba(232,106,42,0.3); }
        .lp-price-card.featured { border-color: #E86A2A; background: rgba(232,106,42,0.04); }

        .lp-cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 16px 32px; background: #E86A2A; color: #fff; border-radius: 12px; text-decoration: none; font-size: 15px; font-weight: 700; transition: all 0.3s; }
        .lp-cta-btn:hover { background: #ff7b3a; transform: translateY(-2px); box-shadow: 0 10px 30px rgba(232,106,42,0.3); }
        .lp-ghost-btn { display: inline-flex; align-items: center; gap: 8px; padding: 16px 32px; background: transparent; border: 1px solid rgba(255,255,255,0.12); color: #f5f3f0; border-radius: 12px; text-decoration: none; font-size: 15px; font-weight: 600; transition: all 0.3s; }
        .lp-ghost-btn:hover { border-color: #E86A2A; color: #E86A2A; }

        .lp-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #E86A2A; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; }
        .lp-eyebrow::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #E86A2A; animation: glow 2s ease-in-out infinite; }

        .lp-gradient-text { background: linear-gradient(135deg, #E86A2A, #ff9a5c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        @media (max-width: 768px) {
          .lp-hero-flex { flex-direction: column !important; text-align: center !important; }
          .lp-hero-flex > div:first-child h1 { font-size: 48px !important; }
          .lp-feature-grid { grid-template-columns: 1fr !important; }
          .lp-price-grid { flex-direction: column !important; }
          .lp-stat-grid { flex-direction: column !important; gap: 24px !important; }
          .lp-nav-links { display: none !important; }
        }
      `}</style>

      {/* Floating gradient orb */}
      <div style={{ position: "fixed", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,106,42,0.08) 0%, transparent 70%)", pointerEvents: "none", animation: "float 8s ease-in-out infinite" }} />
      <div style={{ position: "fixed", bottom: -300, left: -200, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,106,42,0.05) 0%, transparent 70%)", pointerEvents: "none", animation: "float 10s ease-in-out infinite reverse" }} />

      {/* Nav */}
      <nav className="lp-nav">
        <Link href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: "#f5f3f0", textDecoration: "none" }}>
          THE <span style={{ color: "#E86A2A" }}>WOLF</span> PACK AI
        </Link>
        <div className="lp-nav-links" style={{ display: "flex", gap: 32, alignItems: "center" }}>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <Link href="/demo" style={{ color: "#E86A2A" }}>Live Demo</Link>
          <Link href="/sign-in" className="lp-cta-btn" style={{ padding: "10px 24px", fontSize: 13 }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="lp-hero-flex" style={{ display: "flex", alignItems: "center", gap: 50, padding: "80px 40px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ flex: 1 }}>
          <div className="lp-eyebrow" style={{ animation: "heroFadeIn 0.6s ease 0.2s both" }}>The Future of Sales</div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 76, lineHeight: 0.92, margin: "0 0 24px", letterSpacing: 1 }}>
            <ScrambleText text="YOUR AI SALES AGENT." delay={400} />
            <br />
            <span className="lp-gradient-text"><ScrambleText text="THAT NEVER SLEEPS." delay={1200} /></span>
          </h1>
          <p style={{ fontSize: 18, color: "rgba(245,243,240,0.6)", lineHeight: 1.7, margin: "0 0 36px", maxWidth: 500, animation: "heroFadeIn 0.8s ease 2s both" }}>
            Responds in seconds. Qualifies leads. Handles objections. Books appointments. All while you sleep.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", animation: "heroFadeIn 0.8s ease 2.4s both" }}>
            <Link href="/demo" className="lp-cta-btn">See It In Action →</Link>
            <Link href="/book/default" className="lp-ghost-btn">Book a Demo</Link>
          </div>
        </div>
        <div style={{ flexShrink: 0, animation: "phoneDrop 1s cubic-bezier(0.34, 1.56, 0.64, 1) 1.8s both" }}>
          <PhoneMockup />
        </div>
      </div>

      {/* Stats */}
      <div className="lp-stat-grid" style={{ display: "flex", gap: 40, justifyContent: "center", padding: "30px 40px 40px", maxWidth: 800, margin: "0 auto" }}>
        {[{ num: "3", suf: " SEC", label: "Response time" }, { num: "24/7", suf: "", label: "Never misses a lead" }, { num: "10X", suf: "", label: "More appointments" }].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <AnimatedCounter target={s.num} suffix={s.suf} />
            <div style={{ fontSize: 13, color: "rgba(245,243,240,0.4)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Problem */}
      <div style={{ background: "#111827", padding: "50px 0" }}>
      <div style={{ padding: "0 40px", maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div className="lp-eyebrow" style={{ justifyContent: "center" }}>The Problem</div>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 16px" }}>Every Minute You Wait, Your Lead Goes Cold</h2>
        <p style={{ fontSize: 16, color: "rgba(245,243,240,0.5)", lineHeight: 1.7, maxWidth: 600, margin: "0 auto 40px" }}>78% of customers buy from whoever responds first. Are you first?</p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          {[{ num: "78%", text: "buy from first responder" }, { num: "5 MIN", text: "and your odds drop 80%" }, { num: "48%", text: "never follow up at all" }].map((s, i) => (
            <div key={i} style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "28px 32px", flex: 1, minWidth: 180 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: "#E86A2A" }}>{s.num}</div>
              <div style={{ fontSize: 13, color: "rgba(245,243,240,0.5)", marginTop: 4 }}>{s.text}</div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* How It Works */}
      <div style={{ padding: "50px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div className="lp-eyebrow" style={{ justifyContent: "center" }}>How It Works</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 48px" }}>Three Steps. Zero Effort.</h2>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { num: "01", title: "Lead Comes In", desc: "From ads, your website, referrals. The AI picks it up instantly." },
            { num: "02", title: "AI Starts Selling", desc: "Texts within seconds. Qualifies. Handles objections. Builds trust." },
            { num: "03", title: "Appointment Booked", desc: "Calendar invite sent. Google Meet link. You just show up and close." },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, minWidth: 250, background: "#111827", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "32px", transition: "all 0.3s" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: "rgba(232,106,42,0.2)", marginBottom: 12 }}>{s.num}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#f5f3f0", marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: "rgba(245,243,240,0.5)", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ background: "rgba(255,255,255,0.02)" }}>
      <div id="features" style={{ padding: "50px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div className="lp-eyebrow" style={{ justifyContent: "center" }}>Features</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 48px" }}>Everything You Need. Nothing You Don't.</h2>
        </div>
        <div className="lp-feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { icon: "🤖", title: "AI Sales Agent", desc: "Trained on proven NEPQ methodology. Sells like your best rep, 24/7." },
            { icon: "💬", title: "SMS + iMessage", desc: "Green or blue texts. Upgrade to iMessage with no A2P approval needed." },
            { icon: "📞", title: "Built-in Calling", desc: "Click to call from the CRM. Auto-recording. No extra apps." },
            { icon: "📧", title: "Email Integration", desc: "Gmail and Outlook. See all emails per lead. Reply right from the CRM." },
            { icon: "📅", title: "Calendar + Booking", desc: "Google Calendar sync. Public booking page. Auto Google Meet links." },
            { icon: "📊", title: "Pipeline + Analytics", desc: "Drag and drop kanban. Conversion funnel. Lead scoring." },
            { icon: "🔄", title: "Auto Follow-ups", desc: "Different angle every time. Day 1, 3, 7, 14. Never drops the ball." },
            { icon: "🧠", title: "Self-Learning", desc: "Learns from every conversation. Gets smarter with every lead." },
            { icon: "⭐", title: "Review Automation", desc: "Asks for feedback after close. Sends Google review link automatically." },
          ].map((f, i) => (
            <div key={i} className="lp-feature-card">
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f3f0", marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "rgba(245,243,240,0.5)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* Demo CTA */}
      <div style={{ padding: "50px 40px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", background: "linear-gradient(135deg, rgba(232,106,42,0.08), rgba(232,106,42,0.02))", border: "1px solid rgba(232,106,42,0.15)", borderRadius: 24, padding: "60px 40px", textAlign: "center", animation: "pulse 4s ease-in-out infinite" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, margin: "0 0 12px" }}>See It Work On <span className="lp-gradient-text">You</span></h2>
          <p style={{ fontSize: 16, color: "rgba(245,243,240,0.5)", margin: "0 0 28px", lineHeight: 1.6 }}>Enter your phone number. Our AI will text you, qualify you, and book an appointment. Experience it firsthand.</p>
          <Link href="/demo" className="lp-cta-btn">Try the Live Demo →</Link>
        </div>
      </div>

      {/* Pricing */}
      <div style={{ background: "#0a1020" }}>
      <div id="pricing" style={{ padding: "50px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div className="lp-eyebrow" style={{ justifyContent: "center" }}>Pricing</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: "0 0 8px" }}>Simple. Transparent.</h2>
          <p style={{ fontSize: 15, color: "rgba(245,243,240,0.4)", margin: "0 0 48px" }}>No contracts. Cancel anytime.</p>
        </div>
        <div className="lp-price-grid" style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { name: "STARTER", price: "$49", period: "/mo", desc: "Everything you need to start.", featured: false, plan: "starter", features: ["AI Sales Agent", "1 Phone Number (SMS + Voice)", "Unlimited Conversations", "Pipeline CRM", "Auto Follow-ups", "Gmail Integration", "Calendar + Booking", "Call Recording", "Analytics"], cta: "Get Started" },
            { name: "PRO", price: "$289", period: "/mo", desc: "Blue texts. Maximum deliverability.", featured: true, badge: "MOST POPULAR", plan: "pro", features: ["Everything in Starter", "iMessage (Blue Texts)", "RCS Messaging", "No A2P Registration", "Higher Deliverability", "Priority Support", "Self-Learning AI", "Google Review Automation", "CSV Import"], cta: "Get Started" },
            { name: "AGENCY", price: "Custom", period: "", desc: "For agencies managing clients.", featured: false, plan: null, features: ["Everything in Pro", "Multiple Numbers", "White Label Branding", "Custom Domain", "Team Management", "API Access", "Dedicated Support", "Facebook Lead Integration", "Volume Discounts"], cta: "Contact Us" },
          ].map((p, i) => (
            <div key={i} className={`lp-price-card ${p.featured ? "featured" : ""}`} style={{ flex: 1, minWidth: 260, maxWidth: 320, position: "relative" }}>
              {p.badge && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#E86A2A", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 16px", borderRadius: 20 }}>{p.badge}</div>}
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(245,243,240,0.4)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{p.name}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: "#f5f3f0" }}>{p.price}<span style={{ fontSize: 16, color: "rgba(245,243,240,0.4)", fontFamily: "Inter, sans-serif" }}>{p.period}</span></div>
              <p style={{ fontSize: 14, color: "rgba(245,243,240,0.4)", margin: "8px 0 24px" }}>{p.desc}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
                {p.features.map((f, j) => (
                  <li key={j} style={{ fontSize: 13, color: "rgba(245,243,240,0.6)", padding: "5px 0", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#2ecc71", fontWeight: 700 }}>✓</span>{f}
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
                  className={p.featured ? "lp-cta-btn" : "lp-ghost-btn"}
                  style={{ width: "100%", justifyContent: "center", boxSizing: "border-box", display: "flex", cursor: "pointer", border: "none", fontFamily: "inherit", fontSize: "inherit" }}
                >
                  {p.cta}
                </button>
              ) : (
                <Link href="/book/default" className="lp-ghost-btn" style={{ width: "100%", justifyContent: "center", boxSizing: "border-box", display: "flex" }}>
                  {p.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      </div>

      {/* FAQ */}
      <div id="faq" style={{ padding: "50px 40px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="lp-eyebrow" style={{ justifyContent: "center" }}>FAQ</div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, margin: 0 }}>Questions? We Got You.</h2>
        </div>
        <FaqItem q="How does the AI know what to say?" a="Our AI is trained on proven sales methodology (NEPQ). It asks the right questions, listens to answers, handles objections naturally, and guides leads to book an appointment. It gets smarter with every conversation." />
        <FaqItem q="Will leads know they're talking to AI?" a="No. The AI texts like a real person on your team. No dashes, no bullet points, no robotic grammar. It mirrors the lead's energy and tone. Most leads have no idea." />
        <FaqItem q="What's the difference between green and blue texts?" a="Green texts (SMS) require A2P registration and can get filtered by carriers. Blue texts (iMessage) go through Apple's network directly with no registration needed, higher deliverability, and a more trusted look. Our Pro plan includes blue texts." />
        <FaqItem q="Can I take over a conversation from the AI?" a="Yes. Every conversation has an AI toggle. Turn it off with one click and you're in control. Turn it back on and the AI picks up where you left off." />
        <FaqItem q="How fast does the AI respond to new leads?" a="Within seconds. The moment a lead comes in, the AI is texting them. That speed alone puts you ahead of 90% of your competition." />
        <FaqItem q="Do I need any technical skills?" a="No. When you sign up, our AI walks you through setup with a few questions about your business. You can be live in minutes." />
        <FaqItem q="What happens if a lead goes cold?" a="The AI follows up automatically with a different approach each time. Day 1, 3, 7, 14. Each message uses a different angle. No lead gets forgotten." />
      </div>

      {/* Final CTA */}
      <div style={{ background: "#111827", padding: "50px 40px 60px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, margin: "0 0 16px" }}>Stop Losing Leads. <span className="lp-gradient-text">Start Today.</span></h2>
        <p style={{ fontSize: 17, color: "rgba(245,243,240,0.4)", margin: "0 0 36px" }}>Your competitors are already following up faster than you.</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/demo" className="lp-cta-btn">Try the Live Demo →</Link>
          <Link href="/book/default" className="lp-ghost-btn">Book a Call</Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 40px 24px", overflow: "hidden" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 12vw, 200px)", letterSpacing: "clamp(2px, 0.5vw, 6px)", textAlign: "center", lineHeight: 0.9, marginBottom: 24, color: "rgba(255,255,255,0.35)", userSelect: "none" }}>
          THE <span style={{ color: "rgba(232,106,42,0.45)" }}>WOLF</span> PACK AI
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, alignItems: "center" }}>
          <Link href="/privacy" style={{ color: "rgba(245,243,240,0.3)", textDecoration: "none", fontSize: 13 }}>Privacy</Link>
          <Link href="/terms" style={{ color: "rgba(245,243,240,0.3)", textDecoration: "none", fontSize: 13 }}>Terms</Link>
          <span style={{ fontSize: 12, color: "rgba(245,243,240,0.2)" }}>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}
