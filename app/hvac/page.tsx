"use client";

import { useState } from "react";
import TradeChatWidget from "../components/TradeChatWidget";

const TEAL = "#2BA5A5";
const BG = "#0a0a0a";
const TEXT = "#e8eaf0";
const CARD_BG = "#141418";
const BORDER = "rgba(255,255,255,0.06)";

const SERVICES = [
  { icon: "\u2744\uFE0F", title: "AC Repair & Install", desc: "Fast, reliable air conditioning repair and new system installations to keep you cool all summer." },
  { icon: "\uD83D\uDD25", title: "Furnace Repair & Install", desc: "Expert furnace diagnostics, repair, and high-efficiency system installations for Michigan winters." },
  { icon: "\uD83D\uDCA8", title: "Duct Cleaning", desc: "Professional duct cleaning to improve air quality, reduce allergens, and boost system efficiency." },
  { icon: "\uD83C\uDF21\uFE0F", title: "Thermostat Install", desc: "Smart thermostat installation and setup so you can control comfort and save on energy bills." },
  { icon: "\uD83D\uDD27", title: "Maintenance Plans", desc: "Affordable annual maintenance plans that prevent breakdowns and extend your system's lifespan." },
  { icon: "\u26A1", title: "Emergency HVAC Service", desc: "24/7 emergency heating and cooling repair. We'll be there when you need us most." },
];

const WHY_US = [
  { title: "NATE Certified Techs", desc: "Our technicians hold NATE certifications — the gold standard in HVAC training and expertise." },
  { title: "24/7 Emergency Service", desc: "Furnace quit at 2am? AC died on the hottest day? We answer the phone and show up fast." },
  { title: "Financing Available", desc: "Don't let cost stop you from staying comfortable. Flexible financing options on new systems." },
  { title: "Satisfaction Guaranteed", desc: "We stand behind every job. If you're not happy, we'll make it right — no questions asked." },
];

const TESTIMONIALS = [
  { name: "Jennifer M.", location: "Troy, MI", stars: 5, text: "Our AC went out in the middle of July and they had a tech here within two hours. Professional, fair pricing, and our house was cool again by dinner. Can't recommend them enough." },
  { name: "David & Lisa K.", location: "Rochester Hills, MI", stars: 5, text: "We've used Comfort Zone for our furnace maintenance for three years now. Always on time, always thorough. They caught a cracked heat exchanger last fall that could've been dangerous." },
  { name: "Robert T.", location: "Sterling Heights, MI", stars: 5, text: "Got quotes from four companies for a new HVAC system. Comfort Zone was the most honest and competitively priced. Install crew was clean, fast, and explained everything. Five stars." },
];

const SERVICE_AREAS = ["Troy", "Warren", "Sterling Heights", "Rochester Hills", "Birmingham", "Oakland County"];

function Stars({ count }: { count: number }) {
  return (
    <div style={{ color: "#f5a623", fontSize: 18, letterSpacing: 2 }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i}>&#9733;</span>
      ))}
    </div>
  );
}

