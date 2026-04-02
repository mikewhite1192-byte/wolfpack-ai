"use client";

import { useState } from "react";
import TradeChatWidget from "../components/TradeChatWidget";

const BLUE = "#2B7CD4";
const BG = "#0a0a0a";
const TEXT = "#e8eaf0";
const TEXT_MUTED = "#9ca3af";
const CARD_BG = "#111318";
const CARD_BORDER = "rgba(255,255,255,0.06)";

const SERVICES = [
  { icon: "\u{1F527}", title: "Emergency Repairs", desc: "Burst pipes, flooding, and urgent plumbing issues handled fast. We arrive ready to fix the problem." },
  { icon: "\u{1F6BF}", title: "Drain Cleaning", desc: "Stubborn clogs and slow drains cleared with professional-grade equipment. No damage to your pipes." },
  { icon: "\u{1F525}", title: "Water Heater Install", desc: "Tank and tankless water heater installation, repair, and replacement. All major brands serviced." },
  { icon: "\u{1F4A7}", title: "Pipe Repair", desc: "Leaky, corroded, or frozen pipes repaired quickly. We minimize wall and floor damage during every job." },
  { icon: "\u{1F6C1}", title: "Bathroom Remodels", desc: "Full bathroom plumbing rough-in and finish work. Tubs, showers, vanities, and fixtures installed right." },
  { icon: "\u{1F3D7}\uFE0F", title: "Sewer Line Service", desc: "Camera inspections, sewer line repair, and trenchless replacement. We find the problem before we dig." },
];

const REASONS = [
  { title: "Licensed & Insured", desc: "Fully licensed Michigan plumber with comprehensive liability and workers comp coverage on every job." },
  { title: "24/7 Emergency Service", desc: "Plumbing emergencies don't wait. Neither do we. Call any time, day or night, and we'll be there." },
  { title: "Free Estimates", desc: "Upfront pricing with no hidden fees. We'll give you an honest quote before any work starts." },
  { title: "100% Satisfaction Guarantee", desc: "If you're not happy with our work, we'll come back and make it right. That's our promise." },
];

const TESTIMONIALS = [
  { name: "Mike D.", location: "Warren, MI", rating: 5, text: "Called at 11pm with a burst pipe in the basement. They were here in 30 minutes and had it fixed before midnight. Saved us from serious water damage. Can't recommend them enough." },
  { name: "Sarah T.", location: "Sterling Heights, MI", rating: 5, text: "Had our entire bathroom remodeled. The crew was professional, clean, and finished on time. The tile work around the new shower is perfect. Best plumber we've ever used." },
  { name: "James R.", location: "Troy, MI", rating: 5, text: "Honest pricing and great work. They replaced our 15-year-old water heater and the quote was exactly what we paid. No surprises. Will be using Metro Plumbing for everything from now on." },
];

const AREAS = ["Warren", "Sterling Heights", "Troy", "Rochester Hills", "Macomb County"];

function Stars({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ color: "#facc15", fontSize: 18 }}>&#9733;</span>
      ))}
    </div>
  );
}

