"use client";

import { useState, useEffect } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111827",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  bg: "#0D1426",
};

interface Slot {
  start: string;
  end: string;
  display: string;
}

export default function BookingPage() {
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

  // Generate next 14 days
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

  async function selectDate(date: string) {
    setSelectedDate(date);
    setLoading(true);
    setError("");
    const res = await fetch(`/api/calendar/slots?date=${date}`);
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setSlots([]);
    } else {
      setSlots(data.slots || []);
    }
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
    const res = await fetch("/api/calendar/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, email, phone, notes,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
      }),
    });
    const data = await res.json();
    if (data.booked) {
      setStep("done");
    } else {
      setError(data.error || "Failed to book");
    }
    setBooking(false);
  }

  const selectedDateObj = selectedDate ? new Date(selectedDate + "T12:00:00") : null;
  const dateDisplay = selectedDateObj
    ? selectedDateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 480, maxWidth: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "24px 28px", borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: T.text, letterSpacing: 1 }}>
            BOOK AN APPOINTMENT
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>30 minute consultation</div>
        </div>

        <div style={{ padding: "24px 28px" }}>

          {/* Step 1: Pick a Date */}
          {step === "date" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>Select a date</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {dates.filter(d => !d.isWeekend).map(d => (
                  <button
                    key={d.value}
                    onClick={() => selectDate(d.value)}
                    style={{
                      padding: "12px 8px", borderRadius: 10, border: `1px solid ${T.border}`,
                      background: selectedDate === d.value ? T.orange : "rgba(255,255,255,0.03)",
                      color: selectedDate === d.value ? "#fff" : T.text,
                      cursor: "pointer", textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, color: selectedDate === d.value ? "#fff" : T.muted }}>{d.day}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif" }}>{d.date}</div>
                    <div style={{ fontSize: 10, color: selectedDate === d.value ? "#fff" : T.muted }}>{d.month}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Pick a Time */}
          {step === "time" && (
            <div>
              <button onClick={() => setStep("date")} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", marginBottom: 12 }}>
                ← Back to dates
              </button>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>{dateDisplay}</div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>Select a time</div>

              {loading ? (
                <div style={{ textAlign: "center", color: T.muted, padding: 30 }}>Loading available times...</div>
              ) : error ? (
                <div style={{ textAlign: "center", color: T.muted, padding: 30 }}>{error}</div>
              ) : slots.length === 0 ? (
                <div style={{ textAlign: "center", color: T.muted, padding: 30 }}>No available times on this date. Try another day.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {slots.map(s => (
                    <button
                      key={s.start}
                      onClick={() => selectSlot(s)}
                      style={{
                        padding: "10px", borderRadius: 8, border: `1px solid ${T.border}`,
                        background: "rgba(255,255,255,0.03)", color: T.text, fontSize: 13,
                        fontWeight: 600, cursor: "pointer", textAlign: "center",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text; }}
                    >
                      {s.display}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Your Info */}
          {step === "info" && selectedSlot && (
            <div>
              <button onClick={() => setStep("time")} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", marginBottom: 12 }}>
                ← Back to times
              </button>
              <div style={{ background: "rgba(232,106,42,0.08)", border: `1px solid rgba(232,106,42,0.2)`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: T.orange }}>
                {dateDisplay} at {selectedSlot.display}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>Name *</div>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>Email</div>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@email.com" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>Phone</div>
                  <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="(555) 000-0000" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>Notes (optional)</div>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything we should know?" rows={2} style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              {error && <div style={{ color: T.red, fontSize: 12, marginTop: 8 }}>{error}</div>}

              <button
                onClick={handleBook}
                disabled={booking || !name.trim()}
                style={{
                  width: "100%", padding: "12px", background: T.orange, color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", marginTop: 16, opacity: booking || !name.trim() ? 0.5 : 1,
                }}
              >
                {booking ? "Booking..." : "Confirm Appointment"}
              </button>
            </div>
          )}

          {/* Step 4: Confirmed */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: T.text, marginBottom: 8 }}>
                YOU'RE BOOKED!
              </div>
              <div style={{ fontSize: 14, color: T.muted, marginBottom: 6 }}>{dateDisplay}</div>
              <div style={{ fontSize: 16, color: T.orange, fontWeight: 700, marginBottom: 16 }}>{selectedSlot?.display}</div>
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                You'll receive a calendar invite shortly.<br />We look forward to speaking with you!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
