"use client";

import { useState, useEffect, useRef } from "react";
import { Menu, X, Phone, ChevronDown } from "lucide-react";

// ── Types ──
export type NicheConfig = {
  brand: { name: string; highlight: string };
  accent: string;
  accentDark: string;
  hero: {
    image: string;
    tagline: string;
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    cta: string;
  };
  stats: { value: string; label: string }[];
  services: { title: string; desc: string; image: string }[];
  reasons: { num: string; title: string; desc: string }[];
  testimonials: { name: string; location: string; text: string }[];
  cta: { title: string; subtitle: string; phone: string };
  footer: { desc: string; address: string; phone: string; license: string };
  chatTrade: string;
};

// ── Scroll Reveal ──
function ScrollReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(40px)", transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s` }}>
      {children}
    </div>
  );
}

// ── Main Component ──
export default function NicheLandingPage({ config }: { config: NicheConfig }) {
  const c = config;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="bg-[#0a0a0a] text-[#e8eaf0] font-sans min-h-screen overflow-x-hidden">
      <style>{`
        @keyframes hero-zoom { 0% { transform: scale(1); } 100% { transform: scale(1.1); } }
        @keyframes hero-fade { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce-scroll { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(10px); } }
        .hero-content { animation: hero-fade 1s ease-out 0.3s both; }
        .hero-bg { animation: hero-zoom 20s ease-in-out alternate infinite; }
        .scroll-bounce { animation: bounce-scroll 2s ease-in-out infinite; }
        .service-img { transition: transform 0.6s ease, filter 0.6s ease; }
        .service-img:hover { transform: scale(1.03); filter: brightness(1.1); }
      `}</style>

      {/* ── Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0a0a0a]/97 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.05)]" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-20">
          <div className="font-display text-[28px] tracking-[3px] text-white">
            {c.brand.name} <span style={{ color: c.accent }}>{c.brand.highlight}</span>
          </div>
          <div className="hidden lg:flex items-center gap-10">
            {["Services", "About", "Contact"].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} className="text-[13px] font-medium tracking-[1.5px] uppercase text-white/70 no-underline hover:text-white transition-colors">{link}</a>
            ))}
            <span className="text-white/20">|</span>
            <a href={`tel:${c.footer.phone.replace(/\D/g, "")}`} className="text-[13px] font-medium tracking-wider text-white/90 no-underline hover:text-white transition-colors flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" /> {c.footer.phone}
            </a>
            <a href="#contact" className="px-7 py-3 text-xs font-semibold tracking-widest uppercase text-white border-none rounded-none cursor-pointer hover:-translate-y-0.5 transition-all duration-300 no-underline" style={{ background: c.accent, boxShadow: `0 8px 24px ${c.accent}30` }}>
              {c.hero.cta}
            </a>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden bg-transparent border-none text-white cursor-pointer p-2" aria-label="Toggle menu">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden bg-[#0a0a0a]/98 border-t border-white/[0.06] flex flex-col">
            {["Services", "About", "Contact"].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} onClick={() => setMenuOpen(false)} className="block px-12 py-5 text-sm font-medium tracking-[1.5px] uppercase text-white/80 no-underline border-b border-white/[0.04]">{link}</a>
            ))}
            <div className="px-12 py-5 flex flex-col gap-3">
              <a href={`tel:${c.footer.phone.replace(/\D/g, "")}`} className="text-[15px] font-semibold text-white no-underline">{c.footer.phone}</a>
              <a href="#contact" className="text-center py-3.5 px-7 text-xs font-semibold tracking-widest uppercase text-white no-underline" style={{ background: c.accent }} onClick={() => setMenuOpen(false)}>{c.hero.cta}</a>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative h-screen min-h-[700px] flex items-end overflow-hidden">
        <div className="hero-bg absolute" style={{ inset: "-5%", backgroundImage: `url('${c.hero.image}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
        <div className="hero-content relative z-[2] max-w-7xl w-full mx-auto px-6 md:px-12 pb-24">
          <div className="text-[11px] font-semibold tracking-[3px] uppercase mb-6" style={{ color: c.accent }}>{c.hero.tagline}</div>
          <h1 className="font-display text-[clamp(42px,9vw,88px)] tracking-[4px] leading-[0.95] m-0 text-white">{c.hero.titleLine1}</h1>
          <h1 className="font-display text-[clamp(42px,9vw,88px)] tracking-[4px] leading-[0.95] mb-8" style={{ color: c.accent }}>{c.hero.titleLine2}</h1>
          <p className="text-lg leading-relaxed text-white/65 max-w-[520px] mb-10">{c.hero.subtitle}</p>
          <a href="#contact" className="inline-block px-11 py-[18px] text-sm font-semibold tracking-widest uppercase text-white no-underline hover:-translate-y-0.5 transition-all duration-300" style={{ background: c.accent, boxShadow: `0 8px 24px ${c.accent}30` }}>
            {c.hero.cta}
          </a>
        </div>
        <div className="scroll-bounce absolute bottom-8 left-1/2 -translate-x-1/2 z-[2] flex flex-col items-center gap-2">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-white/40" />
          <ChevronDown className="w-4 h-4 text-white/40" />
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="bg-[#0d0d0d] border-y border-white/[0.06]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center">
          {c.stats.map((stat, i) => (
            <div key={stat.label} className={`flex-1 text-center py-9 px-6 w-full md:w-auto ${i < c.stats.length - 1 ? "border-b md:border-b-0 md:border-r border-white/[0.06]" : ""}`}>
              <div className="font-display text-4xl tracking-wider leading-none mb-1.5" style={{ color: c.accent }}>{stat.value}</div>
              <div className="text-[11px] font-medium tracking-[2px] uppercase text-[#9ca3af]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <ScrollReveal>
            <div className="mb-20">
              <div className="text-[11px] font-semibold tracking-[3px] uppercase mb-4" style={{ color: c.accent }}>What We Do</div>
              <h2 className="font-display text-[clamp(36px,5vw,56px)] tracking-[3px] leading-none">Our Services</h2>
            </div>
          </ScrollReveal>

          {c.services.map((service, i) => {
            const reversed = i % 2 !== 0;
            return (
              <ScrollReveal key={service.title} delay={i * 0.1}>
                <div className={`flex flex-col ${reversed ? "md:flex-row-reverse" : "md:flex-row"} bg-[#111] ${i < c.services.length - 1 ? "mb-0.5" : ""}`}>
                  <div className="w-full md:w-1/2 min-h-[300px] md:min-h-[420px] overflow-hidden relative">
                    <div className="service-img absolute inset-0" style={{ backgroundImage: `url('${service.image}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  </div>
                  <div className="w-full md:w-1/2 flex flex-col justify-center px-6 md:px-16 py-12 md:py-16">
                    <div className="text-[11px] font-semibold tracking-[3px] uppercase mb-4" style={{ color: c.accent }}>{String(i + 1).padStart(2, "0")}</div>
                    <h3 className="font-display text-[clamp(28px,4vw,42px)] tracking-wider leading-none mb-5 text-white">{service.title}</h3>
                    <p className="text-base leading-relaxed text-[#9ca3af] mb-8 max-w-[440px]">{service.desc}</p>
                    <a href="#contact" className="text-sm font-semibold tracking-widest uppercase no-underline inline-flex items-center gap-2 transition-all duration-300 hover:gap-3.5" style={{ color: c.accent }}>
                      Learn More <span>→</span>
                    </a>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ── Why Choose Us ── */}
      <section id="about" className="bg-[#0d0d0d] border-y border-white/[0.06] py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <ScrollReveal>
            <div className="mb-20 max-w-[600px]">
              <div className="text-[11px] font-semibold tracking-[3px] uppercase mb-4" style={{ color: c.accent }}>The Difference</div>
              <h2 className="font-display text-[clamp(36px,5vw,56px)] tracking-[3px] leading-none">Why {c.brand.name} {c.brand.highlight}</h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
            {c.reasons.map((reason, i) => (
              <ScrollReveal key={reason.title} delay={i * 0.12}>
                <div>
                  <div className="font-display text-[clamp(48px,6vw,72px)] tracking-wider leading-none mb-4 opacity-90" style={{ color: c.accent }}>{reason.num}</div>
                  <h3 className="font-display text-2xl tracking-wide leading-tight mb-3 text-white">{reason.title}</h3>
                  <p className="text-[15px] leading-relaxed text-[#9ca3af]">{reason.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <ScrollReveal>
            <div className="mb-20">
              <div className="text-[11px] font-semibold tracking-[3px] uppercase mb-4" style={{ color: c.accent }}>Testimonials</div>
              <h2 className="font-display text-[clamp(36px,5vw,56px)] tracking-[3px] leading-none">What Our Clients Say</h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {c.testimonials.map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 0.12}>
                <div className="bg-[#111] border border-white/[0.06] p-10 md:p-12 h-full flex flex-col hover:border-white/[0.12] transition-all duration-300">
                  <div className="font-display text-7xl leading-none opacity-40 mb-6 select-none" style={{ color: c.accent }}>&ldquo;</div>
                  <p className="text-base leading-relaxed text-white/85 italic mb-8 flex-1">{t.text}</p>
                  <div>
                    <div className="text-[15px] font-semibold text-white mb-1">{t.name}</div>
                    <div className="text-sm text-[#9ca3af]">{t.location}</div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="contact" className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url('${c.hero.image}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-black/80" />
        <div className="relative z-[2] max-w-7xl mx-auto px-6 md:px-12 py-28 text-center">
          <ScrollReveal>
            <div className="text-[11px] font-semibold tracking-[3px] uppercase mb-5" style={{ color: c.accent }}>Get Started</div>
            <h2 className="font-display text-[clamp(36px,5vw,56px)] tracking-[3px] leading-none mb-5 text-white">{c.cta.title}</h2>
            <p className="text-lg leading-relaxed text-white/55 max-w-[520px] mx-auto mb-4">{c.cta.subtitle}</p>
            <a href={`tel:${c.cta.phone.replace(/\D/g, "")}`} className="block font-display text-[clamp(28px,4vw,42px)] tracking-[3px] text-white no-underline mb-10">{c.cta.phone}</a>
            <a href={`tel:${c.cta.phone.replace(/\D/g, "")}`} className="inline-block px-14 py-[18px] text-sm font-semibold tracking-widest uppercase text-white no-underline hover:-translate-y-0.5 transition-all duration-300" style={{ background: c.accent, boxShadow: `0 8px 24px ${c.accent}30` }}>
              Call Now
            </a>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-20 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 mb-16">
            <div>
              <div className="font-display text-2xl tracking-[3px] text-white mb-4">
                {c.brand.name} <span style={{ color: c.accent }}>{c.brand.highlight}</span>
              </div>
              <p className="text-[15px] leading-relaxed text-[#9ca3af] max-w-[360px]">{c.footer.desc}</p>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[2px] uppercase text-white/40 mb-6">Quick Links</div>
              {["Services", "About", "Contact"].map(link => (
                <a key={link} href={`#${link.toLowerCase()}`} className="block text-[15px] text-[#9ca3af] no-underline mb-3.5 hover:text-white transition-colors">{link}</a>
              ))}
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[2px] uppercase text-white/40 mb-6">Contact</div>
              <p className="text-[15px] leading-[2] text-[#9ca3af] whitespace-pre-line">{c.footer.address}{"\n"}{c.footer.phone}</p>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-[13px] text-white/25">{new Date().getFullYear()} {c.brand.name} {c.brand.highlight}. All rights reserved.</div>
            <div className="text-[13px] text-white/25">{c.footer.license}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