export default function PlumberPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .plumber-page a { color: inherit; text-decoration: none; }
        .plumber-btn {
          display: inline-block;
          padding: 14px 32px;
          background: ${BLUE};
          color: #fff;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          letter-spacing: 1.5px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .plumber-btn:hover { background: #2468b0; }
        .plumber-btn-outline {
          display: inline-block;
          padding: 14px 32px;
          background: transparent;
          color: ${BLUE};
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          letter-spacing: 1.5px;
          border: 2px solid ${BLUE};
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .plumber-btn-outline:hover { background: ${BLUE}; color: #fff; }
        .plumber-section { padding: 80px 24px; max-width: 1100px; margin: 0 auto; }
        .plumber-grid-6 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .plumber-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        .plumber-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 900px) {
          .plumber-grid-6 { grid-template-columns: repeat(2, 1fr); }
          .plumber-grid-4 { grid-template-columns: repeat(2, 1fr); }
          .plumber-grid-3 { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .plumber-grid-6 { grid-template-columns: 1fr; }
          .plumber-grid-4 { grid-template-columns: 1fr; }
          .plumber-section { padding: 48px 16px; }
          .plumber-hero-title { font-size: 42px !important; }
          .plumber-nav-links { display: none !important; }
          .plumber-nav-phone { display: none !important; }
          .plumber-mobile-toggle { display: flex !important; }
          .plumber-hero-buttons { flex-direction: column; align-items: stretch; }
          .plumber-hero-buttons .plumber-btn,
          .plumber-hero-buttons .plumber-btn-outline { text-align: center; }
        }
      `}</style>

      <div className="plumber-page" style={{ background: BG, color: TEXT, fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>

        {/* ── Nav ──────────────────────────────────────────────────────── */}
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: BLUE }}>
              Metro Plumbing Co
            </div>
            <div className="plumber-nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
              <span className="plumber-nav-phone" style={{ color: TEXT_MUTED, fontSize: 15 }}>(586) 555-0142</span>
              <button className="plumber-btn" style={{ padding: "10px 24px", fontSize: 15 }}>Get a Free Quote</button>
            </div>
            <button
              className="plumber-mobile-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ display: "none", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: TEXT, fontSize: 28, cursor: "pointer" }}
            >
              {menuOpen ? "\u2715" : "\u2630"}
            </button>
          </div>
          {menuOpen && (
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", flexDirection: "column", gap: 16 }}>
              <span style={{ color: TEXT_MUTED, fontSize: 15 }}>(586) 555-0142</span>
              <button className="plumber-btn" style={{ padding: "10px 24px", fontSize: 15, width: "100%" }}>Get a Free Quote</button>
            </div>
          )}
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section style={{ position: "relative", padding: "120px 24px 100px", textAlign: "center", overflow: "hidden" }}>
          {/* Background glow */}
          <div style={{ position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)", width: 800, height: 800, borderRadius: "50%", background: `radial-gradient(circle, rgba(43,124,212,0.15) 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "inline-block", padding: "6px 18px", borderRadius: 20, background: "rgba(43,124,212,0.12)", color: BLUE, fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 24 }}>
              Licensed &bull; Insured &bull; 24/7 Emergency
            </div>
            <h1 className="plumber-hero-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, letterSpacing: 3, lineHeight: 1, margin: "0 0 12px", color: TEXT }}>
              Warren&apos;s <span style={{ color: BLUE }}>Most Trusted</span>
            </h1>
            <h1 className="plumber-hero-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, letterSpacing: 3, lineHeight: 1, margin: "0 0 28px", color: TEXT }}>
              Plumbers
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: TEXT_MUTED, maxWidth: 580, margin: "0 auto 40px" }}>
              From emergency repairs at 2am to full bathroom remodels. Fast response. Honest pricing. Guaranteed work.
            </p>
            <div className="plumber-hero-buttons" style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 56 }}>
              <button className="plumber-btn" style={{ fontSize: 20, padding: "16px 40px" }}>Call Now &mdash; (586) 555-0142</button>
              <button className="plumber-btn-outline" style={{ fontSize: 20, padding: "16px 40px" }}>Request a Quote</button>
            </div>
            {/* Stats bar */}
            <div style={{ display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
              {[
                { num: "15+", label: "Years in Business" },
                { num: "3,200+", label: "Jobs Completed" },
                { num: "4.9", label: "Google Rating" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: BLUE, lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4, letterSpacing: 0.5 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Services ─────────────────────────────────────────────────── */}
        <section style={{ background: "#08090c" }}>
          <div className="plumber-section">
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: 2, margin: "0 0 12px" }}>Our Services</h2>
              <p style={{ color: TEXT_MUTED, fontSize: 16 }}>Professional plumbing solutions for your home or business</p>
            </div>
            <div className="plumber-grid-6">
              {SERVICES.map((s) => (
                <div key={s.title} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 28 }}>
                  <div style={{ fontSize: 36, marginBottom: 14 }}>{s.icon}</div>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, margin: "0 0 10px", color: TEXT }}>{s.title}</h3>
                  <p style={{ color: TEXT_MUTED, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Choose Us ────────────────────────────────────────────── */}
        <section>
          <div className="plumber-section">
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: 2, margin: "0 0 12px" }}>Why Choose Metro Plumbing</h2>
              <p style={{ color: TEXT_MUTED, fontSize: 16 }}>What sets us apart from every other plumber in Warren</p>
            </div>
            <div className="plumber-grid-4">
              {REASONS.map((r) => (
                <div key={r.title} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 28, textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(43,124,212,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: BLUE }} />
                  </div>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, margin: "0 0 10px", color: TEXT }}>{r.title}</h3>
                  <p style={{ color: TEXT_MUTED, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────────────────── */}
        <section style={{ background: "#08090c" }}>
          <div className="plumber-section">
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: 2, margin: "0 0 12px" }}>What Our Customers Say</h2>
              <p style={{ color: TEXT_MUTED, fontSize: 16 }}>Real reviews from homeowners in the Warren area</p>
            </div>
            <div className="plumber-grid-3">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 28 }}>
                  <Stars count={t.rating} />
                  <p style={{ color: TEXT_MUTED, fontSize: 14, lineHeight: 1.7, margin: "0 0 20px", fontStyle: "italic" }}>
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: TEXT }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: TEXT_MUTED }}>{t.location}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Service Area ─────────────────────────────────────────────── */}
        <section>
          <div className="plumber-section" style={{ textAlign: "center" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: 2, margin: "0 0 12px" }}>Service Area</h2>
            <p style={{ color: TEXT_MUTED, fontSize: 16, marginBottom: 32 }}>Proudly serving Southeast Michigan</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
              {AREAS.map((a) => (
                <span key={a} style={{ padding: "10px 24px", borderRadius: 20, background: "rgba(43,124,212,0.1)", border: `1px solid rgba(43,124,212,0.2)`, color: BLUE, fontSize: 15, fontWeight: 500 }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section style={{ background: `linear-gradient(135deg, rgba(43,124,212,0.12) 0%, rgba(43,124,212,0.04) 100%)`, borderTop: `1px solid rgba(43,124,212,0.15)`, borderBottom: `1px solid rgba(43,124,212,0.15)` }}>
          <div className="plumber-section" style={{ textAlign: "center" }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 2, margin: "0 0 16px" }}>Ready to Fix Your Plumbing?</h2>
            <p style={{ color: TEXT_MUTED, fontSize: 17, lineHeight: 1.7, maxWidth: 550, margin: "0 auto 36px" }}>
              Give us a call or request a free quote online. We respond to every inquiry within 15 minutes during business hours.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="plumber-btn" style={{ fontSize: 20, padding: "16px 40px" }}>Call (586) 555-0142</button>
              <button className="plumber-btn-outline" style={{ fontSize: 20, padding: "16px 40px" }}>Request a Free Quote</button>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer style={{ borderTop: `1px solid ${CARD_BORDER}`, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: BLUE, marginBottom: 16 }}>
              Metro Plumbing Co
            </div>
            <p style={{ color: TEXT_MUTED, fontSize: 14, lineHeight: 1.8, margin: "0 0 16px" }}>
              14820 E 12 Mile Rd, Warren, MI 48088<br />
              (586) 555-0142
            </p>
            <div style={{ display: "inline-block", padding: "6px 18px", borderRadius: 20, background: "rgba(43,124,212,0.1)", border: `1px solid rgba(43,124,212,0.2)`, color: BLUE, fontSize: 13, fontWeight: 600, letterSpacing: 1, marginBottom: 24 }}>
              Licensed &amp; Insured &mdash; State of Michigan
            </div>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, margin: 0 }}>
              &copy; {new Date().getFullYear()} Metro Plumbing Co. All rights reserved.
            </p>
          </div>
        </footer>
        <TradeChatWidget trade="plumber" accentColor={BLUE} />
      </div>
    </>
  );
}
