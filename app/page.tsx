"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lp-faq-item" onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="lp-faq-q">{q}</div>
        <span style={{ color: "#E86A2A", fontSize: 20, fontWeight: 700, flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "rotate(0)" }}>+</span>
      </div>
      {open && <div className="lp-faq-a" style={{ marginTop: 8 }}>{a}</div>}
    </div>
  );
}

const DEMO_MSGS = [
  { type: "in", text: "Hey I saw your ad about roof inspections. My roof has been leaking", delay: 0 },
  { type: "out", text: "Hey Mike! That sounds stressful. How long has that been going on?", delay: 2000 },
  { type: "in", text: "Probably 3-4 months now. Gets worse every storm", delay: 4500 },
  { type: "out", text: "Wow 3-4 months... what have you tried so far to fix it?", delay: 6500 },
  { type: "in", text: "Had a handyman put some tar on it but it didnt help", delay: 9000 },
  { type: "out", text: "Yeah that usually doesn't hold up. How has the leak been affecting things inside?", delay: 11000 },
  { type: "in", text: "My ceiling has a water stain thats getting bigger. Wife is worried about mold", delay: 13500 },
  { type: "out", text: "That's a real concern. What would it mean for you if that was completely taken care of?", delay: 15500 },
  { type: "in", text: "Honestly that would be a huge relief", delay: 18000 },
  { type: "out", text: "We do free inspections. Would it make sense to set one up? I have Thursday at 10am or Friday at 2pm", delay: 20000 },
  { type: "in", text: "Thursday at 10 works!", delay: 22500 },
  { type: "out", text: "Perfect, you're all set! Calendar invite heading to your email right now", delay: 24000 },
];

function PhoneMockup() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    if (visibleCount >= DEMO_MSGS.length) {
      // Reset after a pause
      const timer = setTimeout(() => {
        setVisibleCount(0);
      }, 5000);
      return () => clearTimeout(timer);
    }

    const nextMsg = DEMO_MSGS[visibleCount];
    const prevDelay = visibleCount > 0 ? DEMO_MSGS[visibleCount - 1].delay : 0;
    const wait = nextMsg.delay - prevDelay;

    // Show typing indicator before AI messages
    if (nextMsg.type === "out" && visibleCount > 0) {
      const typingTimer = setTimeout(() => setShowTyping(true), wait - 1200);
      const msgTimer = setTimeout(() => {
        setShowTyping(false);
        setVisibleCount(c => c + 1);
      }, wait);
      return () => { clearTimeout(typingTimer); clearTimeout(msgTimer); };
    }

    const timer = setTimeout(() => {
      setVisibleCount(c => c + 1);
    }, wait);
    return () => clearTimeout(timer);
  }, [visibleCount]);

  const visible = DEMO_MSGS.slice(0, visibleCount);

  const msgsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = msgsContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [visibleCount, showTyping]);

  return (
    <div className="lp-phone">
      <div className="lp-phone-notch" />
      <div className="lp-phone-header">
        <div className="lp-phone-avatar">WP</div>
        <div className="lp-phone-name">Wolf Pack AI</div>
        <div className="lp-phone-sub">iMessage</div>
      </div>
      <div className="lp-phone-msgs" ref={msgsContainerRef} style={{ overflowY: "auto" }}>
        <div className="lp-phone-msgs-inner">
          {visible.map((m, i) => {
            const next = visible[i + 1];
            const isTail = !next || next.type !== m.type;
            return (
              <div key={i} className={`lp-chat-row ${m.type === "in" ? "in" : "out"}${isTail ? " tail" : ""}`}>
                <div className={`lp-chat-bubble ${m.type === "in" ? "in" : "out"}`}>{m.text}</div>
                {isTail && <div className="lp-chat-time">{m.type === "out" ? "AI · " : ""}now</div>}
              </div>
            );
          })}
          {showTyping && (
            <div className="lp-chat-row in" style={{ opacity: 1 }}>
              <div className="lp-chat-typing"><span /><span /><span /></div>
            </div>
          )}
          <div />
        </div>
      </div>
      <div className="lp-phone-input">
        <div className="lp-phone-input-bar">iMessage</div>
        <div className="lp-phone-input-send">↑</div>
      </div>
      <div className="lp-phone-home" />
    </div>
  );
}

