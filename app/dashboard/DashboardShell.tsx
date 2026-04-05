"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import AiAssistant from "./components/AiAssistant";

const T = {
  bg: "#0a0a0a",
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
};

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: "⬡" },
  { label: "Conversations", href: "/dashboard/conversations", icon: "💬" },
  { label: "Email", href: "/dashboard/email", icon: "📧" },
  { label: "Calendar", href: "/dashboard/calendar", icon: "📅" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "📊" },
  { label: "Contacts", href: "/dashboard/contacts", icon: "👥" },
  { label: "GBP", href: "/dashboard/gbp", icon: "📍" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙" },
];

const ADMIN_NAV = [
  { label: "Outreach", href: "/dashboard/outreach", icon: "📨" },
];

const ADMIN_EMAILS = ["info@thewolfpackco.com", "hello@buenaonda.ai"];

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
    } catch (err) {
      console.error("[dial] Init error:", err);
    }
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
    <div style={{ position: "fixed", bottom: 80, right: 24, width: 260, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, zIndex: 200, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, letterSpacing: 1, textTransform: "uppercase" }}>Dial Out</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 18, color: T.text, fontFamily: "monospace", marginBottom: 12, minHeight: 42, letterSpacing: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>{number || <span style={{ color: T.muted, fontSize: 14 }}>Enter number</span>}</span>
        {callStatus === "connected" && <span style={{ fontSize: 12, color: T.green, fontFamily: "Inter, sans-serif" }}>🔴 {formatDuration(duration)}</span>}
      </div>
      {callStatus === "connecting" && <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: T.orange, marginBottom: 8 }}>Connecting...</div>}
      {callStatus === "connected" && <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: T.green, marginBottom: 8 }}>Connected · Recording</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
        {digits.map(d => <button key={d} onClick={() => setNumber(n => n + d)} style={{ padding: "12px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 16, cursor: "pointer", fontFamily: "monospace" }}>{d}</button>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {callStatus === "idle" || callStatus === "ended" ? (
          <button onClick={makeCall} disabled={!number.trim()} style={{ padding: "11px 0", background: T.green, borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", opacity: number.trim() ? 1 : 0.5 }}>📞 Call</button>
        ) : (
          <button onClick={hangUp} style={{ padding: "11px 0", background: T.red, borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>End Call</button>
        )}
        <button onClick={() => setNumber(n => n.slice(0, -1))} style={{ padding: "11px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.muted, fontSize: 13, cursor: "pointer" }}>⌫</button>
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

  async function handleDemoSignOut() {
    setSigningOut(true);
    try { await fetch("/api/demo/reset", { method: "POST" }); } catch {}
    await signOut({ redirectUrl: "/" });
  }

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    function handleOpenDialer(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.number) setDialNumber(detail.number);
      setDialOpen(true);
    }
    window.addEventListener("open-dialer", handleOpenDialer);
    return () => window.removeEventListener("open-dialer", handleOpenDialer);
  }, []);

  if (!isLoaded) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>Loading...</div>;
  if (!isSignedIn) return <div style={{ minHeight: "100vh", background: T.bg }} />;

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <style>{`
        .topnav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(10,10,10,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid ${T.border}; }
        .topnav-inner { max-width: 1400px; margin: 0 auto; height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
        .topnav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: ${T.text}; letter-spacing: 1.5px; text-decoration: none; }
        .topnav-logo span { color: ${T.orange}; }
        .topnav-links { display: flex; align-items: center; gap: 4px; }
        .topnav-link { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; color: ${T.muted}; text-decoration: none; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
        .topnav-link:hover { background: rgba(255,255,255,0.04); color: ${T.text}; }
        .topnav-link-active { background: rgba(232,106,42,0.12); color: ${T.orange}; }
        .topnav-right { display: flex; align-items: center; gap: 10px; }
        .topnav-btn { padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.15s; }
        .topnav-dial { background: rgba(46,204,113,0.1); border: 1px solid rgba(46,204,113,0.2); color: ${T.green}; }
        .topnav-dial:hover { background: rgba(46,204,113,0.18); }
        .topnav-signout { background: none; color: ${T.muted}; }
        .topnav-signout:hover { color: ${T.red}; }
        .topnav-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, ${T.orange}); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #fff; }

        .db-content { max-width: 1400px; margin: 0 auto; padding: 72px 24px 28px; }

        .topnav-hamburger { display: none; background: none; border: none; cursor: pointer; padding: 4px; flex-direction: column; gap: 4px; }
        .topnav-ham-line { width: 20px; height: 2px; background: ${T.text}; border-radius: 2px; }
        .topnav-mobile { display: none; position: fixed; top: 52px; left: 0; right: 0; background: rgba(10,10,10,0.98); border-bottom: 1px solid ${T.border}; padding: 12px 24px 16px; z-index: 99; flex-wrap: wrap; gap: 4px; }

        @media (max-width: 900px) {
          .topnav-links { display: none; }
          .topnav-hamburger { display: flex; }
          .topnav-mobile-open { display: flex; }
        }
      `}</style>

      {/* Top Nav */}
      <nav className="topnav">
        <div className="topnav-inner">
          <Link href="/dashboard" className="topnav-logo">
            THE <span>WOLF</span> PACK
          </Link>

          <div className="topnav-links">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`topnav-link ${pathname === item.href ? "topnav-link-active" : ""}`}
              >
                <span style={{ fontSize: 12 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            {isSignedIn && user?.primaryEmailAddress?.emailAddress && ADMIN_EMAILS.includes(user.primaryEmailAddress.emailAddress.toLowerCase()) && ADMIN_NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`topnav-link ${pathname === item.href ? "topnav-link-active" : ""}`}
                style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 12, marginLeft: 4 }}
              >
                <span style={{ fontSize: 12 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="topnav-right">
            <button className="topnav-btn topnav-dial" onClick={() => setDialOpen(d => !d)}>
              📞 Dial
            </button>
            <button className="topnav-btn topnav-signout" onClick={handleDemoSignOut} disabled={signingOut}>
              {signingOut ? "..." : "Sign Out"}
            </button>
            <div className="topnav-avatar">M</div>
            <button className="topnav-hamburger" onClick={() => setMenuOpen(v => !v)}>
              <div className="topnav-ham-line" />
              <div className="topnav-ham-line" />
              <div className="topnav-ham-line" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Nav */}
      {menuOpen && (
        <div className="topnav-mobile topnav-mobile-open">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`topnav-link ${pathname === item.href ? "topnav-link-active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <span style={{ fontSize: 12 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      )}

      {dialOpen && <DialPad onClose={() => { setDialOpen(false); setDialNumber(""); }} initialNumber={dialNumber} />}

      {/* Content */}
      <main className="db-content">{children}</main>

      <AiAssistant />
    </div>
  );
}
