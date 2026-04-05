"use client";

import { useState } from "react";

interface Slot {
  start: string;
  end: string;
  display: string;
}

export default function BookDemoPage() {
  const [step, setStep] = useState<"date" | "time" | "info" | "done">("date");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return {
      value: d.toISOString().split("T")[0],
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      date: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  });

  const weekdays = dates.filter(d => !d.isWeekend);

  async function selectDate(date: string) {
    setSelectedDate(date);
    setLoading(true);
    setError("");
    const res = await fetch(`/api/calendar/demo-slots?date=${date}`);
    const data = await res.json();
    if (data.error) { setError(data.error); setSlots([]); }
    else { setSlots(data.slots || []); }
    setLoading(false);
    setStep("time");
  }

  function selectSlot(slot: Slot) {
    setSelectedSlot(slot);
    setStep("info");
  }

  async function handleBook() {
    if (!name.trim() || !selectedSlot) return;
    setBooking(true);
    const res = await fetch("/api/calendar/demo-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, notes, startTime: selectedSlot.start, endTime: selectedSlot.end }),
    });
    const data = await res.json();
    if (data.booked) setStep("done");
    else setError(data.error || "Failed to book");
    setBooking(false);
  }

  const selectedDateObj = selectedDate ? new Date(selectedDate + "T12:00:00") : null;
  const dateDisplay = selectedDateObj
    ? selectedDateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`
        .bk-card { width: 520px; max-width: 100%; background: #111; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; overflow: hidden; }
        .bk-header { padding: 32px 36px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .bk-title { font-size: 22px; font-weight: 800; color: #e8eaf0; letter-spacing: -0.3px; }
        .bk-subtitle { font-size: 14px; color: rgba(232,230,227,0.4); margin-top: 6px; }
        .bk-body { padding: 28px 36px 32px; }
        .bk-label { font-size: 14px; font-weight: 600; color: #e8eaf0; margin-bottom: 16px; }
        .bk-back { background: none; border: none; color: rgba(232,230,227,0.4); font-size: 13px; cursor: pointer; margin-bottom: 16px; padding: 0; }
        .bk-back:hover { color: #E86A2A; }

        .bk-dates { display: flex; gap: 8px; flex-wrap: wrap; }
        .bk-date { width: 72px; padding: 14px 0; border-radius: 12px; border: 2px solid rgba(255,255,255,0.08); background: transparent; cursor: pointer; text-align: center; transition: all 0.15s; }
        .bk-date:hover { border-color: #E86A2A; }
        .bk-date.selected { border-color: #E86A2A; background: #E86A2A; }
        .bk-date-day { font-size: 11px; color: rgba(232,230,227,0.4); font-weight: 500; }
        .bk-date.selected .bk-date-day { color: rgba(255,255,255,0.8); }
        .bk-date-num { font-size: 22px; font-weight: 800; color: #e8eaf0; margin: 2px 0; }
        .bk-date.selected .bk-date-num { color: #fff; }
        .bk-date-month { font-size: 10px; color: rgba(232,230,227,0.3); font-weight: 500; }
        .bk-date.selected .bk-date-month { color: rgba(255,255,255,0.7); }

        .bk-times { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .bk-time { padding: 12px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.08); background: transparent; color: #e8eaf0; font-size: 14px; font-weight: 600; cursor: pointer; text-align: center; transition: all 0.15s; }
        .bk-time:hover { border-color: #E86A2A; color: #E86A2A; }

        .bk-selected-badge { background: rgba(232,106,42,0.1); border: 1px solid rgba(232,106,42,0.2); border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 14px; color: #E86A2A; font-weight: 600; text-align: center; }

        .bk-field { margin-bottom: 14px; }
        .bk-field-label { font-size: 12px; font-weight: 600; color: rgba(232,230,227,0.4); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .bk-input { width: 100%; padding: 12px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 10px; font-size: 14px; color: #e8eaf0; background: rgba(255,255,255,0.03); outline: none; box-sizing: border-box; font-family: inherit; transition: border 0.15s; }
        .bk-input:focus { border-color: #E86A2A; }
        .bk-input::placeholder { color: rgba(232,230,227,0.2); }

        .bk-submit { width: 100%; padding: 14px; background: #E86A2A; color: #fff; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: background 0.15s; }
        .bk-submit:hover { background: #ff7b3a; }
        .bk-submit:disabled { opacity: 0.5; cursor: default; }

        .bk-done { text-align: center; padding: 20px 0; }
        .bk-done-icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(46,204,113,0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
        .bk-done-title { font-size: 20px; font-weight: 800; color: #e8eaf0; margin-bottom: 8px; }
        .bk-done-date { font-size: 15px; color: rgba(232,230,227,0.5); margin-bottom: 4px; }
        .bk-done-time { font-size: 18px; font-weight: 700; color: #E86A2A; margin-bottom: 16px; }
        .bk-done-text { font-size: 14px; color: rgba(232,230,227,0.4); line-height: 1.6; }

        .bk-empty { text-align: center; padding: 30px; color: rgba(232,230,227,0.4); font-size: 14px; }
        .bk-error { color: #e74c3c; font-size: 13px; margin-top: 8px; }

        .bk-step { display: flex; gap: 6px; justify-content: center; margin-bottom: 20px; }
        .bk-step-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.08); }
        .bk-step-dot.active { background: #E86A2A; }
        .bk-step-dot.done { background: #2ecc71; }
      `}</style>

      <div className="bk-card">
        <div className="bk-header">
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, color: "rgba(232,230,227,0.3)", marginBottom: 8 }}>THE <span style={{ color: "rgba(232,106,42,0.5)" }}>WOLF</span> PACK</div>
          <div className="bk-title">Book a Demo</div>
          <div className="bk-subtitle">30 min — see the AI appointment setter in action</div>
        </div>

        <div className="bk-body">
          <div className="bk-step">
            <div className={`bk-step-dot ${step === "date" ? "active" : "done"}`} />
            <div className={`bk-step-dot ${step === "time" ? "active" : step === "info" || step === "done" ? "done" : ""}`} />
            <div className={`bk-step-dot ${step === "info" ? "active" : step === "done" ? "done" : ""}`} />
          </div>

          {step === "date" && (
            <div>
              <div className="bk-label">Select a date</div>
              <div className="bk-dates">
                {dates.map(d => (
                  <div key={d.value} className={`bk-date ${selectedDate === d.value ? "selected" : ""}`} onClick={() => selectDate(d.value)}>
                    <div className="bk-date-day">{d.day}</div>
                    <div className="bk-date-num">{d.date}</div>
                    <div className="bk-date-month">{d.month}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "time" && (
            <div>
              <button className="bk-back" onClick={() => setStep("date")}>← Back</button>
              <div className="bk-label">{dateDisplay}</div>
              {loading ? (
                <div className="bk-empty">Loading available times...</div>
              ) : error ? (
                <div className="bk-empty">{error}</div>
              ) : slots.length === 0 ? (
                <div className="bk-empty">No available times. Try another day.</div>
              ) : (
                <div className="bk-times">
                  {slots.map(s => (
                    <div key={s.start} className="bk-time" onClick={() => selectSlot(s)}>{s.display}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "info" && selectedSlot && (
            <div>
              <button className="bk-back" onClick={() => setStep("time")}>← Back</button>
              <div className="bk-selected-badge">{dateDisplay} at {selectedSlot.display}</div>
              <div className="bk-field">
                <div className="bk-field-label">Name *</div>
                <input className="bk-input" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" autoFocus />
              </div>
              <div className="bk-field">
                <div className="bk-field-label">Email</div>
                <input className="bk-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div className="bk-field">
                <div className="bk-field-label">Phone</div>
                <input className="bk-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" />
              </div>
              <div className="bk-field">
                <div className="bk-field-label">Notes (optional)</div>
                <textarea className="bk-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything we should know?" rows={2} style={{ resize: "none" }} />
              </div>
              {error && <div className="bk-error">{error}</div>}
              <button className="bk-submit" onClick={handleBook} disabled={booking || !name.trim()}>
                {booking ? "Booking..." : "Confirm Demo"}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="bk-done">
              <div className="bk-done-icon">✓</div>
              <div className="bk-done-title">You're Booked!</div>
              <div className="bk-done-date">{dateDisplay}</div>
              <div className="bk-done-time">{selectedSlot?.display}</div>
              <div className="bk-done-text">
                You'll receive a calendar invite with a Google Meet link shortly.<br />We look forward to showing you.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
