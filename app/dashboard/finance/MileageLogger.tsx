"use client";

import { useEffect, useState, useCallback } from "react";
import { Car, Plus, Trash2, MapPin } from "lucide-react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
};

const MILEAGE_RATE = 0.67;

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

interface Trip {
  id: string;
  date: string;
  destination: string;
  miles: number;
  purpose: string | null;
  deduction: number;
}

export default function MileageLogger() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [totals, setTotals] = useState({ total_miles: 0, total_deduction: 0, trip_count: 0 });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), destination: "", miles: "", purpose: "" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/mileage?year=${new Date().getFullYear()}`);
      const data = await res.json();
      setTrips(data.trips || []);
      setTotals(data.totals || { total_miles: 0, total_deduction: 0, trip_count: 0 });
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd() {
    if (!form.destination || !form.miles) return;
    setAdding(true);
    try {
      await fetch("/api/finance/mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ date: new Date().toISOString().slice(0, 10), destination: "", miles: "", purpose: "" });
      fetchData();
    } catch { /* silent */ }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this trip?")) return;
    await fetch("/api/finance/mileage", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  }

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: T.muted }}>Loading...</div>;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif" }}>{parseFloat(String(totals.total_miles)).toLocaleString()}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Total Miles</div>
          <div style={{ fontSize: 10, color: T.muted }}>YTD {new Date().getFullYear()}</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(parseFloat(String(totals.total_deduction)))}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Total Deduction</div>
          <div style={{ fontSize: 10, color: T.muted }}>${MILEAGE_RATE}/mile × {parseFloat(String(totals.total_miles)).toLocaleString()} miles</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{totals.trip_count}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Trips Logged</div>
        </div>
      </div>

      {/* Add trip form */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Log a Trip</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>Destination</label>
            <input placeholder="Client meeting, office supply run..." value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>Miles</label>
            <input type="number" step="0.1" placeholder="0" value={form.miles} onChange={(e) => setForm({ ...form, miles: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>Purpose (optional)</label>
            <input placeholder="Business purpose..." value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 13 }} />
          </div>
          <button onClick={handleAdd} disabled={adding || !form.destination || !form.miles}
            style={{ padding: "8px 18px", background: T.orange, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: (!form.destination || !form.miles) ? 0.5 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus style={{ width: 14, height: 14 }} /> {adding ? "..." : "Add"}
          </button>
        </div>
        {form.miles && (
          <div style={{ marginTop: 10, fontSize: 12, color: T.green }}>
            Deduction: {fmt(parseFloat(form.miles || "0") * MILEAGE_RATE)}
          </div>
        )}
      </div>

      {/* Trip list */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Trip Log</div>
        {trips.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: T.muted, fontSize: 13 }}>No trips logged yet. Add your first trip above.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {trips.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: `1px solid ${T.border}` }}>
                <Car style={{ width: 14, height: 14, color: T.orange, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.destination}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {t.date} {t.purpose && `· ${t.purpose}`}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap" }}>
                  {parseFloat(String(t.miles)).toFixed(1)} mi
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.green, whiteSpace: "nowrap" }}>
                  {fmt(parseFloat(String(t.deduction)))}
                </div>
                <button onClick={() => handleDelete(t.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4, opacity: 0.5 }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
