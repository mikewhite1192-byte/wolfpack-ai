"use client";

import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Copy, X, Video } from "lucide-react";

interface CalendarEvent { id: string; summary: string; start: string; end: string; attendees?: string[]; description?: string; status: string; }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EVENT_COLORS = ["#E86A2A", "#3498db", "#2ecc71", "#9b59b6", "#e67e22", "#1abc9c"];

function sameDay(a: string, b: Date) { const d = new Date(a); return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate(); }
function formatTime(d: string) { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }

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
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchEvents(); setBookingLink(`${window.location.origin}/book/default`); }, []);

  async function fetchEvents() { const res = await fetch("/api/calendar/events"); const data = await res.json(); if (data.connected === false) { setConnected(false); } else { setConnected(true); setEvents(data.events || []); } setLoading(false); }

  async function handleAddEvent() {
    if (!addTitle.trim() || !selectedDate) return;
    setSaving(true);
    const [hours, mins] = addTime.split(":").map(Number);
    const start = new Date(selectedDate); start.setHours(hours, mins, 0, 0);
    const end = new Date(start.getTime() + parseInt(addDuration) * 60000);
    await fetch("/api/calendar/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: addTitle, email: addAttendee || undefined, startTime: start.toISOString(), endTime: end.toISOString(), notes: addNotes, duration: parseInt(addDuration), addGoogleMeet: addMeet }) });
    setSaving(false); setShowAdd(false); setAddTitle(""); setAddTime("10:00"); setAddAttendee(""); setAddNotes(""); fetchEvents();
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (day: number) => selectedDate && day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
  const getEventsForDay = (day: number) => events.filter(e => sameDay(e.start, new Date(year, month, day)));
  const selectedDayEvents = selectedDate ? events.filter(e => sameDay(e.start, selectedDate)) : [];
  const selectedDateStr = selectedDate ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";

  function handleCopy() { navigator.clipboard.writeText(bookingLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  if (connected === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-[400px]">
          <CalendarIcon className="w-12 h-12 text-[#E86A2A] mx-auto mb-4" />
          <div className="font-display text-2xl text-[#e8eaf0] tracking-wider mb-2">CONNECT YOUR CALENDAR</div>
          <div className="text-sm text-[#b0b4c8] leading-relaxed mb-6">Connect your Google account to sync your calendar. Leads can book appointments directly.</div>
          <a href="/api/email/connect" className="inline-block px-7 py-3 bg-[#E86A2A] text-white rounded-xl text-sm font-bold no-underline hover:bg-[#ff7b3a] transition-colors">Connect Google</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="font-display text-[28px] text-[#e8eaf0] tracking-wide">CALENDAR</div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setCurrentMonth(new Date(year, month - 1, 1)); setSelectedDate(null); }}
            className="bg-transparent border border-white/[0.07] rounded-md text-[#e8eaf0] p-1.5 cursor-pointer hover:border-[#E86A2A] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-base font-bold text-[#e8eaf0] min-w-[160px] text-center">{MONTHS[month]} {year}</div>
          <button onClick={() => { setCurrentMonth(new Date(year, month + 1, 1)); setSelectedDate(null); }}
            className="bg-transparent border border-white/[0.07] rounded-md text-[#e8eaf0] p-1.5 cursor-pointer hover:border-[#E86A2A] transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Booking Link */}
      <div className="bg-[#111] border border-white/[0.07] rounded-xl px-4 py-3 mb-5 flex items-center gap-2.5">
        <div className="flex-1">
          <div className="text-[10px] font-bold text-[#b0b4c8] uppercase tracking-wider">Booking Link</div>
          <div className="text-xs text-[#E86A2A] overflow-hidden text-ellipsis whitespace-nowrap">{bookingLink}</div>
        </div>
        <button onClick={handleCopy} className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.07] rounded-md text-[11px] text-[#e8eaf0] cursor-pointer hover:border-[#E86A2A] transition-colors">
          <Copy className="w-3 h-3" /> {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-[#b0b4c8] py-16">Loading calendar...</div>
      ) : (
        <div className="flex gap-5 flex-col lg:flex-row">
          {/* Month Grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-7 bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden">
              {DAYS.map(d => <div key={d} className="py-2.5 text-center text-[11px] font-bold text-[#b0b4c8] uppercase border-b border-white/[0.07]">{d}</div>)}
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} className="min-h-[90px] p-1.5 border-r border-b border-white/[0.07] [&:nth-child(7n)]:border-r-0 bg-black/10" />;
                const dayEvents = getEventsForDay(day);
                return (
                  <div key={day} onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`min-h-[90px] p-1.5 border-r border-b border-white/[0.07] [&:nth-child(7n)]:border-r-0 cursor-pointer transition-colors hover:bg-white/[0.03] ${isToday(day) ? "bg-[#E86A2A]/[0.06]" : ""} ${isSelected(day) ? "bg-[#E86A2A]/12" : ""}`}>
                    <div className={`text-xs font-semibold mb-1 ${isToday(day) ? "text-[#E86A2A] font-extrabold" : "text-[#e8eaf0]"}`}>{day}</div>
                    {dayEvents.slice(0, 1).map((e, ei) => (
                      <div key={e.id} className="text-[9px] px-1 py-0.5 rounded text-white mb-px whitespace-nowrap overflow-hidden text-ellipsis" style={{ background: EVENT_COLORS[ei % EVENT_COLORS.length] }}>
                        {formatTime(e.start)}
                      </div>
                    ))}
                    {dayEvents.length > 1 && <div className="text-[10px] text-[#b0b4c8] mt-0.5">+{dayEvents.length - 1} more</div>}
                    {dayEvents.length === 1 && <div className="text-[10px] text-[#b0b4c8] mt-0.5">{dayEvents[0].summary.substring(0, 12)}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[300px] flex-shrink-0">
            {selectedDate ? (
              <>
                <div className="font-display text-lg text-[#e8eaf0] tracking-wider mb-1">{selectedDate.toLocaleDateString("en-US", { weekday: "long" })}</div>
                <div className="text-xs text-[#b0b4c8] mb-4">{selectedDateStr}</div>
                {selectedDayEvents.length === 0 ? (
                  <div className="text-sm text-[#b0b4c8] py-5">No appointments this day</div>
                ) : (
                  selectedDayEvents.map((e, i) => (
                    <div key={e.id} className="bg-[#111] border border-white/[0.07] rounded-lg px-3 py-2.5 mb-2 flex gap-2.5 items-center hover:border-white/[0.12] transition-colors">
                      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: EVENT_COLORS[i % EVENT_COLORS.length] }} />
                      <div>
                        <div className="text-[13px] font-semibold text-[#e8eaf0]">{e.summary}</div>
                        <div className="text-[11px] text-[#b0b4c8] mt-0.5">{formatTime(e.start)} - {formatTime(e.end)}</div>
                        {e.attendees && e.attendees.length > 0 && <div className="text-[11px] text-[#b0b4c8]">{e.attendees.join(", ")}</div>}
                      </div>
                    </div>
                  ))
                )}
                <button onClick={() => setShowAdd(true)} className="w-full py-2.5 bg-[#E86A2A] text-white border-none rounded-lg text-sm font-bold cursor-pointer mt-3 flex items-center justify-center gap-1.5 hover:bg-[#ff7b3a] transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Appointment
                </button>
              </>
            ) : (
              <div>
                <div className="font-display text-lg text-[#e8eaf0] tracking-wider mb-1">Select a Day</div>
                <div className="text-sm text-[#b0b4c8] py-5">Click on a date to see appointments or add a new one</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && selectedDate && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="w-[400px] max-w-[90vw] bg-[#0a0a0a] border border-white/[0.07] rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-1">
              <div className="font-display text-xl text-[#e8eaf0]">ADD APPOINTMENT</div>
              <button onClick={() => setShowAdd(false)} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-[#b0b4c8] mb-4">{selectedDateStr}</div>

            {[{ label: "Title / Name *", value: addTitle, set: setAddTitle, ph: "Meeting with John Smith", focus: true }].map(f => (
              <div key={f.label} className="mb-3">
                <div className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-1">{f.label}</div>
                <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} autoFocus={f.focus}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
              </div>
            ))}

            <div className="flex gap-2.5 mb-3">
              <div className="flex-1">
                <div className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-1">Time</div>
                <input type="time" value={addTime} onChange={e => setAddTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-1">Duration</div>
                <select value={addDuration} onChange={e => setAddDuration(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none cursor-pointer">
                  {[["15","15 min"],["30","30 min"],["45","45 min"],["60","1 hour"],["90","1.5 hours"],["120","2 hours"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-1">Attendee Email (optional)</div>
              <input type="email" value={addAttendee} onChange={e => setAddAttendee(e.target.value)} placeholder="client@email.com"
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
            </div>

            <div className="mb-3">
              <div className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider mb-1">Notes (optional)</div>
              <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Any details..." rows={2}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none resize-none focus:border-[#E86A2A]/40 transition-colors" />
            </div>

            <div className="flex items-center gap-2.5 py-2.5 cursor-pointer" onClick={() => setAddMeet(!addMeet)}>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors relative ${addMeet ? "bg-emerald-400" : "bg-white/10"}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${addMeet ? "left-[18px]" : "left-0.5"}`} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#e8eaf0] flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> Add Google Meet</div>
                <div className="text-[11px] text-[#b0b4c8]">Auto-generate a video call link</div>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-transparent border border-white/[0.07] rounded-lg text-sm text-[#b0b4c8] cursor-pointer hover:bg-white/[0.04] transition-colors">Cancel</button>
              <button onClick={handleAddEvent} disabled={saving || !addTitle.trim()}
                className={`px-5 py-2 bg-[#E86A2A] text-white border-none rounded-lg text-sm font-bold cursor-pointer transition-colors ${saving ? "opacity-50" : "hover:bg-[#ff7b3a]"}`}>
                {saving ? "Saving..." : "Add Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
