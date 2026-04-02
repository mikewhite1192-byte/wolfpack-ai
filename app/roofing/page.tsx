"use client";

import TradeChatWidget from "../components/TradeChatWidget";
import { ScrambleText, FadeIn, AnimatedCounter, FloatingOrbs, HeroBackground, ScrollReveal, GlowCard, TestimonialCarousel } from "../components/TradeHeroEffects";

const ACCENT = "#C4412B";
const BG = "#0a0a0a";
const TEXT = "#e8eaf0";
const MUTED = "#9ca3af";
const CARD_BG = "#131316";
const BORDER = "rgba(255,255,255,0.06)";

const SERVICES = [
  { icon: "🏠", title: "Roof Replacement", desc: "Complete tear-off and replacement with premium architectural shingles. GAF and Owens Corning certified." },
  { icon: "⛈️", title: "Storm Damage Repair", desc: "Fast response after hail, wind, or fallen tree damage. We document everything for your insurance claim." },
  { icon: "🔨", title: "Roof Inspections", desc: "Free 21-point roof inspection. We'll find problems early so a small repair doesn't become a full replacement." },
  { icon: "🏗️", title: "Gutter Installation", desc: "Seamless aluminum gutters and leaf guards to protect your foundation and keep water flowing away from your home." },
  { icon: "🛡️", title: "Siding & Exteriors", desc: "Vinyl, fiber cement, and engineered wood siding. Transform your home's curb appeal and weather protection." },
  { icon: "🚨", title: "Emergency Tarping", desc: "24/7 emergency tarping after storm damage. We'll secure your home fast to prevent further interior damage." },
];

const WHY_US = [
  { title: "Licensed & Insured", desc: "Fully licensed in Michigan with $2M liability coverage. Your home is protected." },
  { title: "Free Storm Inspections", desc: "We'll inspect your roof after any major storm — no charge, no obligation." },
  { title: "Insurance Claim Help", desc: "We work directly with your insurance company and handle all the paperwork." },
  { title: "10-Year Workmanship Warranty", desc: "Our work is guaranteed. If anything goes wrong, we'll make it right." },
];

const TESTIMONIALS = [
  { name: "Dave & Linda M.", location: "Sterling Heights", rating: 5, text: "Summit replaced our entire roof in two days after the July storm. They handled the insurance claim from start to finish. Couldn't have been easier." },
  { name: "Rachel K.", location: "Troy", rating: 5, text: "I got three quotes and Summit was the most thorough by far. They found hail damage I didn't even know about. Professional crew, great cleanup." },
  { name: "Tom P.", location: "Shelby Township", rating: 5, text: "Called them on a Sunday after a tree branch punctured our roof. They had a tarp up within 2 hours. Replacement done that same week. Highly recommend." },
];

const SERVICE_AREAS = ["Sterling Heights", "Warren", "Troy", "Rochester Hills", "Shelby Township", "Macomb County"];

