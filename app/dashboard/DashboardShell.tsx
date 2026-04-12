"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import AiAssistant from "./components/AiAssistant";
import { LayoutDashboard, Hexagon, MessageSquare, Mail, Calendar, BarChart3, Users, MapPin, Settings, Send, Phone, PhoneOff, Delete, X, Briefcase, DollarSign } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: Hexagon },
  { label: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
  { label: "Email", href: "/dashboard/email", icon: Mail },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Contacts", href: "/dashboard/contacts", icon: Users },
  { label: "GBP", href: "/dashboard/gbp", icon: MapPin },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const ADMIN_NAV = [
  { label: "Outreach", href: "/dashboard/outreach", icon: Send },
  { label: "AI Caller", href: "/dashboard/caller", icon: Phone },
  { label: "Upwork", href: "/dashboard/upwork", icon: Briefcase },
  { label: "Finance", href: "/dashboard/finance", icon: DollarSign },
];

const ADMIN_EMAILS = ["info@thewolfpackco.com"];
const DEMO_EMAILS = ["mikewhite1192@gmail.com"];

function DialPad({ onClose, initialNumber }: { onClose: () => void; initialNumber?: string }) {
  const [number, setNumber] = useState(initialNumber || "");
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "connected" | "ended">("idle");
  const [duration, setDuration] = useState(0);
  const deviceRef = useRef<any>(null);
  const connectionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const digits = ["1","2","3","4","5","6","7","8","9","*","0","#"];

  const initDevice = useCallback(async () => {
    if (deviceRef.current) return;
    try {
      const { Device } = await import("@twilio/voice-sdk");
      const res = await fetch("/api/calls/token");
      const data = await res.json();
      if (!data.token) return;
      const device = new Device(data.token);
      device.on("registered", () => console.log("[dial] Device registered"));
      device.on("error", (err: Error) => console.error("[dial] Device error:", err));
      await device.register();
      deviceRef.current = device;
    } catch (err) { console.error("[dial] Init error:", err); }
  }, []);

  useEffect(() => {
    initDevice();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (deviceRef.current) { deviceRef.current.destroy(); deviceRef.current = null; }
    };
  }, [initDevice]);

  async function makeCall() {
    if (!number.trim() || !deviceRef.current) return;
    setCallStatus("connecting");
    fetch("/api/calls/initiate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toNumber: number }) });
    try {
      const call = await deviceRef.current.connect({ params: { To: number } });
      connectionRef.current = call;
      call.on("accept", () => { setCallStatus("connected"); setDuration(0); timerRef.current = setInterval(() => setDuration(d => d + 1), 1000); });
      call.on("disconnect", () => { setCallStatus("ended"); if (timerRef.current) clearInterval(timerRef.current); setTimeout(() => { setCallStatus("idle"); setDuration(0); }, 2000); });
      call.on("cancel", () => { setCallStatus("idle"); if (timerRef.current) clearInterval(timerRef.current); });
      call.on("error", () => { setCallStatus("idle"); if (timerRef.current) clearInterval(timerRef.current); });
    } catch { setCallStatus("idle"); }
  }

  function hangUp() {
    if (connectionRef.current) { connectionRef.current.disconnect(); connectionRef.current = null; }
    setCallStatus("idle");
    if (timerRef.current) clearInterval(timerRef.current);
    setDuration(0);
  }

  function formatDuration(s: number) { const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, "0")}`; }

  return (
    <div className="fixed bottom-20 right-6 w-[260px] bg-[#111] border border-white/[0.07] rounded-2xl p-5 z-[200] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
      <div className="flex justify-between items-center mb-3">
        <div className="text-[11px] font-bold text-[#E86A2A] tracking-widest uppercase">Dial Out</div>
        <button onClick={onClose} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3.5 py-2.5 text-lg text-[#e8eaf0] font-mono mb-3 min-h-[42px] tracking-[2px] flex items-center justify-between">
        <span>{number || <span className="text-[#b0b4c8] text-sm font-sans">Enter number</span>}</span>
        {callStatus === "connected" && <span className="text-xs text-emerald-400 font-sans">REC {formatDuration(duration)}</span>}
      </div>
      {callStatus === "connecting" && <div className="text-center py-2 text-xs text-[#E86A2A] mb-2">Connecting...</div>}
      {callStatus === "connected" && <div className="text-center py-2 text-xs text-emerald-400 mb-2">Connected · Recording</div>}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {digits.map(d => (
          <button key={d} onClick={() => setNumber(n => n + d)}
            className="py-3 bg-white/[0.04] border border-white/[0.07] rounded-lg text-[#e8eaf0] text-base cursor-pointer font-mono hover:bg-white/[0.08] transition-colors">
            {d}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {callStatus === "idle" || callStatus === "ended" ? (
          <button onClick={makeCall} disabled={!number.trim()}
            className={`py-3 bg-emerald-500 rounded-lg text-white text-sm font-bold border-none cursor-pointer flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors ${!number.trim() ? "opacity-50 cursor-not-allowed" : ""}`}>
            <Phone className="w-3.5 h-3.5" /> Call
          </button>
        ) : (
          <button onClick={hangUp}
            className="py-3 bg-red-500 rounded-lg text-white text-sm font-bold border-none cursor-pointer flex items-center justify-center gap-2 hover:bg-red-400 transition-colors">
            <PhoneOff className="w-3.5 h-3.5" /> End
          </button>
        )}
        <button onClick={() => setNumber(n => n.slice(0, -1))}
          className="py-3 bg-white/[0.04] border border-white/[0.07] rounded-lg text-[#b0b4c8] text-sm cursor-pointer flex items-center justify-center hover:bg-white/[0.08] transition-colors">
          <Delete className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [dialOpen, setDialOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [subChecked, setSubChecked] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectUrl: "/" });
  }

  async function handleDemoSignOut() {
    setSigningOut(true);
    try { await fetch("/api/demo/reset", { method: "POST" }); } catch {}
    await signOut({ redirectUrl: "/" });
  }

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  // Link Stripe session if coming from checkout
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      fetch("/api/stripe/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
      window.history.replaceState({}, "", pathname);
    }
  }, [isLoaded, isSignedIn, pathname]);

  // Subscription gate
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (!email) return; // wait for Clerk to populate email

    // Admin and demo users bypass Stripe entirely
    if (ADMIN_EMAILS.includes(email) || DEMO_EMAILS.includes(email)) {
      setHasSubscription(true);
      setSubChecked(true);
      return;
    }

    // Everyone else: verify active Stripe subscription
    fetch("/api/stripe/link")
      .then((res) => res.json())
      .then((data) => {
        if (data.active) {
          setHasSubscription(true);
        } else {
          router.push("/#pricing");
        }
        setSubChecked(true);
      })
      .catch(() => {
        // Stripe check failed — redirect to pricing
        router.push("/#pricing");
        setSubChecked(true);
      });
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    function handleOpenDialer(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.number) setDialNumber(detail.number);
      setDialOpen(true);
    }
    window.addEventListener("open-dialer", handleOpenDialer);
    return () => window.removeEventListener("open-dialer", handleOpenDialer);
  }, []);

  // Close account dropdown on outside click
  useEffect(() => {
    if (!accountOpen) return;
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [accountOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  if (!isLoaded) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-[#b0b4c8]">Loading...</div>;
  if (!isSignedIn) return <div className="min-h-screen bg-[#0a0a0a]" />;
  if (!subChecked) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-[#b0b4c8]">Verifying account...</div>;

  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
  const isAdmin = isSignedIn && ADMIN_EMAILS.includes(userEmail);
  const isDemoUser = isSignedIn && DEMO_EMAILS.includes(userEmail);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="max-w-[1400px] mx-auto h-[52px] flex items-center justify-between px-6">
          <Link href="/dashboard" className="font-display text-lg tracking-[1.5px] text-[#e8eaf0] no-underline">
            THE <span className="text-[#E86A2A]">WOLF</span> PACK
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV.map(item => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium no-underline transition-all duration-150 ${
                    active ? "bg-[#E86A2A]/12 text-[#E86A2A]" : "text-[#b0b4c8] hover:bg-white/[0.04] hover:text-[#e8eaf0]"
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
            {isAdmin && (
              <>
                <div className="w-px h-5 bg-white/[0.07] mx-1" />
                {ADMIN_NAV.map(item => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium no-underline transition-all duration-150 ${
                        active ? "bg-[#E86A2A]/12 text-[#E86A2A]" : "text-[#b0b4c8] hover:bg-white/[0.04] hover:text-[#e8eaf0]"
                      }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2.5">
            {/* Account dropdown */}
            <div ref={accountRef} className="relative">
              <button onClick={() => setAccountOpen(v => !v)}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-[#E86A2A] flex items-center justify-center text-[11px] font-extrabold text-white cursor-pointer border-none">
                {user?.firstName?.charAt(0) || "M"}
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-9 w-48 bg-[#161820] border border-white/[0.07] rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.07]">
                    <div className="text-xs font-semibold text-[#e8eaf0] truncate">{user?.firstName} {user?.lastName}</div>
                    <div className="text-[10px] text-[#8b8fa8] truncate">{userEmail}</div>
                  </div>
                  <button onClick={() => { setAccountOpen(false); isDemoUser ? handleDemoSignOut() : handleSignOut(); }} disabled={signingOut}
                    className="w-full text-left px-4 py-2.5 text-xs text-[#b0b4c8] bg-transparent border-none cursor-pointer hover:bg-white/[0.04] hover:text-red-400 transition-colors">
                    {signingOut ? "Signing out..." : "Sign Out"}
                  </button>
                </div>
              )}
            </div>
            {/* Hamburger */}
            <button onClick={() => setMenuOpen(v => !v)} className="lg:hidden bg-transparent border-none cursor-pointer p-1 text-[#e8eaf0]" aria-label="Toggle menu">
              {menuOpen ? <X className="w-5 h-5" /> : <div className="flex flex-col gap-1"><div className="w-5 h-0.5 bg-[#e8eaf0] rounded" /><div className="w-5 h-0.5 bg-[#e8eaf0] rounded" /><div className="w-5 h-0.5 bg-[#e8eaf0] rounded" /></div>}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Nav */}
      {menuOpen && (
        <div className="lg:hidden fixed top-[52px] left-0 right-0 bg-[#0a0a0a]/98 border-b border-white/[0.07] px-6 py-3 z-40 flex flex-wrap gap-1">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium no-underline transition-all ${
                  active ? "bg-[#E86A2A]/12 text-[#E86A2A]" : "text-[#b0b4c8] hover:bg-white/[0.04]"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
          <div className="w-full flex gap-2 mt-2 pt-2 border-t border-white/[0.06]">
            <button onClick={() => { setMenuOpen(false); isDemoUser ? handleDemoSignOut() : handleSignOut(); }} disabled={signingOut}
              className="text-xs text-[#b0b4c8] bg-transparent border-none cursor-pointer hover:text-red-400 px-3 py-2">
              {signingOut ? "..." : "Sign Out"}
            </button>
          </div>
        </div>
      )}

      {dialOpen && isAdmin && <DialPad onClose={() => { setDialOpen(false); setDialNumber(""); }} initialNumber={dialNumber} />}

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-[72px] pb-7">{children}</main>

      <AiAssistant />
    </div>
  );
}
