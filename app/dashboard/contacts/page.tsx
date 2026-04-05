"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, MessageSquare, Trash2, Upload } from "lucide-react";
import DealPanel from "../components/DealPanel";
import CsvImportModal from "../components/CsvImportModal";

interface Contact {
  id: string; first_name: string | null; last_name: string | null; email: string | null;
  phone: string | null; company: string | null; source: string | null; lead_score: number;
  stage_name: string | null; stage_color: string | null; deal_value: string | null;
  deal_id: string | null; last_contacted: string | null; created_at: string;
}

interface ContactList { id: string; name: string; color: string; contact_count: string; }

const COLS = ["Name", "Phone", "Email", "Stage", "Value", "Last Contact", ""];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [counts, setCounts] = useState({ active: 0, won: 0, lost: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"active" | "won" | "lost">("active");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "" });
  const [saving, setSaving] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => { fetch("/api/contact-lists").then(r => r.json()).then(data => setLists(data.lists || [])).catch(() => {}); }, []);

  async function createList() {
    if (!newListName.trim()) return;
    const res = await fetch("/api/contact-lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newListName.trim() }) });
    const data = await res.json();
    if (data.list) { setLists(prev => [...prev, { ...data.list, contact_count: "0" }]); setActiveList(data.list.id); setShowNewList(false); setNewListName(""); }
  }

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("status", statusTab);
    if (activeList) params.set("listId", activeList);
    const res = await fetch(`/api/contacts?${params}`);
    const data = await res.json();
    setContacts(data.contacts || []); setCounts(data.counts || { active: 0, won: 0, lost: 0 }); setLoading(false);
  }, [search, statusTab, activeList]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 300); return () => clearTimeout(t); }, [searchInput]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const res = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
    if (res.ok) { setFormData({ firstName: "", lastName: "", email: "", phone: "", company: "" }); setShowForm(false); fetchContacts(); } else { const err = await res.json(); alert(err.error || "Failed"); }
    setSaving(false);
  }

  async function handleDelete(id: string) { if (!confirm("Delete this contact and all associated data?")) return; await fetch(`/api/contacts/${id}`, { method: "DELETE" }); fetchContacts(); }
  function formatDate(d: string | null) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="font-display text-[28px] text-[#e8eaf0] tracking-wide">CONTACTS</div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-[#111] text-[#e8eaf0] text-sm font-semibold border border-white/[0.07] rounded-lg cursor-pointer hover:bg-white/[0.06] transition-colors">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-5 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer hover:bg-[#ff7b3a] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Contact
          </button>
        </div>
      </div>

      {/* List tabs */}
      <div className="flex gap-1.5 mb-3 flex-wrap items-center">
        {lists.length > 0 && (
          <>
            <button onClick={() => setActiveList(null)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none transition-all ${!activeList ? "bg-[#E86A2A]/12 text-[#E86A2A]" : "bg-white/[0.04] text-[#b0b4c8] hover:bg-white/[0.06]"}`}>
              All Contacts
            </button>
            {lists.map(list => (
              <button key={list.id} onClick={() => setActiveList(list.id)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-none transition-all ${activeList === list.id ? "text-white" : "bg-white/[0.04] text-[#b0b4c8] hover:bg-white/[0.06]"}`}
                style={activeList === list.id ? { background: `${list.color}20`, color: list.color } : {}}>
                {list.name} <span className="text-[10px] opacity-60">{list.contact_count}</span>
              </button>
            ))}
          </>
        )}
        {showNewList ? (
          <div className="flex gap-1 items-center">
            <input value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === "Enter" && createList()} placeholder="List name..." autoFocus
              className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.07] rounded-md text-[11px] text-[#e8eaf0] outline-none w-[120px] focus:border-[#E86A2A]/40 transition-colors" />
            <button onClick={createList} className="px-2.5 py-1.5 bg-[#E86A2A] text-white border-none rounded-md text-[10px] font-bold cursor-pointer">Add</button>
            <button onClick={() => { setShowNewList(false); setNewListName(""); }} className="bg-transparent border-none text-[#b0b4c8] cursor-pointer"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => setShowNewList(true)} className="flex items-center gap-1 px-2.5 py-1.5 bg-transparent border border-dashed border-white/[0.07] rounded-md text-[11px] text-[#b0b4c8] cursor-pointer hover:border-white/[0.15] transition-colors">
            <Plus className="w-2.5 h-2.5" /> New List
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex border-b border-white/[0.07] mb-4">
        {[
          { id: "active" as const, label: "Active", count: counts.active },
          { id: "won" as const, label: "Closed Won", count: counts.won },
          { id: "lost" as const, label: "Dead / Lost", count: counts.lost },
        ].map(t => (
          <button key={t.id} onClick={() => setStatusTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold cursor-pointer border-b-2 bg-transparent transition-all ${
              statusTab === t.id ? "text-[#E86A2A] border-[#E86A2A]" : "text-[#b0b4c8] border-transparent hover:text-[#e8eaf0]"
            }`}>
            {t.label} <span className="text-[11px] bg-white/[0.06] px-2 py-0.5 rounded-full">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input placeholder="Search by name, phone, or email..." value={searchInput} onChange={e => setSearchInput(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
      </div>

      {/* Table */}
      <div className="bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.5fr_1fr_1.5fr_1fr_0.8fr_1fr_0.6fr] px-5 py-3 border-b border-white/[0.07]">
          {COLS.map(c => <div key={c} className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider">{c}</div>)}
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#b0b4c8] text-sm">Loading...</div>
        ) : contacts.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-sm text-[#b0b4c8]">No contacts yet</div>
            <div className="text-xs text-white/20 mt-1.5">Add your first lead or import a list to get started</div>
          </div>
        ) : (
          contacts.map(c => (
            <div key={c.id} onClick={() => c.deal_id && setSelectedDeal(c.deal_id)}
              className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1.5fr_1fr_0.8fr_1fr_0.6fr] px-5 py-3.5 border-b border-white/[0.07] last:border-b-0 items-center cursor-pointer hover:bg-white/[0.03] transition-colors">
              <div>
                <div className="text-sm text-[#e8eaf0] font-medium">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</div>
                {c.company && <div className="text-[11px] text-[#b0b4c8] mt-0.5">{c.company}</div>}
              </div>
              <div className="text-sm text-[#b0b4c8]">{c.phone || "—"}</div>
              <div className="text-sm text-[#b0b4c8] truncate">{c.email || "—"}</div>
              <div>
                {c.stage_name ? (
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: `${c.stage_color}20`, color: c.stage_color || "#b0b4c8" }}>{c.stage_name}</span>
                ) : <span className="text-sm text-[#b0b4c8]">—</span>}
              </div>
              <div className="text-sm text-[#e8eaf0]">{c.deal_value ? `$${parseFloat(c.deal_value).toLocaleString()}` : "—"}</div>
              <div className="text-sm text-[#b0b4c8]">{formatDate(c.last_contacted)}</div>
              <div className="flex gap-1 items-center">
                {c.phone && c.deal_id && (
                  <button onClick={e => { e.stopPropagation(); setSelectedDeal(c.deal_id); }} title="Text"
                    className="bg-transparent border-none text-[#E86A2A] cursor-pointer p-1 rounded hover:bg-[#E86A2A]/10 transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }} title="Delete"
                  className="bg-transparent border-none text-[#b0b4c8] cursor-pointer p-1 rounded hover:text-red-400 hover:bg-red-400/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {contacts.length > 0 && <div className="text-xs text-[#b0b4c8] mt-3">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</div>}

      {/* Add Contact Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-[#111] border border-white/[0.07] rounded-2xl p-7 w-[440px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <div className="font-display text-[22px] text-[#e8eaf0] tracking-wider mb-5">ADD CONTACT</div>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-2 gap-3.5">
                {[{ label: "First Name", key: "firstName" }, { label: "Last Name", key: "lastName" }].map(f => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider">{f.label}</label>
                    <input value={formData[f.key as keyof typeof formData]} onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                      className="px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" autoFocus={f.key === "firstName"} />
                  </div>
                ))}
              </div>
              {[{ label: "Phone", key: "phone", ph: "+1 (555) 000-0000" }, { label: "Email", key: "email", type: "email" }, { label: "Company", key: "company" }].map(f => (
                <div key={f.key} className="flex flex-col gap-1 mt-3.5">
                  <label className="text-[11px] font-bold text-[#b0b4c8] uppercase tracking-wider">{f.label}</label>
                  <input type={f.type || "text"} placeholder={f.ph} value={formData[f.key as keyof typeof formData]} onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                    className="px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-sm text-[#e8eaf0] outline-none focus:border-[#E86A2A]/40 transition-colors" />
                </div>
              ))}
              <div className="flex gap-2.5 justify-end mt-5">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-transparent border border-white/[0.07] rounded-lg text-sm text-[#b0b4c8] cursor-pointer hover:bg-white/[0.04] transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#E86A2A] text-white text-sm font-bold border-none rounded-lg cursor-pointer hover:bg-[#ff7b3a] transition-colors">{saving ? "Saving..." : "Add Contact"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImport && <CsvImportModal onClose={() => setShowImport(false)} onComplete={fetchContacts} />}
      {selectedDeal && <DealPanel dealId={selectedDeal} onClose={() => setSelectedDeal(null)} onUpdate={fetchContacts} />}
    </div>
  );
}
