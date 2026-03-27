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
  purple: "#9b59b6",
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function sameDay(a: string, b: Date) {
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function eventColor(i: number) {
  const colors = [T.orange, T.blue, T.green, T.purple, "#e67e22", "#1abc9c"];
  return colors[i % colors.length];
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addTime, setAddTime] = useState("10:00");
  const [addDuration, setAddDuration] = useState("30");
  const [addAttendee, setAddAttendee] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addMeet, setAddMeet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookingLink, setBookingLink] = useState("");

  useEffect(() => {
    fetchEvents();
    setBookingLink(`${window.location.origin}/book/default`);
  }, []);

  async function fetchEvents() {
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

  async function handleAddEvent() {
    if (!addTitle.trim() || !selectedDate) return;
    setSaving(true);

    const [hours, mins] = addTime.split(":").map(Number);
    const start = new Date(selectedDate);
    start.setHours(hours, mins, 0, 0);
    const end = new Date(start.getTime() + parseInt(addDuration) * 60000);

    await fetch("/api/calendar/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addTitle,
        email: addAttendee || undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        notes: addNotes,
        duration: parseInt(addDuration),
        addGoogleMeet: addMeet,
      }),
    });

    setSaving(false);
    setShowAdd(false);
    setAddTitle("");
    setAddTime("10:00");
    setAddAttendee("");
    setAddNotes("");
    fetchEvents();
  }

  // Build calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
    setSelectedDate(null);
  }
  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
    setSelectedDate(null);
  }

  function getEventsForDay(day: number) {
    const d = new Date(year, month, day);
    return events.filter(e => sameDay(e.start, d));
  }

  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (day: number) => selectedDate && day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();

  const selectedDayEvents = selectedDate ? events.filter(e => sameDay(e.start, selectedDate)) : [];
  const selectedDateStr = selectedDate
    ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

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

  return (
    <div>
      <style>{`
        .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .cal-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1px; }
        .cal-nav { display: flex; align-items: center; gap: 12px; }
        .cal-nav-btn { background: none; border: 1px solid ${T.border}; border-radius: 6px; color: ${T.text}; padding: 6px 12px; cursor: pointer; font-size: 14px; }
        .cal-nav-btn:hover { border-color: ${T.orange}; }
        .cal-month-label { font-size: 16px; font-weight: 700; color: ${T.text}; min-width: 160px; text-align: center; }

        .cal-layout { display: flex; gap: 20px; }
        .cal-grid-wrap { flex: 1; min-width: 0; }
        .cal-sidebar { width: 300px; flex-shrink: 0; }

        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; overflow: hidden; }
        .cal-day-header { padding: 10px; text-align: center; font-size: 11px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; border-bottom: 1px solid ${T.border}; }
        .cal-cell { min-height: 90px; padding: 6px 8px; border-right: 1px solid ${T.border}; border-bottom: 1px solid ${T.border}; cursor: pointer; transition: background 0.15s; position: relative; }
        .cal-cell:nth-child(7n) { border-right: none; }
        .cal-cell:hover { background: rgba(255,255,255,0.03); }
        .cal-cell.today { background: rgba(232,106,42,0.06); }
        .cal-cell.selected { background: rgba(232,106,42,0.12); }
        .cal-cell.empty { cursor: default; background: rgba(0,0,0,0.1); }
        .cal-cell-day { font-size: 12px; font-weight: 600; color: ${T.text}; margin-bottom: 4px; }
        .cal-cell-day.today { color: ${T.orange}; font-weight: 800; }
        .cal-cell-event { font-size: 9px; padding: 1px 4px; border-radius: 3px; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; cursor: pointer; max-width: 100%; display: block; }
        .cal-cell-more { font-size: 10px; color: ${T.muted}; margin-top: 2px; }

        .cal-side-header { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: ${T.text}; letter-spacing: 0.5px; margin-bottom: 4px; }
        .cal-side-date { font-size: 12px; color: ${T.muted}; margin-bottom: 16px; }
        .cal-side-event { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; display: flex; gap: 10px; align-items: center; }
        .cal-side-dot { width: 4px; height: 32px; border-radius: 2px; flex-shrink: 0; }
        .cal-side-name { font-size: 13px; font-weight: 600; color: ${T.text}; }
        .cal-side-time { font-size: 11px; color: ${T.muted}; margin-top: 2px; }
        .cal-side-attendee { font-size: 11px; color: ${T.muted}; }
        .cal-side-empty { font-size: 13px; color: ${T.muted}; padding: 20px 0; }
        .cal-side-add { padding: 10px; background: ${T.orange}; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; width: 100%; margin-top: 12px; }

        .cal-link-box { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        .cal-link-label { font-size: 10px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; }
        .cal-link-url { font-size: 12px; color: ${T.orange}; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cal-copy { padding: 5px 12px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 6px; color: ${T.text}; font-size: 11px; cursor: pointer; }

        .cal-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 300; display: flex; align-items: center; justify-content: center; }
        .cal-modal-box { width: 400px; max-width: 90vw; background: ${T.bg}; border: 1px solid ${T.border}; border-radius: 14px; padding: 24px; }
        .cal-modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: ${T.text}; margin-bottom: 16px; }
        .cal-modal-field { margin-bottom: 12px; }
        .cal-modal-label { font-size: 11px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; margin-bottom: 4px; }
        .cal-modal-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 8px; color: ${T.text}; font-size: 13px; outline: none; box-sizing: border-box; font-family: 'Inter', sans-serif; }
        .cal-modal-input:focus { border-color: ${T.orange}; }
        .cal-modal-row { display: flex; gap: 10px; }
        .cal-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
        .cal-modal-cancel { padding: 8px 16px; background: none; border: 1px solid ${T.border}; border-radius: 8px; color: ${T.muted}; font-size: 13px; cursor: pointer; }
        .cal-modal-save { padding: 8px 20px; background: ${T.orange}; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .cal-modal-save:disabled { opacity: 0.5; }
      `}</style>

      <div className="cal-header">
        <div className="cal-title">CALENDAR</div>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}>←</button>
          <div className="cal-month-label">{MONTHS[month]} {year}</div>
          <button className="cal-nav-btn" onClick={nextMonth}>→</button>
        </div>
      </div>

      {/* Booking Link */}
      <div className="cal-link-box">
        <div style={{ flex: 1 }}>
          <div className="cal-link-label">Booking Link</div>
          <div className="cal-link-url">{bookingLink}</div>
        </div>
        <button className="cal-copy" onClick={() => navigator.clipboard.writeText(bookingLink)}>Copy</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: T.muted, padding: 60 }}>Loading calendar...</div>
      ) : (
        <div className="cal-layout">
          {/* Month Grid */}
          <div className="cal-grid-wrap">
            <div className="cal-grid">
              {DAYS.map(d => <div key={d} className="cal-day-header">{d}</div>)}
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} className="cal-cell empty" />;
                const dayEvents = getEventsForDay(day);
                return (
                  <div
                    key={day}
                    className={`cal-cell ${isToday(day) ? "today" : ""} ${isSelected(day) ? "selected" : ""}`}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                  >
                    <div className={`cal-cell-day ${isToday(day) ? "today" : ""}`}>{day}</div>
                    {dayEvents.slice(0, 1).map((e, ei) => (
                      <div key={e.id} className="cal-cell-event" style={{ background: eventColor(ei) }}>
                        {formatTime(e.start)}
                      </div>
                    ))}
                    {dayEvents.length > 1 && <div className="cal-cell-more">+{dayEvents.length - 1} more</div>}
                    {dayEvents.length === 1 && <div className="cal-cell-more">{dayEvents[0].summary.substring(0, 12)}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Sidebar — Selected Day */}
          <div className="cal-sidebar">
            {selectedDate ? (
              <>
                <div className="cal-side-header">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
                </div>
                <div className="cal-side-date">{selectedDateStr}</div>

                {selectedDayEvents.length === 0 ? (
                  <div className="cal-side-empty">No appointments this day</div>
                ) : (
                  selectedDayEvents.map((e, i) => (
                    <div key={e.id} className="cal-side-event">
                      <div className="cal-side-dot" style={{ background: eventColor(i) }} />
                      <div>
                        <div className="cal-side-name">{e.summary}</div>
                        <div className="cal-side-time">{formatTime(e.start)} - {formatTime(e.end)}</div>
                        {e.attendees && e.attendees.length > 0 && (
                          <div className="cal-side-attendee">{e.attendees.join(", ")}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                <button className="cal-side-add" onClick={() => setShowAdd(true)}>
                  + Add Appointment
                </button>
              </>
            ) : (
              <div>
                <div className="cal-side-header">Select a Day</div>
                <div className="cal-side-empty">Click on a date to see appointments or add a new one</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Appointment Modal */}
      {showAdd && selectedDate && (
        <div className="cal-modal" onClick={() => setShowAdd(false)}>
          <div className="cal-modal-box" onClick={e => e.stopPropagation()}>
            <div className="cal-modal-title">ADD APPOINTMENT</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>{selectedDateStr}</div>

            <div className="cal-modal-field">
              <div className="cal-modal-label">Title / Name *</div>
              <input className="cal-modal-input" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Meeting with John Smith" autoFocus />
            </div>

            <div className="cal-modal-row">
              <div className="cal-modal-field" style={{ flex: 1 }}>
                <div className="cal-modal-label">Time</div>
                <input className="cal-modal-input" type="time" value={addTime} onChange={e => setAddTime(e.target.value)} />
              </div>
              <div className="cal-modal-field" style={{ flex: 1 }}>
                <div className="cal-modal-label">Duration</div>
                <select className="cal-modal-input" value={addDuration} onChange={e => setAddDuration(e.target.value)} style={{ cursor: "pointer" }}>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
            </div>

            <div className="cal-modal-field">
              <div className="cal-modal-label">Attendee Email (optional)</div>
              <input className="cal-modal-input" type="email" value={addAttendee} onChange={e => setAddAttendee(e.target.value)} placeholder="client@email.com" />
            </div>

            <div className="cal-modal-field">
              <div className="cal-modal-label">Notes (optional)</div>
              <textarea className="cal-modal-input" value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Any details..." rows={2} style={{ resize: "none" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", cursor: "pointer" }} onClick={() => setAddMeet(!addMeet)}>
              <div style={{
                width: 36, height: 20, borderRadius: 10, background: addMeet ? T.green : "rgba(255,255,255,0.1)",
                position: "relative", transition: "background 0.2s",
              }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: addMeet ? 18 : 2, transition: "left 0.2s" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Add Google Meet</div>
                <div style={{ fontSize: 11, color: T.muted }}>Auto-generate a video call link</div>
              </div>
            </div>

            <div className="cal-modal-actions">
              <button className="cal-modal-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="cal-modal-save" onClick={handleAddEvent} disabled={saving || !addTitle.trim()}>
                {saving ? "Saving..." : "Add Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
