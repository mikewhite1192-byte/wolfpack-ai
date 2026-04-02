"use client";

import { useState, useEffect, useRef } from "react";
import TradeChatWidget from "../components/TradeChatWidget";
import { ScrollReveal } from "../components/TradeHeroEffects";

const ACCENT = "#C4412B";
const BG = "#0a0a0a";
const TEXT = "#e8eaf0";
const TEXT_MUTED = "#9ca3af";

const SERVICES = [
  {
    title: "Storm Damage Repair",
    desc: "When storms strike, we respond fast. Emergency tarping, full damage assessment, and insurance claim assistance from start to finish.",
    image: "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=800&q=80",
  },
  {
    title: "Roof Replacement",
    desc: "Complete tear-off and replacement with premium materials. We handle everything from permits to final inspection, leaving your home protected for decades.",
    image: "https://images.unsplash.com/photo-1635424710928-0544e8512eae?w=800&q=80",
  },
  {
    title: "Gutters & Exteriors",
    desc: "Seamless gutter installation, siding repair, and exterior maintenance. We protect every side of your home, not just the top.",
    image: "https://images.unsplash.com/photo-1597484661973-ee6cd0b6482c?w=800&q=80",
  },
];

const REASONS = [
  { num: "01", title: "Licensed & Insured", desc: "$2M liability coverage on every job. Your home is fully protected." },
  { num: "02", title: "Free Storm Inspections", desc: "We inspect your roof after any major storm at no charge, no obligation." },
  { num: "03", title: "Insurance Claim Help", desc: "We work directly with your insurance company and handle all the paperwork." },
  { num: "04", title: "10-Year Warranty", desc: "Our workmanship is guaranteed. If anything goes wrong, we make it right." },
];

const TESTIMONIALS = [
  { name: "Dave & Linda M.", location: "Sterling Heights, MI", text: "Summit replaced our entire roof in two days after the July storm. They handled the insurance claim from start to finish. Couldn't have been easier." },
  { name: "Rachel K.", location: "Troy, MI", text: "I got three quotes and Summit was the most thorough by far. They found hail damage I didn't even know about. Professional crew, great cleanup." },
  { name: "Tom P.", location: "Shelby Township, MI", text: "Called them on a Sunday after a tree branch punctured our roof. They had a tarp up within 2 hours. Replacement done that same week. Highly recommend." },
];