export default function RoofingDemo() {
  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .roofing-page a { color: inherit; text-decoration: none; }
        .roofing-page h1, .roofing-page h2, .roofing-page h3 {
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 1px;
        }
        .roofing-page p, .roofing-page span, .roofing-page div {
          font-family: 'Inter', sans-serif;
        }
        .roofing-btn {
          display: inline-block;
          padding: 16px 32px;
          background: ${ACCENT};
          color: #fff;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          letter-spacing: 1.5px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
          text-align: center;
        }
        .roofing-btn:hover {
          background: #a83723;
          transform: translateY(-1px);
        }
        .roofing-btn-outline {
          display: inline-block;
          padding: 16px 32px;
          background: transparent;
          color: ${TEXT};
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          letter-spacing: 1.5px;
          border: 1.5px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          cursor: pointer;
          transition: border-color 0.2s, transform 0.2s;
          text-align: center;
        }
        .roofing-btn-outline:hover {
          border-color: ${ACCENT};
          transform: translateY(-1px);
        }
        .services-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .why-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        @media (max-width: 900px) {
          .services-grid { grid-template-columns: repeat(2, 1fr); }
          .why-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .services-grid { grid-template-columns: 1fr; }
          .why-grid { grid-template-columns: 1fr; }
          .hero-buttons { flex-direction: column; align-items: stretch; }
          .nav-inner { flex-direction: column; gap: 12px; text-align: center; }
        }
      `}</style>

      <div className="roofing-page" style={{ background: BG, color: TEXT, minHeight: "100vh" }}>

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 0" }}>
          <div className="nav-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: TEXT }}>
              Summit Roofing <span style={{ color: ACCENT }}>&</span> Exteriors
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <span style={{ color: MUTED, fontSize: 15 }}>(586) 555-0287</span>
              <span className="roofing-btn" style={{ padding: "10px 24px", fontSize: 15 }}>
                Free Inspection
              </span>
            </div>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section style={{ position: "relative", padding: "140px 24px 110px", textAlign: "center", overflow: "hidden" }}>
          <HeroBackground imageUrl="https://images.unsplash.com/photo-1632759145351-1d592919f522?w=1920&q=80" overlayOpacity={0.83} />
          <FloatingOrbs color={ACCENT} />
          <div style={{ position: "relative", zIndex: 2, maxWidth: 900, margin: "0 auto" }}>
            <FadeIn delay={100}>
              <div style={{ display: "inline-block", padding: "6px 18px", borderRadius: 20, background: "rgba(196,65,43,0.15)", border: "1px solid rgba(196,65,43,0.25)", color: ACCENT, fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 28 }}>
                Free Inspections &bull; Insurance Claims &bull; Licensed
              </div>
            </FadeIn>
            <FadeIn delay={300}>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 60, lineHeight: 1.1, marginBottom: 8, fontWeight: 800, letterSpacing: -1 }}>
                <ScrambleText text="YOUR ROOF TOOK THE HIT." delay={400} />
              </h1>
            </FadeIn>
            <FadeIn delay={500}>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 60, lineHeight: 1.1, marginBottom: 32, fontWeight: 800, letterSpacing: -1, color: ACCENT }}>
                <ScrambleText text="WE'LL MAKE IT RIGHT." delay={700} />
              </h1>
            </FadeIn>
            <FadeIn delay={900}>
              <p style={{ fontSize: 18, color: MUTED, lineHeight: 1.7, maxWidth: 580, margin: "0 auto 44px" }}>
                Storm damage repair, full replacements, and free inspections across Macomb County. We handle the insurance paperwork so you don&apos;t have to.
              </p>
            </FadeIn>
            <FadeIn delay={1100}>
              <div className="hero-buttons" style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 64 }}>
                <span className="roofing-btn" style={{ fontSize: 18, padding: "16px 40px" }}>Get Free Inspection</span>
                <span className="roofing-btn-outline" style={{ fontSize: 18, padding: "16px 40px" }}>Call (586) 555-0287</span>
              </div>
            </FadeIn>
            <FadeIn delay={1400}>
              <div style={{ display: "flex", justifyContent: "center", gap: 56, flexWrap: "wrap" }}>
                {[
                  { num: "850+", label: "Roofs Replaced" },
                  { num: "17", label: "Years Experience" },
                  { num: "4.8", label: "Google Rating" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 46, color: ACCENT, lineHeight: 1 }}>
                      <AnimatedCounter target={s.num} delay={1600} />
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 6, letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── Services ─────────────────────────────────────────── */}
        <section style={{ background: "#08090c", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, rgba(196,65,43,0.06) 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ padding: "80px 24px", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
            <ScrollReveal>
              <div style={{ textAlign: "center", marginBottom: 56 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>What We Do</div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 2, margin: "0 0 12px" }}>
                  Our Services
                </h2>
                <p style={{ color: MUTED, fontSize: 16 }}>
                  Full-service roofing and exterior solutions for residential homeowners.
                </p>
              </div>
            </ScrollReveal>
            <div className="services-grid">
              {SERVICES.map((s, i) => (
                <ScrollReveal key={s.title} delay={i * 100}>
                  <GlowCard color={ACCENT}>
                    <div style={{ fontSize: 40, marginBottom: 16 }}>{s.icon}</div>
                    <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, margin: "0 0 10px", color: TEXT }}>{s.title}</h3>
                    <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                  </GlowCard>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Choose Us ────────────────────────────────────── */}
        <section style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ padding: "80px 24px", maxWidth: 1200, margin: "0 auto" }}>
            <ScrollReveal>
              <div style={{ textAlign: "center", marginBottom: 56 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>The Difference</div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 2, margin: "0 0 12px" }}>
                  Why Choose <span style={{ color: ACCENT }}>Summit</span>
                </h2>
                <p style={{ color: MUTED, fontSize: 16 }}>What sets us apart from every other roofer in Macomb County</p>
              </div>
            </ScrollReveal>
            <div className="why-grid">
              {WHY_US.map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 120}>
                  <GlowCard color={ACCENT} style={{ textAlign: "center" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT}25, ${ACCENT}08)`, border: `1px solid ${ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: ACCENT }}>{String(i + 1).padStart(2, "0")}</div>
                    </div>
                    <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 21, letterSpacing: 1, margin: "0 0 10px", color: TEXT }}>{item.title}</h3>
                    <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
                  </GlowCard>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────────── */}
        <section style={{ background: "#08090c", overflow: "hidden" }}>
          <div style={{ padding: "80px 24px 80px", maxWidth: 1200, margin: "0 auto" }}>
            <ScrollReveal>
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>Reviews</div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 2, margin: "0 0 12px" }}>
                  What Homeowners Say
                </h2>
                <p style={{ color: MUTED, fontSize: 16 }}>Real reviews from homeowners across Macomb County</p>
              </div>
            </ScrollReveal>
          </div>
          <ScrollReveal>
            <TestimonialCarousel testimonials={TESTIMONIALS} color={ACCENT} />
          </ScrollReveal>
          <div style={{ height: 60 }} />
        </section>

        {/* ── Service Area ─────────────────────────────────────── */}
        <section style={{ position: "relative" }}>
          <div style={{ padding: "80px 24px", maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
            <ScrollReveal>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>Coverage</div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 2, margin: "0 0 12px" }}>
                Serving Macomb County & Beyond
              </h2>
              <p style={{ color: MUTED, fontSize: 16, marginBottom: 32 }}>
                Proud to serve homeowners across Southeast Michigan.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
                {SERVICE_AREAS.map((city) => (
                  <span key={city} style={{ padding: "12px 28px", borderRadius: 24, background: "rgba(196,65,43,0.08)", border: `1px solid rgba(196,65,43,0.2)`, color: ACCENT, fontSize: 15, fontWeight: 600, letterSpacing: 0.5, transition: "all 0.3s", cursor: "default" }}>
                    {city}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, rgba(196,65,43,0.15) 0%, rgba(196,65,43,0.03) 50%, rgba(196,65,43,0.10) 100%)` }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, rgba(196,65,43,0.12) 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ padding: "80px 24px", maxWidth: 1200, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
            <ScrollReveal>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, letterSpacing: 3, margin: "0 0 20px" }}>
                Don&apos;t Wait Until The Next <span style={{ color: ACCENT }}>Storm</span>
              </h2>
              <p style={{ color: MUTED, fontSize: 18, lineHeight: 1.7, maxWidth: 550, margin: "0 auto 40px" }}>
                Most roof damage goes unnoticed until it&apos;s too late. Schedule your free inspection today.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                <span className="roofing-btn" style={{ fontSize: 20, padding: "18px 44px" }}>
                  Schedule Free Inspection
                </span>
                <span className="roofing-btn-outline" style={{ fontSize: 20, padding: "18px 44px" }}>
                  Call (586) 555-0287
                </span>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────── */}
        <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, marginBottom: 16 }}>
            Summit Roofing <span style={{ color: ACCENT }}>&</span> Exteriors
          </div>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.8 }}>
            14280 Lakeside Circle, Sterling Heights, MI 48312<br />
            (586) 555-0287
          </p>
          <div style={{ marginTop: 16, display: "inline-block", padding: "8px 20px", border: `1px solid ${ACCENT}44`, borderRadius: 6, fontSize: 13, color: ACCENT, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5 }}>
            Licensed & Insured
          </div>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 32 }}>
            &copy; {new Date().getFullYear()} Summit Roofing & Exteriors. All rights reserved.
          </p>
        </footer>
        <TradeChatWidget trade="roofing" accentColor={ACCENT} />
      </div>
    </>
  );
}
