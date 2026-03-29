"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import AiAssistant from "./components/AiAssistant";

const T = {
  bg: "#0D1426",
  navy: "#080f1e",
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
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
  { label: "Websites", href: "/dashboard/websites", icon: "🌐" },
  { label: "Contacts", href: "/dashboard/contacts", icon: "👥" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙" },
];

function DialPad({ onClose, initialNumber }: { onClose: () => void; initialNumber?: string }) {
  const [number, setNumber] = useState(initialNumber || "");
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "connected" | "ended">("idle");
  const [duration, setDuration] = useState(0);
  const deviceRef = useRef<any>(null);
  const connectionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const digits = ["1","2","3","4","5","6","7","8","9","*","0","#"];

  // Initialize Twilio Device
  const initDevice = useCallback(async () => {
    if (deviceRef.current) return;

    try {
      // Dynamically import Twilio Client SDK
      const { Device } = await import("@twilio/voice-sdk");

      const res = await fetch("/api/calls/token");
      const data = await res.json();

      if (!data.token) {
        console.error("[dial] No token received");
        return;
      }

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
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, [initDevice]);

  async function makeCall() {
    if (!number.trim() || !deviceRef.current) return;

    setCallStatus("connecting");

    // Log the call
    fetch("/api/calls/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toNumber: number }),
    });

    try {
      const call = await deviceRef.current.connect({
        params: { To: number },
      });

      connectionRef.current = call;

      call.on("accept", () => {
        setCallStatus("connected");
        setDuration(0);
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      });

      call.on("disconnect", () => {
        setCallStatus("ended");
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeout(() => {
          setCallStatus("idle");
          setDuration(0);
        }, 2000);
      });

      call.on("cancel", () => {
        setCallStatus("idle");
        if (timerRef.current) clearInterval(timerRef.current);
      });

      call.on("error", (err: Error) => {
        console.error("[dial] Call error:", err);
        setCallStatus("idle");
        if (timerRef.current) clearInterval(timerRef.current);
      });
    } catch (err) {
      console.error("[dial] Connect error:", err);
      setCallStatus("idle");
    }
  }

  function hangUp() {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }
    setCallStatus("idle");
    if (timerRef.current) clearInterval(timerRef.current);
    setDuration(0);
  }

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div style={{ position: "fixed", bottom: 80, left: 24, width: 260, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, zIndex: 200, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, letterSpacing: 1, textTransform: "uppercase" }}>Dial Out</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16 }}>×</button>
      </div>

      {/* Number display */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 18, color: T.text, fontFamily: "monospace", marginBottom: 12, minHeight: 42, letterSpacing: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>{number || <span style={{ color: T.muted, fontSize: 14 }}>Enter number</span>}</span>
        {callStatus === "connected" && (
          <span style={{ fontSize: 12, color: T.green, fontFamily: "Inter, sans-serif" }}>
            🔴 {formatDuration(duration)}
          </span>
        )}
      </div>

      {/* Status */}
      {callStatus === "connecting" && (
        <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: T.orange, marginBottom: 8 }}>
          Connecting...
        </div>
      )}
      {callStatus === "connected" && (
        <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: T.green, marginBottom: 8 }}>
          Connected · Recording
        </div>
      )}

      {/* Keypad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
        {digits.map(d => (
          <button key={d} onClick={() => setNumber(n => n + d)} style={{ padding: "12px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 16, cursor: "pointer", fontFamily: "monospace" }}>{d}</button>
        ))}
      </div>

      {/* Actions */}
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
  const { isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [dialOpen, setDialOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [notifications] = useState(3);
  const [signingOut, setSigningOut] = useState(false);

  async function handleDemoSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/demo/reset", { method: "POST" });
    } catch (err) {
      console.error("Demo reset failed:", err);
    }
    await signOut({ redirectUrl: "/" });
  }

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  // Listen for open-dialer events from deal cards
  useEffect(() => {
    function handleOpenDialer(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.number) setDialNumber(detail.number);
      setDialOpen(true);
    }
    window.addEventListener("open-dialer", handleOpenDialer);
    return () => window.removeEventListener("open-dialer", handleOpenDialer);
  }, []);

  if (!isLoaded) {
    return <div style={{ minHeight: "100vh", background: "#0D1426", display: "flex", alignItems: "center", justifyContent: "center", color: "#b0b4c8" }}>Loading...</div>;
  }

  if (!isSignedIn) {
    return <div style={{ minHeight: "100vh", background: "#0D1426" }} />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg }}>
      <style>{`
        .db-sidebar { width: 220px; background: ${T.navy}; border-right: 1px solid ${T.border}; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
        .db-logo { padding: 20px 20px 16px; border-bottom: 1px solid ${T.border}; }
        .db-logo-text { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: ${T.text}; letter-spacing: 1.5px; }
        .db-logo-text span { color: ${T.orange}; }
        .db-logo-sub { font-size: 10px; color: ${T.muted}; letter-spacing: 0.5px; margin-top: 2px; }
        .db-nav { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
        .db-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: ${T.muted}; text-decoration: none; transition: all 0.15s; }
        .db-nav-item:hover { background: rgba(255,255,255,0.04); color: ${T.text}; }
        .db-nav-item-active { background: rgba(232,106,42,0.12); color: ${T.orange}; }
        .db-nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
        .db-nav-section { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.2); letter-spacing: 1px; text-transform: uppercase; padding: 14px 12px 6px; }
        .db-bottom { padding: 12px 10px; border-top: 1px solid ${T.border}; }
        .db-phone-btn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #2ecc71; background: rgba(46,204,113,0.08); border: 1px solid rgba(46,204,113,0.2); cursor: pointer; width: 100%; transition: all 0.15s; }
        .db-phone-btn:hover { background: rgba(46,204,113,0.15); }

        .db-main { margin-left: 220px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
        .db-topbar { height: 56px; background: ${T.navy}; border-bottom: 1px solid ${T.border}; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; position: sticky; top: 0; z-index: 99; }
        .db-topbar-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: ${T.text}; letter-spacing: 1px; }
        .db-topbar-right { display: flex; align-items: center; gap: 16px; }
        .db-notif-btn { position: relative; background: none; border: none; cursor: pointer; font-size: 18px; color: ${T.muted}; }
        .db-notif-badge { position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; background: ${T.orange}; border-radius: 50%; font-size: 9px; font-weight: 700; color: #fff; display: flex; align-items: center; justify-content: center; }
        .db-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, ${T.orange}); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; cursor: pointer; }
        .db-content { flex: 1; padding: 28px 24px; }

        @media (max-width: 768px) {
          .db-sidebar { transform: translateX(-100%); }
          .db-main { margin-left: 0; }
        }
      `}</style>

      {/* Sidebar */}
      <aside className="db-sidebar">
        <div className="db-logo">
          <div className="db-logo-text">THE <span>WOLF</span> PACK CO</div>
          <div className="db-logo-sub">Client Dashboard</div>
        </div>

        <nav className="db-nav">
          <div className="db-nav-section">Main</div>
          {NAV.slice(0, 2).map(item => (
            <Link key={item.href} href={item.href} className={`db-nav-item ${pathname === item.href ? "db-nav-item-active" : ""}`}>
              <span className="db-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div className="db-nav-section">Communication</div>
          {NAV.slice(2, 4).map(item => (
            <Link key={item.href} href={item.href} className={`db-nav-item ${pathname === item.href ? "db-nav-item-active" : ""}`}>
              <span className="db-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div className="db-nav-section">Configure</div>
          {NAV.slice(4).map(item => (
            <Link key={item.href} href={item.href} className={`db-nav-item ${pathname === item.href ? "db-nav-item-active" : ""}`}>
              <span className="db-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="db-bottom">
          <button className="db-phone-btn" onClick={() => setDialOpen(d => !d)}>
            <span>📞</span> Dial Out
          </button>
          <button
            onClick={handleDemoSignOut}
            disabled={signingOut}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, color: T.muted, background: "none", border: "none", cursor: "pointer", width: "100%", marginTop: 6, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = T.red; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>↪</span>
            {signingOut ? "Resetting..." : "Sign Out"}
          </button>
        </div>
      </aside>

      {dialOpen && <DialPad onClose={() => { setDialOpen(false); setDialNumber(""); }} initialNumber={dialNumber} />}

      {/* Main */}
      <div className="db-main">
        <header className="db-topbar">
          <div className="db-topbar-title">
            {NAV.find(n => n.href === pathname)?.label ?? "Dashboard"}
          </div>
          <div className="db-topbar-right">
            <button className="db-notif-btn">
              🔔
              {notifications > 0 && <span className="db-notif-badge">{notifications}</span>}
            </button>
            <div className="db-avatar">M</div>
          </div>
        </header>
        <main className="db-content">{children}</main>
      </div>

      <AiAssistant />
    </div>
  );
}
