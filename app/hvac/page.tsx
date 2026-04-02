"use client";

import { useState, useEffect, useRef } from "react";
import TradeChatWidget from "../components/TradeChatWidget";
import { ScrollReveal } from "../components/TradeHeroEffects";

const TEAL = "#2BA5A5";
const BG = "#0a0a0a";
const TEXT = "#e8eaf0";
const TEXT_MUTED = "#9ca3af";

const SERVICES = [
  {
    title: "AC Repair & Install",
    desc: "From emergency breakdowns on the hottest day to full system upgrades, we keep your home cool and comfortable all summer.",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80",
  },
  {
    title: "Furnace Repair & Install",
    desc: "High-efficiency furnace installation, repair, and maintenance. We service all major brands and ensure your family stays warm through Michigan winters.",
    image: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80",
  },
  {
    title: "Maintenance Plans",
    desc: "Preventive maintenance that catches problems before they become emergencies. Twice-yearly tune-ups keep your system running at peak efficiency.",
    image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80",
  },
];

const REASONS = [
  { num: "01", title: "NATE Certified", desc: "Our technicians hold NATE certifications, the gold standard in HVAC training and expertise." },
  { num: "02", title: "24/7 Emergency", desc: "Furnace quit at 2am? AC died on the hottest day? We answer the phone and show up fast." },
  { num: "03", title: "Financing Available", desc: "Don't let cost stop you from staying comfortable. Flexible financing on new systems." },
  { num: "04", title: "Guaranteed Work", desc: "We stand behind every job. If you're not happy, we make it right, no questions asked." },
];

const TESTIMONIALS = [
  { name: "Jennifer M.", location: "Troy, MI", text: "Our AC went out in the middle of July and they had a tech here within two hours. Professional, fair pricing, and our house was cool again by dinner." },
  { name: "David & Lisa K.", location: "Rochester Hills, MI", text: "We've used Comfort Zone for our furnace maintenance for three years now. Always on time, always thorough. They caught a cracked heat exchanger last fall." },
  { name: "Robert T.", location: "Sterling Heights, MI", text: "Got quotes from four companies for a new HVAC system. Comfort Zone was the most honest and competitively priced. Install crew was clean and fast." },
];

