"use client";

import { useEffect, useState, useCallback } from "react";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  yellow: "#f5a623",
  bg: "#0a0a0a",
};

interface SocialGroup {
  id: string;
  product: string;
  name: string;
  platform: string;
  url: string | null;
  niche: string | null;
  size: string | null;
  rules: string | null;
  frequency_days: number;
  last_posted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  postedThisWeek: number;
  dueCount: number;
}

const WOLFPACK_SYSTEM = `You write Facebook and Reddit posts for Mike. He runs thewolfpack.ai, websites and CRM tools for home service contractors (roofers, HVAC, plumbers, electricians, landscapers, etc).\n\nThe tone should sound like Mike just sat down next to someone at a coffee shop and started talking about business. Relaxed, genuine, no agenda. Just two people shooting the shit about how the trades work. That's the energy.\n\nThese posts are conversation starters. Not pitches. Not tips wrapped in a sales funnel. Just real talk that makes people want to respond because it feels like someone actually gets it.\n\nPost styles to rotate through:\n1. Ask something you're genuinely curious about\n2. Share something you noticed\n3. Throw out a hot take\n4. Tell a quick story\n5. Start a conversation\n\nNever pitch, never list prices, never mention offers. If thewolfpack.ai comes up it should feel incidental.\n\nCRITICAL FORMATTING RULES:\n1. NEVER use dashes, em dashes, or hyphens connecting thoughts.\n2. NEVER use bullet points or lists.\n3. Write in short paragraphs or single sentences. Like texting a buddy.\n4. Keep it under 80 words.\n\nMike's voice: casual, warm, talks like a contractor himself. Short punchy sentences.\n\nOutput ONLY the post text.`;

const BUENAONDA_SYSTEM = `You write Facebook and Reddit posts for Mike. He's building buenaonda.ai, an AI ad management platform for Meta, Google, and TikTok that runs campaigns on autopilot.\n\nThe tone should sound like Mike just sat down next to someone at a coffee shop and started talking about the ad industry. Relaxed, genuine, no agenda.\n\nPost styles to rotate through:\n1. Ask something you're genuinely curious about\n2. Share something from building the product\n3. Throw out a hot take\n4. Tell a quick story\n5. Start a conversation\n\nNever hard pitch, never list pricing. If buenaonda.ai comes up it should feel natural.\n\nCRITICAL FORMATTING RULES:\n1. NEVER use dashes or hyphens connecting thoughts.\n2. NEVER use bullet points or lists.\n3. Write in short paragraphs or single sentences.\n4. Keep it under 80 words.\n\nMike's voice: casual, warm, confident but not arrogant. Short punchy sentences.\n\nOutput ONLY the post text.`;