export default function HvacPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${BG}; color: ${TEXT}; font-family: 'Inter', sans-serif; }

        .hvac-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 48px; position: sticky; top: 0; z-index: 100;
          background: rgba(10,10,10,0.92); backdrop-filter: blur(12px);
          border-bottom: 1px solid ${BORDER};
        }
        .hvac-nav-logo {
          font-family: 'Bebas Neue', sans-serif; font-size: 22px;
          color: ${TEAL}; letter-spacing: 1px; white-space: nowrap;
        }
        .hvac-nav-right { display: flex; align-items: center; gap: 24px; }
        .hvac-nav-phone { color: ${TEXT}; font-size: 15px; font-weight: 500; }
        .hvac-nav-cta {
          background: ${TEAL}; color: #fff; border: none; padding: 10px 24px;
          font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600;
          border-radius: 6px; cursor: pointer; white-space: nowrap;
          transition: opacity 0.2s;
        }
        .hvac-nav-cta:hover { opacity: 0.88; }
        .hvac-hamburger {
          display: none; background: none; border: none; color: ${TEXT};
          font-size: 28px; cursor: pointer;
        }

        .hvac-hero {
          padding: 120px 48px 100px; text-align: center;
          background: radial-gradient(ellipse at 50% 0%, rgba(43,165,165,0.10) 0%, transparent 70%);
        }
        .hvac-hero h1 {
          font-family: 'Bebas Neue', sans-serif; font-size: 72px;
          line-height: 1.05; color: #fff; max-width: 800px; margin: 0 auto 24px;
          letter-spacing: 1px;
        }
        .hvac-hero p {
          font-size: 18px; color: rgba(232,234,240,0.65); max-width: 580px;
          margin: 0 auto 40px; line-height: 1.7;
        }
        .hvac-hero-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
        .hvac-btn-primary {
          background: ${TEAL}; color: #fff; border: none; padding: 16px 36px;
          font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600;
          border-radius: 8px; cursor: pointer; transition: opacity 0.2s;
        }
        .hvac-btn-primary:hover { opacity: 0.88; }
        .hvac-btn-secondary {
          background: transparent; color: ${TEXT}; border: 2px solid rgba(255,255,255,0.15);
          padding: 14px 36px; font-family: 'Inter', sans-serif; font-size: 16px;
          font-weight: 600; border-radius: 8px; cursor: pointer; transition: border-color 0.2s;
        }
        .hvac-btn-secondary:hover { border-color: ${TEAL}; }

        .hvac-section {
          padding: 96px 48px; max-width: 1200px; margin: 0 auto;
        }
        .hvac-section-title {
          font-family: 'Bebas Neue', sans-serif; font-size: 48px; color: #fff;
          text-align: center; margin-bottom: 16px; letter-spacing: 1px;
        }
        .hvac-section-sub {
          text-align: center; color: rgba(232,234,240,0.5); font-size: 16px;
          margin-bottom: 56px; max-width: 560px; margin-left: auto; margin-right: auto;
        }

        .hvac-services-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
        }
        .hvac-service-card {
          background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 12px;
          padding: 36px 28px; transition: border-color 0.25s;
        }
        .hvac-service-card:hover { border-color: ${TEAL}; }
        .hvac-service-icon { font-size: 32px; margin-bottom: 16px; }
        .hvac-service-title {
          font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #fff;
          margin-bottom: 10px; letter-spacing: 0.5px;
        }
        .hvac-service-desc { color: rgba(232,234,240,0.55); font-size: 14px; line-height: 1.7; }

        .hvac-why-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
        }
        .hvac-why-card {
          background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 12px;
          padding: 32px 24px; text-align: center;
        }
        .hvac-why-title {
          font-family: 'Bebas Neue', sans-serif; font-size: 22px; color: ${TEAL};
          margin-bottom: 12px; letter-spacing: 0.5px;
        }
        .hvac-why-desc { color: rgba(232,234,240,0.55); font-size: 14px; line-height: 1.7; }

        .hvac-testimonials-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
        }
        .hvac-testimonial-card {
          background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 12px;
          padding: 32px 28px;
        }
        .hvac-testimonial-text {
          color: rgba(232,234,240,0.7); font-size: 15px; line-height: 1.8;
          margin-bottom: 20px; font-style: italic;
        }
        .hvac-testimonial-name { color: #fff; font-weight: 600; font-size: 15px; }
        .hvac-testimonial-loc { color: rgba(232,234,240,0.4); font-size: 13px; margin-top: 2px; }

        .hvac-areas {
          display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;
        }
        .hvac-area-tag {
          background: rgba(43,165,165,0.10); border: 1px solid rgba(43,165,165,0.25);
          color: ${TEAL}; padding: 10px 24px; border-radius: 100px;
          font-size: 15px; font-weight: 500;
        }

        .hvac-cta-section {
          text-align: center; padding: 96px 48px;
          background: radial-gradient(ellipse at 50% 100%, rgba(43,165,165,0.08) 0%, transparent 70%);
        }
        .hvac-cta-section h2 {
          font-family: 'Bebas Neue', sans-serif; font-size: 52px; color: #fff;
          margin-bottom: 16px; letter-spacing: 1px;
        }
        .hvac-cta-section p {
          color: rgba(232,234,240,0.55); font-size: 18px; margin-bottom: 40px;
        }
        .hvac-cta-phone {
          font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: ${TEAL};
          margin-bottom: 32px; letter-spacing: 2px;
        }

        .hvac-footer {
          border-top: 1px solid ${BORDER}; padding: 48px;
          display: flex; justify-content: space-between; align-items: center;
          max-width: 1200px; margin: 0 auto; flex-wrap: wrap; gap: 24px;
        }
        .hvac-footer-left { color: rgba(232,234,240,0.4); font-size: 14px; line-height: 1.8; }
        .hvac-footer-badge {
          background: rgba(43,165,165,0.10); border: 1px solid rgba(43,165,165,0.25);
          color: ${TEAL}; padding: 10px 20px; border-radius: 8px;
          font-size: 13px; font-weight: 600; letter-spacing: 0.5px;
        }

        .hvac-divider {
          width: 100%; height: 1px; background: ${BORDER}; max-width: 1200px; margin: 0 auto;
        }

        @media (max-width: 900px) {
          .hvac-nav { padding: 14px 20px; }
          .hvac-nav-right { display: none; }
          .hvac-nav-right.open {
            display: flex; flex-direction: column; position: absolute;
            top: 100%; left: 0; right: 0; background: rgba(10,10,10,0.97);
            padding: 24px; gap: 16px; border-bottom: 1px solid ${BORDER};
          }
          .hvac-hamburger { display: block; }
          .hvac-hero { padding: 80px 20px 64px; }
          .hvac-hero h1 { font-size: 44px; }
          .hvac-hero p { font-size: 16px; }
          .hvac-section { padding: 64px 20px; }
          .hvac-section-title { font-size: 36px; }
          .hvac-services-grid { grid-template-columns: 1fr; }
          .hvac-why-grid { grid-template-columns: repeat(2, 1fr); }
          .hvac-testimonials-grid { grid-template-columns: 1fr; }
          .hvac-cta-section { padding: 64px 20px; }
          .hvac-cta-section h2 { font-size: 36px; }
          .hvac-cta-phone { font-size: 28px; }
          .hvac-footer { padding: 32px 20px; flex-direction: column; text-align: center; }
        }

        @media (max-width: 600px) {
          .hvac-hero h1 { font-size: 36px; }
          .hvac-why-grid { grid-template-columns: 1fr; }
          .hvac-hero-btns { flex-direction: column; align-items: center; }
          .hvac-btn-primary, .hvac-btn-secondary { width: 100%; max-width: 320px; text-align: center; }
        }
      `}</style>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="hvac-nav">
        <div className="hvac-nav-logo">Comfort Zone Heating &amp; Cooling</div>
        <button className="hvac-hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? "\u2715" : "\u2630"}
        </button>
        <div className={`hvac-nav-right${menuOpen ? " open" : ""}`}>
          <span className="hvac-nav-phone">(248) 555-0193</span>
          <button className="hvac-nav-cta">Schedule Service</button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="hvac-hero" style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)", width: 800, height: 800, borderRadius: "50%", background: `radial-gradient(circle, rgba(43,165,165,0.18) 0%, transparent 65%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-block", padding: "6px 18px", borderRadius: 20, background: `rgba(43,165,165,0.12)`, color: TEAL, fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 24 }}>
            NATE Certified &bull; 24/7 Emergency &bull; Financing Available
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 76, lineHeight: 1, maxWidth: 800, margin: "0 auto 12px", letterSpacing: 2, color: "#fff" }}>
            Your Comfort Is
          </h1>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 76, lineHeight: 1, maxWidth: 800, margin: "0 auto 28px", letterSpacing: 2, color: TEAL }}>
            Non-Negotiable
          </h1>
          <p style={{ fontSize: 18, color: "rgba(232,234,240,0.65)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Heating, cooling, and air quality for Troy and Oakland County. From routine tune-ups to emergency repairs at 2am, we keep your family comfortable.
          </p>
          <div className="hvac-hero-btns" style={{ marginBottom: 56 }}>
            <button className="hvac-btn-primary">Schedule Service</button>
            <button className="hvac-btn-secondary">Call (248) 555-0193</button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
            {[
              { num: "12,000+", label: "Systems Serviced" },
              { num: "20+", label: "Years Experience" },
              { num: "4.9", label: "Google Rating" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: TEAL, lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 13, color: "rgba(232,234,240,0.5)", marginTop: 4, letterSpacing: 0.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="hvac-divider" />

      {/* ── Services ───────────────────────────────────────────────────── */}
      <section className="hvac-section">
        <h2 className="hvac-section-title">Our Services</h2>
        <p className="hvac-section-sub">
          Full-service heating and cooling for residential and light commercial
          properties across Oakland County.
        </p>
        <div className="hvac-services-grid">
          {SERVICES.map((s, i) => (
            <div key={i} className="hvac-service-card">
              <div className="hvac-service-icon">{s.icon}</div>
              <div className="hvac-service-title">{s.title}</div>
              <div className="hvac-service-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="hvac-divider" />

      {/* ── Why Choose Us ──────────────────────────────────────────────── */}
      <section className="hvac-section">
        <h2 className="hvac-section-title">Why Choose Comfort Zone</h2>
        <p className="hvac-section-sub">
          Locally owned and operated since 2009. We treat every home like our own.
        </p>
        <div className="hvac-why-grid">
          {WHY_US.map((w, i) => (
            <div key={i} className="hvac-why-card">
              <div className="hvac-why-title">{w.title}</div>
              <div className="hvac-why-desc">{w.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="hvac-divider" />

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      <section className="hvac-section">
        <h2 className="hvac-section-title">What Our Customers Say</h2>
        <p className="hvac-section-sub">
          Real reviews from real homeowners in the Troy and Rochester Hills area.
        </p>
        <div className="hvac-testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="hvac-testimonial-card">
              <Stars count={t.stars} />
              <div className="hvac-testimonial-text" style={{ marginTop: 16 }}>
                &ldquo;{t.text}&rdquo;
              </div>
              <div className="hvac-testimonial-name">{t.name}</div>
              <div className="hvac-testimonial-loc">{t.location}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="hvac-divider" />

      {/* ── Service Area ───────────────────────────────────────────────── */}
      <section className="hvac-section">
        <h2 className="hvac-section-title">Service Area</h2>
        <p className="hvac-section-sub">
          Proudly serving homeowners and businesses across Southeast Michigan.
        </p>
        <div className="hvac-areas">
          {SERVICE_AREAS.map((a, i) => (
            <div key={i} className="hvac-area-tag">{a}</div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────────── */}
      <section className="hvac-cta-section">
        <h2>Don&apos;t Sweat It &mdash; We&apos;ve Got You Covered</h2>
        <p>Call now for a free estimate or schedule your service online.</p>
        <div className="hvac-cta-phone">(248) 555-0193</div>
        <button className="hvac-btn-primary">Schedule Service Today</button>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer>
        <div className="hvac-divider" />
        <div className="hvac-footer">
          <div className="hvac-footer-left">
            <div style={{ color: TEXT, fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, marginBottom: 8, letterSpacing: 1 }}>
              Comfort Zone Heating &amp; Cooling
            </div>
            <div>1847 E. Big Beaver Rd, Troy, MI 48083</div>
            <div>(248) 555-0193</div>
            <div style={{ marginTop: 8 }}>&copy; {new Date().getFullYear()} Comfort Zone Heating &amp; Cooling. All rights reserved.</div>
          </div>
          <div className="hvac-footer-badge">Licensed &amp; Insured</div>
        </div>
      </footer>
      <TradeChatWidget trade="hvac" accentColor={TEAL} />
    </>
  );
}
