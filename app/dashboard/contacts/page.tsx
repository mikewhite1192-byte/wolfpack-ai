"use client";

import { useEffect, useState, useCallback } from "react";
import DealPanel from "../components/DealPanel";
import CsvImportModal from "../components/CsvImportModal";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  bg: "#0a0a0a",
};

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  lead_score: number;
  stage_name: string | null;
  stage_color: string | null;
  deal_value: string | null;
  deal_id: string | null;
  last_contacted: string | null;
  created_at: string;
}

const COLS = ["Name", "Phone", "Email", "Stage", "Value", "Last Contact", "Actions"];

interface ContactList { id: string; name: string; color: string; contact_count: string; }

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

  // Load lists
  useEffect(() => {
    fetch("/api/contact-lists").then(r => r.json()).then(data => {
      setLists(data.lists || []);
    }).catch(() => {});
  }, []);

  async function createList() {
    if (!newListName.trim()) return;
    const res = await fetch("/api/contact-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newListName.trim() }),
    });
    const data = await res.json();
    if (data.list) {
      setLists(prev => [...prev, { ...data.list, contact_count: "0" }]);
      setActiveList(data.list.id);
      setShowNewList(false);
      setNewListName("");
    }
  }

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("status", statusTab);
    if (activeList) params.set("listId", activeList);
    const res = await fetch(`/api/contacts?${params}`);
    const data = await res.json();
    setContacts(data.contacts || []);
    setCounts(data.counts || { active: 0, won: 0, lost: 0 });
    setLoading(false);
  }, [search, statusTab, activeList]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setFormData({ firstName: "", lastName: "", email: "", phone: "", company: "" });
      setShowForm(false);
      fetchContacts();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to create contact");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this contact and all associated data?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    fetchContacts();
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div>
      <style>{`
        .contacts-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .contacts-title { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: ${T.text}; letter-spacing: 1px; }
        .contacts-btn { padding: 10px 20px; background: ${T.orange}; color: #fff; font-size: 13px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; }
        .contacts-btn:hover { opacity: 0.9; }
        .contacts-toolbar { display: flex; gap: 10px; margin-bottom: 16px; }
        .contacts-search { flex: 1; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 8px; font-size: 13px; color: ${T.text}; outline: none; font-family: 'Inter', sans-serif; }
        .contacts-search::placeholder { color: ${T.muted}; }
        .contacts-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid ${T.border}; }
        .contacts-tab { padding: 10px 20px; font-size: 13px; font-weight: 600; color: ${T.muted}; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; display: flex; align-items: center; gap: 8px; }
        .contacts-tab:hover { color: ${T.text}; }
        .contacts-tab.active { color: ${T.orange}; border-bottom-color: ${T.orange}; }
        .contacts-tab-count { font-size: 11px; background: rgba(255,255,255,0.06); padding: 1px 8px; border-radius: 10px; }
        .contacts-table { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; overflow: hidden; }
        .contacts-thead { display: grid; grid-template-columns: 1.5fr 1fr 1.5fr 1fr 0.8fr 1fr 0.6fr; padding: 12px 20px; border-bottom: 1px solid ${T.border}; }
        .contacts-th { font-size: 11px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.5px; }
        .contacts-row { display: grid; grid-template-columns: 1.5fr 1fr 1.5fr 1fr 0.8fr 1fr 0.6fr; padding: 14px 20px; border-bottom: 1px solid ${T.border}; align-items: center; transition: background 0.15s; cursor: pointer; }
        .contacts-row:hover { background: rgba(255,255,255,0.03); }
        .contacts-row:last-child { border-bottom: none; }
        .contacts-cell { font-size: 13px; color: ${T.text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .contacts-cell-muted { font-size: 13px; color: ${T.muted}; }
        .contacts-empty { padding: 60px 20px; text-align: center; font-size: 14px; color: ${T.muted}; }
        .contacts-empty-sub { font-size: 12px; color: rgba(255,255,255,0.2); margin-top: 6px; }
        .contacts-count { font-size: 12px; color: ${T.muted}; margin-top: 12px; }
        .stage-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .del-btn { background: none; border: none; color: ${T.muted}; cursor: pointer; font-size: 16px; padding: 4px 8px; border-radius: 4px; }
        .del-btn:hover { color: ${T.red}; background: rgba(231,76,60,0.1); }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .modal { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 14px; padding: 28px; width: 440px; max-width: 90vw; }
        .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; color: ${T.text}; margin-bottom: 20px; letter-spacing: 0.5px; }
        .modal-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
        .modal-label { font-size: 11px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; letter-spacing: 0.5px; }
        .modal-input { padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 8px; font-size: 13px; color: ${T.text}; outline: none; font-family: 'Inter', sans-serif; }
        .modal-input:focus { border-color: ${T.orange}; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
        .modal-cancel { padding: 10px 20px; background: none; border: 1px solid ${T.border}; border-radius: 8px; color: ${T.muted}; font-size: 13px; cursor: pointer; }
      `}</style>

      <div className="contacts-header">
        <div className="contacts-title">CONTACTS</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowImport(true)} style={{ padding: "10px 18px", background: T.surface, color: T.text, fontSize: 13, fontWeight: 600, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer" }}>📄 Import CSV</button>
          <button className="contacts-btn" onClick={() => setShowForm(true)}>+ Add Contact</button>
        </div>
      </div>

      {/* List tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {lists.length > 0 && (
          <>
            <button
              onClick={() => setActiveList(null)}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                background: !activeList ? "rgba(232,106,42,0.12)" : "rgba(255,255,255,0.04)",
                color: !activeList ? T.orange : T.muted,
              }}
            >
              All Contacts
            </button>
            {lists.map(list => (
              <button
                key={list.id}
                onClick={() => setActiveList(list.id)}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                  background: activeList === list.id ? `${list.color}20` : "rgba(255,255,255,0.04)",
                  color: activeList === list.id ? list.color : T.muted,
                }}
              >
                {list.name} <span style={{ fontSize: 10, opacity: 0.6 }}>{list.contact_count}</span>
              </button>
            ))}
          </>
        )}
        {showNewList ? (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createList()}
              placeholder="List name..."
              autoFocus
              style={{ padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11, color: T.text, outline: "none", width: 120 }}
            />
            <button onClick={createList} style={{ padding: "5px 10px", background: T.orange, color: "#fff", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Add</button>
            <button onClick={() => { setShowNewList(false); setNewListName(""); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewList(true)}
            style={{ padding: "5px 10px", background: "none", border: `1px dashed ${T.border}`, borderRadius: 6, fontSize: 11, color: T.muted, cursor: "pointer" }}
          >
            + New List
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="contacts-tabs">
        <div className={`contacts-tab ${statusTab === "active" ? "active" : ""}`} onClick={() => setStatusTab("active")}>
          Active <span className="contacts-tab-count">{counts.active}</span>
        </div>
        <div className={`contacts-tab ${statusTab === "won" ? "active" : ""}`} onClick={() => setStatusTab("won")}>
          Closed Won <span className="contacts-tab-count">{counts.won}</span>
        </div>
        <div className={`contacts-tab ${statusTab === "lost" ? "active" : ""}`} onClick={() => setStatusTab("lost")}>
          Dead / Lost <span className="contacts-tab-count">{counts.lost}</span>
        </div>
      </div>

      <div className="contacts-toolbar">
        <input
          className="contacts-search"
          placeholder="Search by name, phone, or email..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
      </div>

      <div className="contacts-table">
        <div className="contacts-thead">
          {COLS.map(c => <div key={c} className="contacts-th">{c}</div>)}
        </div>

        {loading ? (
          <div className="contacts-empty">Loading...</div>
        ) : contacts.length === 0 ? (
          <div className="contacts-empty">
            No contacts yet
            <div className="contacts-empty-sub">Add your first lead or import a list to get started</div>
          </div>
        ) : (
          contacts.map(c => (
            <div key={c.id} className="contacts-row" onClick={() => c.deal_id && setSelectedDeal(c.deal_id)}>
              <div className="contacts-cell">
                {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                {c.company && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{c.company}</div>}
              </div>
              <div className="contacts-cell-muted">{c.phone || "—"}</div>
              <div className="contacts-cell-muted">{c.email || "—"}</div>
              <div>
                {c.stage_name ? (
                  <span className="stage-badge" style={{ background: `${c.stage_color}20`, color: c.stage_color || T.muted }}>
                    {c.stage_name}
                  </span>
                ) : (
                  <span className="contacts-cell-muted">—</span>
                )}
              </div>
              <div className="contacts-cell">{c.deal_value ? `$${parseFloat(c.deal_value).toLocaleString()}` : "—"}</div>
              <div className="contacts-cell-muted">{formatDate(c.last_contacted)}</div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {c.phone && c.deal_id && (
                  <button
                    className="del-btn"
                    style={{ color: T.orange }}
                    onClick={e => { e.stopPropagation(); setSelectedDeal(c.deal_id); }}
                    title="Text"
                  >💬</button>
                )}
                <button className="del-btn" onClick={e => { e.stopPropagation(); handleDelete(c.id); }} title="Delete">×</button>
              </div>
            </div>
          ))
        )}
      </div>

      {contacts.length > 0 && <div className="contacts-count">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</div>}

      {/* Add Contact Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">ADD CONTACT</div>
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="modal-field">
                  <label className="modal-label">First Name</label>
                  <input className="modal-input" value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} autoFocus />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Last Name</label>
                  <input className="modal-input" value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="modal-field">
                <label className="modal-label">Phone</label>
                <input className="modal-input" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="modal-field">
                <label className="modal-label">Email</label>
                <input className="modal-input" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="modal-field">
                <label className="modal-label">Company</label>
                <input className="modal-input" value={formData.company} onChange={e => setFormData(p => ({ ...p, company: e.target.value }))} />
              </div>
              <div className="modal-actions">
                <button type="button" className="modal-cancel" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="contacts-btn" disabled={saving}>{saving ? "Saving..." : "Add Contact"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import */}
      {showImport && (
        <CsvImportModal onClose={() => setShowImport(false)} onComplete={fetchContacts} />
      )}

      {/* Deal Detail Panel */}
      {selectedDeal && (
        <DealPanel
          dealId={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={fetchContacts}
        />
      )}

    </div>
  );
}
