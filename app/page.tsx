"use client";

import React from "react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Calendar, Bot, MessageSquare, Clock, Circle, RefreshCw, ChevronDown, X, MessageCircle, Send, BarChart3, Users, Mail, Settings, Kanban } from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { icon: Calendar, text: "Appointment booked — Michael R., Dallas TX" },
  { icon: Bot, text: "New lead texted back in 3 seconds" },
  { icon: MessageSquare, text: "Objection handled automatically" },
  { icon: Calendar, text: "Sarah M. booked for Thursday 2pm" },
  { icon: Clock, text: "2:47am — appointment booked while agent slept" },
  { icon: Circle, text: "Blue text delivered — no carrier filtering" },
  { icon: Calendar, text: "3 appointments booked before 9am" },
  { icon: Bot, text: "Lead qualified in 4 messages. Appointment set." },
  { icon: MessageSquare, text: "Price objection handled. Lead booked next day." },
  { icon: Clock, text: "Sunday 6am. AI booked appointment instantly." },
  { icon: Circle, text: "iMessage delivered. Lead responded in 30 seconds." },
  { icon: Calendar, text: "Maria G. booked — AI nurtured for 11 days" },
];

const ALL_CONVERSATIONS = [
  { name: "Marcus J.", msg: "Yeah Thursday at 2 works for me", time: "Just now", blue: true },
  { name: "Sarah K.", msg: "What's the pricing for a full rewire?", time: "1m ago", blue: true },
  { name: "David R.", msg: "Sounds good, send me the calendar link", time: "3m ago", blue: false },
  { name: "Angela P.", msg: "Can you come out tomorrow morning?", time: "Just now", blue: true },
  { name: "Tom W.", msg: "We need the whole house done ASAP", time: "2m ago", blue: true },
  { name: "Jessica L.", msg: "Perfect, I'll be there at 10", time: "Just now", blue: false },
  { name: "Brian M.", msg: "How soon can you start?", time: "1m ago", blue: true },
  { name: "Kelly H.", msg: "That quote works for us. Let's book it", time: "Just now", blue: true },
  { name: "Robert C.", msg: "My neighbor recommended you guys", time: "4m ago", blue: false },
];

const ALL_APPOINTMENTS = [
  { name: "Marcus J.", time: "Thu 2:00 PM", status: "Confirmed" as const },
  { name: "Lisa M.", time: "Fri 10:00 AM", status: "Confirmed" as const },
  { name: "James W.", time: "Fri 3:30 PM", status: "Pending" as const },
  { name: "Angela P.", time: "Mon 9:00 AM", status: "Confirmed" as const },
  { name: "Tom W.", time: "Mon 1:30 PM", status: "Confirmed" as const },
  { name: "Kelly H.", time: "Tue 11:00 AM", status: "Pending" as const },
];

const FAQS = [
  { q: "How does the AI set appointments?", a: "The moment a lead comes in, the AI texts them within seconds. It qualifies them with natural questions, handles any objections, and books directly on your calendar with a Google Meet link. You just show up." },
  { q: "Will leads know they're talking to AI?", a: "No. It texts like a real person on your team. No dashes, no bullet points, no robotic grammar. It mirrors the lead's energy and tone. Most leads have no idea." },
  { q: "What's the difference between blue and green texts?", a: "Green texts (SMS) require A2P registration and get filtered by carriers — your leads might never see them. Blue texts (iMessage) go through Apple's network directly. No registration. No filtering. Higher response rates." },
  { q: "Can I take over a conversation from the AI?", a: "Yes. Every conversation has an AI toggle. Turn it off and you're in control. Turn it back on and the AI picks up where you left off." },
  { q: "How fast does the AI respond?", a: "3 seconds. The moment a lead comes in, the AI is texting them. That speed alone puts you ahead of 90% of your competition." },
  { q: "Do I need any technical skills?", a: "No. When you sign up, the AI walks you through setup with a few questions about your business. You can be live in minutes." },
  { q: "What happens if a lead goes cold?", a: "The AI follows up automatically on day 1, 3, 7, and 14 with a different approach each time. No lead gets forgotten." },
];

// ── Utility Components ────────────────────────────────────────────────────────

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";

function ScrambleText({ text, delay = 0 }: { text: string; delay?: number }) {
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
      setDisplay(text.split("").map((char, i) => {
        if (char === " " || char === "." || char === "'") return char;
        if (i < iteration / 3) return text[i];
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join(""));
      iteration++;
      if (iteration > max) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [started, text]);

  return <span className="inline-block" style={{ minWidth: `${text.length * 0.6}em` }}>{display}</span>;
}

function ScrollReveal({ children, delay = 0, type = "up" }: { children: React.ReactNode; delay?: number; type?: "up" | "left" | "scale" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.1, rootMargin: "0px 0px -60px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const transforms = {
    up: { from: "translateY(60px) scale(0.97)", to: "translateY(0) scale(1)" },
    left: { from: "translateX(-40px)", to: "translateX(0)" },
    scale: { from: "scale(0.92)", to: "scale(1)" },
  };

  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? transforms[type].to : transforms[type].from,
      transition: `opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
    }}>
      {children}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex justify-between items-center py-6 bg-transparent border-none cursor-pointer text-left group"
      >
        <span className="text-base font-medium text-[#e8eaf0] pr-4">{q}</span>
        <ChevronDown className={`w-5 h-5 text-[#E86A2A] flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-400 ${open ? "max-h-[200px] pb-4" : "max-h-0"}`}>
        <p className="text-sm text-white/50 leading-relaxed m-0">{a}</p>
      </div>
    </div>
  );
}

// ── Immersive Hero Effects ─────────────────────────────────────────────────────

function HeroSmoke() {
  // Smoke particles — larger, more dramatic
  const smokeParticles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: 25 + Math.random() * 60,
    left: 45 + Math.random() * 45,
    top: 25 + Math.random() * 40,
    duration: 2.5 + Math.random() * 3,
    delay: Math.random() * 4,
  }));

  // Ember particles — tiny glowing dots rising
  const emberParticles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: 40 + Math.random() * 50,
    top: 40 + Math.random() * 50,
    size: 1.5 + Math.random() * 3,
    duration: 3 + Math.random() * 4,
    delay: Math.random() * 5,
    drift: -15 + Math.random() * 30,
    driftEnd: -10 + Math.random() * 20,
  }));

  return (
    <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden">
      {/* Smoke */}
      {smokeParticles.map(p => (
        <div key={`s-${p.id}`} className="smoke-particle" style={{ width: p.size, height: p.size, left: `${p.left}%`, top: `${p.top}%`, "--duration": `${p.duration}s`, "--delay": `${p.delay}s` } as React.CSSProperties} />
      ))}
      {/* Embers */}
      {emberParticles.map(p => (
        <div key={`e-${p.id}`} className="ember-particle" style={{ left: `${p.left}%`, top: `${p.top}%`, "--size": `${p.size}px`, "--duration": `${p.duration}s`, "--delay": `${p.delay}s`, "--drift": `${p.drift}px`, "--drift-end": `${p.driftEnd}px` } as React.CSSProperties} />
      ))}
    </div>
  );
}

