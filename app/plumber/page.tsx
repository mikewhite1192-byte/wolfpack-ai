"use client";

import { useState, useEffect, useRef } from "react";
import TradeChatWidget from "../components/TradeChatWidget";
import { ScrollReveal } from "../components/TradeHeroEffects";

const BLUE = "#2B7CD4";
const BG = "#0a0a0a";
const TEXT = "#e8eaf0";
const TEXT_MUTED = "#9ca3af";

const SERVICES = [
  {
    title: "Emergency Repairs",
    desc: "Burst pipes, flooding, and urgent plumbing crises handled around the clock. We arrive equipped and ready to stop the damage before it spreads. No overtime charges, no surprises.",
    image: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&q=80",
  },
  {
    title: "Bathroom Remodels",
    desc: "Complete bathroom plumbing rough-in and finish work. From custom showers and freestanding tubs to vanity installations, we handle every pipe and fixture so your renovation goes right the first time.",
    image: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80",
  },
  {
    title: "Water Heater Install",
    desc: "Tank and tankless water heater installation, repair, and replacement. We service all major brands and help you choose the right system for your home's demand and budget.",
    image: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80",
  },
];

const REASONS = [
  { num: "01", title: "Licensed & Insured", desc: "Fully licensed Michigan plumber with comprehensive liability and workers comp coverage on every job." },
  { num: "02", title: "24/7 Emergency", desc: "Plumbing emergencies don't wait. Neither do we. Call any time, day or night, and we'll be there." },
  { num: "03", title: "Free Estimates", desc: "Upfront pricing with no hidden fees. We give you an honest quote before any work begins." },
  { num: "04", title: "Guaranteed Work", desc: "If you're not happy with our work, we come back and make it right. That's our promise to every customer." },
];

const TESTIMONIALS = [
  { name: "Mike D.", location: "Warren, MI", text: "Called at 11pm with a burst pipe in the basement. They were here in 30 minutes and had it fixed before midnight. Saved us from serious water damage. Can't recommend them enough." },
  { name: "Sarah T.", location: "Sterling Heights, MI", text: "Had our entire bathroom remodeled. The crew was professional, clean, and finished on time. The tile work around the new shower is perfect. Best plumber we've ever used." },
  { name: "James R.", location: "Troy, MI", text: "Honest pricing and great work. They replaced our 15-year-old water heater and the quote was exactly what we paid. No surprises. Will be using Metro Plumbing for everything from now on." },
];

