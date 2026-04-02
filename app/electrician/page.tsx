"use client";

import TradeChatWidget from "../components/TradeChatWidget";
import { ScrambleText, FadeIn, AnimatedCounter, FloatingOrbs, HeroBackground } from "../components/TradeHeroEffects";

const AMBER = "#D4A02B";

export default function ElectricianDemo() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e8eaf0" }}>
      <style>{`
        @media (max-width: 768px) {
          .elec-nav-inner { flex-direction: column; gap: 12px; text-align: center; }
          .elec-hero h1 { font-size: 44px !important; }
          .elec-hero-buttons { flex-direction: column; }
          .elec-services-grid { grid-template-columns: 1fr !important; }
          .elec-why-grid { grid-template-columns: 1fr !important; }
          .elec-testimonials-grid { grid-template-columns: 1fr !important; }
          .elec-cities-grid { grid-template-columns: 1fr 1fr !important; }
          .elec-footer-inner { flex-direction: column; gap: 24px; text-align: center; }
          .elec-section { padding: 48px 16px !important; }
          .elec-hero { padding: 80px 16px 48px !important; }
        }
        @media (max-width: 480px) {
          .elec-hero h1 { font-size: 34px !important; }
          .elec-cities-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(212,160,43,0.15)",
      }}>
        <div className="elec-nav-inner" style={{
          maxWidth: 1100, margin: "0 auto", padding: "16px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 26,
            letterSpacing: 2, color: "#D4A02B",
          }}>
            Volt Electric Services
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <a href="tel:2485550361" style={{
              color: "#e8eaf0", textDecoration: "none", fontSize: 15, fontWeight: 500,
            }}>
              (248) 555-0361
            </a>
            <a href="#estimate" style={{
              background: "#D4A02B", color: "#0a0a0a", padding: "10px 22px",
              borderRadius: 6, fontSize: 14, fontWeight: 700, textDecoration: "none",
              letterSpacing: 0.5,
            }}>
              Get an Estimate
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="elec-hero" style={{
        position: "relative", padding: "140px 24px 110px", textAlign: "center", overflow: "hidden",
      }}>
        <HeroBackground imageUrl="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1920&q=80" overlayOpacity={0.84} />
        <FloatingOrbs color="#D4A02B" />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 850, margin: "0 auto" }}>
          <FadeIn delay={100}>
            <div style={{
              display: "inline-block", background: "rgba(212,160,43,0.15)",
              border: "1px solid rgba(212,160,43,0.25)", borderRadius: 20,
              padding: "6px 18px", fontSize: 13, fontWeight: 600, color: "#D4A02B",
              marginBottom: 28, letterSpacing: 0.5,
            }}>
              Master Licensed &bull; Same-Day Service &bull; Code Compliant
            </div>
          </FadeIn>
          <FadeIn delay={300}>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 82,
              lineHeight: 0.95, letterSpacing: 4, margin: "0 0 8px",
            }}>
              <ScrambleText text="DON'T TRUST YOUR WIRING" delay={400} />
            </h1>
          </FadeIn>
          <FadeIn delay={500}>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 82,
              lineHeight: 0.95, letterSpacing: 4, margin: "0 0 32px", color: "#D4A02B",
            }}>
              <ScrambleText text="TO JUST ANYONE." delay={700} />
            </h1>
          </FadeIn>
          <FadeIn delay={900}>
            <p style={{
              fontSize: 18, color: "#b0b4c8", lineHeight: 1.7, maxWidth: 560,
              margin: "0 auto 44px",
            }}>
              Residential and commercial electrical services from master licensed electricians. EV chargers, panel upgrades, whole-home rewiring, and same-day emergency service.
            </p>
          </FadeIn>
          <FadeIn delay={1100}>
            <div className="elec-hero-buttons" style={{
              display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 64,
            }}>
              <a href="#estimate" style={{
                background: "#D4A02B", color: "#0a0a0a", padding: "16px 36px",
                borderRadius: 8, fontSize: 16, fontWeight: 700, textDecoration: "none",
                letterSpacing: 0.5,
              }}>
                Get Free Estimate
              </a>
              <a href="tel:2485550361" style={{
                background: "transparent", color: "#e8eaf0",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "16px 36px", borderRadius: 8, fontSize: 16,
                fontWeight: 600, textDecoration: "none",
              }}>
                Call (248) 555-0361
              </a>
            </div>
          </FadeIn>
          <FadeIn delay={1400}>
            <div style={{ display: "flex", justifyContent: "center", gap: 56, flexWrap: "wrap" }}>
              {[
                { num: "5,000+", label: "Jobs Completed" },
                { num: "22", label: "Years Experience" },
                { num: "4.9", label: "Google Rating" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 46, color: "#D4A02B", lineHeight: 1 }}>
                    <AnimatedCounter target={s.num} delay={1600} />
                  </div>
                  <div style={{ fontSize: 12, color: "#b0b4c8", marginTop: 6, letterSpacing: 1, textTransform: "uppercase" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Services ─────────────────────────────────────────────── */}
      <section className="elec-section" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 42,
            textAlign: "center", marginBottom: 12, letterSpacing: 1,
          }}>
            Our <span style={{ color: "#D4A02B" }}>Services</span>
          </h2>
          <p style={{
            textAlign: "center", color: "#b0b4c8", fontSize: 16, marginBottom: 48,
            maxWidth: 500, marginLeft: "auto", marginRight: "auto",
          }}>
            From simple repairs to full-scale installations, we handle it all.
          </p>
          <div className="elec-services-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20,
          }}>
            {[
              { icon: "\u26A1", title: "Panel Upgrades", desc: "Upgrade your electrical panel to handle modern power demands safely. 100A to 200A+ conversions." },
              { icon: "\uD83D\uDD0C", title: "Outlet & Wiring", desc: "New outlets, rewiring, dedicated circuits, and GFCI installation for kitchens, bathrooms, and garages." },
              { icon: "\uD83D\uDD0B", title: "EV Charger Install", desc: "Level 2 home charging stations for Tesla, Ford, Chevy, and all major EV brands. Same-week install." },
              { icon: "\uD83D\uDCA1", title: "Lighting Design", desc: "Recessed lighting, under-cabinet LEDs, landscape lighting, and smart home integration." },
              { icon: "\uD83C\uDFE0", title: "Generator Install", desc: "Whole-home standby generators with automatic transfer switches. Never lose power again." },
              { icon: "\uD83D\uDD0D", title: "Electrical Inspections", desc: "Pre-sale, insurance, and code compliance inspections. Detailed reports within 24 hours." },
            ].map((s, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: 28,
                transition: "border-color 0.2s",
              }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{s.icon}</div>
                <h3 style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
                  letterSpacing: 1, marginBottom: 10, color: "#e8eaf0",
                }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 14, color: "#8a8ea0", lineHeight: 1.7, margin: 0 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ────────────────────────────────────────── */}
      <section className="elec-section" style={{
        padding: "80px 24px",
        background: "linear-gradient(180deg, rgba(212,160,43,0.04) 0%, transparent 100%)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 42,
            textAlign: "center", marginBottom: 48, letterSpacing: 1,
          }}>
            Why Choose <span style={{ color: "#D4A02B" }}>Volt Electric</span>
          </h2>
          <div className="elec-why-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20,
          }}>
            {[
              { num: "01", title: "Master Licensed", desc: "State-licensed master electricians on every job. No subcontractors, no shortcuts." },
              { num: "02", title: "Upfront Pricing", desc: "Flat-rate quotes before we start. No surprise charges, no hourly billing games." },
              { num: "03", title: "Same-Day Service", desc: "Emergency calls answered 24/7. Most non-emergency jobs scheduled within 48 hours." },
              { num: "04", title: "Code Compliant", desc: "Every job meets or exceeds NEC standards. We pull permits and schedule inspections." },
            ].map((c, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: 28, textAlign: "center",
              }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 38,
                  color: "#D4A02B", marginBottom: 12, opacity: 0.6,
                }}>
                  {c.num}
                </div>
                <h3 style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
                  letterSpacing: 1, marginBottom: 10, color: "#e8eaf0",
                }}>
                  {c.title}
                </h3>
                <p style={{ fontSize: 14, color: "#8a8ea0", lineHeight: 1.7, margin: 0 }}>
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────── */}
      <section className="elec-section" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 42,
            textAlign: "center", marginBottom: 48, letterSpacing: 1,
          }}>
            What Our <span style={{ color: "#D4A02B" }}>Customers Say</span>
          </h2>
          <div className="elec-testimonials-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20,
          }}>
            {[
              {
                name: "Jennifer M.", location: "Rochester Hills, MI",
                stars: 5,
                text: "Had our entire panel upgraded from 100A to 200A. The crew was professional, clean, and finished in one day. Price was exactly what they quoted. Will use Volt for everything going forward.",
              },
              {
                name: "David K.", location: "Troy, MI",
                stars: 5,
                text: "Called at 7am about a dead outlet in our kitchen. They were at our door by 10am, found a bad breaker, and had it fixed within an hour. Incredible turnaround for a fair price.",
              },
              {
                name: "Sarah & Tom R.", location: "Sterling Heights, MI",
                stars: 5,
                text: "Volt installed our Tesla Wall Connector and added a dedicated 60A circuit. They handled the permit, the inspection, everything. Charging at home now feels like a luxury.",
              },
            ].map((t, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: 28,
              }}>
                <div style={{ color: "#D4A02B", fontSize: 18, marginBottom: 14, letterSpacing: 2 }}>
                  {"★".repeat(t.stars)}
                </div>
                <p style={{
                  fontSize: 15, color: "#c0c4d8", lineHeight: 1.75,
                  margin: "0 0 20px", fontStyle: "italic",
                }}>
                  &ldquo;{t.text}&rdquo;
                </p>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#e8eaf0" }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#6a6e80" }}>
                    {t.location}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Service Area ─────────────────────────────────────────── */}
      <section className="elec-section" style={{
        padding: "80px 24px",
        background: "linear-gradient(180deg, rgba(212,160,43,0.04) 0%, transparent 100%)",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 42,
            marginBottom: 16, letterSpacing: 1,
          }}>
            Serving <span style={{ color: "#D4A02B" }}>Oakland County</span> & Beyond
          </h2>
          <p style={{
            color: "#b0b4c8", fontSize: 16, marginBottom: 40, lineHeight: 1.7,
          }}>
            Proudly serving residential and commercial customers across southeast Michigan.
          </p>
          <div className="elec-cities-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
            maxWidth: 550, margin: "0 auto",
          }}>
            {[
              "Rochester Hills", "Troy", "Warren",
              "Sterling Heights", "Auburn Hills", "Oakland County",
            ].map((city, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "14px 16px", fontSize: 15, fontWeight: 500,
              }}>
                {city}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────────────── */}
      <section id="estimate" className="elec-section" style={{
        padding: "80px 24px", textAlign: "center",
        background: "radial-gradient(ellipse at 50% 50%, rgba(212,160,43,0.1) 0%, transparent 70%)",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 48,
            lineHeight: 1.1, marginBottom: 16, letterSpacing: 1,
          }}>
            Power Your Home<br />
            <span style={{ color: "#D4A02B" }}>With Confidence</span>
          </h2>
          <p style={{
            color: "#b0b4c8", fontSize: 17, marginBottom: 36, lineHeight: 1.7,
          }}>
            Call us today or request a free estimate online. Most jobs quoted
            within 24 hours.
          </p>
          <div style={{
            display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap",
          }}>
            <a href="tel:2485550361" style={{
              background: "#D4A02B", color: "#0a0a0a", padding: "18px 40px",
              borderRadius: 8, fontSize: 18, fontWeight: 700, textDecoration: "none",
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
            }}>
              (248) 555-0361
            </a>
            <a href="#estimate" style={{
              background: "transparent", color: "#e8eaf0",
              border: "1px solid rgba(255,255,255,0.2)",
              padding: "18px 40px", borderRadius: 8, fontSize: 16,
              fontWeight: 600, textDecoration: "none",
            }}>
              Request Free Estimate
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "40px 24px",
      }}>
        <div className="elec-footer-inner" style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
              letterSpacing: 2, color: "#D4A02B", marginBottom: 6,
            }}>
              Volt Electric Services
            </div>
            <div style={{ fontSize: 14, color: "#6a6e80", lineHeight: 1.8 }}>
              1847 Adams Rd, Rochester Hills, MI 48309<br />
              (248) 555-0361
            </div>
          </div>
          <div style={{
            background: "rgba(212,160,43,0.1)",
            border: "1px solid rgba(212,160,43,0.25)",
            borderRadius: 8, padding: "12px 20px", textAlign: "center",
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 16,
              letterSpacing: 1, color: "#D4A02B", marginBottom: 2,
            }}>
              Licensed & Insured
            </div>
            <div style={{ fontSize: 12, color: "#6a6e80" }}>
              MI License #6201-048271
            </div>
          </div>
        </div>
        <div style={{
          maxWidth: 1100, margin: "24px auto 0", paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.04)",
          textAlign: "center", fontSize: 13, color: "#4a4e60",
        }}>
          &copy; 2026 Volt Electric Services. All rights reserved.
        </div>
      </footer>
      <TradeChatWidget trade="electrician" accentColor={AMBER} />
    </div>
  );
}
