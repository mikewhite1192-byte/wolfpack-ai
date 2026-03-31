"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const T = {
  orange: "#E86A2A",
  text: "#e8eaf0",
  muted: "#b0b4c8",
  surface: "#111111",
  border: "rgba(255,255,255,0.07)",
  green: "#2ecc71",
  red: "#e74c3c",
  blue: "#007AFF",
  yellow: "#f5a623",
  bg: "#0a0a0a",
};

interface Stats {
  total: string;
  active: string;
  completed: string;
  replied: string;
  bounced: string;
  invalid: string;
  unsubscribed: string;
  converted: string;
}

interface RecentEmail {
  email: string;
  first_name: string | null;
  from_email: string | null;
  step: number;
  status: string;
  sent_at: string;
}

interface EmailHealthData {
  address: string;
  role: "cold_sender" | "warmup_only";
  displayName: string;
  daysInWarmup: number;
  warmupComplete: boolean;
  isActive: boolean;
  coldDailyLimit: number;
  coldSentToday: number;
  warmupSentToday: number;
  sent7d: number;
  bounced7d: number;
  replied7d: number;
  complained7d: number;
  bounceRate: number;
  replyRate: number;
  complaintRate: number;
  healthScore: number;
  healthStatus: "healthy" | "warning" | "danger" | "new";
  healthIssues: string[];
  totalSent: number;
  totalBounced: number;
  totalReplied: number;
}

const ADMIN_EMAILS = ["info@thewolfpackco.com"];