export default function GroupPostingSection() {
  const [gpTab, setGpTab] = useState<"wolfpack" | "buenaonda">("wolfpack");
  const [groups, setGroups] = useState<SocialGroup[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, postedThisWeek: 0, dueCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "due" | "posted">("all");
  const [platformFilter, setPlatformFilter] = useState<"all" | "facebook" | "reddit">("all");
  const [generatedPost, setGeneratedPost] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<SocialGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", platform: "facebook", url: "", niche: "", size: "Medium", rules: "", frequency_days: 7 });

  const gpAccent = gpTab === "wolfpack" ? T.orange : "#D4A017";

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`/api/outreach/groups?product=${gpTab}`);
      const data = await res.json();
      setGroups(data.groups || []);
      setStats(data.stats || { total: 0, postedThisWeek: 0, dueCount: 0 });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [gpTab]);

  useEffect(() => {
    setLoading(true);
    fetchGroups();
  }, [fetchGroups]);

  const daysSince = (d: string | null) => !d ? null : Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  const isOverdue = (g: SocialGroup) => !g.last_posted_at || (daysSince(g.last_posted_at) ?? 999) >= g.frequency_days;

  const filtered = groups.filter((g) => {
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !(g.niche || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (platformFilter !== "all" && g.platform !== platformFilter) return false;
    if (statusFilter === "due" && !isOverdue(g)) return false;
    if (statusFilter === "posted" && isOverdue(g)) return false;
    return true;
  });

  async function handleDone(id: string) {
    await fetch(`/api/outreach/groups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_posted" }) });
    setFlashId(id);
    setTimeout(() => setFlashId(null), 1200);
    fetchGroups();
  }

  async function handleUndo(id: string) {
    await fetch(`/api/outreach/groups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo_posted" }) });
    fetchGroups();
  }

  async function handleSaveEdit() {
    if (!editingGroup) return;
    await fetch(`/api/outreach/groups/${editingGroup.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingGroup.name,
        platform: editingGroup.platform,
        url: editingGroup.url || null,
        niche: editingGroup.niche,
        size: editingGroup.size,
        rules: editingGroup.rules,
        frequency_days: editingGroup.frequency_days,
      }),
    });
    setEditingGroup(null);
    fetchGroups();
  }

  async function handleCreate() {
    await fetch("/api/outreach/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: gpTab, ...newGroup }),
    });
    setCreating(false);
    setNewGroup({ name: "", platform: "facebook", url: "", niche: "", size: "Medium", rules: "", frequency_days: 7 });
    fetchGroups();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this group?")) return;
    await fetch(`/api/outreach/groups/${id}`, { method: "DELETE" });
    fetchGroups();
  }

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCopied(false);
    const angles = ["question", "practical tip", "discussion starter", "observation", "hot take", "experience share", "curiosity"];
    const todayAngle = angles[new Date().getDay()];
    const today = new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    try {
      const systemPrompt = gpTab === "wolfpack" ? WOLFPACK_SYSTEM : BUENAONDA_SYSTEM;
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          prompt: `Today is ${dayName}, ${dateStr}. Day seed: ${new Date().getDay() + 1}.\nWrite a unique post. Angle this time: ${todayAngle}.\nMake it feel fresh.`,
          maxTokens: 400,
        }),
      });
      const d = await res.json();
      setGeneratedPost(d.text || d.content || "Generation failed — try again.");
    } catch {
      setGeneratedPost("Generation failed — check your connection.");
    }
    setIsGenerating(false);
  };

  const angles = ["question", "practical tip", "discussion starter", "observation", "hot take", "experience share", "curiosity"];
  const todayAngle = angles[new Date().getDay()];
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Shared input style ─────────────────────────────────────────
  const inputStyle = { background: "rgba(0,0,0,0.3)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" as const };
  const selectStyle = { ...inputStyle, appearance: "none" as const, cursor: "pointer" };
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: T.muted, marginBottom: 4, display: "block" as const };

  return (
    <div>
      {/* Product tabs + Add Group button */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, alignItems: "center" }}>
        <button onClick={() => { setGpTab("wolfpack"); setGeneratedPost(""); }} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, background: gpTab === "wolfpack" ? T.orange : "transparent", color: gpTab === "wolfpack" ? "#fff" : T.muted, border: `1px solid ${gpTab === "wolfpack" ? T.orange : T.border}`, borderRadius: 6, cursor: "pointer" }}>THE WOLFPACK</button>
        <button onClick={() => { setGpTab("buenaonda"); setGeneratedPost(""); }} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, background: gpTab === "buenaonda" ? "#D4A017" : "transparent", color: gpTab === "buenaonda" ? "#fff" : T.muted, border: `1px solid ${gpTab === "buenaonda" ? "#D4A017" : T.border}`, borderRadius: 6, cursor: "pointer" }}>BUENA ONDA</button>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={() => setCreating(true)} style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, background: gpAccent, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>+ Add Group</button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="out-stats" style={{ marginBottom: 14 }}>
        {[
          { label: "Posted This Week", value: String(stats.postedThisWeek), color: gpAccent },
          { label: "Due / Overdue", value: String(stats.dueCount), color: stats.dueCount > 0 ? T.red : T.green },
          { label: "Total Groups", value: String(stats.total), color: T.text },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Bebas Neue', sans-serif" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Post Generator */}
      <div className="out-card" style={{ marginBottom: 16, background: "rgba(255,255,255,0.02)", borderColor: `${gpAccent}30` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Today&apos;s Post — {dateStr}</div>
          <div style={{ fontSize: 10, color: T.muted }}>Angle: {todayAngle}</div>
        </div>
        <button onClick={handleGenerate} disabled={isGenerating} style={{ padding: "10px 24px", fontSize: 13, fontWeight: 700, background: gpAccent, color: "#fff", border: "none", borderRadius: 6, cursor: isGenerating ? "wait" : "pointer", opacity: isGenerating ? 0.6 : 1, marginBottom: 12, width: "100%" }}>
          {isGenerating ? "Generating..." : "Generate Today's Post"}
        </button>
        {generatedPost && (
          <>
            <textarea value={generatedPost} onChange={(e) => setGeneratedPost(e.target.value)} style={{ width: "100%", minHeight: 120, background: "rgba(0,0,0,0.3)", color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: 12, fontSize: 13, fontFamily: "'Courier New', monospace", resize: "vertical", lineHeight: 1.5 }} />
            <button onClick={() => { navigator.clipboard.writeText(generatedPost); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ marginTop: 8, padding: "8px 20px", fontSize: 12, fontWeight: 600, background: copied ? T.green : "rgba(255,255,255,0.08)", color: copied ? "#fff" : T.text, border: `1px solid ${copied ? T.green : T.border}`, borderRadius: 6, cursor: "pointer" }}>
              {copied ? "✓ Copied!" : "Copy to Clipboard"}
            </button>
          </>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search groups..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", color: T.text, fontSize: 12, width: 200 }} />
        <div style={{ display: "flex", gap: 2 }}>
          {(["all", "due", "posted"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: statusFilter === s ? gpAccent : "transparent", color: statusFilter === s ? "#fff" : T.muted, border: `1px solid ${statusFilter === s ? gpAccent : T.border}`, borderRadius: 4, cursor: "pointer", textTransform: "capitalize" }}>{s}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {(["all", "facebook", "reddit"] as const).map((p) => (
            <button key={p} onClick={() => setPlatformFilter(p)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: platformFilter === p ? gpAccent : "transparent", color: platformFilter === p ? "#fff" : T.muted, border: `1px solid ${platformFilter === p ? gpAccent : T.border}`, borderRadius: 4, cursor: "pointer", textTransform: "capitalize" }}>{p}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginLeft: "auto" }}>Showing {filtered.length} of {stats.total} groups</div>
      </div>

      {/* Group list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: T.muted, fontSize: 13 }}>Loading groups...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((g) => {
            const d = daysSince(g.last_posted_at);
            const statusColor = d === null ? T.red : d <= 2 ? T.green : d <= (g.frequency_days - 1) ? T.yellow : T.red;
            const statusText = d === null ? "Never" : d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
            const isFlashing = flashId === g.id;

            return (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: isFlashing ? `${gpAccent}15` : "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, borderRadius: 6, transition: "background 0.3s" }}>
                {/* Platform badge */}
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: g.platform === "reddit" ? "rgba(255,140,0,0.15)" : "rgba(59,130,246,0.15)", color: g.platform === "reddit" ? "#FF8C00" : "#3B82F6", textTransform: "uppercase", whiteSpace: "nowrap" }}>{g.platform === "reddit" ? "Reddit" : "FB"}</span>

                {/* Group info — click to edit */}
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setEditingGroup({ ...g })}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>{g.niche || "No niche"} · {g.size || "?"} · {g.rules || "No rules"}</div>
                </div>

                {/* URL link */}
                <div style={{ width: 100, flexShrink: 0, textAlign: "center" }}>
                  {g.url ? (
                    <a href={g.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: gpAccent, textDecoration: "none" }}>Open ↗</a>
                  ) : (
                    <span onClick={() => setEditingGroup({ ...g })} style={{ fontSize: 11, color: T.muted, cursor: "pointer", opacity: 0.5 }}>Add URL...</span>
                  )}
                </div>

                {/* Frequency */}
                <div style={{ fontSize: 10, color: T.muted, width: 40, textAlign: "center" }}>{g.frequency_days}d</div>

                {/* Status */}
                <div style={{ fontSize: 11, fontWeight: 600, color: statusColor, width: 70, textAlign: "center" }}>{statusText}</div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button onClick={() => handleDone(g.id)} style={{ padding: "4px 14px", fontSize: 11, fontWeight: 700, background: d === 0 ? "transparent" : gpAccent, color: d === 0 ? gpAccent : "#fff", border: `1px solid ${gpAccent}`, borderRadius: 4, cursor: "pointer", opacity: d === 0 ? 0.5 : 1 }}>
                    {d === 0 ? "✓" : "DONE"}
                  </button>
                  {d === 0 && (
                    <button onClick={() => handleUndo(g.id)} style={{ fontSize: 10, color: T.muted, background: "none", border: "none", cursor: "pointer", padding: 2 }}>↩</button>
                  )}
                  <button onClick={() => handleDelete(g.id)} style={{ fontSize: 10, color: T.red, background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.6 }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────── */}
      {editingGroup && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }} onClick={() => setEditingGroup(null)}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, width: "100%", maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 20 }}>Edit Group</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input value={editingGroup.name} onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Platform</label>
                <select value={editingGroup.platform} onChange={(e) => setEditingGroup({ ...editingGroup, platform: e.target.value })} style={selectStyle}>
                  <option value="facebook">Facebook</option>
                  <option value="reddit">Reddit</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>URL</label>
                <input value={editingGroup.url || ""} onChange={(e) => setEditingGroup({ ...editingGroup, url: e.target.value })} placeholder="https://facebook.com/groups/..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Niche</label>
                <input value={editingGroup.niche || ""} onChange={(e) => setEditingGroup({ ...editingGroup, niche: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Size</label>
                <select value={editingGroup.size || "Medium"} onChange={(e) => setEditingGroup({ ...editingGroup, size: e.target.value })} style={selectStyle}>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                  <option value="Very Large">Very Large</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Rules</label>
                <input value={editingGroup.rules || ""} onChange={(e) => setEditingGroup({ ...editingGroup, rules: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Post every (days)</label>
                <input type="number" min={1} max={90} value={editingGroup.frequency_days} onChange={(e) => setEditingGroup({ ...editingGroup, frequency_days: parseInt(e.target.value) || 7 })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingGroup(null)} style={{ padding: "8px 20px", fontSize: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSaveEdit} style={{ padding: "8px 20px", fontSize: 12, fontWeight: 700, background: gpAccent, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ──────────────────────────────────────────── */}
      {creating && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }} onClick={() => setCreating(false)}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, width: "100%", maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 20 }}>Add New Group ({gpTab === "wolfpack" ? "Wolf Pack" : "Buena Onda"})</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="Group name" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Platform *</label>
                <select value={newGroup.platform} onChange={(e) => setNewGroup({ ...newGroup, platform: e.target.value })} style={selectStyle}>
                  <option value="facebook">Facebook</option>
                  <option value="reddit">Reddit</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>URL</label>
                <input value={newGroup.url} onChange={(e) => setNewGroup({ ...newGroup, url: e.target.value })} placeholder="https://..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Niche</label>
                <input value={newGroup.niche} onChange={(e) => setNewGroup({ ...newGroup, niche: e.target.value })} placeholder="e.g. Contractors" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Size</label>
                <select value={newGroup.size} onChange={(e) => setNewGroup({ ...newGroup, size: e.target.value })} style={selectStyle}>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                  <option value="Very Large">Very Large</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Rules</label>
                <input value={newGroup.rules} onChange={(e) => setNewGroup({ ...newGroup, rules: e.target.value })} placeholder="e.g. Value posts OK" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Post every (days)</label>
                <input type="number" min={1} max={90} value={newGroup.frequency_days} onChange={(e) => setNewGroup({ ...newGroup, frequency_days: parseInt(e.target.value) || 7 })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setCreating(false)} style={{ padding: "8px 20px", fontSize: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreate} disabled={!newGroup.name} style={{ padding: "8px 20px", fontSize: 12, fontWeight: 700, background: gpAccent, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", opacity: newGroup.name ? 1 : 0.5 }}>Add Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
