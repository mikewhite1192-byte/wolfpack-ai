"use client";

import { useEffect, useState } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  bg: "#0D1426",
  blue: "#3498db",
};

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
  status: string;
}

function formatEventTime(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endTime = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { date, time: `${startTime} - ${endTime}` };
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function isTomorrow(dateStr: string) {
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLink, setBookingLink] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/calendar/events");
      const data = await res.json();
      if (data.connected === false) {
        setConnected(false);
      } else {
        setConnected(true);
        setEvents(data.events || []);
      }
      setLoading(false);
    }
    load();
    setBookingLink(`${window.location.origin}/book/default`);
  }, []);

  if (connected === false) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: T.text, marginBottom: 8 }}>CONNECT YOUR CALENDAR</div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 24 }}>
            Connect your Google account to sync your calendar. Leads can book appointments directly and it shows up on your Google Calendar.
          </div>
          <a href="/api/email/connect" style={{ display: "inline-block", padding: "12px 28px", background: T.orange, color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
            Connect Google
          </a>
        </div>
      </div>
    );
  }

  // Group events by day
  const todayEvents = events.filter(e => isToday(e.start));
  const tomorrowEvents = events.filter(e => isTomorrow(e.start));
  const laterEvents = events.filter(e => !isToday(e.start) && !isTomorrow(e.start));

  return (
    <div>
      <style>{`
        .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .cal-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1px; }
        .cal-link-box { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
        .cal-link-label { font-size: 11px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.5px; }
        .cal-link-url { font-size: 13px; color: ${T.orange}; word-break: break-all; flex: 1; }
        .cal-copy-btn { padding: 6px 14px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 6px; color: ${T.text}; font-size: 12px; cursor: pointer; white-space: nowrap; }
        .cal-copy-btn:hover { border-color: ${T.orange}; }
        .cal-section { margin-bottom: 24px; }
        .cal-section-title { font-size: 11px; font-weight: 700; color: ${T.orange}; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
        .cal-event { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 14px 18px; margin-bottom: 8px; display: flex; gap: 14px; align-items: center; }
        .cal-event-time { width: 100px; flex-shrink: 0; }
        .cal-event-date { font-size: 11px; color: ${T.muted}; }
        .cal-event-hours { font-size: 13px; color: ${T.text}; font-weight: 600; }
        .cal-event-info { flex: 1; min-width: 0; }
        .cal-event-name { font-size: 14px; font-weight: 600; color: ${T.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cal-event-attendees { font-size: 12px; color: ${T.muted}; margin-top: 2px; }
        .cal-event-dot { width: 4px; height: 36px; border-radius: 2px; flex-shrink: 0; }
        .cal-empty { font-size: 13px; color: ${T.muted}; padding: 20px 0; }
      `}</style>

      <div className="cal-header">
        <div className="cal-title">CALENDAR</div>
      </div>

      {/* Booking Link */}
      <div className="cal-link-box">
        <div style={{ flex: 1 }}>
          <div className="cal-link-label">Your Booking Link</div>
          <div className="cal-link-url">{bookingLink}</div>
        </div>
        <button className="cal-copy-btn" onClick={() => { navigator.clipboard.writeText(bookingLink); }}>
          Copy Link
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: T.muted, padding: 40 }}>Loading calendar...</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: "center", color: T.muted, padding: 60, fontSize: 14 }}>
          No upcoming appointments.<br />
          <span style={{ fontSize: 12 }}>Share your booking link to start getting appointments.</span>
        </div>
      ) : (
        <>
          {/* Today */}
          {todayEvents.length > 0 && (
            <div className="cal-section">
              <div className="cal-section-title">Today</div>
              {todayEvents.map(e => {
                const { time } = formatEventTime(e.start, e.end);
                return (
                  <div key={e.id} className="cal-event">
                    <div className="cal-event-dot" style={{ background: T.orange }} />
                    <div className="cal-event-time">
                      <div className="cal-event-hours">{time}</div>
                    </div>
                    <div className="cal-event-info">
                      <div className="cal-event-name">{e.summary}</div>
                      {e.attendees && e.attendees.length > 0 && (
                        <div className="cal-event-attendees">{e.attendees.join(", ")}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tomorrow */}
          {tomorrowEvents.length > 0 && (
            <div className="cal-section">
              <div className="cal-section-title">Tomorrow</div>
              {tomorrowEvents.map(e => {
                const { time } = formatEventTime(e.start, e.end);
                return (
                  <div key={e.id} className="cal-event">
                    <div className="cal-event-dot" style={{ background: T.blue }} />
                    <div className="cal-event-time">
                      <div className="cal-event-hours">{time}</div>
                    </div>
                    <div className="cal-event-info">
                      <div className="cal-event-name">{e.summary}</div>
                      {e.attendees && e.attendees.length > 0 && (
                        <div className="cal-event-attendees">{e.attendees.join(", ")}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upcoming */}
          {laterEvents.length > 0 && (
            <div className="cal-section">
              <div className="cal-section-title">Upcoming</div>
              {laterEvents.map(e => {
                const { date, time } = formatEventTime(e.start, e.end);
                return (
                  <div key={e.id} className="cal-event">
                    <div className="cal-event-dot" style={{ background: T.green }} />
                    <div className="cal-event-time">
                      <div className="cal-event-date">{date}</div>
                      <div className="cal-event-hours">{time}</div>
                    </div>
                    <div className="cal-event-info">
                      <div className="cal-event-name">{e.summary}</div>
                      {e.attendees && e.attendees.length > 0 && (
                        <div className="cal-event-attendees">{e.attendees.join(", ")}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