export default function HvacPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        .cz-page a { color: inherit; text-decoration: none; }

        .cz-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: rgba(10, 10, 10, 0.97);
          backdrop-filter: blur(16px);
          box-shadow: 0 1px 0 rgba(255,255,255,0.05);
        }
        .cz-nav--scrolled {
          background: rgba(10, 10, 10, 0.97) !important;
        }

        .cz-btn {
          display: inline-block;
          padding: 14px 34px;
          background: ${TEAL};
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
        }
        .cz-btn:hover {
          background: #238f8f;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(43, 165, 165, 0.3);
        }

        .cz-btn-outline {
          display: inline-block;
          padding: 14px 34px;
          background: transparent;
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          border: 1px solid rgba(255,255,255,0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
        }
        .cz-btn-outline:hover {
          border-color: #fff;
          background: rgba(255,255,255,0.05);
          transform: translateY(-2px);
        }

        .cz-link-arrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: ${TEAL};
          cursor: pointer;
          transition: gap 0.3s ease;
          background: none;
          border: none;
          text-decoration: none;
        }
        .cz-link-arrow:hover { gap: 14px; }
        .cz-link-arrow::after {
          content: '\\2192';
          transition: transform 0.3s ease;
        }

        .cz-service-img {
          transition: transform 0.6s ease, filter 0.6s ease;
        }
        .cz-service-img:hover {
          transform: scale(1.03);
          filter: brightness(1.1);
        }

        .cz-nav-link {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: rgba(232, 234, 240, 0.7);
          text-decoration: none;
          transition: color 0.3s;
          cursor: pointer;
          background: none;
          border: none;
        }
        .cz-nav-link:hover { color: #fff; }

        @keyframes cz-hero-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        @keyframes cz-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        .cz-scroll-indicator {
          animation: cz-bounce 2s ease-in-out infinite;
        }

        @keyframes cz-fade-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cz-hero-content {
          animation: cz-fade-up 1s ease-out 0.3s both;
        }

        .cz-mobile-menu { display: none; }
        .cz-hamburger { display: none; }

        @media (max-width: 900px) {
          .cz-nav-desktop { display: none !important; }
          .cz-hamburger { display: flex !important; }
          .cz-mobile-menu--open { display: flex !important; }
          .cz-service-row { flex-direction: column !important; }
          .cz-service-row--reverse { flex-direction: column !important; }
          .cz-service-image-wrap { width: 100% !important; min-height: 300px !important; }
          .cz-service-text-wrap { width: 100% !important; padding: 48px 24px !important; }
          .cz-stats-bar { flex-wrap: wrap; }
          .cz-stats-bar > div { width: 50%; }
          .cz-reasons-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .cz-testimonials-grid { grid-template-columns: 1fr !important; }
          .cz-footer-grid { grid-template-columns: 1fr !important; text-align: center; }
          .cz-hero-title { font-size: 56px !important; }
          .cz-hero-sub-title { font-size: 56px !important; }
        }

        @media (max-width: 600px) {
          .cz-hero-title { font-size: 42px !important; }
          .cz-hero-sub-title { font-size: 42px !important; }
          .cz-section-title { font-size: 36px !important; }
          .cz-reasons-grid { grid-template-columns: 1fr !important; }
          .cz-stats-bar > div { width: 100%; }
          .cz-reason-num { font-size: 48px !important; }
        }
      `}</style>

      <div className="cz-page" style={{ background: BG, color: TEXT, fontFamily: "'Inter', sans-serif", minHeight: "100vh", overflowX: "hidden" }}>

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav
          ref={navRef}
          className={`cz-nav${scrolled ? " cz-nav--scrolled" : ""}`}
          style={{}}
        >
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 48px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 80 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: "#fff" }}>
              COMFORT ZONE <span style={{ color: TEAL }}>HVAC</span>
            </div>

            <div className="cz-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 40 }}>
              <a href="#services" className="cz-nav-link">Services</a>
              <a href="#about" className="cz-nav-link">About</a>
              <a href="#contact" className="cz-nav-link">Contact</a>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
              <a href="tel:2485550193" className="cz-nav-link" style={{ color: "rgba(232,234,240,0.9)" }}>(248) 555-0193</a>
              <a href="#contact" className="cz-btn" style={{ padding: "12px 28px", fontSize: 12 }}>Get a Quote</a>
            </div>

            <button
              className="cz-hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ display: "none", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", padding: 8 }}
            >
              {menuOpen ? "\u2715" : "\u2630"}
            </button>
          </div>

          <div
            className={`cz-mobile-menu${menuOpen ? " cz-mobile-menu--open" : ""}`}
            style={{
              flexDirection: "column",
              gap: 0,
              background: "rgba(10,10,10,0.98)",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {["Services", "About", "Contact"].map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "block",
                  padding: "18px 48px",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: 1.5,
                  textTransform: "uppercase" as const,
                  color: "rgba(232,234,240,0.8)",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  textDecoration: "none",
                }}
              >
                {link}
              </a>
            ))}
            <div style={{ padding: "20px 48px", display: "flex", flexDirection: "column", gap: 12 }}>
              <a href="tel:2485550193" style={{ color: TEXT, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>(248) 555-0193</a>
              <a href="#contact" className="cz-btn" style={{ textAlign: "center", padding: "14px 28px" }} onClick={() => setMenuOpen(false)}>Get a Quote</a>
            </div>
          </div>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section style={{
          position: "relative",
          height: "100vh",
          minHeight: 700,
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute",
            inset: "-5%",
            backgroundImage: "url('/hvac-hero.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: "cz-hero-zoom 20s ease-in-out alternate infinite",
          }} />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
          }} />

          <div className="cz-hero-content" style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 1280,
            width: "100%",
            margin: "0 auto",
            padding: "0 48px 100px",
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 3,
              textTransform: "uppercase" as const,
              color: TEAL,
              marginBottom: 24,
            }}>
              Troy, Michigan -- NATE Certified
            </div>
            <h1 className="cz-hero-title" style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 88,
              letterSpacing: 4,
              lineHeight: 0.95,
              margin: 0,
              color: "#fff",
            }}>
              YOUR COMFORT.
            </h1>
            <h1 className="cz-hero-sub-title" style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 88,
              letterSpacing: 4,
              lineHeight: 0.95,
              margin: "0 0 32px",
              color: TEAL,
            }}>
              NON-NEGOTIABLE.
            </h1>
            <p style={{
              fontSize: 18,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 520,
              margin: "0 0 40px",
            }}>
              AC repair. Furnace installs. Maintenance plans. Fast response, honest pricing, guaranteed work.
            </p>
            <a href="#contact" className="cz-btn" style={{ fontSize: 14, padding: "18px 44px" }}>
              Schedule Service
            </a>
          </div>

          <div className="cz-scroll-indicator" style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}>
            <div style={{
              width: 1,
              height: 40,
              background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.4))",
            }} />
            <div style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase" as const,
              color: "rgba(255,255,255,0.4)",
            }}>
              Scroll
            </div>
          </div>
        </section>

        {/* ── Stats Bar ────────────────────────────────────────── */}
        <section style={{ background: "#0d0d0d", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="cz-stats-bar" style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {[
              { value: "12,000+", label: "Systems Serviced" },
              { value: "20+", label: "Years Experience" },
              { value: "4.9", label: "Google Rating" },
              { value: "NATE", label: "Certified Techs" },
            ].map((stat, i) => (
              <div key={stat.label} style={{
                flex: 1,
                textAlign: "center",
                padding: "36px 24px",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 36,
                  letterSpacing: 2,
                  color: TEAL,
                  lineHeight: 1,
                  marginBottom: 6,
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 2,
                  textTransform: "uppercase" as const,
                  color: TEXT_MUTED,
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Services ────────────────────────────────────────── */}
        <section id="services" style={{ paddingTop: 120, paddingBottom: 120 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 48px" }}>
            <ScrollReveal>
              <div style={{ marginBottom: 80 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 3,
                  textTransform: "uppercase" as const,
                  color: TEAL,
                  marginBottom: 16,
                }}>
                  What We Do
                </div>
                <h2 className="cz-section-title" style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 56,
                  letterSpacing: 3,
                  margin: 0,
                  lineHeight: 1,
                }}>
                  Our Services
                </h2>
              </div>
            </ScrollReveal>

            {SERVICES.map((service, i) => {
              const isReversed = i % 2 !== 0;
              return (
                <ScrollReveal key={service.title} delay={i * 100}>
                  <div
                    className={`cz-service-row${isReversed ? " cz-service-row--reverse" : ""}`}
                    style={{
                      display: "flex",
                      flexDirection: isReversed ? "row-reverse" : "row",
                      marginBottom: i < SERVICES.length - 1 ? 2 : 0,
                      background: "#111",
                    }}
                  >
                    <div
                      className="cz-service-image-wrap"
                      style={{
                        width: "50%",
                        minHeight: 420,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        className="cz-service-img"
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundImage: `url('${service.image}')`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    </div>
                    <div
                      className="cz-service-text-wrap"
                      style={{
                        width: "50%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: "64px 72px",
                      }}
                    >
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: 3,
                        textTransform: "uppercase" as const,
                        color: TEAL,
                        marginBottom: 16,
                      }}>
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <h3 style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: 42,
                        letterSpacing: 2,
                        margin: "0 0 20px",
                        lineHeight: 1,
                        color: "#fff",
                      }}>
                        {service.title}
                      </h3>
                      <p style={{
                        fontSize: 16,
                        lineHeight: 1.8,
                        color: TEXT_MUTED,
                        margin: "0 0 32px",
                        maxWidth: 440,
                      }}>
                        {service.desc}
                      </p>
                      <a href="#contact" className="cz-link-arrow">Learn More</a>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        {/* ── Why Choose Us ───────────────────────────────────── */}
        <section id="about" style={{
          background: "#0d0d0d",
          padding: "120px 0",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 48px" }}>
            <ScrollReveal>
              <div style={{ marginBottom: 80, maxWidth: 600 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 3,
                  textTransform: "uppercase" as const,
                  color: TEAL,
                  marginBottom: 16,
                }}>
                  The Difference
                </div>
                <h2 className="cz-section-title" style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 56,
                  letterSpacing: 3,
                  margin: 0,
                  lineHeight: 1,
                }}>
                  Why Comfort Zone
                </h2>
              </div>
            </ScrollReveal>

            <div className="cz-reasons-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 48,
            }}>
              {REASONS.map((reason, i) => (
                <ScrollReveal key={reason.title} delay={i * 120}>
                  <div>
                    <div className="cz-reason-num" style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 72,
                      letterSpacing: 2,
                      color: TEAL,
                      lineHeight: 1,
                      marginBottom: 16,
                      opacity: 0.9,
                    }}>
                      {reason.num}
                    </div>
                    <h3 style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 24,
                      letterSpacing: 1,
                      margin: "0 0 12px",
                      color: "#fff",
                      lineHeight: 1.2,
                    }}>
                      {reason.title}
                    </h3>
                    <p style={{
                      fontSize: 15,
                      lineHeight: 1.8,
                      color: TEXT_MUTED,
                      margin: 0,
                    }}>
                      {reason.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ────────────────────────────────────── */}
        <section style={{ padding: "120px 0" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 48px" }}>
            <ScrollReveal>
              <div style={{ marginBottom: 80 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 3,
                  textTransform: "uppercase" as const,
                  color: TEAL,
                  marginBottom: 16,
                }}>
                  Testimonials
                </div>
                <h2 className="cz-section-title" style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 56,
                  letterSpacing: 3,
                  margin: 0,
                  lineHeight: 1,
                }}>
                  What Our Clients Say
                </h2>
              </div>
            </ScrollReveal>

            <div className="cz-testimonials-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 32,
            }}>
              {TESTIMONIALS.map((t, i) => (
                <ScrollReveal key={t.name} delay={i * 120}>
                  <div style={{
                    padding: "48px 40px",
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.06)",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}>
                    <div style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 72,
                      lineHeight: 0.6,
                      color: TEAL,
                      opacity: 0.4,
                      marginBottom: 24,
                      userSelect: "none",
                    }}>
                      &ldquo;
                    </div>
                    <p style={{
                      fontSize: 16,
                      lineHeight: 1.8,
                      color: "rgba(232, 234, 240, 0.85)",
                      fontStyle: "italic",
                      margin: "0 0 32px",
                      flex: 1,
                    }}>
                      {t.text}
                    </p>
                    <div>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#fff",
                        marginBottom: 4,
                      }}>
                        {t.name}
                      </div>
                      <div style={{
                        fontSize: 13,
                        color: TEXT_MUTED,
                      }}>
                        {t.location}
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section id="contact" style={{
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/hvac-hero.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }} />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
          }} />

          <div style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 1280,
            margin: "0 auto",
            padding: "120px 48px",
            textAlign: "center",
          }}>
            <ScrollReveal>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 3,
                textTransform: "uppercase" as const,
                color: TEAL,
                marginBottom: 20,
              }}>
                Get Started
              </div>
              <h2 className="cz-section-title" style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 56,
                letterSpacing: 3,
                margin: "0 0 20px",
                lineHeight: 1,
                color: "#fff",
              }}>
                Don&apos;t Sweat It. We&apos;ve Got You.
              </h2>
              <p style={{
                fontSize: 18,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.55)",
                maxWidth: 520,
                margin: "0 auto 16px",
              }}>
                Give us a call or request a free quote. We respond to every inquiry within 15 minutes.
              </p>
              <a href="tel:2485550193" style={{
                display: "block",
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 42,
                letterSpacing: 3,
                color: "#fff",
                marginBottom: 40,
                textDecoration: "none",
              }}>
                (248) 555-0193
              </a>
              <a href="tel:2485550193" className="cz-btn" style={{ fontSize: 14, padding: "18px 52px" }}>
                Call Now
              </a>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "#0a0a0a",
        }}>
          <div style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "80px 48px 48px",
          }}>
            <div className="cz-footer-grid" style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: 64,
              marginBottom: 64,
            }}>
              <div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 24,
                  letterSpacing: 3,
                  color: "#fff",
                  marginBottom: 16,
                }}>
                  COMFORT ZONE <span style={{ color: TEAL }}>HVAC</span>
                </div>
                <p style={{
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: TEXT_MUTED,
                  maxWidth: 360,
                  margin: 0,
                }}>
                  Trusted residential and commercial heating and cooling services in Troy, Michigan and surrounding communities for over 20 years.
                </p>
              </div>

              <div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 2,
                  textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 24,
                }}>
                  Quick Links
                </div>
                {["Services", "About", "Contact"].map((link) => (
                  <a
                    key={link}
                    href={`#${link.toLowerCase()}`}
                    style={{
                      display: "block",
                      fontSize: 15,
                      color: TEXT_MUTED,
                      marginBottom: 14,
                      textDecoration: "none",
                      transition: "color 0.3s",
                    }}
                  >
                    {link}
                  </a>
                ))}
              </div>

              <div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 2,
                  textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 24,
                }}>
                  Contact
                </div>
                <p style={{ fontSize: 15, lineHeight: 2, color: TEXT_MUTED, margin: 0 }}>
                  1847 E. Big Beaver Rd<br />
                  Troy, MI 48083<br />
                  (248) 555-0193
                </p>
              </div>
            </div>

            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: 32,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                {new Date().getFullYear()} Comfort Zone Heating &amp; Cooling. All rights reserved.
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                Licensed &amp; Insured &mdash; NATE Certified
              </div>
            </div>
          </div>
        </footer>

        <TradeChatWidget trade="hvac" accentColor={TEAL} />
      </div>
    </>
  );
}