export default function Home() {
  return (
    <div style={{ background: "#0D1426", color: "#e8eaf0", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        .lp-nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; max-width: 1200px; margin: 0 auto; }
        .lp-logo { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 2px; color: #e8eaf0; text-decoration: none; }
        .lp-logo span { color: #E86A2A; }
        .lp-nav-links { display: flex; gap: 28px; align-items: center; }
        .lp-nav-link { color: #b0b4c8; text-decoration: none; font-size: 14px; font-weight: 500; }
        .lp-nav-link:hover { color: #e8eaf0; }
        .lp-nav-cta { padding: 10px 24px; background: #E86A2A; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 700; }

        .lp-section { max-width: 1200px; margin: 0 auto; padding: 0 40px; }

        .lp-hero { display: flex; align-items: center; gap: 60px; padding: 80px 40px 60px; max-width: 1100px; margin: 0 auto; }
        .lp-hero-left { flex: 1; }
        .lp-hero-right { flex-shrink: 0; width: 320px; }
        .lp-hero h1 { font-family: 'Bebas Neue', sans-serif; font-size: 56px; line-height: 1.05; letter-spacing: 1px; margin: 0 0 20px; }
        .lp-hero h1 span { color: #E86A2A; }
        .lp-hero p { font-size: 17px; color: #b0b4c8; line-height: 1.7; margin: 0 0 32px; }
        .lp-hero-btns { display: flex; gap: 14px; flex-wrap: wrap; }
        .lp-btn-primary { padding: 16px 36px; background: #E86A2A; color: #fff; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: 700; }
        .lp-btn-primary:hover { background: #d45a1a; }
        .lp-btn-secondary { padding: 16px 36px; background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #e8eaf0; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: 600; }
        .lp-btn-secondary:hover { border-color: #E86A2A; color: #E86A2A; }
        .lp-hero-stat { display: flex; gap: 40px; margin-top: 48px; }
        .lp-stat-num { font-family: 'Bebas Neue', sans-serif; font-size: 36px; color: #E86A2A; }
        .lp-stat-label { font-size: 13px; color: #b0b4c8; margin-top: 4px; }

        .lp-phone { width: 300px; background: #000; border-radius: 44px; border: 3px solid #333; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5), inset 0 0 0 2px #1a1a1a; position: relative; }
        .lp-phone-notch { width: 126px; height: 32px; background: #000; border-radius: 0 0 18px 18px; margin: 0 auto; position: relative; z-index: 2; }
        .lp-phone-notch::after { content: ""; width: 60px; height: 4px; background: #1a1a1a; border-radius: 2px; position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); }
        .lp-phone-header { padding: 8px 16px 10px; text-align: center; background: #f2f2f7; }
        .lp-phone-avatar { width: 32px; height: 32px; border-radius: 50%; background: #007AFF; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; margin: 0 auto 4px; }
        .lp-phone-name { font-size: 13px; font-weight: 600; color: #000; }
        .lp-phone-sub { font-size: 10px; color: #8e8e93; }
        .lp-phone-msgs { padding: 10px 10px; height: 340px; overflow: hidden; display: flex; flex-direction: column; gap: 2px; background: #fff; }
        .lp-phone-msgs-inner { display: flex; flex-direction: column; gap: 2px; margin-top: auto; }
        .lp-chat-row { display: flex; flex-direction: column; margin-bottom: 1px; opacity: 0; animation: lp-msg-in 0.35s ease forwards; }
        .lp-chat-row.in { align-items: flex-start; padding-left: 4px; padding-right: 50px; }
        .lp-chat-row.out { align-items: flex-end; padding-right: 4px; padding-left: 50px; }
        .lp-chat-row.tail { margin-bottom: 4px; }
        .lp-chat-bubble { width: fit-content; max-width: 100%; padding: 7px 12px; font-size: 13px; line-height: 1.35; }
        .lp-chat-bubble.in { background: #e9e9eb; color: #000; border-radius: 18px; }
        .lp-chat-row.tail .lp-chat-bubble.in { border-radius: 18px 18px 18px 4px; }
        .lp-chat-bubble.out { background: #007AFF; color: #fff; border-radius: 18px; }
        .lp-chat-row.tail .lp-chat-bubble.out { border-radius: 18px 18px 4px 18px; }
        .lp-chat-time { font-size: 9px; color: #8e8e93; margin-top: 2px; padding: 0 6px; }
        .lp-chat-typing { display: flex; gap: 4px; padding: 10px 14px; background: #e9e9eb; border-radius: 18px 18px 18px 4px; width: fit-content; }
        .lp-chat-typing span { width: 6px; height: 6px; border-radius: 50%; background: #8e8e93; animation: lp-dot 1.2s ease-in-out infinite; }
        .lp-chat-typing span:nth-child(2) { animation-delay: 0.15s; }
        .lp-chat-typing span:nth-child(3) { animation-delay: 0.3s; }
        .lp-phone-input { background: #f2f2f7; padding: 8px 12px; display: flex; align-items: center; gap: 8px; }
        .lp-phone-input-bar { flex: 1; background: #fff; border: 1px solid #c7c7cc; border-radius: 18px; padding: 6px 14px; font-size: 12px; color: #8e8e93; }
        .lp-phone-input-send { width: 28px; height: 28px; border-radius: 50%; background: #007AFF; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; }
        .lp-phone-home { width: 36px; height: 4px; background: #333; border-radius: 2px; margin: 8px auto; }

        @keyframes lp-msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lp-dot { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } }

        @media (max-width: 768px) {
          .lp-hero { flex-direction: column; text-align: center; padding: 60px 24px 40px; gap: 40px; }
          .lp-hero h1 { font-size: 40px; }
          .lp-hero-btns { justify-content: center; }
          .lp-hero-stat { justify-content: center; }
          .lp-hero-right { width: 280px; }
        }

        .lp-problem { padding: 80px 40px; text-align: center; max-width: 800px; margin: 0 auto; }
        .lp-problem h2 { font-family: 'Bebas Neue', sans-serif; font-size: 40px; margin: 0 0 20px; }
        .lp-problem p { font-size: 16px; color: #b0b4c8; line-height: 1.7; }
        .lp-problem-stats { display: flex; gap: 24px; justify-content: center; margin-top: 40px; flex-wrap: wrap; }
        .lp-problem-card { background: #111827; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 24px 28px; flex: 1; min-width: 200px; }
        .lp-problem-card-num { font-family: 'Bebas Neue', sans-serif; font-size: 42px; color: #E86A2A; }
        .lp-problem-card-text { font-size: 13px; color: #b0b4c8; margin-top: 6px; line-height: 1.5; }

        .lp-how { padding: 80px 40px; max-width: 1000px; margin: 0 auto; }
        .lp-how h2 { font-family: 'Bebas Neue', sans-serif; font-size: 40px; text-align: center; margin: 0 0 48px; }
        .lp-how-steps { display: flex; gap: 24px; flex-wrap: wrap; }
        .lp-how-step { flex: 1; min-width: 250px; background: #111827; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 28px; text-align: center; }
        .lp-how-num { width: 44px; height: 44px; border-radius: 50%; background: rgba(232,106,42,0.15); color: #E86A2A; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; margin: 0 auto 16px; }
        .lp-how-title { font-size: 16px; font-weight: 700; color: #e8eaf0; margin-bottom: 8px; }
        .lp-how-text { font-size: 13px; color: #b0b4c8; line-height: 1.6; }

        .lp-features { padding: 80px 40px; max-width: 1000px; margin: 0 auto; }
        .lp-features h2 { font-family: 'Bebas Neue', sans-serif; font-size: 40px; text-align: center; margin: 0 0 48px; }
        .lp-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .lp-feature { background: #111827; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 24px; }
        .lp-feature-icon { font-size: 24px; margin-bottom: 12px; }
        .lp-feature-title { font-size: 15px; font-weight: 700; color: #e8eaf0; margin-bottom: 6px; }
        .lp-feature-text { font-size: 13px; color: #b0b4c8; line-height: 1.6; }

        .lp-demo-cta { padding: 80px 40px; text-align: center; }
        .lp-demo-cta-box { background: linear-gradient(135deg, rgba(232,106,42,0.1), rgba(232,106,42,0.02)); border: 1px solid rgba(232,106,42,0.2); border-radius: 20px; padding: 60px 40px; max-width: 700px; margin: 0 auto; }
        .lp-demo-cta h2 { font-family: 'Bebas Neue', sans-serif; font-size: 36px; margin: 0 0 12px; }
        .lp-demo-cta p { font-size: 15px; color: #b0b4c8; margin: 0 0 28px; line-height: 1.6; }

        .lp-pricing { padding: 80px 40px; max-width: 1000px; margin: 0 auto; }
        .lp-pricing h2 { font-family: 'Bebas Neue', sans-serif; font-size: 40px; text-align: center; margin: 0 0 12px; }
        .lp-pricing-sub { font-size: 15px; color: #b0b4c8; text-align: center; margin-bottom: 48px; }
        .lp-pricing-cards { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; }
        .lp-price-card { background: #111827; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 32px; flex: 1; min-width: 260px; max-width: 320px; }
        .lp-price-card.featured { border-color: #E86A2A; position: relative; }
        .lp-price-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #E86A2A; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 16px; border-radius: 20px; white-space: nowrap; }
        .lp-price-name { font-size: 14px; font-weight: 700; color: #b0b4c8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .lp-price-amount { font-family: 'Bebas Neue', sans-serif; font-size: 48px; color: #e8eaf0; }
        .lp-price-amount span { font-size: 16px; color: #b0b4c8; font-family: Inter, sans-serif; }
        .lp-price-desc { font-size: 13px; color: #b0b4c8; margin: 8px 0 20px; line-height: 1.5; }
        .lp-price-features { list-style: none; padding: 0; margin: 0 0 24px; }
        .lp-price-features li { font-size: 13px; color: #b0b4c8; padding: 6px 0; display: flex; align-items: center; gap: 8px; }
        .lp-price-features li::before { content: "✓"; color: #2ecc71; font-weight: 700; font-size: 14px; }
        .lp-price-btn { display: block; width: 100%; padding: 12px; border-radius: 10px; text-align: center; font-size: 14px; font-weight: 700; text-decoration: none; box-sizing: border-box; }
        .lp-price-btn-primary { background: #E86A2A; color: #fff; border: none; }
        .lp-price-btn-secondary { background: transparent; color: #e8eaf0; border: 1px solid rgba(255,255,255,0.15); }

        .lp-faq { padding: 80px 40px; max-width: 700px; margin: 0 auto; }
        .lp-faq h2 { font-family: 'Bebas Neue', sans-serif; font-size: 40px; text-align: center; margin: 0 0 40px; }
        .lp-faq-item { border-bottom: 1px solid rgba(255,255,255,0.07); padding: 20px 0; }
        .lp-faq-q { font-size: 15px; font-weight: 600; color: #e8eaf0; margin-bottom: 8px; }
        .lp-faq-a { font-size: 14px; color: #b0b4c8; line-height: 1.7; }

        .lp-final-cta { padding: 80px 40px 100px; text-align: center; }
        .lp-final-cta h2 { font-family: 'Bebas Neue', sans-serif; font-size: 44px; margin: 0 0 16px; }
        .lp-final-cta p { font-size: 16px; color: #b0b4c8; margin: 0 0 32px; }

        .lp-footer { border-top: 1px solid rgba(255,255,255,0.07); padding: 32px 40px; text-align: center; font-size: 13px; color: #666; }

        @media (max-width: 768px) {
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-nav-links { display: none; }
        }
      `}</style>

      {/* Nav */}
      <nav className="lp-nav">
        <Link href="/" className="lp-logo">THE <span>WOLF</span> PACK AI</Link>
        <div className="lp-nav-links">
          <a href="#features" className="lp-nav-link">Features</a>
          <a href="#pricing" className="lp-nav-link">Pricing</a>
          <a href="#faq" className="lp-nav-link">FAQ</a>
          <Link href="/demo" className="lp-nav-link">Live Demo</Link>
          <Link href="/sign-in" className="lp-nav-cta">Sign In</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="lp-hero">
        <div className="lp-hero-left">
          <h1>Your <span>AI Sales Agent</span> That Never Sleeps</h1>
          <p>Texts your leads in seconds, qualifies them, handles objections, and books appointments. All on autopilot. While you focus on closing.</p>
          <div className="lp-hero-btns">
            <Link href="/demo" className="lp-btn-primary">See It In Action</Link>
            <Link href="/book/default" className="lp-btn-secondary">Book a Demo</Link>
          </div>
          <div className="lp-hero-stat">
            <div>
              <div className="lp-stat-num">3 SEC</div>
              <div className="lp-stat-label">Average response time</div>
            </div>
            <div>
              <div className="lp-stat-num">24/7</div>
              <div className="lp-stat-label">Never misses a lead</div>
            </div>
            <div>
              <div className="lp-stat-num">10X</div>
              <div className="lp-stat-label">More booked</div>
            </div>
          </div>
        </div>
        <div className="lp-hero-right">
          <PhoneMockup />
        </div>
      </div>

      {/* Problem */}
      <div className="lp-problem">
        <h2>Every Minute You Wait, Your Lead Goes Cold</h2>
        <p>78% of customers buy from the company that responds first. Your competitors are following up in minutes. Are you?</p>
        <div className="lp-problem-stats">
          <div className="lp-problem-card">
            <div className="lp-problem-card-num">78%</div>
            <div className="lp-problem-card-text">of customers buy from whoever responds first</div>
          </div>
          <div className="lp-problem-card">
            <div className="lp-problem-card-num">5 MIN</div>
            <div className="lp-problem-card-text">after 5 minutes, your odds of connecting drop 80%</div>
          </div>
          <div className="lp-problem-card">
            <div className="lp-problem-card-num">48%</div>
            <div className="lp-problem-card-text">of businesses never follow up with a lead at all</div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="lp-how">
        <h2>How It Works</h2>
        <div className="lp-how-steps">
          <div className="lp-how-step">
            <div className="lp-how-num">1</div>
            <div className="lp-how-title">Lead Comes In</div>
            <div className="lp-how-text">From your ads, website, referrals, anywhere. The AI picks it up instantly.</div>
          </div>
          <div className="lp-how-step">
            <div className="lp-how-num">2</div>
            <div className="lp-how-title">AI Starts Selling</div>
            <div className="lp-how-text">Texts them within seconds. Asks the right questions. Handles objections. Builds trust.</div>
          </div>
          <div className="lp-how-step">
            <div className="lp-how-num">3</div>
            <div className="lp-how-title">Appointment Booked</div>
            <div className="lp-how-text">Calendar invite sent. Google Meet link included. You just show up and close.</div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="lp-features" id="features">
        <h2>Everything You Need To Close More</h2>
        <div className="lp-features-grid">
          <div className="lp-feature">
            <div className="lp-feature-icon">🤖</div>
            <div className="lp-feature-title">AI Sales Agent</div>
            <div className="lp-feature-text">Trained on proven sales methodology. Qualifies leads, overcomes objections, and books appointments automatically.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">💬</div>
            <div className="lp-feature-title">SMS + iMessage</div>
            <div className="lp-feature-text">Text leads from your own number. Upgrade to blue texts (iMessage) with no A2P approval needed.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">📞</div>
            <div className="lp-feature-title">Built-in Calling</div>
            <div className="lp-feature-text">Call leads directly from the CRM. Auto-recording. Click any contact to dial. No extra apps.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">📧</div>
            <div className="lp-feature-title">Email Integration</div>
            <div className="lp-feature-text">Gmail and Outlook. See all emails per lead. Reply, forward, compose right from the CRM. Your signature carries over.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">📅</div>
            <div className="lp-feature-title">Calendar + Booking</div>
            <div className="lp-feature-text">Syncs with Google Calendar and Microsoft. Public booking page. AI books appointments and sends video call links automatically.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">📊</div>
            <div className="lp-feature-title">Pipeline + Analytics</div>
            <div className="lp-feature-text">Drag and drop kanban board. Conversion funnel. Lead scoring. See exactly where every deal stands.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">🔄</div>
            <div className="lp-feature-title">Auto Follow-ups</div>
            <div className="lp-feature-text">Lead goes quiet? AI follows up with a different angle. 1 day, 3 days, 7 days, 14 days. Never drops the ball.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">🧠</div>
            <div className="lp-feature-title">Self-Learning AI</div>
            <div className="lp-feature-text">Learns from every conversation. What works, what doesn't, what books appointments. Gets smarter over time.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature-icon">⭐</div>
            <div className="lp-feature-title">Review Requests</div>
            <div className="lp-feature-text">After a deal closes, AI asks for feedback. Positive? Sends Google review link. Negative? Owner gets notified.</div>
          </div>
        </div>
      </div>

      {/* Live Demo CTA */}
      <div className="lp-demo-cta">
        <div className="lp-demo-cta-box">
          <h2>See It Work On <span style={{ color: "#E86A2A" }}>You</span></h2>
          <p>Enter your phone number and experience exactly what your leads will experience. Our AI will text you, qualify you, and book an appointment. All in real time.</p>
          <Link href="/demo" className="lp-btn-primary">Try the Live Demo</Link>
        </div>
      </div>

      {/* Pricing */}
      <div className="lp-pricing" id="pricing">
        <h2>Simple Pricing</h2>
        <div className="lp-pricing-sub">No contracts. Cancel anytime.</div>
        <div className="lp-pricing-cards">
          <div className="lp-price-card">
            <div className="lp-price-name">Starter</div>
            <div className="lp-price-amount">$49<span>/mo</span></div>
            <div className="lp-price-desc">Everything you need to start closing more leads with AI.</div>
            <ul className="lp-price-features">
              <li>AI Sales Agent</li>
              <li>1 Phone Number (SMS + Voice)</li>
              <li>Unlimited Conversations</li>
              <li>Pipeline + Contacts CRM</li>
              <li>Auto Follow-ups</li>
              <li>Gmail Integration</li>
              <li>Calendar + Booking</li>
              <li>Call Recording</li>
              <li>Analytics Dashboard</li>
            </ul>
            <Link href="/sign-up" className="lp-price-btn lp-price-btn-secondary">Get Started</Link>
          </div>

          <div className="lp-price-card featured">
            <div className="lp-price-badge">MOST POPULAR</div>
            <div className="lp-price-name">Pro</div>
            <div className="lp-price-amount">$289<span>/mo</span></div>
            <div className="lp-price-desc">Blue texts. No A2P approval. Maximum deliverability.</div>
            <ul className="lp-price-features">
              <li>Everything in Starter</li>
              <li>iMessage (Blue Texts)</li>
              <li>RCS Messaging</li>
              <li>No A2P Registration Needed</li>
              <li>Higher Deliverability</li>
              <li>Priority Support</li>
              <li>Self-Learning AI</li>
              <li>Google Review Automation</li>
              <li>CSV Import</li>
            </ul>
            <Link href="/sign-up" className="lp-price-btn lp-price-btn-primary">Get Started</Link>
          </div>

          <div className="lp-price-card">
            <div className="lp-price-name">Agency</div>
            <div className="lp-price-amount">Custom</div>
            <div className="lp-price-desc">For agencies managing multiple clients. White label available.</div>
            <ul className="lp-price-features">
              <li>Everything in Pro</li>
              <li>Multiple Phone Numbers</li>
              <li>White Label Branding</li>
              <li>Custom Domain</li>
              <li>Team Management</li>
              <li>API Access</li>
              <li>Dedicated Support</li>
              <li>Facebook Lead Ads Integration</li>
              <li>Volume Discounts</li>
            </ul>
            <Link href="/book/default" className="lp-price-btn lp-price-btn-secondary">Contact Us</Link>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="lp-faq" id="faq">
        <h2>Questions? We Got You.</h2>

        <FaqItem q="How does the AI know what to say?" a="Our AI is trained on proven sales methodology (NEPQ). It asks the right questions, listens to answers, handles objections naturally, and guides leads to book an appointment. It gets smarter with every conversation." />
        <FaqItem q="Will leads know they're talking to AI?" a="No. The AI texts like a real person on your team. No dashes, no bullet points, no robotic grammar. It mirrors the lead's energy and tone. Most leads have no idea." />
        <FaqItem q="What's the difference between green and blue texts?" a="Green texts (SMS) require A2P registration and can get filtered by carriers. Blue texts (iMessage) go through Apple's network directly with no registration needed, higher deliverability, and a more trusted look. Our Pro plan includes blue texts." />
        <FaqItem q="Can I take over a conversation from the AI?" a="Yes. Every conversation has an AI toggle. Turn it off with one click and you're in control. Turn it back on and the AI picks up where you left off." />
        <FaqItem q="How fast does the AI respond to new leads?" a="Within seconds. Not minutes, not hours. The moment a lead comes in, the AI is texting them. That speed alone puts you ahead of 90% of your competition." />
        <FaqItem q="Do I need any technical skills to set this up?" a="No. When you sign up, our AI bot walks you through setup with a few simple questions about your business. It configures everything automatically. You can be live in minutes." />
        <FaqItem q="What happens if a lead goes cold?" a="The AI automatically follows up with a different approach each time. Day 1, day 3, day 7, day 14. Each follow-up uses a different angle based on the conversation history. No lead gets forgotten." />
      </div>

      {/* Final CTA */}
      <div className="lp-final-cta">
        <h2>Stop Losing Leads. <span style={{ color: "#E86A2A" }}>Start Today.</span></h2>
        <p>Your competitors are already following up faster than you. Let AI handle it.</p>
        <div className="lp-hero-btns">
          <Link href="/demo" className="lp-btn-primary">Try the Live Demo</Link>
          <Link href="/book/default" className="lp-btn-secondary">Book a Call</Link>
        </div>
      </div>

      {/* Footer */}
      <div className="lp-footer">
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5 }}>THE <span style={{ color: "#E86A2A" }}>WOLF</span> PACK AI</span>
        </div>
        <div>
          <Link href="/privacy" style={{ color: "#666", marginRight: 16, textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ color: "#666", textDecoration: "none" }}>Terms</Link>
        </div>
        <div style={{ marginTop: 8 }}>© {new Date().getFullYear()} The Wolf Pack AI. All rights reserved.</div>
      </div>
    </div>
  );
}