export default function PlumberPage() {
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

        .mp-page a { color: inherit; text-decoration: none; }

        .mp-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          transition: background 0.4s ease, backdrop-filter 0.4s ease, box-shadow 0.4s ease;
        }
        .mp-nav--scrolled {
          background: rgba(10, 10, 10, 0.95) !important;
          backdrop-filter: blur(16px);
          box-shadow: 0 1px 0 rgba(255,255,255,0.05);
        }

        .mp-btn {
          display: inline-block;
          padding: 14px 34px;
          background: ${BLUE};
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
        .mp-btn:hover {
          background: #2468b0;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(43, 124, 212, 0.3);
        }

        .mp-btn-outline {
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
        .mp-btn-outline:hover {
          border-color: #fff;
          background: rgba(255,255,255,0.05);
          transform: translateY(-2px);
        }

        .mp-link-arrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: ${BLUE};
          cursor: pointer;
          transition: gap 0.3s ease;
          background: none;
          border: none;
          text-decoration: none;
        }
        .mp-link-arrow:hover { gap: 14px; }
        .mp-link-arrow::after {
          content: '\\2192';
          transition: transform 0.3s ease;
        }

        .mp-service-img {
          transition: transform 0.6s ease, filter 0.6s ease;
        }
        .mp-service-img:hover {
          transform: scale(1.03);
          filter: brightness(1.1);
        }

        .mp-nav-link {
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
        .mp-nav-link:hover { color: #fff; }

        @keyframes mp-hero-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        @keyframes mp-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        .mp-scroll-indicator {
          animation: mp-bounce 2s ease-in-out infinite;
        }

        @keyframes mp-fade-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .mp-hero-content {
          animation: mp-fade-up 1s ease-out 0.3s both;
        }

        .mp-mobile-menu { display: none; }
        .mp-hamburger { display: none; }

        @media (max-width: 900px) {
          .mp-nav-desktop { display: none !important; }
          .mp-hamburger { display: flex !important; }
          .mp-mobile-menu--open { display: flex !important; }
          .mp-service-row { flex-direction: column !important; }
          .mp-service-row--reverse { flex-direction: column !important; }
          .mp-service-image-wrap { width: 100% !important; min-height: 300px !important; }
          .mp-service-text-wrap { width: 100% !important; padding: 48px 24px !important; }
          .mp-stats-bar { flex-wrap: wrap; }
          .mp-stats-bar > div { width: 50%; }
          .mp-reasons-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .mp-testimonials-grid { grid-template-columns: 1fr !important; }
          .mp-footer-grid { grid-template-columns: 1fr !important; text-align: center; }
          .mp-hero-title { font-size: 56px !important; }
          .mp-hero-sub-title { font-size: 56px !important; }
        }

        @media (max-width: 600px) {
          .mp-hero-title { font-size: 42px !important; }
          .mp-hero-sub-title { font-size: 42px !important; }
          .mp-section-title { font-size: 36px !important; }
          .mp-reasons-grid { grid-template-columns: 1fr !important; }
          .mp-stats-bar > div { width: 100%; }
          .mp-reason-num { font-size: 48px !important; }
        }
      `}</style>

      <div className="mp-page" style={{ background: BG, color: TEXT, fontFamily: "'Inter', sans-serif", minHeight: "100vh", overflowX: "hidden" }}>

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav
          ref={navRef}
          className={`mp-nav${scrolled ? " mp-nav--scrolled" : ""}`}
          style={{ background: scrolled ? undefined : "transparent" }}
        >
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 48px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 80 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: "#fff" }}>
              METRO <span style={{ color: BLUE }}>PLUMBING</span>
            </div>

            <div className="mp-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 40 }}>
              <a href="#services" className="mp-nav-link">Services</a>
              <a href="#about" className="mp-nav-link">About</a>
              <a href="#contact" className="mp-nav-link">Contact</a>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
              <a href="tel:5865550142" className="mp-nav-link" style={{ color: "rgba(232,234,240,0.9)" }}>(586) 555-0142</a>
              <a href="#contact" className="mp-btn" style={{ padding: "12px 28px", fontSize: 12 }}>Get a Quote</a>
            </div>

            <button
              className="mp-hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ display: "none", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", padding: 8 }}
            >
              {menuOpen ? "\u2715" : "\u2630"}
            </button>
          </div>

          <div
            className={`mp-mobile-menu${menuOpen ? " mp-mobile-menu--open" : ""}`}
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
              <a href="tel:5865550142" style={{ color: TEXT, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>(586) 555-0142</a>
              <a href="#contact" className="mp-btn" style={{ textAlign: "center", padding: "14px 28px" }} onClick={() => setMenuOpen(false)}>Get a Quote</a>
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
            backgroundImage: "url('https://images.unsplash.com/photo-1711014882930-c8e0484aedb4?w=1920&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: "mp-hero-zoom 20s ease-in-out alternate infinite",
          }} />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
          }} />

          <div className="mp-hero-content" style={{
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
              color: BLUE,
              marginBottom: 24,
            }}>
              Warren, Michigan -- Since 2009
            </div>
            <h1 className="mp-hero-title" style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 88,
              letterSpacing: 4,
              lineHeight: 0.95,
              margin: 0,
              color: "#fff",
            }}>
              WE FIX IT RIGHT.
            </h1>
            <h1 className="mp-hero-sub-title" style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 88,
              letterSpacing: 4,
              lineHeight: 0.95,
              margin: "0 0 32px",
              color: BLUE,
            }}>
              THE FIRST TIME.
            </h1>
            <p style={{
              fontSize: 18,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 520,
              margin: "0 0 40px",
            }}>
              Emergency repairs. Bathroom remodels. Water heater installs. Fast response, honest pricing, guaranteed work.
            </p>
            <a href="#contact" className="mp-btn" style={{ fontSize: 14, padding: "18px 44px" }}>
              Schedule Service
            </a>
          </div>

          <div className="mp-scroll-indicator" style={{
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
          <div className="mp-stats-bar" style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {[
              { value: "15+", label: "Years Experience" },
              { value: "3,200+", label: "Jobs Completed" },
              { value: "4.9", label: "Google Rating" },
              { value: "24/7", label: "Emergency Service" },
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
                  color: BLUE,
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
                  color: BLUE,
                  marginBottom: 16,
                }}>
                  What We Do
                </div>
                <h2 className="mp-section-title" style={{
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
                    className={`mp-service-row${isReversed ? " mp-service-row--reverse" : ""}`}
                    style={{
                      display: "flex",
                      flexDirection: isReversed ? "row-reverse" : "row",
                      marginBottom: i < SERVICES.length - 1 ? 2 : 0,
                      background: "#111",
                    }}
                  >
                    <div
                      className="mp-service-image-wrap"
                      style={{
                        width: "50%",
                        minHeight: 420,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        className="mp-service-img"
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
                      className="mp-service-text-wrap"
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
                        color: BLUE,
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
                      <a href="#contact" className="mp-link-arrow">Learn More</a>
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
                  color: BLUE,
                  marginBottom: 16,
                }}>
                  The Difference
                </div>
                <h2 className="mp-section-title" style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 56,
                  letterSpacing: 3,
                  margin: 0,
                  lineHeight: 1,
                }}>
                  Why Metro Plumbing
                </h2>
              </div>
            </ScrollReveal>

            <div className="mp-reasons-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 48,
            }}>
              {REASONS.map((reason, i) => (
                <ScrollReveal key={reason.title} delay={i * 120}>
                  <div>
                    <div className="mp-reason-num" style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 72,
                      letterSpacing: 2,
                      color: BLUE,
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
                  color: BLUE,
                  marginBottom: 16,
                }}>
                  Testimonials
                </div>
                <h2 className="mp-section-title" style={{
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

            <div className="mp-testimonials-grid" style={{
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
                      color: BLUE,
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
            backgroundImage: "url('https://images.unsplash.com/photo-1711014882930-c8e0484aedb4?w=1920&q=80')",
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
                color: BLUE,
                marginBottom: 20,
              }}>
                Get Started
              </div>
              <h2 className="mp-section-title" style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 56,
                letterSpacing: 3,
                margin: "0 0 20px",
                lineHeight: 1,
                color: "#fff",
              }}>
                Ready to Get Started?
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
              <a href="tel:5865550142" style={{
                display: "block",
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 42,
                letterSpacing: 3,
                color: "#fff",
                marginBottom: 40,
                textDecoration: "none",
              }}>
                (586) 555-0142
              </a>
              <a href="tel:5865550142" className="mp-btn" style={{ fontSize: 14, padding: "18px 52px" }}>
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
            <div className="mp-footer-grid" style={{
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
                  METRO <span style={{ color: BLUE }}>PLUMBING</span>
                </div>
                <p style={{
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: TEXT_MUTED,
                  maxWidth: 360,
                  margin: 0,
                }}>
                  Trusted residential and commercial plumbing services in Warren, Michigan and surrounding communities since 2009.
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
                  14820 E 12 Mile Rd<br />
                  Warren, MI 48088<br />
                  (586) 555-0142
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
                {new Date().getFullYear()} Metro Plumbing Co. All rights reserved.
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                Licensed &amp; Insured &mdash; State of Michigan
              </div>
            </div>
          </div>
        </footer>

        <TradeChatWidget trade="plumber" accentColor={BLUE} />
      </div>
    </>
  );
}