export default function RoofingPage() {
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

        .sr-page a { color: inherit; text-decoration: none; }

        .sr-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: rgba(10, 10, 10, 0.97);
          backdrop-filter: blur(16px);
          box-shadow: 0 1px 0 rgba(255,255,255,0.05);
        }
        .sr-nav--scrolled {
          background: rgba(10, 10, 10, 0.97) !important;
        }

        .sr-btn {
          display: inline-block;
          padding: 14px 34px;
          background: ${ACCENT};
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
        .sr-btn:hover {
          background: #a83723;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(196, 65, 43, 0.3);
        }

        .sr-btn-outline {
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
        .sr-btn-outline:hover {
          border-color: #fff;
          background: rgba(255,255,255,0.05);
          transform: translateY(-2px);
        }

        .sr-link-arrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: ${ACCENT};
          cursor: pointer;
          transition: gap 0.3s ease;
          background: none;
          border: none;
          text-decoration: none;
        }
        .sr-link-arrow:hover { gap: 14px; }
        .sr-link-arrow::after {
          content: '\\2192';
          transition: transform 0.3s ease;
        }

        .sr-service-img {
          transition: transform 0.6s ease, filter 0.6s ease;
        }
        .sr-service-img:hover {
          transform: scale(1.03);
          filter: brightness(1.1);
        }

        .sr-nav-link {
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
        .sr-nav-link:hover { color: #fff; }

        @keyframes sr-hero-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        @keyframes sr-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        .sr-scroll-indicator {
          animation: sr-bounce 2s ease-in-out infinite;
        }

        @keyframes sr-fade-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sr-hero-content {
          animation: sr-fade-up 1s ease-out 0.3s both;
        }

        .sr-mobile-menu { display: none; }
        .sr-hamburger { display: none; }

        @media (max-width: 900px) {
          .sr-nav-desktop { display: none !important; }
          .sr-hamburger { display: flex !important; }
          .sr-mobile-menu--open { display: flex !important; }
          .sr-service-row { flex-direction: column !important; }
          .sr-service-row--reverse { flex-direction: column !important; }
          .sr-service-image-wrap { width: 100% !important; min-height: 300px !important; }
          .sr-service-text-wrap { width: 100% !important; padding: 48px 24px !important; }
          .sr-stats-bar { flex-wrap: wrap; }
          .sr-stats-bar > div { width: 50%; }
          .sr-reasons-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .sr-testimonials-grid { grid-template-columns: 1fr !important; }
          .sr-footer-grid { grid-template-columns: 1fr !important; text-align: center; }
          .sr-hero-title { font-size: 56px !important; }
          .sr-hero-sub-title { font-size: 56px !important; }
        }

        @media (max-width: 600px) {
          .sr-hero-title { font-size: 42px !important; }
          .sr-hero-sub-title { font-size: 42px !important; }
          .sr-section-title { font-size: 36px !important; }
          .sr-reasons-grid { grid-template-columns: 1fr !important; }
          .sr-stats-bar > div { width: 100%; }
          .sr-reason-num { font-size: 48px !important; }
        }
      `}</style>

      <div className="sr-page" style={{ background: BG, color: TEXT, fontFamily: "'Inter', sans-serif", minHeight: "100vh", overflowX: "hidden" }}>

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav
          ref={navRef}
          className={`sr-nav${scrolled ? " sr-nav--scrolled" : ""}`}
          style={{}}
        >
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 48px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 80 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: "#fff" }}>
              SUMMIT <span style={{ color: ACCENT }}>ROOFING</span>
            </div>

            <div className="sr-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 40 }}>
              <a href="#services" className="sr-nav-link">Services</a>
              <a href="#about" className="sr-nav-link">About</a>
              <a href="#contact" className="sr-nav-link">Contact</a>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
              <a href="tel:5865550287" className="sr-nav-link" style={{ color: "rgba(232,234,240,0.9)" }}>(586) 555-0287</a>
              <a href="#contact" className="sr-btn" style={{ padding: "12px 28px", fontSize: 12 }}>Get a Quote</a>
            </div>

            <button
              className="sr-hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ display: "none", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", padding: 8 }}
            >
              {menuOpen ? "\u2715" : "\u2630"}
            </button>
          </div>

          <div
            className={`sr-mobile-menu${menuOpen ? " sr-mobile-menu--open" : ""}`}
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
              <a href="tel:5865550287" style={{ color: TEXT, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>(586) 555-0287</a>
              <a href="#contact" className="sr-btn" style={{ textAlign: "center", padding: "14px 28px" }} onClick={() => setMenuOpen(false)}>Get a Quote</a>
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
            backgroundImage: "url('/roofing-hero.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: "sr-hero-zoom 20s ease-in-out alternate infinite",
          }} />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
          }} />

          <div className="sr-hero-content" style={{
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
              color: ACCENT,
              marginBottom: 24,
            }}>
              Sterling Heights, Michigan -- Since 2009
            </div>
            <h1 className="sr-hero-title" style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 88,
              letterSpacing: 4,
              lineHeight: 0.95,
              margin: 0,
              color: "#fff",
            }}>
              YOUR ROOF.
            </h1>
            <h1 className="sr-hero-sub-title" style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 88,
              letterSpacing: 4,
              lineHeight: 0.95,
              margin: "0 0 32px",
              color: ACCENT,
            }}>
              OUR REPUTATION.
            </h1>
            <p style={{
              fontSize: 18,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 520,
              margin: "0 0 40px",
            }}>
              Storm damage repair. Full replacements. Free inspections. Fast response, insurance claim help, guaranteed work.
            </p>
            <a href="#contact" className="sr-btn" style={{ fontSize: 14, padding: "18px 44px" }}>
              Schedule Inspection
            </a>
          </div>

          <div className="sr-scroll-indicator" style={{
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
          <div className="sr-stats-bar" style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {[
              { value: "850+", label: "Roofs Completed" },
              { value: "17", label: "Years Experience" },
              { value: "4.8", label: "Google Rating" },
              { value: "Licensed", label: "& Insured" },
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
                  color: ACCENT,
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
                  color: ACCENT,
                  marginBottom: 16,
                }}>
                  What We Do
                </div>
                <h2 className="sr-section-title" style={{
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
                    className={`sr-service-row${isReversed ? " sr-service-row--reverse" : ""}`}
                    style={{
                      display: "flex",
                      flexDirection: isReversed ? "row-reverse" : "row",
                      marginBottom: i < SERVICES.length - 1 ? 2 : 0,
                      background: "#111",
                    }}
                  >
                    <div
                      className="sr-service-image-wrap"
                      style={{
                        width: "50%",
                        minHeight: 420,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        className="sr-service-img"
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
                      className="sr-service-text-wrap"
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
                        color: ACCENT,
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
                      <a href="#contact" className="sr-link-arrow">Learn More</a>
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
                  color: ACCENT,
                  marginBottom: 16,
                }}>
                  The Difference
                </div>
                <h2 className="sr-section-title" style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 56,
                  letterSpacing: 3,
                  margin: 0,
                  lineHeight: 1,
                }}>
                  Why Summit Roofing
                </h2>
              </div>
            </ScrollReveal>

            <div className="sr-reasons-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 48,
            }}>
              {REASONS.map((reason, i) => (
                <ScrollReveal key={reason.title} delay={i * 120}>
                  <div>
                    <div className="sr-reason-num" style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 72,
                      letterSpacing: 2,
                      color: ACCENT,
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
                  color: ACCENT,
                  marginBottom: 16,
                }}>
                  Testimonials
                </div>
                <h2 className="sr-section-title" style={{
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

            <div className="sr-testimonials-grid" style={{
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
                      color: ACCENT,
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
            backgroundImage: "url('/roofing-hero.png')",
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
                color: ACCENT,
                marginBottom: 20,
              }}>
                Get Started
              </div>
              <h2 className="sr-section-title" style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 56,
                letterSpacing: 3,
                margin: "0 0 20px",
                lineHeight: 1,
                color: "#fff",
              }}>
                Don&apos;t Wait for the Next Storm.
              </h2>
              <p style={{
                fontSize: 18,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.55)",
                maxWidth: 520,
                margin: "0 auto 16px",
              }}>
                Schedule your free inspection today. We respond to every inquiry within 15 minutes.
              </p>
              <a href="tel:5865550287" style={{
                display: "block",
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 42,
                letterSpacing: 3,
                color: "#fff",
                marginBottom: 40,
                textDecoration: "none",
              }}>
                (586) 555-0287
              </a>
              <a href="tel:5865550287" className="sr-btn" style={{ fontSize: 14, padding: "18px 52px" }}>
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
            <div className="sr-footer-grid" style={{
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
                  SUMMIT <span style={{ color: ACCENT }}>ROOFING</span>
                </div>
                <p style={{
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: TEXT_MUTED,
                  maxWidth: 360,
                  margin: 0,
                }}>
                  Trusted residential roofing and exterior services in Sterling Heights, Michigan and surrounding communities since 2009.
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
                  14280 Lakeside Circle<br />
                  Sterling Heights, MI 48313<br />
                  (586) 555-0287
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
                {new Date().getFullYear()} Summit Roofing &amp; Exteriors. All rights reserved.
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                Licensed &amp; Insured &mdash; State of Michigan
              </div>
            </div>
          </div>
        </footer>

        <TradeChatWidget trade="roofing" accentColor={ACCENT} />
      </div>
    </>
  );
}