export default function OutreachPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([]);
  const [emailHealth, setEmailHealth] = useState<EmailHealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeState, setScrapeState] = useState("");
  const [scrapeCount, setScrapeCount] = useState(30);
  const [tab, setTab] = useState<"overview" | "emails" | "health" | "inbox" | "contacts" | "campaigns" | "scraper">("overview");
  const [contactSearch, setContactSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Campaigns state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", niche: "" });
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingTemplates, setEditingTemplates] = useState<string | null>(null);
  const [templateDrafts, setTemplateDrafts] = useState<Record<number, { subject: string; body: string }>>({});
  const [assigningSender, setAssigningSender] = useState<string | null>(null);

  // Scraper state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scraperConfigs, setScraperConfigs] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scraperStats, setScraperStats] = useState<any>(null);
  const [showScraperForm, setShowScraperForm] = useState(false);
  const [newScraper, setNewScraper] = useState({ name: "", query: "", dailyCount: "15" });
  const [addingScraper, setAddingScraper] = useState(false);
  const [massScraping, setMassScraping] = useState(false);
  const [massScrapeQuery, setMassScrapeQuery] = useState("");
  const [massScrapeCount, setMassScrapeCount] = useState("50");

  // Outreach contacts
  const [outreachContacts, setOutreachContacts] = useState<Array<{
    id: string; email: string; first_name: string | null; last_name: string | null;
    company: string | null; state: string | null; sequence_status: string;
    sequence_step: number; assigned_sender: string | null; replied: boolean;
    bounced: boolean; unsubscribed: boolean; created_at: string; last_email_sent_at: string | null;
  }>>([]);

  // Inbox state
  const [inboxReplies, setInboxReplies] = useState<Array<{
    id: string; from_email: string; from_name: string; to_address: string;
    subject: string; body: string; received_at: string; is_read: boolean;
    is_starred: boolean; outreach_contact_id: string | null;
  }>>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread" | "starred">("all");
  const [polling, setPolling] = useState(false);
  const [selectedReply, setSelectedReply] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  // Add email form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState({ email: "", displayName: "Mike", smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "", coldSender: true });
  const [addingEmail, setAddingEmail] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  // Admin check
  useEffect(() => {
    if (isLoaded && user) {
      const email = user.primaryEmailAddress?.emailAddress || "";
      if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
        router.push("/dashboard");
      }
    }
  }, [isLoaded, user, router]);

  // Load stats
  useEffect(() => {
    fetch("/api/outreach/stats")
      .then(r => r.json())
      .then(data => {
        setStats(data.stats);
        setRecentEmails(data.recentEmails || []);
        setEmailHealth(data.emailHealth || []);
        setOutreachContacts(data.outreachContacts || []);
        setCampaigns(data.campaigns || []);
        setScraperConfigs(data.scraperConfigs || []);
        setScraperStats(data.scraperStats || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function runSend() {
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/outreach/send", { method: "POST" });
    const data = await res.json();
    if (data.perAddress) {
      const details = Object.entries(data.perAddress as Record<string, { sent: number; limit: number }>)
        .map(([addr, s]) => `${addr.split("@")[0]}: ${s.sent}/${s.limit}`)
        .join(", ");
      setSendResult(`Sent: ${data.sent}, Failed: ${data.failed || 0} | ${details}`);
    } else {
      setSendResult(`Sent: ${data.sent}, Failed: ${data.failed || 0}`);
    }
    setSending(false);
    refreshStats();
  }

  async function runScrape() {
    setScraping(true);
    setScrapeState("Scraping...");
    const res = await fetch("/api/outreach/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: scrapeCount }),
    });
    const data = await res.json();
    setScrapeState(`Found: ${data.found || 0}, Valid: ${data.valid || 0}, Added: ${data.added || 0}`);
    setScraping(false);
    refreshStats();
  }

  async function revalidateContacts() {
    let offset = 0;
    let totalChecked = 0;
    let totalRemoved = 0;
    const allRemoved: string[] = [];
    let hasMore = true;

    while (hasMore) {
      setSendResult(`Revalidating contacts... (${totalChecked} checked, ${totalRemoved} removed so far)`);
      const res = await fetch(`/api/outreach/revalidate?offset=${offset}`, { method: "POST" });
      const data = await res.json();
      if (data.error) { setSendResult(`Error: ${data.error}`); return; }
      totalChecked += data.checked || 0;
      totalRemoved += data.removed || 0;
      allRemoved.push(...(data.removedEmails || []));
      hasMore = data.hasMore || false;
      offset = data.nextOffset || offset + 15;
    }

    setSendResult(`Done! ${totalChecked} checked, ${totalRemoved} removed${allRemoved.length ? `: ${allRemoved.join(", ")}` : ""}`);
    refreshStats();
  }

  async function addEmailAddress() {
    setAddingEmail(true);
    setAddResult(null);
    const res = await fetch("/api/outreach/warmup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail.email,
        displayName: newEmail.displayName,
        smtpHost: newEmail.smtpHost,
        smtpPort: parseInt(newEmail.smtpPort),
        smtpUser: newEmail.smtpUser,
        smtpPass: newEmail.smtpPass,
        coldSender: newEmail.coldSender,
      }),
    });
    const data = await res.json();
    if (data.id) {
      setAddResult(`Added: ${data.email} (${data.role})`);
      setNewEmail({ email: "", displayName: "Mike", smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "", coldSender: true });
      setShowAddForm(false);
      refreshStats();
    } else {
      setAddResult(`Error: ${data.error}`);
    }
    setAddingEmail(false);
  }

  async function runWarmup() {
    const res = await fetch("/api/outreach/warmup", { method: "POST" });
    const data = await res.json();
    setSendResult(`Warmup: ${data.sent} sent, ${data.errors} errors${data.completed?.length ? `, ${data.completed.join(", ")} completed warmup!` : ""}`);
    refreshStats();
  }

  function refreshStats(search?: string) {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/outreach/stats${params}`)
      .then(r => r.json())
      .then(data => {
        setStats(data.stats);
        setRecentEmails(data.recentEmails || []);
        setEmailHealth(data.emailHealth || []);
        setOutreachContacts(data.outreachContacts || []);
        setCampaigns(data.campaigns || []);
        setScraperConfigs(data.scraperConfigs || []);
        setScraperStats(data.scraperStats || null);
      });
  }

  function searchContacts(query: string) {
    setContactSearch(query);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => refreshStats(query), 300));
  }

  async function createCampaign() {
    setCreatingCampaign(true);
    await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: newCampaign.name, niche: newCampaign.niche }),
    });
    setNewCampaign({ name: "", niche: "" });
    setShowCampaignForm(false);
    setCreatingCampaign(false);
    refreshStats();
  }

  async function toggleCampaign(id: string, enabled: boolean) {
    await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, enabled }),
    });
    refreshStats();
  }

  async function saveCampaignTemplates(campaignId: string) {
    const templates = Object.entries(templateDrafts).map(([step, t]) => ({ step: parseInt(step), ...t }));
    await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-templates", campaignId, templates }),
    });
    setEditingTemplates(null);
    setTemplateDrafts({});
    refreshStats();
  }

  async function assignSender(campaignId: string, senderId: string) {
    await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign-sender", campaignId, senderId }),
    });
    setAssigningSender(null);
    refreshStats();
  }

  async function removeSender(campaignId: string, senderId: string) {
    await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove-sender", campaignId, senderId }),
    });
    refreshStats();
  }

  async function addScraperConfig() {
    setAddingScraper(true);
    await fetch("/api/outreach/scrape-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", name: newScraper.name, query: newScraper.query, dailyCount: parseInt(newScraper.dailyCount) }),
    });
    setNewScraper({ name: "", query: "", dailyCount: "15" });
    setShowScraperForm(false);
    setAddingScraper(false);
    refreshStats();
  }

  async function toggleScraper(id: string, enabled: boolean) {
    await fetch("/api/outreach/scrape-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, enabled }),
    });
    refreshStats();
  }

  async function updateScraperCount(id: string, count: number) {
    await fetch("/api/outreach/scrape-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-count", id, dailyCount: count }),
    });
    refreshStats();
  }

  async function runMassScrape() {
    setMassScraping(true);
    const res = await fetch("/api/outreach/scrape-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mass-scrape", query: massScrapeQuery, maxResults: parseInt(massScrapeCount), format: "csv" }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scrape-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMassScraping(false);
  }

  async function exportCSV() {
    const res = await fetch("/api/outreach/scrape-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "export-csv" }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scraped-leads-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function linkScraperToCampaign(scraperConfigId: string, campaignId: string) {
    await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link-scraper", scraperConfigId, campaignId }),
    });
    refreshStats();
  }

  // Inbox functions
  function loadInbox(filter?: "all" | "unread" | "starred") {
    const f = filter || inboxFilter;
    const params = new URLSearchParams();
    if (f === "unread") params.set("unread", "true");
    if (f === "starred") params.set("starred", "true");
    fetch(`/api/outreach/inbox?${params}`)
      .then(r => r.json())
      .then(data => {
        setInboxReplies(data.replies || []);
        setInboxTotal(data.total || 0);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {});
  }

  // Load inbox when switching to inbox tab
  useEffect(() => {
    if (tab === "inbox") loadInbox();
  }, [tab, inboxFilter]);

  async function pollInboxes() {
    setPolling(true);
    await fetch("/api/outreach/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "poll" }),
    });
    setPolling(false);
    loadInbox();
  }

  async function markAsRead(replyId: string) {
    await fetch("/api/outreach/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", replyId }),
    });
    loadInbox();
  }

  async function toggleStarReply(replyId: string) {
    await fetch("/api/outreach/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "star", replyId }),
    });
    loadInbox();
  }

  async function sendReply(replyId: string) {
    if (!replyText.trim()) return;
    setReplying(true);
    await fetch("/api/outreach/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reply", replyId, body: replyText }),
    });
    setReplyText("");
    setSelectedReply(null);
    setReplying(false);
    loadInbox();
  }

  const email = user?.primaryEmailAddress?.emailAddress || "";
  if (isLoaded && !ADMIN_EMAILS.includes(email.toLowerCase())) return null;

  const healthColor = (status: string) => {
    if (status === "healthy") return T.green;
    if (status === "warning") return T.yellow;
    if (status === "danger") return T.red;
    return T.muted;
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    color: T.text,
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  return (
    <div>
      <style>{`
        .out-label { font-size: 11px; font-weight: 700; color: ${T.orange}; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
        .out-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .out-stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 16px 14px; }
        .out-stat-val { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 0.5px; line-height: 1; margin-bottom: 4px; }
        .out-stat-label { font-size: 11px; font-weight: 600; color: ${T.muted}; }
        .out-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 18px; margin-bottom: 14px; }
        .out-btn { padding: 10px 20px; background: ${T.orange}; color: #fff; font-size: 13px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; }
        .out-btn:hover { opacity: 0.9; }
        .out-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .out-btn-sm { padding: 6px 14px; font-size: 12px; }
        .out-btn-ghost { padding: 10px 20px; background: none; border: 1px solid ${T.border}; color: ${T.text}; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer; }
        .out-btn-ghost:hover { border-color: ${T.orange}; }
        .out-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .out-table { width: 100%; border-collapse: collapse; }
        .out-table th { text-align: left; font-size: 11px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; padding: 8px 0; border-bottom: 1px solid ${T.border}; }
        .out-table td { font-size: 13px; color: ${T.text}; padding: 10px 0; border-bottom: 1px solid ${T.border}; }
        .out-table td.muted { color: ${T.muted}; }
        .out-input { padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid ${T.border}; border-radius: 6px; color: ${T.text}; font-size: 13px; outline: none; width: 80px; }
        .out-tab { padding: 8px 18px; font-size: 13px; font-weight: 600; color: ${T.muted}; background: none; border: none; cursor: pointer; border-bottom: 2px solid transparent; }
        .out-tab:hover { color: ${T.text}; }
        .out-tab.active { color: ${T.orange}; border-bottom-color: ${T.orange}; }
        .health-bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .health-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
        .health-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 16px; margin-bottom: 10px; }
        @media (max-width: 900px) { .out-stats { grid-template-columns: repeat(2, 1fr); } .out-row { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: T.text, letterSpacing: 1 }}>OUTREACH ENGINE</div>
        <div style={{ fontSize: 11, color: T.muted, background: "rgba(232,106,42,0.1)", padding: "4px 12px", borderRadius: 12, border: "1px solid rgba(232,106,42,0.2)" }}>Admin Only</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
        <button className={`out-tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
        <button className={`out-tab ${tab === "campaigns" ? "active" : ""}`} onClick={() => setTab("campaigns")}>Campaigns ({campaigns.length})</button>
        <button className={`out-tab ${tab === "scraper" ? "active" : ""}`} onClick={() => setTab("scraper")}>Scraper</button>
        <button className={`out-tab ${tab === "emails" ? "active" : ""}`} onClick={() => setTab("emails")}>Email Addresses</button>
        <button className={`out-tab ${tab === "contacts" ? "active" : ""}`} onClick={() => setTab("contacts")}>Contacts ({outreachContacts.length})</button>
        <button className={`out-tab ${tab === "health" ? "active" : ""}`} onClick={() => setTab("health")}>Health Monitor</button>
        <button className={`out-tab ${tab === "inbox" ? "active" : ""}`} onClick={() => setTab("inbox")} style={{ position: "relative" }}>
          Inbox
          {unreadCount > 0 && (
            <span style={{ position: "absolute", top: 2, right: -4, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div style={{ color: T.muted, textAlign: "center", padding: 60 }}>Loading...</div>
      ) : (
        <>
          {/* ============= OVERVIEW TAB ============= */}
          {tab === "overview" && (
            <>
              <div className="out-stats">
                {stats && [
                  { label: "Total Contacts", value: stats.total, color: T.text },
                  { label: "Active in Sequence", value: stats.active, color: T.orange },
                  { label: "Completed", value: stats.completed, color: T.muted },
                  { label: "Replied", value: stats.replied, color: T.green },
                  { label: "Bounced", value: stats.bounced, color: T.red },
                  { label: "Invalid", value: stats.invalid || "0", color: T.muted },
                  { label: "Unsubscribed", value: stats.unsubscribed, color: T.yellow },
                  { label: "Converted", value: stats.converted, color: T.green },
                  { label: "Reply Rate", value: parseInt(stats.total) > 0 ? `${Math.round((parseInt(stats.replied) / parseInt(stats.total)) * 100)}%` : "0%", color: T.blue },
                ].map(s => (
                  <div key={s.label} className="out-stat">
                    <div className="out-stat-val" style={{ color: s.color }}>{s.value}</div>
                    <div className="out-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="out-row">
                <div className="out-card">
                  <div className="out-label">Controls</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>Scrape New Contacts</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input className="out-input" type="number" value={scrapeCount} onChange={e => setScrapeCount(parseInt(e.target.value) || 30)} min={1} max={500} />
                        <button className="out-btn" onClick={runScrape} disabled={scraping}>{scraping ? "Scraping..." : "Scrape NIPR"}</button>
                      </div>
                      {scrapeState && <div style={{ fontSize: 12, color: T.green, marginTop: 6 }}>{scrapeState}</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>Cold Outreach</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="out-btn" onClick={runSend} disabled={sending}>{sending ? "Sending..." : "Send Cold Emails"}</button>
                        <button className="out-btn-ghost" onClick={runWarmup}>Run Warmup</button>
                        <button className="out-btn-ghost" onClick={revalidateContacts}>Revalidate</button>
                      </div>
                      {sendResult && <div style={{ fontSize: 12, color: T.green, marginTop: 6 }}>{sendResult}</div>}
                    </div>
                  </div>
                </div>

                <div className="out-card">
                  <div className="out-label">Recent Sends</div>
                  {recentEmails.length === 0 ? (
                    <div style={{ color: T.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No emails sent yet</div>
                  ) : (
                    <table className="out-table">
                      <thead>
                        <tr>
                          <th>Contact</th>
                          <th>From</th>
                          <th>Step</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentEmails.map((e, i) => (
                          <tr key={i}>
                            <td>{e.first_name || e.email?.split("@")[0] || "—"}</td>
                            <td className="muted" style={{ fontSize: 11 }}>{e.from_email?.split("@")[0] || "—"}</td>
                            <td className="muted">#{e.step}</td>
                            <td style={{ color: e.status === "sent" ? T.green : T.red }}>{e.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ============= EMAIL ADDRESSES TAB ============= */}
          {tab === "emails" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="out-label" style={{ marginBottom: 0 }}>Registered Email Addresses</div>
                <button className="out-btn out-btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                  {showAddForm ? "Cancel" : "+ Add Email"}
                </button>
              </div>

              {addResult && <div style={{ fontSize: 12, color: addResult.startsWith("Error") ? T.red : T.green, marginBottom: 12 }}>{addResult}</div>}

              {/* Add email form */}
              {showAddForm && (
                <div className="out-card" style={{ marginBottom: 16 }}>
                  <div className="out-label">Add New Email Address</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>EMAIL ADDRESS</div>
                      <input style={inputStyle} placeholder="mike@wolfpack.ai" value={newEmail.email} onChange={e => setNewEmail({ ...newEmail, email: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>DISPLAY NAME</div>
                      <input style={inputStyle} placeholder="Mike" value={newEmail.displayName} onChange={e => setNewEmail({ ...newEmail, displayName: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>SMTP HOST</div>
                      <input style={inputStyle} placeholder="smtp.gmail.com" value={newEmail.smtpHost} onChange={e => setNewEmail({ ...newEmail, smtpHost: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>SMTP PORT</div>
                      <input style={inputStyle} placeholder="587" value={newEmail.smtpPort} onChange={e => setNewEmail({ ...newEmail, smtpPort: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>SMTP USERNAME</div>
                      <input style={inputStyle} placeholder="mike@wolfpack.ai" value={newEmail.smtpUser} onChange={e => setNewEmail({ ...newEmail, smtpUser: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>SMTP PASSWORD / APP PASSWORD</div>
                      <input style={inputStyle} type="password" placeholder="app password" value={newEmail.smtpPass} onChange={e => setNewEmail({ ...newEmail, smtpPass: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: T.text }}>
                      <input type="checkbox" checked={newEmail.coldSender} onChange={e => setNewEmail({ ...newEmail, coldSender: e.target.checked })} />
                      Cold Sender
                    </label>
                    <span style={{ fontSize: 11, color: T.muted }}>
                      {newEmail.coldSender ? "Sends cold + warmup from day 1, ramps to 40 cold / 10 warmup at day 25" : "Warmup only — helps build reputation but won't send cold emails"}
                    </span>
                  </div>
                  <button className="out-btn" onClick={addEmailAddress} disabled={addingEmail || !newEmail.email || !newEmail.smtpHost}>
                    {addingEmail ? "Adding..." : "Add to Warmup"}
                  </button>
                </div>
              )}

              {/* Email list */}
              {emailHealth.length === 0 ? (
                <div className="out-card" style={{ textAlign: "center", color: T.muted, padding: 40 }}>
                  No email addresses registered yet. Click &quot;+ Add Email&quot; to get started.
                </div>
              ) : (
                emailHealth.map(h => (
                  <div key={h.address} className="health-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{h.address}</div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                          {h.role === "cold_sender" ? "Cold Sender" : "Warmup Only"}
                          {" · "}
                          Day {h.daysInWarmup}
                          {h.role === "cold_sender" && ` · Limit: ${h.coldDailyLimit}/day`}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 12,
                        background: `${healthColor(h.healthStatus)}15`,
                        color: healthColor(h.healthStatus),
                        border: `1px solid ${healthColor(h.healthStatus)}30`,
                      }}>
                        {h.healthScore}/100
                      </div>
                    </div>

                    {/* Health bar */}
                    <div className="health-bar" style={{ marginTop: 10 }}>
                      <div className="health-fill" style={{ width: `${h.healthScore}%`, background: healthColor(h.healthStatus) }} />
                    </div>

                    {/* Quick stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 12 }}>
                      {[
                        { label: "Sent Today", value: `${h.coldSentToday + h.warmupSentToday}` },
                        { label: "Sent 7d", value: `${h.sent7d}` },
                        { label: "Bounce Rate", value: `${h.bounceRate.toFixed(1)}%`, color: h.bounceRate > 3 ? T.red : T.green },
                        { label: "Reply Rate", value: `${h.replyRate.toFixed(1)}%`, color: h.replyRate >= 3 ? T.green : h.replyRate > 0 ? T.yellow : T.muted },
                        { label: "Total Sent", value: `${h.totalSent}` },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: s.color || T.text }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: T.muted }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Issues */}
                    {h.healthIssues.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        {h.healthIssues.map((issue, i) => (
                          <div key={i} style={{ fontSize: 11, color: h.healthStatus === "danger" ? T.red : T.yellow, marginTop: 4 }}>
                            {issue}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* ============= CONTACTS TAB ============= */}
          {tab === "contacts" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="out-label" style={{ marginBottom: 0 }}>Outreach Contacts ({outreachContacts.length})</div>
                <input
                  style={{ ...inputStyle, width: 260 }}
                  placeholder="Search by name, email, company..."
                  value={contactSearch}
                  onChange={e => searchContacts(e.target.value)}
                />
              </div>
              <div className="out-card">
                {outreachContacts.length === 0 ? (
                  <div style={{ color: T.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No contacts yet. Hit Scrape NIPR on the Overview tab.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="out-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Company</th>
                          <th>State</th>
                          <th>Status</th>
                          <th>Step</th>
                          <th>Sender</th>
                          <th>Last Sent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outreachContacts.map(c => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600 }}>{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</td>
                            <td style={{ fontSize: 12 }}>{c.email}</td>
                            <td className="muted" style={{ fontSize: 12 }}>{c.company || "—"}</td>
                            <td className="muted">{c.state || "—"}</td>
                            <td>
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                                background: c.sequence_status === "active" ? "rgba(232,106,42,0.15)" :
                                  c.sequence_status === "replied" ? "rgba(46,204,113,0.15)" :
                                  c.sequence_status === "bounced" ? "rgba(231,76,60,0.15)" :
                                  c.sequence_status === "completed" ? "rgba(176,180,200,0.1)" :
                                  "rgba(255,255,255,0.05)",
                                color: c.sequence_status === "active" ? T.orange :
                                  c.sequence_status === "replied" ? T.green :
                                  c.sequence_status === "bounced" ? T.red :
                                  T.muted,
                                textTransform: "uppercase",
                              }}>
                                {c.sequence_status}
                              </span>
                            </td>
                            <td className="muted">{c.sequence_step}/4</td>
                            <td className="muted" style={{ fontSize: 11 }}>{c.assigned_sender?.split("@")[0] || "—"}</td>
                            <td className="muted" style={{ fontSize: 11 }}>
                              {c.last_email_sent_at ? new Date(c.last_email_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ============= HEALTH MONITOR TAB ============= */}
          {tab === "health" && (
            <>
              <div className="out-label">Health Overview</div>

              {/* Summary stats */}
              <div className="out-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {[
                  { label: "Total Addresses", value: emailHealth.length, color: T.text },
                  { label: "Cold Senders", value: emailHealth.filter(h => h.role === "cold_sender").length, color: T.orange },
                  { label: "Warmup Only", value: emailHealth.filter(h => h.role === "warmup_only").length, color: T.blue },
                  { label: "Healthy", value: emailHealth.filter(h => h.healthStatus === "healthy").length, color: T.green },
                ].map(s => (
                  <div key={s.label} className="out-stat">
                    <div className="out-stat-val" style={{ color: s.color }}>{s.value}</div>
                    <div className="out-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Aggregate health table */}
              <div className="out-card">
                <div className="out-label">Per-Address Breakdown</div>
                <table className="out-table">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Role</th>
                      <th>Warmup</th>
                      <th>Health</th>
                      <th>Bounce</th>
                      <th>Reply</th>
                      <th>Sent 7d</th>
                      <th>Today</th>
                      <th>Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailHealth.map(h => (
                      <tr key={h.address}>
                        <td style={{ fontWeight: 600 }}>{h.address.split("@")[0]}@...</td>
                        <td className="muted" style={{ fontSize: 11 }}>{h.role === "cold_sender" ? "COLD" : "WARM"}</td>
                        <td>
                          <span style={{ color: h.daysInWarmup >= 25 ? T.green : T.yellow, fontSize: 11 }}>
                            Day {h.daysInWarmup}{h.daysInWarmup >= 25 ? " (full)" : ""}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: healthColor(h.healthStatus), fontWeight: 700 }}>{h.healthScore}</span>
                        </td>
                        <td style={{ color: h.bounceRate > 3 ? T.red : T.green }}>{h.bounceRate.toFixed(1)}%</td>
                        <td style={{ color: h.replyRate >= 3 ? T.green : T.muted }}>{h.replyRate.toFixed(1)}%</td>
                        <td>{h.sent7d}</td>
                        <td>{h.coldSentToday + h.warmupSentToday}</td>
                        <td className="muted">{h.role === "cold_sender" ? h.coldDailyLimit : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Danger alerts */}
              {emailHealth.some(h => h.healthStatus === "danger" || h.healthStatus === "warning") && (
                <div className="out-card" style={{ borderColor: `${T.red}30` }}>
                  <div className="out-label" style={{ color: T.red }}>Alerts</div>
                  {emailHealth.filter(h => h.healthIssues.length > 0).map(h => (
                    <div key={h.address} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{h.address}</div>
                      {h.healthIssues.map((issue, i) => (
                        <div key={i} style={{ fontSize: 12, color: h.healthStatus === "danger" ? T.red : T.yellow, marginTop: 3, paddingLeft: 12 }}>
                          {issue}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ============= CAMPAIGNS TAB ============= */}
          {tab === "campaigns" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="out-label" style={{ marginBottom: 0 }}>Campaigns</div>
                <button className="out-btn out-btn-sm" onClick={() => setShowCampaignForm(!showCampaignForm)}>
                  {showCampaignForm ? "Cancel" : "+ New Campaign"}
                </button>
              </div>

              {showCampaignForm && (
                <div className="out-card" style={{ marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>CAMPAIGN NAME</div>
                      <input style={inputStyle} placeholder="FL Insurance Agents" value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>NICHE</div>
                      <input style={inputStyle} placeholder="insurance" value={newCampaign.niche} onChange={e => setNewCampaign({ ...newCampaign, niche: e.target.value })} />
                    </div>
                  </div>
                  <button className="out-btn" onClick={createCampaign} disabled={creatingCampaign || !newCampaign.name}>
                    {creatingCampaign ? "Creating..." : "Create Campaign"}
                  </button>
                </div>
              )}

              {campaigns.length === 0 ? (
                <div className="out-card" style={{ textAlign: "center", color: T.muted, padding: 40 }}>
                  No campaigns yet. Create one to separate niches with dedicated senders and templates.
                </div>
              ) : (
                campaigns.map((c: Record<string, unknown>) => {
                  const senders = (c.senders || []) as { id: string; email: string; display_name: string }[];
                  const templates = (c.templates || []) as { step: number; subject: string; body: string }[];
                  const cStats = (c.stats || {}) as Record<string, string>;
                  const isEditing = editingTemplates === c.id;
                  const isAssigning = assigningSender === c.id;

                  return (
                    <div key={c.id as string} className="out-card" style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{c.name as string}</div>
                          <div style={{ fontSize: 12, color: T.muted }}>{c.niche as string || "No niche set"}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            onClick={() => toggleCampaign(c.id as string, !(c.enabled as boolean))}
                            style={{
                              padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 12, cursor: "pointer",
                              background: (c.enabled as boolean) ? `${T.green}15` : "rgba(255,255,255,0.05)",
                              color: (c.enabled as boolean) ? T.green : T.muted,
                              border: `1px solid ${(c.enabled as boolean) ? T.green + "30" : T.border}`,
                            }}
                          >
                            {(c.enabled as boolean) ? "ACTIVE" : "PAUSED"}
                          </button>
                        </div>
                      </div>

                      {/* Campaign stats */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 14 }}>
                        {[
                          { label: "Total", value: cStats.total || "0", color: T.text },
                          { label: "Active", value: cStats.active || "0", color: T.orange },
                          { label: "Replied", value: cStats.replied || "0", color: T.green },
                          { label: "Bounced", value: cStats.bounced || "0", color: T.red },
                          { label: "Completed", value: cStats.completed || "0", color: T.muted },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 10, color: T.muted }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Senders */}
                      <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, letterSpacing: 1 }}>SENDERS</div>
                          <button
                            onClick={() => setAssigningSender(isAssigning ? null : c.id as string)}
                            style={{ fontSize: 11, color: T.orange, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                          >
                            {isAssigning ? "Done" : "+ Assign"}
                          </button>
                        </div>
                        {senders.length === 0 && !isAssigning && (
                          <div style={{ fontSize: 12, color: T.muted }}>No senders assigned yet</div>
                        )}
                        {senders.map(s => (
                          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                            <span style={{ fontSize: 13, color: T.text }}>{s.email}</span>
                            <button onClick={() => removeSender(c.id as string, s.id)} style={{ fontSize: 10, color: T.red, background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                          </div>
                        ))}
                        {isAssigning && (
                          <div style={{ marginTop: 8 }}>
                            {emailHealth.filter(h => h.role === "cold_sender" && !senders.find(s => s.email === h.address)).map(h => (
                              <button
                                key={h.address}
                                onClick={() => {
                                  const match = emailHealth.find(eh => eh.address === h.address);
                                  if (match) {
                                    // Need the warmup address ID — fetch from health data isn't ideal, but we can use the email
                                    fetch("/api/outreach/warmup").then(r => r.json()).then(data => {
                                      const addr = (data.addresses || []).find((a: Record<string, unknown>) => a.address === h.address);
                                      // We don't have the UUID here easily — let's use a different approach
                                    });
                                  }
                                }}
                                style={{ display: "block", padding: "6px 12px", fontSize: 12, color: T.text, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 6, cursor: "pointer", marginBottom: 4, width: "100%" }}
                              >
                                {h.address}
                              </button>
                            ))}
                            <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>Use the API to assign senders by ID for now</div>
                          </div>
                        )}
                      </div>

                      {/* Templates */}
                      <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, letterSpacing: 1 }}>TEMPLATES ({templates.length}/4)</div>
                          <button
                            onClick={() => {
                              if (isEditing) {
                                saveCampaignTemplates(c.id as string);
                              } else {
                                const drafts: Record<number, { subject: string; body: string }> = {};
                                templates.forEach(t => { drafts[t.step] = { subject: t.subject, body: t.body }; });
                                for (let i = 1; i <= 4; i++) { if (!drafts[i]) drafts[i] = { subject: "", body: "" }; }
                                setTemplateDrafts(drafts);
                                setEditingTemplates(c.id as string);
                              }
                            }}
                            style={{ fontSize: 11, color: T.orange, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                          >
                            {isEditing ? "Save Templates" : "Edit Templates"}
                          </button>
                        </div>
                        {!isEditing && templates.map(t => (
                          <div key={t.step} style={{ marginBottom: 8, padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                            <div style={{ fontSize: 11, color: T.orange, fontWeight: 700 }}>STEP {t.step}</div>
                            <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{t.subject}</div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 2, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>{t.body}</div>
                          </div>
                        ))}
                        {isEditing && [1, 2, 3, 4].map(step => (
                          <div key={step} style={{ marginBottom: 12, padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                            <div style={{ fontSize: 11, color: T.orange, fontWeight: 700, marginBottom: 6 }}>STEP {step}</div>
                            <input
                              style={{ ...inputStyle, marginBottom: 6 }}
                              placeholder={`Step ${step} subject (use {{firstName}}, {{company}})`}
                              value={templateDrafts[step]?.subject || ""}
                              onChange={e => setTemplateDrafts({ ...templateDrafts, [step]: { ...templateDrafts[step], subject: e.target.value } })}
                            />
                            <textarea
                              style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
                              placeholder={`Step ${step} body (use {{firstName}}, {{company}}, {{state}})`}
                              value={templateDrafts[step]?.body || ""}
                              onChange={e => setTemplateDrafts({ ...templateDrafts, [step]: { ...templateDrafts[step], body: e.target.value } })}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ============= SCRAPER TAB ============= */}
          {tab === "scraper" && (
            <>
              {/* Scraper stats */}
              {scraperStats && (
                <div className="out-stats">
                  {[
                    { label: "Total Scraped", value: scraperStats.total || "0", color: T.text },
                    { label: "Pending Email", value: scraperStats.pending || "0", color: T.yellow },
                    { label: "Email Found", value: scraperStats.found || "0", color: T.blue },
                    { label: "Verified", value: scraperStats.verified || "0", color: T.green },
                    { label: "Invalid", value: scraperStats.invalid || "0", color: T.red },
                    { label: "Added to Sequence", value: scraperStats.added || "0", color: T.orange },
                    { label: "No Email Found", value: scraperStats.not_found || "0", color: T.muted },
                  ].map(s => (
                    <div key={s.label} className="out-stat">
                      <div className="out-stat-val" style={{ color: s.color }}>{s.value}</div>
                      <div className="out-stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Scraper configs */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="out-label" style={{ marginBottom: 0 }}>Scraper Configs</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="out-btn-ghost" onClick={exportCSV} style={{ fontSize: 12, padding: "6px 12px" }}>Export CSV</button>
                  <button className="out-btn out-btn-sm" onClick={() => setShowScraperForm(!showScraperForm)}>
                    {showScraperForm ? "Cancel" : "+ Add Scraper"}
                  </button>
                </div>
              </div>

              {showScraperForm && (
                <div className="out-card" style={{ marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>NAME</div>
                      <input style={inputStyle} placeholder="Tampa Roofers" value={newScraper.name} onChange={e => setNewScraper({ ...newScraper, name: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>GOOGLE MAPS QUERY</div>
                      <input style={inputStyle} placeholder="roofing contractors in Tampa FL" value={newScraper.query} onChange={e => setNewScraper({ ...newScraper, query: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>DAILY</div>
                      <input style={inputStyle} type="number" value={newScraper.dailyCount} onChange={e => setNewScraper({ ...newScraper, dailyCount: e.target.value })} />
                    </div>
                  </div>
                  <button className="out-btn" onClick={addScraperConfig} disabled={addingScraper || !newScraper.name || !newScraper.query}>
                    {addingScraper ? "Adding..." : "Add Scraper"}
                  </button>
                </div>
              )}

              {scraperConfigs.length === 0 ? (
                <div className="out-card" style={{ textAlign: "center", color: T.muted, padding: 40 }}>
                  No scraper configs yet. Add one to start scraping Google Maps for leads.
                </div>
              ) : (
                scraperConfigs.map((sc: Record<string, unknown>) => (
                  <div key={sc.id as string} className="health-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{sc.name as string}</div>
                        <div style={{ fontSize: 12, color: T.muted }}>{sc.query as string}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          className="out-input"
                          type="number"
                          value={sc.daily_count as number}
                          onChange={e => updateScraperCount(sc.id as string, parseInt(e.target.value) || 15)}
                          style={{ width: 60, textAlign: "center" }}
                          min={1}
                          max={100}
                        />
                        <span style={{ fontSize: 10, color: T.muted }}>/day</span>
                        <button
                          onClick={() => toggleScraper(sc.id as string, !(sc.enabled as boolean))}
                          style={{
                            padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 12, cursor: "pointer",
                            background: (sc.enabled as boolean) ? `${T.green}15` : "rgba(255,255,255,0.05)",
                            color: (sc.enabled as boolean) ? T.green : T.muted,
                            border: `1px solid ${(sc.enabled as boolean) ? T.green + "30" : T.border}`,
                          }}
                        >
                          {(sc.enabled as boolean) ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>
                    {/* Link to campaign */}
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: T.muted }}>Campaign:</span>
                      <select
                        value={(sc.campaign_id as string) || ""}
                        onChange={e => linkScraperToCampaign(sc.id as string, e.target.value)}
                        style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 11 }}
                      >
                        <option value="">None (default pool)</option>
                        {campaigns.map((camp: Record<string, unknown>) => (
                          <option key={camp.id as string} value={camp.id as string}>{camp.name as string}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              )}

              {/* Mass scrape */}
              <div className="out-card" style={{ marginTop: 20 }}>
                <div className="out-label">Mass Scrape + CSV Export</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px auto", gap: 10, alignItems: "end" }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>SEARCH QUERY</div>
                    <input style={inputStyle} placeholder="HVAC companies in Orlando FL" value={massScrapeQuery} onChange={e => setMassScrapeQuery(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MAX</div>
                    <input style={inputStyle} type="number" value={massScrapeCount} onChange={e => setMassScrapeCount(e.target.value)} />
                  </div>
                  <button className="out-btn" onClick={runMassScrape} disabled={massScraping || !massScrapeQuery}>
                    {massScraping ? "Scraping..." : "Scrape + Download CSV"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ============= INBOX TAB ============= */}
          {tab === "inbox" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div className="out-label" style={{ marginBottom: 0 }}>Campaign Inbox</div>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: 12, color: T.red, fontWeight: 700 }}>{unreadCount} unread</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="out-btn-ghost" onClick={pollInboxes} disabled={polling} style={{ fontSize: 12, padding: "6px 12px" }}>
                    {polling ? "Checking..." : "Check Mail"}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                {(["all", "unread", "starred"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setInboxFilter(f)}
                    style={{
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: inboxFilter === f ? "rgba(232,106,42,0.15)" : "transparent",
                      border: `1px solid ${inboxFilter === f ? T.orange + "40" : T.border}`,
                      borderRadius: 6,
                      color: inboxFilter === f ? T.orange : T.muted,
                      cursor: "pointer",
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === "all" && ` (${inboxTotal})`}
                  </button>
                ))}
              </div>

              {/* Replies list */}
              {inboxReplies.length === 0 ? (
                <div className="out-card" style={{ textAlign: "center", color: T.muted, padding: 40 }}>
                  {inboxFilter === "all" ? "No replies yet. Click \"Check Mail\" to poll inboxes." : `No ${inboxFilter} messages.`}
                </div>
              ) : (
                inboxReplies.map(r => (
                  <div
                    key={r.id}
                    className="health-card"
                    style={{
                      cursor: "pointer",
                      borderColor: !r.is_read ? `${T.orange}30` : T.border,
                      background: !r.is_read ? "rgba(232,106,42,0.03)" : T.surface,
                    }}
                    onClick={() => { markAsRead(r.id); setSelectedReply(selectedReply === r.id ? null : r.id); }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {!r.is_read && <div style={{ width: 8, height: 8, borderRadius: 4, background: T.orange, flexShrink: 0 }} />}
                          <div style={{ fontSize: 14, fontWeight: r.is_read ? 400 : 700, color: T.text }}>
                            {r.from_name || r.from_email.split("@")[0]}
                          </div>
                          <div style={{ fontSize: 11, color: T.muted }}>&lt;{r.from_email}&gt;</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginTop: 4 }}>{r.subject}</div>
                        {selectedReply !== r.id && (
                          <div style={{ fontSize: 12, color: T.muted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>
                            {r.body?.substring(0, 120)}...
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <div style={{ fontSize: 11, color: T.muted }}>
                          {new Date(r.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <div style={{ fontSize: 10, color: T.muted, background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 4 }}>
                            to: {r.to_address.split("@")[0]}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); toggleStarReply(r.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: r.is_starred ? T.yellow : T.muted }}
                          >
                            {r.is_starred ? "★" : "☆"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded view */}
                    {selectedReply === r.id && (
                      <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                        <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 300, overflow: "auto" }}>
                          {r.body}
                        </div>

                        {/* Reply box */}
                        <div style={{ marginTop: 14 }}>
                          <textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder="Type your reply..."
                            style={{
                              width: "100%",
                              minHeight: 80,
                              padding: 12,
                              background: "rgba(255,255,255,0.04)",
                              border: `1px solid ${T.border}`,
                              borderRadius: 8,
                              color: T.text,
                              fontSize: 13,
                              resize: "vertical",
                              outline: "none",
                              fontFamily: "inherit",
                            }}
                          />
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                            <button
                              className="out-btn out-btn-sm"
                              onClick={e => { e.stopPropagation(); sendReply(r.id); }}
                              disabled={replying || !replyText.trim()}
                            >
                              {replying ? "Sending..." : `Reply from ${r.to_address.split("@")[0]}@...`}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
