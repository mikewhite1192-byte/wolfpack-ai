"use client";

import { useState, useEffect, useRef } from "react";

// ── Scramble Text ─────────────────────────────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function ScrambleText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [display, setDisplay] = useState(text.replace(/[A-Za-z0-9]/g, " "));
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let iteration = 0;
    const max = text.length * 3;
    const interval = setInterval(() => {
      setDisplay(
        text.split("").map((char, i) => {
          if (char === " " || char === "." || char === "'" || char === "\u2019") return char;
          if (i < iteration / 3) return text[i];
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join("")
      );
      iteration++;
      if (iteration > max) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [started, text]);

  return <>{display}</>;
}

// ── Fade In on Mount ──────────────────────────────────────────────
export function FadeIn({ children, delay = 0, direction = "up" }: { children: React.ReactNode; delay?: number; direction?: "up" | "left" | "right" | "none" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const translateMap = { up: "translateY(30px)", left: "translateX(-30px)", right: "translateX(30px)", none: "none" };

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : translateMap[direction],
      transition: `opacity 0.8s ease, transform 0.8s ease`,
    }}>
      {children}
    </div>
  );
}

// ── Animated Counter ──────────────────────────────────────────────
export function AnimatedCounter({ target, suffix = "", duration = 2000, delay = 600 }: { target: string; suffix?: string; duration?: number; delay?: number }) {
  const [display, setDisplay] = useState("0");
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Extract number from target (e.g., "3,200+" -> 3200, "4.9" -> 4.9)
  const numStr = target.replace(/[^0-9.]/g, "");
  const targetNum = parseFloat(numStr);
  const hasComma = target.includes(",");
  const prefix = target.match(/^[^0-9]*/)?.[0] || "";
  const suffixStr = target.match(/[^0-9.]*$/)?.[0] || "";
  const isDecimal = numStr.includes(".");

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = targetNum * eased;

      if (isDecimal) {
        setDisplay(current.toFixed(1));
      } else if (hasComma) {
        setDisplay(Math.floor(current).toLocaleString());
      } else {
        setDisplay(Math.floor(current).toString());
      }

      if (progress >= 1) {
        setDisplay(isDecimal ? targetNum.toFixed(1) : (hasComma ? targetNum.toLocaleString() : Math.floor(targetNum).toString()));
        clearInterval(interval);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [started, targetNum, duration, isDecimal, hasComma]);

  return <span ref={ref}>{prefix}{display}{suffixStr}{suffix}</span>;
}

// ── Floating Orbs ─────────────────────────────────────────────────
export function FloatingOrbs({ color }: { color: string }) {
  return (
    <>
      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -40px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-40px, 30px) scale(0.9); } 66% { transform: translate(25px, -25px) scale(1.05); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(20px, 30px) scale(1.15); } }
      `}</style>
      <div style={{ position: "absolute", top: "15%", left: "8%", width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`, animation: "float1 8s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "60%", right: "5%", width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`, animation: "float2 10s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", left: "15%", width: 90, height: 90, borderRadius: "50%", background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`, animation: "float3 6s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "30%", right: "18%", width: 60, height: 60, borderRadius: "50%", background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`, animation: "float1 12s ease-in-out infinite reverse", pointerEvents: "none" }} />
    </>
  );
}

// ── Scroll Reveal (IntersectionObserver) ──────────────────────────
export function ScrollReveal({ children, delay = 0, direction = "up" }: { children: React.ReactNode; delay?: number; direction?: "up" | "left" | "right" | "none" }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  const translateMap = { up: "translateY(40px)", left: "translateX(-40px)", right: "translateX(40px)", none: "none" };

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : translateMap[direction],
      transition: `opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)`,
    }}>
      {children}
    </div>
  );
}

// ── Glow Card (glassmorphism with gradient border on hover) ───────
export function GlowCard({ children, color, style }: { children: React.ReactNode; color: string; style?: React.CSSProperties }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: hovered ? `linear-gradient(135deg, ${color}08 0%, rgba(255,255,255,0.03) 100%)` : "rgba(255,255,255,0.02)",
        border: `1px solid ${hovered ? color + "40" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 14,
        padding: 32,
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? `0 20px 40px ${color}12, 0 0 60px ${color}08` : "none",
        cursor: "default",
        ...style,
      }}
    >
      {hovered && (
        <div style={{
          position: "absolute", top: -1, left: -1, right: -1, bottom: -1,
          borderRadius: 15,
          background: `linear-gradient(135deg, ${color}30, transparent 50%, ${color}15)`,
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: 1,
          pointerEvents: "none",
        }} />
      )}
      {children}
    </div>
  );
}

// ── Section Divider (angled) ──────────────────────────────────────
export function AngleDivider({ color, flip = false }: { color: string; flip?: boolean }) {
  return (
    <div style={{ position: "relative", height: 60, overflow: "hidden", marginTop: -1 }}>
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ position: "absolute", width: "100%", height: "100%", transform: flip ? "scaleY(-1)" : "none" }}>
        <path d="M0,60 L1440,0 L1440,60 Z" fill={color} />
      </svg>
    </div>
  );
}

// ── Testimonial Carousel ──────────────────────────────────────────
export function TestimonialCarousel({ testimonials, color }: { testimonials: { name: string; location: string; rating: number; text: string }[]; color: string }) {
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ overflow: "hidden", position: "relative", padding: "10px 0" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 100, background: "linear-gradient(to right, #08090c, transparent)", zIndex: 2 }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 100, background: "linear-gradient(to left, #08090c, transparent)", zIndex: 2 }} />
      <style>{`
        @keyframes testimonialScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .testimonial-track { display: flex; gap: 24px; animation: testimonialScroll 30s linear infinite; }
        .testimonial-track:hover { animation-play-state: paused; }
      `}</style>
      <div ref={trackRef} className="testimonial-track">
        {[...testimonials, ...testimonials].map((t, i) => (
          <div key={i} style={{
            flexShrink: 0, width: 380, background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 28,
          }}>
            <div style={{ display: "flex", gap: 2, marginBottom: 14 }}>
              {Array.from({ length: t.rating }).map((_, j) => (
                <span key={j} style={{ color: "#facc15", fontSize: 16 }}>&#9733;</span>
              ))}
            </div>
            <p style={{ color: "rgba(232,234,240,0.6)", fontSize: 14, lineHeight: 1.7, margin: "0 0 20px", fontStyle: "italic" }}>
              &ldquo;{t.text}&rdquo;
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", color: color, fontSize: 14, fontWeight: 700 }}>
                {t.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#e8eaf0" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "rgba(232,234,240,0.4)" }}>{t.location}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hero Background Image ─────────────────────────────────────────
export function HeroBackground({ imageUrl, overlayOpacity = 0.82 }: { imageUrl: string; overlayOpacity?: number }) {
  return (
    <>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "grayscale(30%)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, rgba(10,10,10,${overlayOpacity}) 0%, rgba(10,10,10,0.95) 100%)`,
      }} />
    </>
  );
}
