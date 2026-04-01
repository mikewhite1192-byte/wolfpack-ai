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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const DEFAULT_TEMPLATES: Record<number, { subject: string; body: string }> = {
    1: {
      subject: "quick question {{firstName}}",
      body: "Hey {{firstName}},\n\nQuick question — are your follow-ups still going through SMS or have you moved away from A2P yet?\n\nWe built something that handles lead follow-up instantly without touching A2P at all. Curious if that's even on your radar.\n\nMike, The Wolf Pack AI",
    },
    2: {
      subject: "quick question {{firstName}}",
      body: "Hey {{firstName}},\n\nJust wanted to bump this — curious how you're handling follow-ups right now.\n\nMike, The Wolf Pack AI",
    },
    3: {
      subject: "quick question {{firstName}}",
      body: "Hey {{firstName}},\n\nMost agents we've talked to are losing deals just from slow follow-up — have you found a way around that?\n\nMike, The Wolf Pack AI",
    },
    4: {
      subject: "quick question {{firstName}}",
      body: "Hey {{firstName}},\n\nNot sure if this is relevant right now — should I close this out or is follow-up something you're still trying to improve?\n\nMike, The Wolf Pack AI",
    },
  };

  // Scraper state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scraperConfigs, setScraperConfigs] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scraperStats, setScraperStats] = useState<any>(null);
  const [showScraperForm, setShowScraperForm] = useState(false);
  const [newScraper, setNewScraper] = useState({ name: "", query: "", dailyCount: "15", maxReviews: "", minRating: "", maxRating: "", categoryFilter: "", customCategory: "", campaignId: "" });
  const [addingScraper, setAddingScraper] = useState(false);
  const [editingScraperId, setEditingScraperId] = useState<string | null>(null);
  const [editScraper, setEditScraper] = useState({ name: "", query: "", dailyCount: "", maxReviews: "", minRating: "", maxRating: "", categoryFilter: "" });
  const [massScraping, setMassScraping] = useState(false);
  const [massScrapeQuery, setMassScrapeQuery] = useState("");
  const [massScrapeCount, setMassScrapeCount] = useState("50");

  // Today's totals & unread per campaign
  const [todayTotals, setTodayTotals] = useState({ cold: 0, warmup: 0 });
  const [unreadByCampaign, setUnreadByCampaign] = useState<Record<string, number>>({});

  // Contact detail panel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedContact, setSelectedContact] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contactEmails, setContactEmails] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contactReplies, setContactReplies] = useState<any[]>([]);

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

  // Warmup addresses (with IDs for sender assignment)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [warmupAddresses, setWarmupAddresses] = useState<any[]>([]);

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
        setWarmupAddresses(data.warmupStatus || []);
        setTodayTotals(data.todayTotals || { cold: 0, warmup: 0 });
        setUnreadByCampaign(data.unreadByCampaign || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => refreshStats(contactSearch || undefined), 30000);
    return () => clearInterval(interval);
  }, [contactSearch]);

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
      // If campaign selected, assign sender to it
      const campaignId = (newEmail as Record<string, unknown>).campaignId as string;
      if (campaignId && data.id) {
        await fetch("/api/outreach/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "assign-sender", campaignId, senderId: data.id }),
        });
        setAddResult(`Added: ${data.email} (${data.role}) → assigned to campaign`);
      } else {
        setAddResult(`Added: ${data.email} (${data.role})`);
      }
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
        setWarmupAddresses(data.warmupStatus || []);
        setTodayTotals(data.todayTotals || { cold: 0, warmup: 0 });
        setUnreadByCampaign(data.unreadByCampaign || {});
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
    const catFilter = newScraper.categoryFilter === "other" ? newScraper.customCategory : newScraper.categoryFilter;
    await fetch("/api/outreach/scrape-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        name: newScraper.name,
        query: newScraper.query,
        dailyCount: parseInt(newScraper.dailyCount),
        maxReviews: newScraper.maxReviews ? parseInt(newScraper.maxReviews) : null,
        minRating: newScraper.minRating ? parseFloat(newScraper.minRating) : null,
        maxRating: newScraper.maxRating ? parseFloat(newScraper.maxRating) : null,
        categoryFilter: catFilter || null,
      }),
    });
    // Link to campaign if selected
    if (newScraper.campaignId) {
      const res2 = await fetch("/api/outreach/scrape-maps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status" }) });
      const data = await res2.json();
      const latest = (data.configs || []).find((c: Record<string, unknown>) => (c.name as string) === newScraper.name);
      if (latest) {
        await linkScraperToCampaign(latest.id as string, newScraper.campaignId);
      }
    }
    setNewScraper({ name: "", query: "", dailyCount: "15", maxReviews: "", minRating: "", maxRating: "", categoryFilter: "", customCategory: "", campaignId: "" });
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

  async function migrateContacts(campaignId: string) {
    if (!confirm("Move ALL unassigned contacts into this campaign?")) return;
    const res = await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "migrate-contacts", campaignId }),
    });
    const data = await res.json();
    setSendResult(`Migrated ${data.migrated || 0} contacts into campaign`);
    refreshStats();
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign? Contacts will be unassigned but not deleted.")) return;
    await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    refreshStats();
  }

  async function saveScraperEdit() {
    if (!editingScraperId) return;
    await fetch("/api/outreach/scrape-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        name: editScraper.name,
        query: editScraper.query,
        dailyCount: parseInt(editScraper.dailyCount) || 15,
        maxReviews: editScraper.maxReviews ? parseInt(editScraper.maxReviews) : null,
        minRating: editScraper.minRating ? parseFloat(editScraper.minRating) : null,
        maxRating: editScraper.maxRating ? parseFloat(editScraper.maxRating) : null,
        categoryFilter: editScraper.categoryFilter || null,
      }),
    });
    setEditingScraperId(null);
    refreshStats();
  }

  async function deleteScraperConfig(id: string) {
    if (!confirm("Delete this scraper config?")) return;
    await fetch("/api/outreach/scrape-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    refreshStats();
  }

  async function viewContact(contactId: string) {
    const res = await fetch(`/api/outreach/sequence?contactId=${contactId}`);
    const data = await res.json();
    setSelectedContact(data.contact);
    setContactEmails(data.emails || []);
    setContactReplies(data.replies || []);
  }

  async function pauseContact(contactId: string) {
    await fetch("/api/outreach/sequence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause", contactId }),
    });
    setSelectedContact(null);
    refreshStats();
  }

  async function resumeContact(contactId: string) {
    await fetch("/api/outreach/sequence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume", contactId }),
    });
    setSelectedContact(null);
    refreshStats();
  }

  async function unsubContact(contactId: string) {
    if (!confirm("Mark this contact as unsubscribed?")) return;
    await fetch("/api/outreach/sequence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsubscribe", contactId }),
    });
    setSelectedContact(null);
    refreshStats();
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
        <button className={`out-tab ${tab === "campaigns" ? "active" : ""}`} onClick={() => setTab("campaigns")} style={{ position: "relative" }}>
          Campaigns ({campaigns.length})
          {Object.values(unreadByCampaign).reduce((a, b) => a + b, 0) > 0 && (
            <span style={{ position: "absolute", top: 2, right: -4, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
              {Object.values(unreadByCampaign).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>
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
              {/* Today at a glance */}
              <div className="out-card" style={{ marginBottom: 14, borderColor: `${T.orange}20` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="out-label" style={{ marginBottom: 0 }}>TODAY</div>
                  <div style={{ fontSize: 10, color: T.muted }}>Auto-refreshes every 30s</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: T.orange, fontFamily: "'Bebas Neue', sans-serif" }}>{todayTotals.cold}</div>
                    <div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Cold Emails Sent</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: T.blue, fontFamily: "'Bebas Neue', sans-serif" }}>{todayTotals.warmup}</div>
                    <div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Warmup Emails Sent</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: T.green, fontFamily: "'Bebas Neue', sans-serif" }}>{stats?.replied || "0"}</div>
                    <div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Total Replies</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif" }}>{stats?.active || "0"}</div>
                    <div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Active in Sequence</div>
                  </div>
                </div>
              </div>

              {/* Warmup ramp progress */}
              <div className="out-card" style={{ marginBottom: 14 }}>
                <div className="out-label">Email Address Ramp Progress</div>
                {warmupAddresses.map((wa: Record<string, unknown>) => {
                  const day = wa.daysActive as number;
                  const limits = wa.dailyLimits as { total: number; cold: number; warmup: number };
                  const pct = Math.min((day / 25) * 100, 100);
                  const atSteady = day >= 25;
                  return (
                    <div key={wa.address as string} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{(wa.address as string).split("@")[0]}@...</span>
                        <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                          <span style={{ color: T.muted }}>Day {day}</span>
                          <span style={{ color: T.orange }}>{limits.cold} cold</span>
                          <span style={{ color: T.blue }}>{limits.warmup} warmup</span>
                          <span style={{ color: atSteady ? T.green : T.yellow }}>{atSteady ? "FULL" : `${limits.total}/50`}</span>
                        </div>
                      </div>
                      <div className="health-bar">
                        <div className="health-fill" style={{ width: `${pct}%`, background: atSteady ? T.green : T.orange }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stats + Controls side by side */}
              <div className="out-row">
                <div>
                  <div className="out-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    {stats && [
                      { label: "Total Contacts", value: stats.total, color: T.text },
                      { label: "Completed", value: stats.completed, color: T.muted },
                      { label: "Reply Rate", value: parseInt(stats.total) > 0 ? `${Math.round((parseInt(stats.replied) / parseInt(stats.total)) * 100)}%` : "0%", color: T.green },
                      { label: "Bounced", value: stats.bounced, color: T.red },
                      { label: "Invalid", value: stats.invalid || "0", color: T.muted },
                      { label: "Unsubscribed", value: stats.unsubscribed, color: T.yellow },
                    ].map(s => (
                      <div key={s.label} className="out-stat">
                        <div className="out-stat-val" style={{ color: s.color }}>{s.value}</div>
                        <div className="out-stat-label">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="out-card">
                    <div className="out-label">Recent Sends</div>
                    {recentEmails.length === 0 ? (
                      <div style={{ color: T.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No emails sent yet</div>
                    ) : (
                      <table className="out-table">
                        <thead><tr><th>Contact</th><th>From</th><th>Step</th><th>Status</th></tr></thead>
                        <tbody>
                          {recentEmails.slice(0, 10).map((e, i) => (
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

                <div>
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>Manual Actions</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="out-btn" onClick={runSend} disabled={sending}>{sending ? "Sending..." : "Send Cold Emails"}</button>
                          <button className="out-btn-ghost" onClick={runWarmup}>Run Warmup</button>
                          <button className="out-btn-ghost" onClick={revalidateContacts}>Revalidate</button>
                        </div>
                        {sendResult && <div style={{ fontSize: 12, color: T.green, marginTop: 6 }}>{sendResult}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Active campaigns summary */}
                  <div className="out-card">
                    <div className="out-label">Active Campaigns</div>
                    {campaigns.filter((c: Record<string, unknown>) => c.enabled).map((c: Record<string, unknown>) => {
                      const cStats = (c.stats || {}) as Record<string, string>;
                      const unread = unreadByCampaign[c.id as string] || 0;
                      return (
                        <div key={c.id as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.name as string}</div>
                            <div style={{ fontSize: 11, color: T.muted }}>{cStats.active || 0} active · {cStats.replied || 0} replied</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {unread > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: `${T.red}20`, color: T.red }}>{unread} new</span>
                            )}
                            <span style={{ fontSize: 12, color: T.orange, fontWeight: 700 }}>{String((c as Record<string, unknown>).coldToday || 0)} sent today</span>
                          </div>
                        </div>
                      );
                    })}
                    {campaigns.filter((c: Record<string, unknown>) => c.enabled).length === 0 && (
                      <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: 20 }}>No active campaigns</div>
                    )}
                  </div>
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
                      {newEmail.coldSender ? "Sends cold + warmup from day 1, ramps to 40 cold / 10 warmup at day 25" : "Warmup only — builds reputation only"}
                    </span>
                  </div>
                  {newEmail.coldSender && campaigns.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>ASSIGN TO CAMPAIGN</div>
                      <select
                        style={{ ...inputStyle, width: "auto" }}
                        value={(newEmail as Record<string, unknown>).campaignId as string || ""}
                        onChange={e => setNewEmail({ ...newEmail, campaignId: e.target.value } as typeof newEmail)}
                      >
                        <option value="">No campaign (unassigned)</option>
                        {campaigns.map((camp: Record<string, unknown>) => (
                          <option key={camp.id as string} value={camp.id as string}>{camp.name as string}</option>
                        ))}
                      </select>
                    </div>
                  )}
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
                          <tr key={c.id} onClick={() => viewContact(c.id)} style={{ cursor: "pointer" }}>
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
                                  c.sequence_status === "paused" ? "rgba(245,166,35,0.15)" :
                                  c.sequence_status === "completed" ? "rgba(176,180,200,0.1)" :
                                  "rgba(255,255,255,0.05)",
                                color: c.sequence_status === "active" ? T.orange :
                                  c.sequence_status === "replied" ? T.green :
                                  c.sequence_status === "bounced" ? T.red :
                                  c.sequence_status === "paused" ? T.yellow :
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
                          <button
                            onClick={() => deleteCampaign(c.id as string)}
                            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: "pointer", background: "none", color: T.red, border: `1px solid ${T.red}30` }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Campaign stats */}
                      <div className="out-stats" style={{ marginTop: 14, gridTemplateColumns: "repeat(4, 1fr)" }}>
                        {[
                          { label: "Total Contacts", value: cStats.total || "0", color: T.text },
                          { label: "Active in Sequence", value: cStats.active || "0", color: T.orange },
                          { label: "Replied", value: cStats.replied || "0", color: T.green },
                          { label: "Bounced", value: cStats.bounced || "0", color: T.red },
                        ].map(s => (
                          <div key={s.label} className="out-stat">
                            <div className="out-stat-val" style={{ color: s.color }}>{s.value}</div>
                            <div className="out-stat-label">{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Activity summary */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                        <div style={{ padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, letterSpacing: 1, marginBottom: 8 }}>TODAY</div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: T.muted }}>Cold emails sent</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{(c as Record<string, unknown>).coldToday as number || 0}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: T.muted }}>Warmup emails sent</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{(c as Record<string, unknown>).warmupToday as number || 0}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: T.muted }}>New contacts added</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{cStats.added_today || "0"}</span>
                          </div>
                        </div>
                        <div style={{ padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, letterSpacing: 1, marginBottom: 8 }}>SEQUENCE STAGES</div>
                          {[
                            { label: "Step 1 — Hook", value: cStats.step1 || "0" },
                            { label: "Step 2 — Bump", value: cStats.step2 || "0" },
                            { label: "Step 3 — Angle", value: cStats.step3 || "0" },
                            { label: "Step 4 — Close", value: cStats.step4 || "0" },
                          ].map(s => (
                            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 12, color: T.muted }}>{s.label}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Secondary stats */}
                      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: T.muted }}>
                        <span>Completed: {cStats.completed || "0"}</span>
                        <span>Invalid: {cStats.invalid || "0"}</span>
                        <span>Unsubscribed: {cStats.unsubscribed || "0"}</span>
                        <span style={{ color: T.green }}>Scraping 15 contacts/day automatically</span>
                      </div>

                      {/* Quick actions */}
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button className="out-btn-ghost" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => migrateContacts(c.id as string)}>
                          Move All Unassigned Contacts Here
                        </button>
                      </div>

                      {/* Senders */}
                      <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                        <button
                          onClick={() => setExpandedSections(s => ({ ...s, [`senders-${c.id}`]: !s[`senders-${c.id}`] }))}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 700, color: T.orange, letterSpacing: 1 }}>SENDERS ({senders.length})</span>
                          <span style={{ fontSize: 12, color: T.muted }}>{expandedSections[`senders-${c.id}`] ? "▲" : "▼"}</span>
                        </button>
                        {!expandedSections[`senders-${c.id}`] && senders.length > 0 && (
                          <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{senders.map(s => s.email.split("@")[0]).join(", ")}</div>
                        )}
                        {expandedSections[`senders-${c.id}`] && (
                          <>
                            {senders.map(s => (
                              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 13, color: T.text }}>{s.email}</span>
                                <button onClick={() => removeSender(c.id as string, s.id)} style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Remove</button>
                              </div>
                            ))}
                            {(() => {
                              const assignedEmails = senders.map(s => s.email);
                              const available = warmupAddresses.filter((wa: Record<string, unknown>) =>
                                wa.role === "cold_sender" && !assignedEmails.includes(wa.address as string)
                              );
                              if (available.length === 0 && senders.length === 0) {
                                return <div style={{ fontSize: 12, color: T.muted }}>No cold sender addresses available. Add one in the Email Addresses tab first.</div>;
                              }
                              if (available.length === 0) return null;
                              return (
                                <select
                                  value=""
                                  onChange={e => { if (e.target.value) assignSender(c.id as string, e.target.value); }}
                                  style={{ ...inputStyle, marginTop: 6, cursor: "pointer" }}
                                >
                                  <option value="">+ Add a sender...</option>
                                  {available.map((wa: Record<string, unknown>) => (
                                    <option key={wa.id as string} value={wa.id as string}>{wa.address as string}</option>
                                  ))}
                                </select>
                              );
                            })()}
                          </>
                        )}
                      </div>

                      {/* Templates */}
                      <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <button
                            onClick={() => setExpandedSections(s => ({ ...s, [`templates-${c.id}`]: !s[`templates-${c.id}`] }))}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8 }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 700, color: T.orange, letterSpacing: 1 }}>TEMPLATES (4)</span>
                            <span style={{ fontSize: 12, color: T.muted }}>{expandedSections[`templates-${c.id}`] ? "▲" : "▼"}</span>
                          </button>
                          <button
                            onClick={() => {
                              if (isEditing) {
                                saveCampaignTemplates(c.id as string);
                              } else {
                                const drafts: Record<number, { subject: string; body: string }> = {};
                                for (let i = 1; i <= 4; i++) {
                                  const existing = templates.find(t => t.step === i);
                                  drafts[i] = existing ? { subject: existing.subject, body: existing.body } : { ...DEFAULT_TEMPLATES[i] };
                                }
                                setTemplateDrafts(drafts);
                                setEditingTemplates(c.id as string);
                              }
                            }}
                            style={{ fontSize: 11, color: T.orange, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                          >
                            {isEditing ? "Save Templates" : "Edit Templates"}
                          </button>
                        </div>
                        {(expandedSections[`templates-${c.id}`] || isEditing) && (
                          <>
                            {!isEditing && [1, 2, 3, 4].map(step => {
                              const t = templates.find(t => t.step === step) || DEFAULT_TEMPLATES[step];
                              const isDefault = !templates.find(t => t.step === step);
                              return (
                                <div key={step} style={{ marginBottom: 8, padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <span style={{ fontSize: 11, color: T.orange, fontWeight: 700 }}>STEP {step}</span>
                                    {isDefault && <span style={{ fontSize: 9, color: T.muted, background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>DEFAULT</span>}
                                  </div>
                                  <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{t.subject}</div>
                                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>{t.body}</div>
                                </div>
                              );
                            })}
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
                          </>
                        )}
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
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>DAILY COUNT</div>
                      <input style={inputStyle} type="number" value={newScraper.dailyCount} onChange={e => setNewScraper({ ...newScraper, dailyCount: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MAX REVIEWS</div>
                      <input style={inputStyle} type="number" placeholder="e.g. 20" value={newScraper.maxReviews} onChange={e => setNewScraper({ ...newScraper, maxReviews: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MIN RATING</div>
                      <input style={inputStyle} type="number" step="0.5" placeholder="e.g. 3.0" value={newScraper.minRating} onChange={e => setNewScraper({ ...newScraper, minRating: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MAX RATING</div>
                      <input style={inputStyle} type="number" step="0.5" placeholder="e.g. 5.0" value={newScraper.maxRating} onChange={e => setNewScraper({ ...newScraper, maxRating: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>CATEGORY</div>
                      <select style={inputStyle} value={newScraper.categoryFilter} onChange={e => setNewScraper({ ...newScraper, categoryFilter: e.target.value })}>
                        <option value="">Any category</option>
                        <option value="Roofing contractor">Roofing</option>
                        <option value="HVAC contractor">HVAC</option>
                        <option value="Plumber">Plumbing</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Real estate">Real Estate</option>
                        <option value="Dentist">Dental</option>
                        <option value="Medical spa">Med Spa</option>
                        <option value="Gym">Fitness / Gym</option>
                        <option value="Solar">Solar</option>
                        <option value="Landscaping">Landscaping</option>
                        <option value="Auto repair">Auto Repair</option>
                        <option value="other">Other (type below)</option>
                      </select>
                    </div>
                  </div>
                  {newScraper.categoryFilter === "other" && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>CUSTOM CATEGORY</div>
                      <input style={inputStyle} placeholder="e.g. Pool cleaning, Pest control" value={newScraper.customCategory} onChange={e => setNewScraper({ ...newScraper, customCategory: e.target.value })} />
                    </div>
                  )}
                  {campaigns.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>ADD TO CAMPAIGN</div>
                      <select style={inputStyle} value={newScraper.campaignId} onChange={e => setNewScraper({ ...newScraper, campaignId: e.target.value })}>
                        <option value="">No campaign (unassigned pool)</option>
                        {campaigns.map((camp: Record<string, unknown>) => (
                          <option key={camp.id as string} value={camp.id as string}>{camp.name as string}</option>
                        ))}
                      </select>
                    </div>
                  )}
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
                scraperConfigs.map((sc: Record<string, unknown>) => {
                  const isEditing = editingScraperId === sc.id;
                  return (
                  <div key={sc.id as string} className="health-card">
                    {!isEditing ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{sc.name as string}</div>
                            <div style={{ fontSize: 12, color: T.muted }}>{sc.query as string}</div>
                            {((sc.max_reviews as number) || (sc.min_rating as number) || (sc.category_filter as string)) && (
                              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                                {(sc.max_reviews as number) && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(232,106,42,0.1)", color: T.orange }}>≤{String(sc.max_reviews)} reviews</span>}
                                {(sc.min_rating as number) && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(232,106,42,0.1)", color: T.orange }}>≥{String(sc.min_rating)}★</span>}
                                {(sc.max_rating as number) && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(232,106,42,0.1)", color: T.orange }}>≤{String(sc.max_rating)}★</span>}
                                {(sc.category_filter as string) && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(232,106,42,0.1)", color: T.orange }}>{sc.category_filter as string}</span>}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input className="out-input" type="number" value={sc.daily_count as number}
                              onChange={e => updateScraperCount(sc.id as string, parseInt(e.target.value) || 15)}
                              style={{ width: 60, textAlign: "center" }} min={1} max={100} />
                            <span style={{ fontSize: 10, color: T.muted }}>/day</span>
                            <button onClick={() => toggleScraper(sc.id as string, !(sc.enabled as boolean))}
                              style={{ padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 12, cursor: "pointer",
                                background: (sc.enabled as boolean) ? `${T.green}15` : "rgba(255,255,255,0.05)",
                                color: (sc.enabled as boolean) ? T.green : T.muted,
                                border: `1px solid ${(sc.enabled as boolean) ? T.green + "30" : T.border}` }}>
                              {(sc.enabled as boolean) ? "ON" : "OFF"}
                            </button>
                            <button onClick={() => {
                              setEditingScraperId(sc.id as string);
                              setEditScraper({
                                name: sc.name as string, query: sc.query as string,
                                dailyCount: String(sc.daily_count), maxReviews: sc.max_reviews ? String(sc.max_reviews) : "",
                                minRating: sc.min_rating ? String(sc.min_rating) : "", maxRating: sc.max_rating ? String(sc.max_rating) : "",
                                categoryFilter: (sc.category_filter as string) || "",
                              });
                            }} style={{ padding: "4px 8px", fontSize: 11, color: T.orange, background: "none", border: `1px solid ${T.orange}30`, borderRadius: 6, cursor: "pointer" }}>
                              Edit
                            </button>
                            <button onClick={() => deleteScraperConfig(sc.id as string)}
                              style={{ padding: "4px 8px", fontSize: 11, color: T.red, background: "none", border: `1px solid ${T.red}30`, borderRadius: 6, cursor: "pointer" }}>
                              Delete
                            </button>
                          </div>
                        </div>
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: T.muted }}>Campaign:</span>
                          <select value={(sc.campaign_id as string) || ""} onChange={e => linkScraperToCampaign(sc.id as string, e.target.value)}
                            style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 11 }}>
                            <option value="">None (default pool)</option>
                            {campaigns.map((camp: Record<string, unknown>) => (
                              <option key={camp.id as string} value={camp.id as string}>{camp.name as string}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="out-label">Edit Scraper</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>NAME</div>
                            <input style={inputStyle} value={editScraper.name} onChange={e => setEditScraper({ ...editScraper, name: e.target.value })} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>QUERY</div>
                            <input style={inputStyle} value={editScraper.query} onChange={e => setEditScraper({ ...editScraper, query: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>DAILY COUNT</div>
                            <input style={inputStyle} type="number" value={editScraper.dailyCount} onChange={e => setEditScraper({ ...editScraper, dailyCount: e.target.value })} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MAX REVIEWS</div>
                            <input style={inputStyle} type="number" placeholder="Any" value={editScraper.maxReviews} onChange={e => setEditScraper({ ...editScraper, maxReviews: e.target.value })} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MIN RATING</div>
                            <input style={inputStyle} type="number" step="0.5" placeholder="Any" value={editScraper.minRating} onChange={e => setEditScraper({ ...editScraper, minRating: e.target.value })} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>CATEGORY</div>
                            <input style={inputStyle} placeholder="Any" value={editScraper.categoryFilter} onChange={e => setEditScraper({ ...editScraper, categoryFilter: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="out-btn" onClick={saveScraperEdit}>Save</button>
                          <button className="out-btn-ghost" onClick={() => setEditingScraperId(null)}>Cancel</button>
                        </div>
                      </>
                    )}
                  </div>
                  );
                })
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
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}
                    onChange={e => {
                      const campaignId = e.target.value;
                      if (campaignId) {
                        // Get all sender emails for this campaign, fetch inbox for each
                        const camp = campaigns.find((c: Record<string, unknown>) => c.id === campaignId);
                        const senderEmails = ((camp?.senders || []) as { email: string }[]).map(s => s.email);
                        if (senderEmails.length > 0) {
                          // Fetch with first sender address, inbox API already supports filtering
                          const params = senderEmails.map(e => `address=${encodeURIComponent(e)}`).join("&");
                          fetch(`/api/outreach/inbox?${params}`)
                            .then(r => r.json())
                            .then(data => { setInboxReplies(data.replies || []); setInboxTotal(data.total || 0); });
                        }
                      } else {
                        loadInbox();
                      }
                    }}
                  >
                    <option value="">All Campaigns</option>
                    {campaigns.map((camp: Record<string, unknown>) => {
                      const campSenders = (camp.senders || []) as { email: string }[];
                      return (
                        <option key={camp.id as string} value={camp.id as string}>
                          {camp.name as string} ({campSenders.length} senders)
                        </option>
                      );
                    })}
                  </select>
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

      {/* ============= CONTACT DETAIL PANEL ============= */}
      {selectedContact && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 440, background: T.bg, borderLeft: `1px solid ${T.border}`, zIndex: 1000, overflowY: "auto", padding: 24 }}>
          {/* Backdrop */}
          <div onClick={() => setSelectedContact(null)} style={{ position: "fixed", top: 0, left: 0, right: 440, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: -1 }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: T.text }}>CONTACT DETAIL</div>
            <button onClick={() => setSelectedContact(null)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>

          {/* Contact info */}
          <div className="out-card" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
              {[selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(" ") || selectedContact.email}
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{selectedContact.email}</div>
            {selectedContact.company && <div style={{ fontSize: 12, color: T.muted }}>{selectedContact.company}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6, textTransform: "uppercase",
                background: selectedContact.sequence_status === "active" ? "rgba(232,106,42,0.15)" :
                  selectedContact.sequence_status === "replied" ? "rgba(46,204,113,0.15)" :
                  selectedContact.sequence_status === "paused" ? "rgba(245,166,35,0.15)" :
                  "rgba(255,255,255,0.05)",
                color: selectedContact.sequence_status === "active" ? T.orange :
                  selectedContact.sequence_status === "replied" ? T.green :
                  selectedContact.sequence_status === "paused" ? T.yellow :
                  selectedContact.sequence_status === "bounced" ? T.red : T.muted,
              }}>
                {selectedContact.sequence_status}
              </span>
              <span style={{ fontSize: 11, color: T.muted }}>Step {selectedContact.sequence_step}/4</span>
              {selectedContact.assigned_sender && <span style={{ fontSize: 11, color: T.muted }}>via {selectedContact.assigned_sender.split("@")[0]}</span>}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {selectedContact.sequence_status === "active" && (
                <button className="out-btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => pauseContact(selectedContact.id)}>Pause</button>
              )}
              {selectedContact.sequence_status === "paused" && (
                <button className="out-btn" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => resumeContact(selectedContact.id)}>Resume</button>
              )}
              {!["unsubscribed", "bounced"].includes(selectedContact.sequence_status) && (
                <button style={{ fontSize: 11, padding: "5px 12px", background: "none", border: `1px solid ${T.red}30`, color: T.red, borderRadius: 6, cursor: "pointer" }} onClick={() => unsubContact(selectedContact.id)}>
                  Unsubscribe
                </button>
              )}
            </div>
          </div>

          {/* Email thread */}
          <div className="out-label">Email Thread</div>
          {contactEmails.length === 0 && contactReplies.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 12, textAlign: "center", padding: 20 }}>No emails sent yet</div>
          ) : (
            <>
              {/* Merge and sort emails + replies by date */}
              {(() => {
                const thread = [
                  ...contactEmails.map((e: Record<string, unknown>) => ({ step: e.step as number, subject: e.subject as string, body: e.body as string, type: "sent" as const, date: e.sent_at as string })),
                  ...contactReplies.map((r: Record<string, unknown>) => ({ step: 0, subject: r.subject as string, body: r.body as string, type: "reply" as const, date: r.received_at as string })),
                ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                return thread.map((item, i) => (
                  <div key={i} style={{
                    marginBottom: 10, padding: 12, borderRadius: 8,
                    background: item.type === "reply" ? "rgba(46,204,113,0.06)" : "rgba(255,255,255,0.02)",
                    borderLeft: `3px solid ${item.type === "reply" ? T.green : T.orange}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: item.type === "reply" ? T.green : T.orange }}>
                        {item.type === "reply" ? "REPLY" : `STEP ${item.step}`}
                      </span>
                      <span style={{ fontSize: 10, color: T.muted }}>
                        {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    {item.subject && <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>{item.subject}</div>}
                    <div style={{ fontSize: 12, color: T.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{item.body}</div>
                  </div>
                ));
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
