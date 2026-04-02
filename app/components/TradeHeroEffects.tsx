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
