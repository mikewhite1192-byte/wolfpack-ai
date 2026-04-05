"use client";

import { useState } from "react";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface Slot { start: string; end: string; display: string; }

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  // Build 2-week calendar grid starting from next available day
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find the Sunday that starts the week containing tomorrow
  const calStart = new Date(tomorrow);
  calStart.setDate(calStart.getDate() - calStart.getDay());

  // Build 3 weeks of cells to ensure we cover 14 days from tomorrow
  const calendarCells: Array<{ value: string; date: number; day: string; month: string; isPast: boolean; isToday: boolean }> = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(calStart);
    d.setDate(d.getDate() + i);
    const isPast = d <= today;
    calendarCells.push({
      value: d.toISOString().split("T")[0],
      date: d.getDate(),
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      month: d.toLocaleDateString("en-US", { month: "short" }),
      isPast,
      isToday: d.toDateString() === today.toDateString(),
    });
  }

  // Trim to only show full weeks that contain bookable dates
  const firstBookableIdx = calendarCells.findIndex(c => !c.isPast);
  const startRow = Math.floor(firstBookableIdx / 7) * 7;
  const displayCells = calendarCells.slice(startRow, startRow + 14);

  // Month label for header
  const months = [...new Set(displayCells.filter(c => !c.isPast).map(c => c.month))];
  const monthLabel = months.join(" / ");

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

  function selectSlot(slot: Slot) { setSelectedSlot(slot); setStep("info"); }

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
  const dateDisplay = selectedDateObj ? selectedDateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-[540px] max-w-full bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-9 pt-8 pb-6 text-center border-b border-white/[0.06]">
          <Link href="/" className="no-underline">
            <div className="font-display text-sm tracking-[2px] text-white/30 mb-2">THE <span className="text-[#E86A2A]/50">WOLF</span> PACK</div>
          </Link>
          <div className="text-[22px] font-extrabold text-[#e8eaf0] tracking-tight">Book a Demo</div>
          <div className="text-sm text-white/40 mt-1.5">30 min — see the AI appointment setter in action</div>
        </div>

        <div className="px-9 py-7">
          {/* Progress dots */}
          <div className="flex gap-1.5 justify-center mb-5">
            <div className={`w-2 h-2 rounded-full ${step === "date" ? "bg-[#E86A2A]" : "bg-emerald-400"}`} />
            <div className={`w-2 h-2 rounded-full ${step === "time" ? "bg-[#E86A2A]" : step === "info" || step === "done" ? "bg-emerald-400" : "bg-white/[0.08]"}`} />
            <div className={`w-2 h-2 rounded-full ${step === "info" ? "bg-[#E86A2A]" : step === "done" ? "bg-emerald-400" : "bg-white/[0.08]"}`} />
          </div>

          {/* ── DATE STEP ── */}
          {step === "date" && (
            <div>
              <div className="text-sm font-semibold text-[#e8eaf0] mb-4">Select a date</div>
              <div className="text-xs text-white/30 text-center mb-3 font-semibold tracking-wider uppercase">{monthLabel}</div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_HEADERS.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-white/30 uppercase py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {displayCells.map(d => (
                  <button
                    key={d.value}
                    disabled={d.isPast}
                    onClick={() => !d.isPast && selectDate(d.value)}
                    className={`py-3 rounded-xl text-center transition-all duration-150 border-2 cursor-pointer ${
                      selectedDate === d.value
                        ? "border-[#E86A2A] bg-[#E86A2A] text-white"
                        : d.isPast
                          ? "border-transparent bg-transparent text-white/10 cursor-not-allowed"
                          : d.isToday
                            ? "border-white/10 bg-white/[0.03] text-[#e8eaf0] hover:border-[#E86A2A]"
                            : "border-white/[0.06] bg-transparent text-[#e8eaf0] hover:border-[#E86A2A]"
                    }`}
                  >
                    <div className="text-lg font-bold leading-none">{d.date}</div>
                    <div className={`text-[9px] mt-0.5 ${selectedDate === d.value ? "text-white/70" : "text-white/25"}`}>{d.month}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── TIME STEP ── */}
          {step === "time" && (
            <div>
              <button onClick={() => setStep("date")} className="flex items-center gap-1 bg-transparent border-none text-white/40 text-sm cursor-pointer mb-4 p-0 hover:text-[#E86A2A] transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <div className="text-sm font-semibold text-[#e8eaf0] mb-4">{dateDisplay}</div>
              {loading ? (
                <div className="text-center py-8 text-white/40 text-sm">Loading available times...</div>
              ) : error ? (
                <div className="text-center py-8 text-white/40 text-sm">{error}</div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">No available times. Try another day.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map(s => (
                    <button key={s.start} onClick={() => selectSlot(s)}
                      className="py-3 rounded-xl border-2 border-white/[0.06] bg-transparent text-[#e8eaf0] text-sm font-semibold cursor-pointer text-center hover:border-[#E86A2A] hover:text-[#E86A2A] transition-all">
                      {s.display}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── INFO STEP ── */}
          {step === "info" && selectedSlot && (
            <div>
              <button onClick={() => setStep("time")} className="flex items-center gap-1 bg-transparent border-none text-white/40 text-sm cursor-pointer mb-4 p-0 hover:text-[#E86A2A] transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <div className="bg-[#E86A2A]/10 border border-[#E86A2A]/20 rounded-xl px-4 py-3 mb-5 text-sm text-[#E86A2A] font-semibold text-center">
                {dateDisplay} at {selectedSlot.display}
              </div>
              {[
                { label: "Name *", value: name, set: setName, ph: "Your full name", type: "text", focus: true },
                { label: "Email", value: email, set: setEmail, ph: "you@email.com", type: "email" },
                { label: "Phone", value: phone, set: setPhone, ph: "(555) 000-0000", type: "tel" },
              ].map(f => (
                <div key={f.label} className="mb-3.5">
                  <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">{f.label}</div>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.ph}
                    autoFocus={f.focus}
                    className="w-full px-4 py-3 border-2 border-white/[0.06] rounded-xl text-sm text-[#e8eaf0] bg-white/[0.03] outline-none focus:border-[#E86A2A] transition-colors"
                  />
                </div>
              ))}
              <div className="mb-3.5">
                <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Notes (optional)</div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Anything we should know?"
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-white/[0.06] rounded-xl text-sm text-[#e8eaf0] bg-white/[0.03] outline-none resize-none focus:border-[#E86A2A] transition-colors"
                />
              </div>
              {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
              <button onClick={handleBook} disabled={booking || !name.trim()}
                className={`w-full py-3.5 rounded-xl text-[15px] font-bold border-none cursor-pointer mt-2 transition-colors ${
                  booking || !name.trim() ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-[#E86A2A] text-white hover:bg-[#ff7b3a]"
                }`}>
                {booking ? "Booking..." : "Confirm Demo"}
              </button>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="text-center py-5">
              <div className="w-16 h-16 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="text-xl font-extrabold text-[#e8eaf0] mb-2">You're Booked!</div>
              <div className="text-[15px] text-white/50 mb-1">{dateDisplay}</div>
              <div className="text-lg font-bold text-[#E86A2A] mb-4">{selectedSlot?.display}</div>
              <div className="text-sm text-white/40 leading-relaxed">
                You'll receive a calendar invite with a Google Meet link shortly.<br />We look forward to showing you.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