function useMouseParallax() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    function handleMove(e: MouseEvent) {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setOffset({ x, y });
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);
  return offset;
}

function useScrollParallax() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    function handleScroll() { setScrollY(window.scrollY); }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return scrollY;
}

// ── Immersive Hero Section ────────────────────────────────────────────────────

function HeroSection({ setDemoOpen }: { setDemoOpen: (v: boolean) => void }) {
  const mouse = useMouseParallax();
  const scrollY = useScrollParallax();

  // Wolf parallax: moves slower than scroll, shifts with mouse
  const wolfX = mouse.x * 15;
  const wolfY = mouse.y * 10 + scrollY * 0.15;
  const wolfScale = 1 + scrollY * 0.0002;

  // Smoke layer moves opposite to mouse for depth
  const smokeX = mouse.x * -8;
  const smokeY = mouse.y * -5;

  // Content parallax — moves up slightly faster
  const contentY = scrollY * -0.08;

  // Hero opacity fades as you scroll
  const heroOpacity = Math.max(1 - scrollY / 700, 0);

  return (
    <div className="relative h-[92vh] min-h-[600px] max-h-[900px] flex items-center overflow-hidden" style={{ opacity: heroOpacity }}>
      {/* Wolf image — parallax on mouse + scroll */}
      <div
        className="absolute z-0 opacity-70 will-change-transform"
        style={{
          inset: "-5%",
          backgroundImage: "url(/images/hero-wolf.png)",
          backgroundSize: "cover",
          backgroundPosition: "70% 35%",
          filter: "contrast(1.3) brightness(0.9)",
          transform: `translate(${wolfX}px, ${wolfY}px) scale(${wolfScale})`,
          transition: "transform 0.15s ease-out",
        }}
      />

      {/* Orange smoke + embers — parallax opposite direction */}
      <div style={{ transform: `translate(${smokeX}px, ${smokeY}px)`, transition: "transform 0.2s ease-out" }}>
        <HeroSmoke />
      </div>

      {/* Ambient orange glow behind wolf — pulses */}
      <div className="absolute z-[1] pointer-events-none animate-glow-pulse" style={{
        top: "20%", right: "10%", width: "50%", height: "60%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(232,106,42,0.12) 0%, transparent 60%)",
        filter: "blur(60px)",
      }} />

      {/* Gradients */}
      <div className="absolute inset-0 z-[3]" style={{ background: "linear-gradient(to right, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.85) 25%, rgba(10,10,10,0.5) 55%, rgba(10,10,10,0.2) 80%, rgba(10,10,10,0.15) 100%)" }} />
      <div className="absolute inset-0 z-[3]" style={{ background: "linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(10,10,10,0.7) 85%, #0a0a0a 100%)" }} />
      <div className="absolute inset-0 z-[3]" style={{ background: "radial-gradient(ellipse at 70% 40%, transparent 30%, rgba(10,10,10,0.4) 100%)" }} />

      {/* Content — slight parallax up on scroll */}
      <div className="relative z-[4] max-w-[1200px] w-full mx-auto px-6 md:px-16" style={{ transform: `translateY(${contentY}px)` }}>
        <div className="max-w-[580px]">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#E86A2A]/15 border border-[#E86A2A]/30 rounded-full text-[11px] font-semibold text-[#E86A2A] tracking-widest uppercase mb-7 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-[#E86A2A] inline-block animate-live-pulse" />
              AI Appointment Setter
            </div>
          </div>
          <h1 className="font-display text-[clamp(38px,8vw,80px)] leading-[0.92] mb-7 tracking-wide animate-fade-up animate-fade-up-d1" style={{ textShadow: "0 4px 60px rgba(0,0,0,0.8)" }}>
            <ScrambleText text="STOP CHASING LEADS." delay={600} />
            <br />
            <span className="text-[#E86A2A]"><ScrambleText text="START CLOSING THEM." delay={1400} /></span>
          </h1>
          <p className="text-[17px] text-white/85 leading-relaxed max-w-[500px] mb-5 animate-fade-up animate-fade-up-d3" style={{ textShadow: "0 1px 20px rgba(0,0,0,0.6)" }}>
            Your AI appointment setter texts leads in 3 seconds, qualifies them, and books on your calendar. 24/7. No staff. No missed leads.
          </p>
          <p className="text-base text-[#e8eaf0] max-w-[500px] mb-10 leading-relaxed font-semibold animate-fade-up animate-fade-up-d4">
            <span className="inline-flex items-center gap-1.5 bg-[#007AFF]/15 border border-[#007AFF]/30 rounded-full px-3.5 py-1 text-sm font-bold text-[#007AFF] mr-1.5 align-middle backdrop-blur-sm">
              <Circle className="w-2.5 h-2.5 fill-[#007AFF] text-[#007AFF]" /> iMessage
            </span>
            texts. No A2P registration. No carrier filtering. <span className="text-white/90">Your leads actually hear from you first.</span>
          </p>
          <div className="flex gap-3.5 flex-wrap animate-fade-up animate-fade-up-d5">
            <button onClick={() => setDemoOpen(true)} className="inline-flex items-center gap-2 px-9 py-4 bg-[#E86A2A] text-white rounded-xl text-[15px] font-bold border-none cursor-pointer shadow-[0_4px_20px_rgba(232,106,42,0.3)] hover:bg-[#ff7b3a] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(232,106,42,0.35)] transition-all duration-300 animate-cta-pulse">
              See It Work On You →
            </button>
            <Link href="/book-demo" className="inline-flex items-center gap-2 px-7 py-4 bg-transparent border border-white/30 text-white rounded-xl text-sm font-medium no-underline backdrop-blur-sm hover:border-white/50 transition-all duration-300 cursor-pointer">
              Book a Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Demo Modal ────────────────────────────────────────────────────────────────

function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/try", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone }) });
    const data = await res.json();
    if (data.error) { setError(data.error); setSending(false); } else { setSent(true); setSending(false); }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/75 z-[9999] flex items-center justify-center p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div onClick={e => e.stopPropagation()} className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-9 max-w-[420px] w-full relative">
        <button onClick={onClose} className="absolute top-4 right-5 bg-transparent border-none text-white/30 text-xl cursor-pointer hover:text-white/60 transition-colors">
          <X className="w-5 h-5" />
        </button>

        {!sent ? (
          <>
            <div className="text-center mb-6">
              <div className="font-display text-[28px] tracking-wide text-[#e8eaf0] mb-2">
                SEE IT <span className="text-[#E86A2A]">WORK ON YOU</span>
              </div>
              <p className="text-sm text-white/40 leading-relaxed">Enter your number. Maya will text you in 3 seconds.</p>
            </div>
            <div className="mb-3.5">
              <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Your Name</div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                className="w-full px-4 py-3 bg-[#111] border border-white/[0.08] rounded-xl text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
            </div>
            <div className="mb-5">
              <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Phone Number</div>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="(555) 000-0000"
                className="w-full px-4 py-3 bg-[#111] border border-white/[0.08] rounded-xl text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
            </div>
            {error && <div className="text-red-400 text-sm mb-3 text-center">{error}</div>}
            <button onClick={handleSubmit} disabled={sending || !name.trim() || !phone.trim()}
              className={`w-full py-3.5 rounded-xl text-[15px] font-bold border-none cursor-pointer transition-all duration-200 ${
                sending || !name.trim() || !phone.trim() ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-[#E86A2A] text-white hover:bg-[#ff7b3a]"
              }`}>
              {sending ? "Sending..." : "Text Me Now →"}
            </button>
            <div className="text-[11px] text-white/20 text-center mt-3 leading-relaxed">By clicking, you agree to receive a text message. Standard rates apply.</div>
          </>
        ) : (
          <div className="text-center py-5">
            <MessageCircle className="w-10 h-10 text-[#E86A2A] mx-auto mb-4" />
            <div className="font-display text-2xl text-[#e8eaf0] mb-2">CHECK YOUR PHONE</div>
            <p className="text-sm text-white/40 leading-relaxed mb-5">Maya just texted you. Reply naturally and see the AI appointment setter in action.</p>
            <button onClick={onClose} className="px-7 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white/60 text-sm font-semibold cursor-pointer hover:bg-white/10 transition-all">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat Widget ───────────────────────────────────────────────────────────────

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setSending(true);
    const res = await fetch("/api/chat-widget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: messages }) });
    const data = await res.json();
    setMessages([...updated, { role: "assistant", content: data.reply }]);
    setSending(false);
  }

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#E86A2A] border-2 border-white/10 flex items-center justify-center shadow-[0_4px_24px_rgba(232,106,42,0.35)] z-[9998] text-white transition-all duration-300 cursor-pointer ${open ? "rotate-45 scale-95" : "animate-cta-pulse"}`}>
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>

      {open && (
        <div className="fixed bottom-[90px] right-6 w-[360px] max-w-[calc(100vw-48px)] h-[460px] max-h-[calc(100vh-120px)] bg-[#0a0a0a] border border-white/[0.08] rounded-2xl flex flex-col overflow-hidden z-[9998] shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E86A2A]/20 text-[#E86A2A] flex items-center justify-center text-sm font-bold">M</div>
            <div>
              <div className="text-sm font-bold text-[#e8eaf0]">Maya</div>
              <div className="text-[11px] text-white/40">Wolf Pack AI Assistant</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {messages.length === 0 && (
              <div className="bg-[#E86A2A]/[0.08] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-[#e8eaf0] leading-relaxed max-w-[85%]">
                Hey! I&apos;m Maya. Got questions about Wolf Pack AI? Ask me anything.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl ${
                  m.role === "user" ? "bg-[#E86A2A] text-white" : "bg-white/[0.06] text-[#e8eaf0]"
                }`}>{m.content}</div>
              </div>
            ))}
            {sending && <div className="text-xs text-white/30 px-2 py-1">Maya is typing...</div>}
            <div ref={endRef} />
          </div>
          <div className="px-3.5 py-3 border-t border-white/[0.06] flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask Maya anything..."
              className="flex-1 px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
            <button onClick={send} disabled={sending || !input.trim()}
              className={`px-4 py-2.5 bg-[#E86A2A] text-white border-none rounded-xl text-sm font-bold cursor-pointer transition-all ${sending ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Animated Dashboard ────────────────────────────────────────────────────────

function AnimatedDashboard() {
  const [convos, setConvos] = useState<{ id: number; name: string; msg: string; time: string; blue: boolean }[]>([]);
  const [appts, setAppts] = useState<{ id: number; name: string; time: string; status: "Confirmed" | "Pending" }[]>([]);
  const [stats, setStats] = useState({ appts: 0, convos: 0, pipeline: 0, response: 0 });
  const [pipelineWidths, setPipelineWidths] = useState([0, 0, 0, 0, 0]);
  const [pipelineCounts, setPipelineCounts] = useState([0, 0, 0, 0, 0]);
  const [isVisible, setIsVisible] = useState(false);
  const dashRef = useRef<HTMLDivElement>(null);
  const convPtr = useRef(0);
  const apptPtr = useRef(0);
  const idCounter = useRef(0);

  useEffect(() => {
    const el = dashRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const targets = { appts: 6, convos: 12, pipeline: 342, response: 3 };
    const duration = 2500;
    const steps = 60;
    let step = 0;
    const countUp = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const ease = 1 - Math.pow(1 - progress, 5);
      setStats({ appts: Math.round(targets.appts * ease), convos: Math.round(targets.convos * ease), pipeline: Math.round(targets.pipeline * ease), response: Math.round(targets.response * ease) });
      if (step >= steps) {
        clearInterval(countUp);
        const liveTimer = setInterval(() => {
          setStats(prev => {
            const r = Math.random();
            if (r < 0.3) return { ...prev, appts: prev.appts + 1 };
            if (r < 0.6) return { ...prev, convos: prev.convos + 1 };
            return { ...prev, pipeline: prev.pipeline + Math.floor(Math.random() * 30 + 10) };
          });
        }, 3000);
        return () => clearInterval(liveTimer);
      }
    }, duration / steps);
    return () => clearInterval(countUp);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const tw = [85, 55, 45, 25, 35];
    const tc = [8, 5, 4, 2, 3];
    const t = setTimeout(() => { setPipelineWidths(tw); setPipelineCounts(tc); }, 300);
    const lt = setTimeout(() => {
      const ticker = setInterval(() => {
        setPipelineCounts(prev => { const idx = Math.floor(Math.random() * 5); const next = [...prev]; next[idx]++; return next; });
        setPipelineWidths(prev => { const idx = Math.floor(Math.random() * 5); const next = [...prev]; next[idx] = Math.min(next[idx] + Math.floor(Math.random() * 5 + 2), 98); return next; });
      }, 4000);
      return () => clearInterval(ticker);
    }, 3000);
    return () => { clearTimeout(t); clearTimeout(lt); };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    setConvos([{ ...ALL_CONVERSATIONS[0], id: ++idCounter.current }]);
    convPtr.current = 1;
    const timer = setInterval(() => {
      const c = ALL_CONVERSATIONS[convPtr.current % ALL_CONVERSATIONS.length];
      convPtr.current++;
      setConvos(prev => [{ ...c, id: ++idCounter.current }, ...prev].slice(0, 4));
    }, 2500);
    return () => clearInterval(timer);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    setAppts([{ ...ALL_APPOINTMENTS[0], id: ++idCounter.current }]);
    apptPtr.current = 1;
    const timer = setInterval(() => {
      const a = ALL_APPOINTMENTS[apptPtr.current % ALL_APPOINTMENTS.length];
      apptPtr.current++;
      setAppts(prev => [...prev, { ...a, id: ++idCounter.current }].slice(-4));
    }, 3500);
    return () => clearInterval(timer);
  }, [isVisible]);

  const pipelineStages = [
    { stage: "New Lead", color: "#007AFF" },
    { stage: "Qualified", color: "#E86A2A" },
    { stage: "Appointment Set", color: "#f5a623" },
    { stage: "Proposal Sent", color: "#9b59b6" },
    { stage: "Won", color: "#2ecc71" },
  ];

  const sidebarItems = [
    { icon: BarChart3, label: "Dashboard", active: true },
    { icon: MessageSquare, label: "Conversations", badge: stats.convos || undefined },
    { icon: Kanban, label: "Pipeline" },
    { icon: Calendar, label: "Calendar" },
    { icon: Users, label: "Contacts" },
    { icon: Mail, label: "Email" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <div ref={dashRef} className="max-w-[1000px] mx-auto px-10 pt-16 pb-5 relative" style={{ perspective: 1200 }}>
      <div style={{ transform: "rotateX(4deg) rotateY(-1deg)", transformOrigin: "center center" }} className="relative">
        <div className="absolute -inset-10 rounded-[40px] blur-[40px] pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(232,106,42,0.08) 0%, transparent 70%)" }} />
        <div className="relative z-[1] bg-[#111]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.06)]">
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="text-[11px] text-white/25 font-medium tracking-wider">Wolf Pack AI — Dashboard</div>
            <div className="w-[50px]" />
          </div>

          <div className="flex min-h-[420px]">
            {/* Sidebar */}
            <div className="w-[180px] border-r border-white/[0.06] p-3 flex-shrink-0 bg-black/20 hidden md:block">
              {sidebarItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg mb-0.5 text-xs font-medium ${item.active ? "bg-[#E86A2A]/12 text-[#E86A2A]" : "text-white/35"}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.badge && <span className="ml-auto bg-[#E86A2A] text-white text-[9px] font-bold px-1.5 rounded-md transition-all">{item.badge}</span>}
                  </div>
                );
              })}
            </div>

            {/* Main */}
            <div className="flex-1 p-5 overflow-hidden">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                {[
                  { label: "Appointments Today", value: stats.appts.toString(), color: "#E86A2A" },
                  { label: "Active Conversations", value: stats.convos.toString(), color: "#007AFF" },
                  { label: "Pipeline Value", value: `$${(stats.pipeline / 10).toFixed(1)}k`, color: "#2ecc71" },
                  { label: "Response Time", value: `${stats.response}s`, color: "#f5a623" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 transition-transform duration-300">
                    <div className="text-[30px] font-display tracking-wider" style={{ color: stat.color, textShadow: `0 0 20px ${stat.color}40` }}>{stat.value}</div>
                    <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Live conversations */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[10px] font-bold text-[#E86A2A] uppercase tracking-widest mb-3.5">Live Conversations</div>
                  {convos.map((c, i) => (
                    <div key={c.id} className={`flex items-center gap-3 py-2.5 animate-fade-up ${i < convos.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                      <div className="w-9 h-9 rounded-xl bg-[#E86A2A]/15 flex items-center justify-center text-sm font-bold text-[#E86A2A] flex-shrink-0">{c.name.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] font-semibold text-white/75">{c.name}</span>
                          <span className="text-[10px] text-white/20">{c.time}</span>
                        </div>
                        <div className="text-xs text-white/35 overflow-hidden text-ellipsis whitespace-nowrap mt-0.5">
                          {c.blue && <span className="text-[#007AFF] mr-1.5 text-[9px]">●</span>}{c.msg}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pipeline */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[10px] font-bold text-[#E86A2A] uppercase tracking-widest mb-3.5">Pipeline</div>
                  {pipelineStages.map((s, i) => (
                    <div key={i} className="mb-2.5">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-white/45 font-medium">{s.stage}</span>
                        <span className="text-xs font-bold transition-all duration-300" style={{ color: s.color }}>{pipelineCounts[i]}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="h-full rounded-full opacity-70" style={{ background: s.color, width: `${pipelineWidths[i]}%`, transition: `width 1.2s cubic-bezier(0.22, 1, 0.36, 1)`, transitionDelay: `${i * 0.2}s` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Appointments */}
              <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                {appts.map(a => (
                  <div key={a.id} className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl px-4 py-3 animate-fade-up">
                    <div className="text-[13px] font-semibold text-white/65">{a.name}</div>
                    <div className="text-[11px] text-white/30 mt-0.5">{a.time} · <span className={`font-semibold ${a.status === "Confirmed" ? "text-emerald-400" : "text-amber-400"}`}>{a.status}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="bg-[#0a0a0a] text-[#e8eaf0] min-h-screen font-sans overflow-x-hidden relative">
      {/* Grain texture */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.035]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "256px" }} />

      {/* Ambient glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-1/2 h-1/2 rounded-full blur-[80px]" style={{ background: "radial-gradient(circle, rgba(232,106,42,0.06) 0%, transparent 70%)" }} />
        <div className="absolute top-[30%] -right-[5%] w-[40%] h-[40%] rounded-full blur-[80px]" style={{ background: "radial-gradient(circle, rgba(0,122,255,0.04) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[5%] left-[30%] w-[45%] h-[35%] rounded-full blur-[100px]" style={{ background: "radial-gradient(circle, rgba(232,106,42,0.04) 0%, transparent 70%)" }} />
      </div>

      {/* Dot grid */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <div className="relative z-[1]">

      {/* ── Nav ── */}
      <nav className={`fixed top-4 left-4 right-4 z-50 flex justify-between items-center px-8 h-14 rounded-2xl transition-all duration-300 ${
        scrolled ? "bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.06]" : "bg-transparent border border-transparent"
      }`}>
        <Link href="/" className="font-display text-xl tracking-[2px] text-[#e8eaf0] no-underline">
          THE <span className="text-[#E86A2A]">WOLF</span> PACK
        </Link>
        <div className="hidden md:flex gap-7 items-center">
          <a href="#how" className="text-sm text-white/40 no-underline hover:text-white transition-colors font-medium tracking-wider">How It Works</a>
          <a href="#pricing" className="text-sm text-white/40 no-underline hover:text-white transition-colors font-medium tracking-wider">Pricing</a>
          <a href="#faq" className="text-sm text-white/40 no-underline hover:text-white transition-colors font-medium tracking-wider">FAQ</a>
          <a href="#" onClick={e => { e.preventDefault(); setDemoOpen(true); }} className="text-sm text-[#E86A2A] no-underline hover:text-[#ff7b3a] transition-colors font-medium">Live Demo</a>
          <Link href="/sign-in" className="text-sm text-white/40 no-underline hover:text-white transition-colors">Sign In</Link>
          <Link href="/sign-up" className="px-5 py-2 bg-[#E86A2A] text-white text-xs font-bold rounded-lg no-underline hover:bg-[#ff7b3a] hover:-translate-y-0.5 transition-all duration-200 shadow-[0_4px_20px_rgba(232,106,42,0.3)]">
            Get Started
          </Link>
        </div>
        <div className="flex md:hidden gap-3 items-center">
          <Link href="/sign-in" className="text-sm text-white/50 no-underline">Sign In</Link>
          <Link href="/sign-up" className="px-4 py-2 bg-[#E86A2A] text-white text-xs font-bold rounded-lg no-underline">Get Started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <HeroSection setDemoOpen={setDemoOpen} />

      {/* ── Stats Bar ── */}
      <ScrollReveal>
        <div className="flex flex-col md:flex-row justify-center max-w-[1000px] mx-auto py-20 px-10">
          {[
            { num: "3 SEC", label: "Response time" },
            { num: "24/7", label: "Never misses a lead" },
            { num: "10X", label: "More appointments booked" },
          ].map((s, i) => (
            <div key={i} className={`flex-1 text-center py-5 md:py-0 md:px-5 ${i < 2 ? "border-b md:border-b-0 md:border-r border-white/[0.06]" : ""}`}>
              <div className="font-display text-[clamp(52px,8vw,72px)] text-[#E86A2A] tracking-wider leading-none">{s.num}</div>
              <div className="text-[13px] text-white/35 mt-2.5 tracking-widest uppercase font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* ── Ticker ── */}
      <div className="border-y border-white/[0.04] my-5 relative overflow-hidden py-5">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        <div className="flex gap-3 animate-ticker" style={{ width: "max-content" }}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white/70 font-medium whitespace-nowrap flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-[#E86A2A]" />
                <span>{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Problem Section ── */}
      <ScrollReveal>
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0e0e0e 30%, #111 70%, #0e0e0e 100%)" }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-full rounded-full pointer-events-none blur-[60px]" style={{ background: "radial-gradient(ellipse, rgba(232,106,42,0.04) 0%, transparent 60%)" }} />
          <div className="max-w-[900px] mx-auto px-10 py-20 text-center relative">
            <h2 className="font-display text-[clamp(36px,5vw,48px)] mb-3 tracking-wide leading-none">
              EVERY MINUTE YOU WAIT <span className="text-[#E86A2A]">YOUR LEAD IS TEXTING SOMEONE ELSE</span>
            </h2>
            <p className="text-[15px] text-white/40 mb-12">The first person to respond wins. Always. Are you first?</p>
            <div className="flex flex-col md:flex-row gap-12 md:gap-12 justify-center">
              {[
                { num: "78%", label: "Buy from the\nfirst responder" },
                { num: "5 MIN", label: "Response time drops\nconversion 80%" },
                { num: "48%", label: "Never follow\nup at all" },
              ].map((s, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className="font-display text-[clamp(44px,6vw,56px)] text-[#E86A2A] leading-none">{s.num}</div>
                  <div className="text-sm text-white/40 mt-2 leading-relaxed whitespace-pre-line">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ── The Difference ── */}
      <ScrollReveal>
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #0e0e0e 0%, #0a0a0a 50%, #0a0a0a 100%)" }}>
          <div className="max-w-[1000px] mx-auto px-10 py-20 relative">
            <div className="text-center mb-14">
              <div className="text-[11px] font-bold text-[#E86A2A] tracking-[3px] uppercase mb-4">The Difference</div>
              <h2 className="font-display text-[clamp(36px,5vw,52px)] mb-3.5 tracking-wide leading-tight">
                THIS ISN&#39;T SOFTWARE. <span className="text-[#E86A2A]">IT&#39;S A CLOSER.</span>
              </h2>
              <p className="text-[15px] text-white/35 max-w-[520px] mx-auto leading-relaxed">
                You didn&#39;t start your business to sit in a CRM. Wolf Pack handles the grind so you handle the deals.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: Calendar, title: "Your phone buzzes with booked appointments", desc: "Not notifications to follow up. Not reminders you missed something. Actual confirmed appointments, already on your calendar, with qualified leads ready to talk." },
                { icon: Clock, title: "2am lead? Handled before you wake up", desc: "Sunday night. Holiday weekend. Middle of a closing. Doesn't matter. The AI responds in 3 seconds, every single time." },
                { icon: Circle, title: "Blue bubble. Not spam folder.", desc: "Your competitors send green SMS texts that get filtered by carriers. You send real iMessages through Apple's network. No registration. No filtering. The message actually lands." },
                { icon: RefreshCw, title: "The lead you forgot about? We didn't.", desc: "Day 1, 3, 7, 14 — different angle every time. The AI came back on a lead 11 days later and booked them. That's revenue you would've lost." },
              ].map((o, i) => {
                const Icon = o.icon;
                return (
                  <div key={i} className="group p-9 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-all duration-400 relative overflow-hidden hover:border-[#E86A2A]/20 hover:bg-[#E86A2A]/[0.03] hover:-translate-y-0.5 cursor-default">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#E86A2A]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5 bg-[#E86A2A]/[0.08] border border-[#E86A2A]/15">
                      <Icon className="w-5 h-5 text-[#E86A2A]" />
                    </div>
                    <div className="text-[19px] font-bold text-[#e8eaf0] mb-2.5 leading-snug">{o.title}</div>
                    <div className="text-sm text-white/45 leading-relaxed">{o.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Before / After ── */}
      <ScrollReveal>
        <div className="max-w-[1000px] mx-auto px-10 py-20">
          <div className="text-center mb-12">
            <div className="text-[11px] font-bold text-[#E86A2A] tracking-[3px] uppercase mb-4">The Reality</div>
            <h2 className="font-display text-[clamp(36px,5vw,48px)] tracking-wide leading-tight">
              TWO BUSINESSES. <span className="text-[#E86A2A]">SAME LEADS.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-9 rounded-2xl bg-white/[0.02] border border-red-500/12 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
              <div className="text-xs font-bold text-red-400 uppercase tracking-[2px] mb-6">Without Wolf Pack</div>
              {["Lead texts at 9pm. You see it at 8am.", "Manual follow-up... if you remember.", "Green texts filtered by carriers.", "Competitor books them while you sleep.", "3 appointments this week. Maybe."].map((text, i) => (
                <div key={i} className={`flex items-center gap-3 py-3.5 ${i < 4 ? "border-b border-white/[0.04]" : ""}`}>
                  <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-sm text-white/45 leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
            <div className="p-9 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/15 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-[2px] mb-6">With Wolf Pack</div>
              {["Lead texts at 9pm. AI responds in 3 seconds.", "Follow-up on day 1, 3, 7, 14. Automatic.", "Blue iMessage. No filtering. They see it.", "Appointment booked before you wake up.", "17 appointments this week. On autopilot."].map((text, i) => (
                <div key={i} className={`flex items-center gap-3 py-3.5 ${i < 4 ? "border-b border-white/[0.04]" : ""}`}>
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-sm text-white/70 leading-relaxed font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Proof Bar ── */}
      <div className="border-y border-white/[0.06]" style={{ background: "linear-gradient(180deg, #0c0c0c, #0f0f0f, #0c0c0c)" }}>
        <div className="max-w-[900px] mx-auto py-12 px-10 flex flex-wrap justify-center gap-12">
          {[
            { num: "47", label: "Appointments booked in 30 days" },
            { num: "3 SEC", label: "Average response time" },
            { num: "11 DAYS", label: "Longest nurture to booking" },
            { num: "$0", label: "Extra staff needed" },
          ].map((p, i) => (
            <div key={i} className="text-center">
              <div className="font-display text-[44px] text-[#E86A2A] leading-none">{p.num}</div>
              <div className="text-xs text-white/35 mt-1.5 tracking-wider">{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dashboard ── */}
      <AnimatedDashboard />

      {/* ── How It Works ── */}
      <ScrollReveal>
        <div id="how" className="max-w-[960px] mx-auto px-10 pt-20 pb-10 relative">
          <div className="text-center mb-14">
            <div className="text-[11px] font-bold text-[#E86A2A] tracking-[3px] uppercase mb-4">How It Works</div>
            <h2 className="font-display text-[clamp(36px,5vw,52px)] mb-3 tracking-wide leading-tight">
              THREE STEPS. <span className="text-[#E86A2A]">ONE FULL CALENDAR.</span>
            </h2>
            <p className="text-[15px] text-white/35 max-w-[440px] mx-auto">You don&#39;t learn software. You just get appointments.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            {[
              { num: "01", title: "Lead comes in", desc: "Ads, website, referral, Google — doesn't matter where. The AI picks it up before you even see the notification." },
              { num: "02", title: "AI books the appointment", desc: "Texts back in 3 seconds via iMessage. Qualifies. Handles objections. Sends the calendar invite. Done." },
              { num: "03", title: "You show up and close", desc: "Calendar invite with Google Meet link. The lead is warmed up, qualified, and expecting your call." },
            ].map((s, i) => (
              <React.Fragment key={i}>
                <div className="flex-1 p-9 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-all duration-400 hover:border-[#E86A2A]/15 hover:bg-[#E86A2A]/[0.02]">
                  <div className="font-display text-5xl text-[#E86A2A] leading-none mb-4 opacity-90">{s.num}</div>
                  <div className="text-[17px] font-bold text-[#e8eaf0] mb-2.5">{s.title}</div>
                  <div className="text-sm text-white/40 leading-relaxed">{s.desc}</div>
                </div>
                {i < 2 && <div className="hidden md:flex items-center text-[#E86A2A]/30 text-2xl px-1">→</div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* ── Demo CTA ── */}
      <ScrollReveal>
        <div className="py-20 px-10" style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0d0b09 40%, #0d0b09 60%, #0a0a0a 100%)" }}>
          <div className="max-w-[640px] mx-auto text-center p-14 rounded-2xl border border-[#E86A2A]/25 shadow-[0_0_60px_rgba(232,106,42,0.06)]" style={{ background: "linear-gradient(180deg, rgba(232,106,42,0.04), rgba(232,106,42,0.01))" }}>
            <h2 className="font-display text-4xl mb-3">SEE IT <span className="text-[#E86A2A]">WORK ON YOU</span></h2>
            <p className="text-[15px] text-white/40 mb-7 leading-relaxed">Enter your number. Wolf Pack AI texts you back in 3 seconds, qualifies you, and books an appointment on your calendar.</p>
            <button onClick={() => setDemoOpen(true)} className="inline-flex items-center gap-2 px-9 py-4 bg-[#E86A2A] text-white rounded-xl text-[15px] font-bold border-none cursor-pointer shadow-[0_4px_20px_rgba(232,106,42,0.3)] hover:bg-[#ff7b3a] hover:-translate-y-0.5 transition-all duration-300 animate-cta-pulse">
              Text Me Now →
            </button>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Pricing ── */}
      <ScrollReveal>
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0e0e0e 20%, #111 50%, #0e0e0e 80%, #0a0a0a 100%)" }}>
          <div id="pricing" className="max-w-[1000px] mx-auto px-10 py-16 relative">
            <div className="text-center mb-14">
              <div className="text-[11px] font-bold text-[#E86A2A] tracking-[3px] uppercase mb-4">Pricing</div>
              <h2 className="font-display text-[clamp(32px,5vw,48px)] mb-3 tracking-wide leading-tight">ONE MISSED APPOINTMENT COSTS MORE THAN THIS.</h2>
              <p className="text-[15px] text-white/35 max-w-[480px] mx-auto">No contracts. Cancel anytime. Set up in 10 minutes.</p>
            </div>

            {/* Main plan */}
            <div className="max-w-[680px] mx-auto mb-5">
              <div className="relative bg-[#E86A2A]/[0.03] border-2 border-[#E86A2A] rounded-2xl p-9 hover:border-[#ff7b3a] transition-all duration-300">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E86A2A] text-white text-[10px] font-bold px-3.5 py-1 rounded-full tracking-wider">ALL-IN-ONE</div>
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-1 min-w-[240px]">
                    <div className="text-xs font-bold text-white/30 uppercase tracking-[1.5px] mb-2">WOLF PACK AI</div>
                    <div className="font-display text-[56px] text-[#e8eaf0] leading-none">$97<span className="text-[15px] text-white/30 font-sans">/mo</span></div>
                    <p className="text-sm text-white/40 mt-3 mb-5">Everything you need. Blue texts, AI agent, CRM. One price.</p>
                    <button onClick={async () => { const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "pro" }) }); const data = await res.json(); if (data.url) window.location.href = data.url; }}
                      className="w-full py-4 bg-[#E86A2A] text-white rounded-xl text-[15px] font-bold border-none cursor-pointer hover:bg-[#ff7b3a] transition-all duration-200 shadow-[0_4px_20px_rgba(232,106,42,0.3)]">
                      Get Started
                    </button>
                  </div>
                  <div className="flex-1 min-w-[240px] grid grid-cols-2 gap-x-4 gap-y-0.5 content-start">
                    {["AI Appointment Setter", "iMessage (Blue Texts)", "No A2P Registration", "No Carrier Filtering", "Unlimited Conversations", "Pipeline CRM", "Auto Follow-ups", "Gmail Integration", "Calendar + Booking", "Call Recording", "Self-Learning AI", "CSV Import", "Analytics"].map(f => (
                      <div key={f} className="text-[13px] text-white/50 py-1.5 flex items-center gap-2">
                        <span className="text-emerald-400 text-[11px] font-bold">✓</span>{f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom cards */}
            <div className="flex flex-col gap-5 max-w-[680px] mx-auto">
              <div className="relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-9 hover:border-[#E86A2A]/20 transition-all duration-300">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E86A2A]/20 text-[#E86A2A] text-[10px] font-bold px-3.5 py-1 rounded-full tracking-wider border border-[#E86A2A]/30">ADD-ON</div>
                <div className="text-xs font-bold text-white/30 uppercase tracking-[1.5px] mb-2">GBP MANAGEMENT</div>
                <div className="font-display text-[42px] text-[#e8eaf0]">$49<span className="text-[15px] text-white/30 font-sans">/mo</span></div>
                <p className="text-sm text-white/35 mt-2 mb-5">Your Google Business Profile on autopilot. More visibility, more calls.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5 mb-5">
                  {["Weekly Auto Posts", "AI Review Replies", "Negative Review Alerts", "Monthly Performance Report", "Search + Maps Tracking", "Call + Direction Tracking", "Top Search Terms", "Photo Management", "Business Info Updates", "Service Area Management", "Review Request Sequence", "Competitor-Level Presence"].map(f => (
                    <div key={f} className="text-xs text-white/50 py-1 flex items-center gap-2">
                      <span className="text-emerald-400 text-[10px] font-bold">✓</span>{f}
                    </div>
                  ))}
                </div>
                <button onClick={async () => { const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "gbp" }) }); const data = await res.json(); if (data.url) window.location.href = data.url; }}
                  className="w-full flex justify-center py-3.5 bg-transparent border border-white/15 text-white/50 rounded-xl text-sm font-medium no-underline hover:border-white/30 hover:text-white transition-all duration-300 cursor-pointer">Add to Plan</button>
              </div>

              <div className="relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-9 hover:border-[#E86A2A]/20 transition-all duration-300">
                <div className="text-xs font-bold text-white/30 uppercase tracking-[1.5px] mb-2">AGENCY</div>
                <div className="font-display text-[42px] text-[#e8eaf0]">Custom</div>
                <p className="text-sm text-white/35 mt-2 mb-5">For agencies managing multiple clients.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5 mb-5">
                  {["Everything in Wolf Pack AI", "GBP Management Included", "Multiple Numbers", "White Label Branding", "Custom Domain", "Team Management", "API Access", "Dedicated Support", "Facebook Lead Integration", "Volume Discounts"].map(f => (
                    <div key={f} className="text-xs text-white/50 py-1 flex items-center gap-2">
                      <span className="text-emerald-400 text-[10px] font-bold">✓</span>{f}
                    </div>
                  ))}
                </div>
                <Link href="/book-demo" className="w-full flex justify-center py-3.5 bg-transparent border border-white/15 text-white/50 rounded-xl text-sm font-medium no-underline hover:border-white/30 hover:text-white transition-all duration-300 cursor-pointer">Contact Us</Link>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* ── FAQ ── */}
      <div id="faq" className="max-w-[640px] mx-auto px-10 py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-[44px] tracking-wide">Questions? We Got You.</h2>
        </div>
        {FAQS.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
      </div>

      {/* ── Final CTA ── */}
      <div className="py-16 px-10 text-center relative overflow-hidden" style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0d0b09 50%, #0f0c0a 100%)" }}>
        <h2 className="font-display text-[44px] mb-4 tracking-wide leading-tight relative z-[1]">
          STOP LOSING APPOINTMENTS TO<br /><span className="text-[#E86A2A]">WHOEVER RESPONDED FASTER</span>
        </h2>
        <p className="text-[15px] text-white/35 mb-8 relative z-[1]">Your competitors are texting your leads right now.</p>
        <div className="flex gap-3.5 justify-center flex-wrap relative z-[1]">
          <button onClick={() => setDemoOpen(true)} className="inline-flex items-center gap-2 px-9 py-4 bg-[#E86A2A] text-white rounded-xl text-[15px] font-bold border-none cursor-pointer shadow-[0_4px_20px_rgba(232,106,42,0.3)] hover:bg-[#ff7b3a] hover:-translate-y-0.5 transition-all duration-300 animate-cta-pulse">
            See It Work On You →
          </button>
          <Link href="/book-demo" className="inline-flex items-center gap-2 px-7 py-4 bg-transparent border border-white/15 text-white/50 rounded-xl text-sm font-medium no-underline hover:border-white/30 hover:text-white transition-all duration-300 cursor-pointer">
            Book a Demo
          </Link>
        </div>
      </div>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <ChatWidget />

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] px-10 pt-20 pb-10">
        <div className="text-center mb-16">
          <div className="font-display text-[42px] tracking-wide text-white/60 mb-4">YOUR COMPETITION ISN&apos;T WAITING.</div>
          <button onClick={() => setDemoOpen(true)} className="px-10 py-4 bg-[#E86A2A] text-white rounded-xl text-base font-bold border-none cursor-pointer hover:bg-[#ff7b3a] transition-all duration-200 shadow-[0_4px_20px_rgba(232,106,42,0.3)]">
            See It Work On You →
          </button>
        </div>
        <div className="font-display text-center leading-none mb-8 text-white/[0.04] select-none" style={{ fontSize: "clamp(32px, 10vw, 140px)", letterSpacing: "clamp(2px, 0.5vw, 6px)" }}>
          THE <span className="text-[#E86A2A]/[0.08]">WOLF</span> PACK
        </div>
        <div className="flex flex-wrap justify-center gap-8 mb-6">
          {[{ label: "How It Works", href: "#how" }, { label: "Pricing", href: "#pricing" }, { label: "Book a Demo", href: "/book-demo" }, { label: "FAQ", href: "#faq" }].map(link => (
            <Link key={link.label} href={link.href} className="text-white/30 no-underline text-sm font-medium hover:text-white/60 transition-colors">{link.label}</Link>
          ))}
        </div>
        <div className="flex justify-center gap-6 items-center">
          <Link href="/privacy" className="text-white/20 no-underline text-[11px] hover:text-white/40 transition-colors">Privacy</Link>
          <Link href="/terms" className="text-white/20 no-underline text-[11px] hover:text-white/40 transition-colors">Terms</Link>
          <span className="text-[11px] text-white/[0.12]">© {new Date().getFullYear()} The Wolf Pack AI</span>
        </div>
      </footer>

      </div>
    </div>
  );
}
