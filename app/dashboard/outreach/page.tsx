"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

// Colors used inline throughout — kept as constants for the 2400+ line file
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
  last_name: string | null;
  from_email: string | null;
  step: number;
  status: string;
  sent_at: string;
  subject: string | null;
  body: string | null;
  company: string | null;
  city: string | null;
  niche: string | null;
}

interface EmailHealthData {
  id: string;
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
  const [tab, setTab] = useState<"overview" | "emails" | "health" | "inbox" | "contacts" | "campaigns" | "scraper" | "sent" | "postmaster" | "emailsetup" | "messages" | "groupposting">("overview");
  const [emailSetupSub, setEmailSetupSub] = useState<"addresses" | "health" | "postmaster">("addresses");
  const [messagesSub, setMessagesSub] = useState<"inbox" | "sent">("inbox");

  // Group Posting state
  const [gpTab, setGpTab] = useState<"wolfpack" | "buenaonda">("wolfpack");
  const [gpSearch, setGpSearch] = useState("");
  const [gpStatusFilter, setGpStatusFilter] = useState<"all" | "due" | "posted">("all");
  const [gpPlatformFilter, setGpPlatformFilter] = useState<"all" | "facebook" | "reddit">("all");
  const [gpGeneratedPost, setGpGeneratedPost] = useState("");
  const [gpIsGenerating, setGpIsGenerating] = useState(false);
  const [gpCopied, setGpCopied] = useState(false);
  const [gpEditingUrlId, setGpEditingUrlId] = useState<string | null>(null);
  const [gpFlashId, setGpFlashId] = useState<string | null>(null);
  const [gpWolfpackData, setGpWolfpackData] = useState<Record<string, { lastPosted?: string; url?: string }>>({});
  const [gpBuenaondaData, setGpBuenaondaData] = useState<Record<string, { lastPosted?: string; url?: string }>>({});

  // Postmaster state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [postmasterData, setPostmasterData] = useState<any>(null);
  const [postmasterLoading, setPostmasterLoading] = useState(false);
  const [postmasterError, setPostmasterError] = useState("");
  const [postmasterRange, setPostmasterRange] = useState("7d");
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
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
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, Record<number, { subject: string; body: string }>>>({});
  const [activeVariant, setActiveVariant] = useState<string>("A");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [emailSearch, setEmailSearch] = useState("");
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [rampOpen, setRampOpen] = useState(false);
  const [statsRange, setStatsRange] = useState<"today" | "7d" | "30d" | "90d">("7d");
  const [contactCampaignFilter, setContactCampaignFilter] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scraperLog, setScraperLog] = useState<any[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [healthCampaignFilter, setHealthCampaignFilter] = useState<string>("");
  const [emailCampaignFilter, setEmailCampaignFilter] = useState<string>("");
  const [scraperDateFilter, setScraperDateFilter] = useState<"today" | "7d" | "30d" | "all">("all");

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
  const [newScraper, setNewScraper] = useState({ name: "", query: "", dailyCount: "15", maxReviews: "", minRating: "", maxRating: "", categoryFilter: "", customCategory: "", campaignId: "", city: "", state: "", country: "US" });
  const [addingScraper, setAddingScraper] = useState(false);
  const [editingScraperId, setEditingScraperId] = useState<string | null>(null);
  const [editScraper, setEditScraper] = useState({ name: "", query: "", dailyCount: "", maxReviews: "", minRating: "", maxRating: "", categoryFilter: "" });
  const [massScraping, setMassScraping] = useState(false);
  const [massScrapeQuery, setMassScrapeQuery] = useState("");
  const [massScrapeCount, setMassScrapeCount] = useState("50");
  const [msName, setMsName] = useState("");
  const [msCity, setMsCity] = useState("");
  const [msState, setMsState] = useState("");
  const [runningAllScrapers, setRunningAllScrapers] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState("");

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
    campaign_id: string | null;
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
  const [threadMessages, setThreadMessages] = useState<Array<{ direction: string; from: string; body: string; subject: string; sent_at: string }>>([]);
  const [loadingThread, setLoadingThread] = useState(false);

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

  // Load group posting data from localStorage
  useEffect(() => {
    try {
      const wp = localStorage.getItem("wolfpack_tracker_v1");
      if (wp) setGpWolfpackData(JSON.parse(wp));
      const bo = localStorage.getItem("buenaonda_tracker_v1");
      if (bo) setGpBuenaondaData(JSON.parse(bo));
    } catch {}
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

  async function deleteEmailAddress(id: string) {
    setDeletingEmail(id);
    try {
      await fetch("/api/outreach/warmup", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setEmailHealth(emailHealth.filter(h => h.id !== id));
    } catch (e) { console.error(e); }
    setDeletingEmail(null);
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
    // Flatten all variants into a single array of templates
    const templates: { step: number; subject: string; body: string; variant: string }[] = [];
    for (const [variant, steps] of Object.entries(templateDrafts)) {
      for (const [step, t] of Object.entries(steps)) {
        // Only include variants that have content (A is always required)
        if (variant === "A" || (t.subject.trim() && t.body.trim())) {
          templates.push({ step: parseInt(step), subject: t.subject, body: t.body, variant });
        }
      }
    }
    await fetch("/api/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-templates", campaignId, templates }),
    });
    // Delete variants that were cleared (had content before but now empty)
    for (const variant of ["B", "C"]) {
      const hasContent = templates.some(t => t.variant === variant);
      if (!hasContent && templateDrafts[variant]) {
        await fetch("/api/outreach/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete-variant", campaignId, variant }),
        });
      }
    }
    setEditingTemplates(null);
    setTemplateDrafts({});
    setActiveVariant("A");
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
    setNewScraper({ name: "", query: "", dailyCount: "15", maxReviews: "", minRating: "", maxRating: "", categoryFilter: "", customCategory: "", campaignId: "", city: "", state: "", country: "US" });
    setShowScraperForm(false);
    setAddingScraper(false);
    refreshStats();
  }

  async function runAllScrapers() {
    setRunningAllScrapers(true);
    const enabledConfigs = scraperConfigs.filter((sc: Record<string, unknown>) => sc.enabled);
    for (let i = 0; i < enabledConfigs.length; i++) {
      const sc = enabledConfigs[i];
      setScrapeProgress(`Scraping ${i + 1}/${enabledConfigs.length}: ${sc.name}...`);
      try {
        await fetch(`/api/outreach/scrape-maps?phase=scrape&configId=${sc.id}`);
      } catch (e) {
        console.error(`Failed to scrape ${sc.name}:`, e);
      }
    }
    setScrapeProgress("");
    setRunningAllScrapers(false);
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

  async function stopCampaignContacts(campaignId?: string) {
    const label = campaignId ? "this campaign" : "unassigned";
    if (!confirm(`Stop all active contacts in ${label}? They will not receive any more emails.`)) return;
    const res = await fetch("/api/outreach/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop-contacts", campaignId }) });
    const data = await res.json();
    alert(`${data.count || 0} contacts stopped`);
    refreshStats();
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

  const [movingToCrm, setMovingToCrm] = useState<string | null>(null);
  async function moveToCrm(contactId: string) {
    setMovingToCrm(contactId);
    try {
      const res = await fetch("/api/outreach/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move-to-crm", contactId }) });
      const data = await res.json();
      if (data.error) { alert(data.error); } else { alert("Moved to CRM! Check your pipeline."); }
    } catch { alert("Error moving to CRM"); }
    setMovingToCrm(null);
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

  // Load inbox when switching to messages tab with inbox sub-tab
  useEffect(() => {
    if (tab === "messages" && messagesSub === "inbox") loadInbox();
  }, [tab, messagesSub, inboxFilter]);

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
    setReplying(false);
    loadInbox();
    // Reload thread after sending
    loadThread(replyId);
  }

  async function loadThread(replyId: string) {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/outreach/inbox?thread=${replyId}`);
      const data = await res.json();
      setThreadMessages(data.thread || []);
    } catch { setThreadMessages([]); }
    setLoadingThread(false);
  }

  function openReply(replyId: string) {
    if (selectedReply === replyId) {
      setSelectedReply(null);
      setThreadMessages([]);
    } else {
      setSelectedReply(replyId);
      markAsRead(replyId);
      loadThread(replyId);
    }
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
        @media (max-width: 900px) {
          .out-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .out-row { grid-template-columns: 1fr !important; }
          .out-tabs { flex-wrap: wrap; gap: 2px; }
          .out-tab { font-size: 11px !important; padding: 8px 10px !important; }
          .out-table th, .out-table td { font-size: 11px; padding: 6px 8px; }
        }
        @media (max-width: 600px) {
          .out-stats { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .out-stat-val { font-size: 22px !important; }
          .out-stat-label { font-size: 9px !important; }
          .out-card { padding: 14px !important; }
          .out-label { font-size: 12px !important; }
          .out-table { font-size: 10px; }
          .out-table th, .out-table td { padding: 5px 6px; white-space: nowrap; }
          .out-tab { font-size: 10px !important; padding: 6px 8px !important; }
          .health-card { padding: 12px !important; }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: T.text, letterSpacing: 1 }}>OUTREACH ENGINE</div>
        <div style={{ fontSize: 11, color: T.muted, background: "rgba(232,106,42,0.1)", padding: "4px 12px", borderRadius: 12, border: "1px solid rgba(232,106,42,0.2)" }}>Admin Only</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 20, flexWrap: "wrap" }}>
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
        <button className={`out-tab ${tab === "emailsetup" ? "active" : ""}`} onClick={() => setTab("emailsetup")}>Email Setup</button>
        <button className={`out-tab ${tab === "contacts" ? "active" : ""}`} onClick={() => setTab("contacts")}>Contacts</button>
        <button className={`out-tab ${tab === "messages" ? "active" : ""}`} onClick={() => { setTab("messages"); if (messagesSub === "inbox") { fetch("/api/outreach/inbox").then(r => r.json()).then(d => { setInboxReplies(d.replies || []); setInboxTotal(d.total || 0); setUnreadCount(d.unread || 0); }); } }} style={{ position: "relative" }}>
          Messages
          {unreadCount > 0 && (
            <span style={{ position: "absolute", top: 2, right: -4, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
              {unreadCount}
            </span>
          )}
        </button>
        <button className={`out-tab ${tab === "groupposting" ? "active" : ""}`} onClick={() => setTab("groupposting")}>Group Posting</button>
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

              {/* Warmup ramp progress — collapsible */}
              <div className="out-card" style={{ marginBottom: 14 }}>
                <div onClick={() => setRampOpen(!rampOpen)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div className="out-label" style={{ marginBottom: 0 }}>
                    Email Address Ramp Progress
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 400, marginLeft: 8 }}>
                      ({warmupAddresses.filter((wa: Record<string, unknown>) => (wa.daysActive as number) >= 25).length}/{warmupAddresses.length} at full capacity)
                    </span>
                  </div>
                  <span style={{ color: T.orange, fontSize: 18, fontWeight: 300, transition: "transform 0.3s", transform: rampOpen ? "rotate(45deg)" : "rotate(0)" }}>+</span>
                </div>
                {rampOpen && (
                  <div style={{ marginTop: 14 }}>
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
                )}
              </div>

              {/* Stats with date range */}
              <div className="out-card" style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div className="out-label" style={{ marginBottom: 0 }}>Contact Stats</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["today", "7d", "30d", "90d"] as const).map(r => (
                      <button key={r} onClick={() => { setStatsRange(r); fetch(`/api/outreach/stats?range=${r}`).then(res => res.json()).then(data => { if (data.stats) setStats(data.stats); }); }}
                        style={{ padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: "pointer", background: statsRange === r ? `${T.orange}20` : "rgba(255,255,255,0.04)", color: statsRange === r ? T.orange : T.muted, border: `1px solid ${statsRange === r ? T.orange + "40" : T.border}`, transition: "all 0.2s" }}>
                        {r === "today" ? "Today" : r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
                      </button>
                    ))}
                  </div>
                </div>
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
              </div>

              {/* Recent sends + actions */}
              <div className="out-row">
                <div>
                  <div className="out-card">
                    <div className="out-label">Recent Sends</div>
                    {recentEmails.length === 0 ? (
                      <div style={{ color: T.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No emails sent yet</div>
                    ) : (
                      <table className="out-table">
                        <thead><tr><th>Contact</th><th>From</th><th>Step</th><th>Status</th><th>Date</th></tr></thead>
                        <tbody>
                          {recentEmails.slice(0, 10).map((e, i) => (
                            <tr key={i}>
                              <td>{e.first_name || e.email?.split("@")[0] || "—"}</td>
                              <td className="muted" style={{ fontSize: 11 }}>{e.from_email?.split("@")[0] || "—"}</td>
                              <td className="muted">#{e.step}</td>
                              <td style={{ color: e.status === "sent" ? T.green : T.red }}>{e.status}</td>
                              <td className="muted" style={{ fontSize: 11 }}>{e.sent_at ? new Date(e.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div>
                  <div className="out-card">
                    <div className="out-label">Quick Actions</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="out-btn" onClick={runSend} disabled={sending}>{sending ? "Sending..." : "Send Cold Emails"}</button>
                        <button className="out-btn-ghost" onClick={runWarmup}>Run Warmup</button>
                      </div>
                      {sendResult && <div style={{ fontSize: 12, color: T.green, marginTop: 4 }}>{sendResult}</div>}
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

          {/* ============= EMAIL SETUP SUB-TAB BAR ============= */}
          {tab === "emailsetup" && (
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              <button onClick={() => setEmailSetupSub("addresses")} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: emailSetupSub === "addresses" ? T.orange : "transparent", color: emailSetupSub === "addresses" ? "#fff" : T.muted, border: `1px solid ${emailSetupSub === "addresses" ? T.orange : T.border}`, borderRadius: 6, cursor: "pointer" }}>Email Addresses</button>
              <button onClick={() => setEmailSetupSub("health")} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: emailSetupSub === "health" ? T.orange : "transparent", color: emailSetupSub === "health" ? "#fff" : T.muted, border: `1px solid ${emailSetupSub === "health" ? T.orange : T.border}`, borderRadius: 6, cursor: "pointer" }}>Health Monitor</button>
              <button onClick={() => { setEmailSetupSub("postmaster"); if (!postmasterData && !postmasterLoading) { setPostmasterLoading(true); setPostmasterError(""); fetch(`/api/outreach/postmaster?range=${postmasterRange}`).then(r => r.json()).then(d => { if (d.error) setPostmasterError(d.error); else setPostmasterData(d); setPostmasterLoading(false); }).catch(() => { setPostmasterError("Failed to load"); setPostmasterLoading(false); }); } }} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: emailSetupSub === "postmaster" ? T.orange : "transparent", color: emailSetupSub === "postmaster" ? "#fff" : T.muted, border: `1px solid ${emailSetupSub === "postmaster" ? T.orange : T.border}`, borderRadius: 6, cursor: "pointer" }}>Postmaster</button>
            </div>
          )}

          {/* ============= EMAIL ADDRESSES (Email Setup > Addresses) ============= */}
          {tab === "emailsetup" && emailSetupSub === "addresses" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="out-label" style={{ marginBottom: 0 }}>Email Addresses</div>
                  <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: `${T.orange}15`, color: T.orange, fontWeight: 700 }}>{emailHealth.length}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select style={{ ...inputStyle, width: 160, fontSize: 12 }} value={emailCampaignFilter} onChange={e => setEmailCampaignFilter(e.target.value)}>
                    <option value="">All Campaigns</option>
                    {campaigns.map((c: Record<string, unknown>) => (
                      <option key={c.id as string} value={c.id as string}>{c.name as string}</option>
                    ))}
                    <option value="none">Unassigned</option>
                  </select>
                  <input
                    style={{ ...inputStyle, width: 200, fontSize: 12 }}
                    placeholder="Search emails..."
                    value={emailSearch}
                    onChange={e => setEmailSearch(e.target.value)}
                  />
                  <button className="out-btn out-btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                    {showAddForm ? "Cancel" : "+ Add Email"}
                  </button>
                </div>
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
                emailHealth.filter(h => {
                  if (emailSearch && !h.address.toLowerCase().includes(emailSearch.toLowerCase())) return false;
                  if (emailCampaignFilter) {
                    const senderCampMap: Record<string, string> = {};
                    campaigns.forEach((c: Record<string, unknown>) => {
                      const senders = (c.senders || []) as { email: string }[];
                      senders.forEach(s => { senderCampMap[s.email] = c.id as string; });
                    });
                    if (emailCampaignFilter === "none") return !senderCampMap[h.address];
                    return senderCampMap[h.address] === emailCampaignFilter;
                  }
                  return true;
                }).sort((a, b) => {
                  if (a.role === "cold_sender" && b.role !== "cold_sender") return -1;
                  if (a.role !== "cold_sender" && b.role === "cold_sender") return 1;
                  return a.address.localeCompare(b.address);
                }).map(h => (
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
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                        <button
                          onClick={() => { if (confirm(`Delete ${h.address}?`)) deleteEmailAddress(h.id); }}
                          disabled={deletingEmail === h.id}
                          style={{ padding: "4px 8px", fontSize: 11, background: "rgba(255,59,48,0.1)", color: "#ff3b30", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
                        >
                          {deletingEmail === h.id ? "..." : "X"}
                        </button>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="out-label" style={{ marginBottom: 0 }}>Outreach Contacts</div>
                  <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: `${T.orange}15`, color: T.orange, fontWeight: 700 }}>{outreachContacts.length}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select style={{ ...inputStyle, width: 160, fontSize: 12 }} value={contactCampaignFilter} onChange={e => setContactCampaignFilter(e.target.value)}>
                    <option value="">All Campaigns</option>
                    {campaigns.map((c: Record<string, unknown>) => (
                      <option key={c.id as string} value={c.id as string}>{c.name as string}</option>
                    ))}
                    <option value="none">No Campaign</option>
                  </select>
                  <input
                    style={{ ...inputStyle, width: 220, fontSize: 12 }}
                    placeholder="Search by name, email, company..."
                    value={contactSearch}
                    onChange={e => searchContacts(e.target.value)}
                  />
                </div>
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
                          <th>Added</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outreachContacts.filter(c => !contactCampaignFilter || (contactCampaignFilter === "none" ? !c.campaign_id : c.campaign_id === contactCampaignFilter)).map(c => (
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
                            <td className="muted" style={{ fontSize: 11 }}>
                              {c.created_at ? new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
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

          {/* ============= HEALTH MONITOR (Email Setup > Health) ============= */}
          {tab === "emailsetup" && emailSetupSub === "health" && (() => {
            const senderCampaignMap: Record<string, string> = {};
            campaigns.forEach((c: Record<string, unknown>) => {
              const senders = (c.senders || []) as { id: string; email: string }[];
              senders.forEach(s => { senderCampaignMap[s.email] = c.id as string; });
            });
            const filteredHealth = healthCampaignFilter
              ? healthCampaignFilter === "none"
                ? emailHealth.filter(h => !senderCampaignMap[h.address])
                : emailHealth.filter(h => senderCampaignMap[h.address] === healthCampaignFilter)
              : emailHealth;
            return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div className="out-label" style={{ marginBottom: 0 }}>Health Overview</div>
                <select style={{ ...inputStyle, width: 180, fontSize: 12 }} value={healthCampaignFilter} onChange={e => setHealthCampaignFilter(e.target.value)}>
                  <option value="">All Campaigns</option>
                  {campaigns.map((c: Record<string, unknown>) => (
                    <option key={c.id as string} value={c.id as string}>{c.name as string}</option>
                  ))}
                  <option value="none">Unassigned</option>
                </select>
              </div>

              {/* Summary stats */}
              <div className="out-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {[
                  { label: "Total Addresses", value: filteredHealth.length, color: T.text },
                  { label: "Cold Senders", value: filteredHealth.filter(h => h.role === "cold_sender").length, color: T.orange },
                  { label: "Warmup Only", value: filteredHealth.filter(h => h.role === "warmup_only").length, color: T.blue },
                  { label: "Healthy", value: filteredHealth.filter(h => h.healthStatus === "healthy").length, color: T.green },
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
                    {filteredHealth.map(h => (
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
                  {filteredHealth.filter(h => h.healthIssues.length > 0).map(h => (
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
          );})()}

          {/* ============= CAMPAIGNS TAB ============= */}
          {tab === "campaigns" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="out-label" style={{ marginBottom: 0 }}>Campaigns</div>
                  <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: `${T.orange}15`, color: T.orange, fontWeight: 700 }}>{campaigns.length}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, width: 220, fontSize: 12 }}
                    placeholder="Search campaigns..."
                    value={campaignSearch}
                    onChange={e => setCampaignSearch(e.target.value)}
                  />
                  <button className="out-btn out-btn-sm" onClick={() => setShowCampaignForm(!showCampaignForm)}>
                    {showCampaignForm ? "Cancel" : "+ New Campaign"}
                  </button>
                </div>
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
                campaigns.filter((c: Record<string, unknown>) => !campaignSearch || (c.name as string).toLowerCase().includes(campaignSearch.toLowerCase()) || ((c.niche as string) || "").toLowerCase().includes(campaignSearch.toLowerCase())).sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
                  if (a.enabled && !b.enabled) return -1;
                  if (!a.enabled && b.enabled) return 1;
                  return 0;
                }).map((c: Record<string, unknown>) => {
                  const senders = (c.senders || []) as { id: string; email: string; display_name: string }[];
                  const templates = (c.templates || []) as { step: number; subject: string; body: string; variant?: string }[];
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

                      {/* A/B variant stats */}
                      {(() => {
                        const vs = (c as Record<string, unknown>).variantStats as Record<string, { sent: number; replied: number; bounced: number; replyRate: number }> | undefined;
                        if (!vs || Object.keys(vs).length <= 1) return null;
                        const entries = Object.entries(vs).sort(([a], [b]) => a.localeCompare(b));
                        const bestVariant = entries.reduce((best, curr) => curr[1].replyRate > best[1].replyRate ? curr : best);
                        return (
                          <div style={{ marginTop: 10, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, letterSpacing: 1, marginBottom: 8 }}>A/B SPLIT TEST</div>
                            <div style={{ display: "grid", gridTemplateColumns: `80px repeat(${entries.length}, 1fr)`, gap: 4, fontSize: 11 }}>
                              <div style={{ color: T.muted, fontWeight: 600 }}></div>
                              {entries.map(([v]) => (
                                <div key={v} style={{ color: v === bestVariant[0] ? T.green : T.text, fontWeight: 700, textAlign: "center" }}>
                                  Variant {v} {v === bestVariant[0] && entries.length > 1 ? " *" : ""}
                                </div>
                              ))}
                              <div style={{ color: T.muted }}>Sent</div>
                              {entries.map(([v, s]) => <div key={v} style={{ textAlign: "center", color: T.text }}>{s.sent}</div>)}
                              <div style={{ color: T.muted }}>Replies</div>
                              {entries.map(([v, s]) => <div key={v} style={{ textAlign: "center", color: T.green }}>{s.replied}</div>)}
                              <div style={{ color: T.muted }}>Reply Rate</div>
                              {entries.map(([v, s]) => <div key={v} style={{ textAlign: "center", color: v === bestVariant[0] ? T.green : T.text, fontWeight: v === bestVariant[0] ? 700 : 400 }}>{s.replyRate}%</div>)}
                              <div style={{ color: T.muted }}>Bounced</div>
                              {entries.map(([v, s]) => <div key={v} style={{ textAlign: "center", color: s.bounced > 0 ? T.red : T.muted }}>{s.bounced}</div>)}
                            </div>
                          </div>
                        );
                      })()}

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
                        <span style={{ color: T.green }}>{scraperConfigs.filter((sc: Record<string, unknown>) => sc.campaign_id === c.id && sc.enabled).length} scrapers linked</span>
                      </div>

                      {/* Quick actions */}
                      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                        <button className="out-btn-ghost" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => migrateContacts(c.id as string)}>
                          Move Unassigned Here
                        </button>
                        <button style={{ fontSize: 11, padding: "6px 12px", background: `${T.red}10`, border: `1px solid ${T.red}30`, color: T.red, borderRadius: 6, cursor: "pointer" }} onClick={() => stopCampaignContacts(c.id as string)}>
                          Stop All Contacts
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
                                const allDrafts: Record<string, Record<number, { subject: string; body: string }>> = {};
                                for (const variant of ["A", "B", "C"]) {
                                  const varDrafts: Record<number, { subject: string; body: string }> = {};
                                  for (let i = 1; i <= 4; i++) {
                                    const existing = templates.find((t: { step: number; variant?: string }) => t.step === i && (t.variant || "A") === variant);
                                    if (variant === "A") {
                                      varDrafts[i] = existing ? { subject: existing.subject, body: existing.body } : { ...DEFAULT_TEMPLATES[i] };
                                    } else {
                                      varDrafts[i] = existing ? { subject: existing.subject, body: existing.body } : { subject: "", body: "" };
                                    }
                                  }
                                  allDrafts[variant] = varDrafts;
                                }
                                setTemplateDrafts(allDrafts);
                                setActiveVariant("A");
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
                            {/* Variant tabs */}
                            {(() => {
                              const existingVariants = [...new Set(templates.map((t: { variant?: string }) => t.variant || "A"))].sort();
                              const displayVariants = isEditing ? ["A", "B", "C"] : (existingVariants.length > 0 ? existingVariants : ["A"]);
                              const currentVariant = isEditing ? activeVariant : (displayVariants.includes(activeVariant) ? activeVariant : "A");
                              return displayVariants.length > 1 || isEditing ? (
                                <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                  {displayVariants.map(v => {
                                    const hasContent = isEditing
                                      ? (v === "A" || Object.values(templateDrafts[v] || {}).some(t => t.subject.trim() || t.body.trim()))
                                      : templates.some((t: { variant?: string }) => (t.variant || "A") === v);
                                    return (
                                      <button
                                        key={v}
                                        onClick={() => setActiveVariant(v)}
                                        style={{
                                          padding: "4px 14px", fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: "pointer",
                                          background: currentVariant === v ? `${T.orange}20` : "rgba(255,255,255,0.04)",
                                          color: currentVariant === v ? T.orange : (hasContent ? T.text : T.muted),
                                          border: `1px solid ${currentVariant === v ? T.orange + "40" : T.border}`,
                                          transition: "all 0.2s",
                                        }}
                                      >
                                        Variant {v} {!hasContent && v !== "A" ? "(empty)" : ""}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null;
                            })()}
                            {!isEditing && [1, 2, 3, 4].map(step => {
                              const t = templates.find((t: { step: number; variant?: string }) => t.step === step && (t.variant || "A") === activeVariant)
                                || (activeVariant === "A" ? DEFAULT_TEMPLATES[step] : null);
                              if (!t) return null;
                              const isDefault = !templates.find((t: { step: number; variant?: string }) => t.step === step && (t.variant || "A") === activeVariant);
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
                            {isEditing && (
                              <>
                                {activeVariant !== "A" && (
                                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                                    Variant {activeVariant} is optional. Leave empty to only use Variant A.
                                  </div>
                                )}
                                {[1, 2, 3, 4].map(step => (
                                  <div key={step} style={{ marginBottom: 12, padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                                    <div style={{ fontSize: 11, color: T.orange, fontWeight: 700, marginBottom: 6 }}>STEP {step}</div>
                                    <input
                                      style={{ ...inputStyle, marginBottom: 6 }}
                                      placeholder={`Step ${step} subject (use {{firstName}}, {{company}})`}
                                      value={templateDrafts[activeVariant]?.[step]?.subject || ""}
                                      onChange={e => setTemplateDrafts({
                                        ...templateDrafts,
                                        [activeVariant]: {
                                          ...templateDrafts[activeVariant],
                                          [step]: { ...templateDrafts[activeVariant]?.[step], subject: e.target.value },
                                        },
                                      })}
                                    />
                                    <textarea
                                      style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
                                      placeholder={`Step ${step} body (use {{firstName}}, {{company}}, {{state}})`}
                                      value={templateDrafts[activeVariant]?.[step]?.body || ""}
                                      onChange={e => setTemplateDrafts({
                                        ...templateDrafts,
                                        [activeVariant]: {
                                          ...templateDrafts[activeVariant],
                                          [step]: { ...templateDrafts[activeVariant]?.[step], body: e.target.value },
                                        },
                                      })}
                                    />
                                  </div>
                                ))}
                              </>
                            )}
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

              {/* Date filter for scraper stats */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                {(["today", "7d", "30d", "all"] as const).map(r => (
                  <button key={r} onClick={() => { setScraperDateFilter(r); fetch(`/api/outreach/scrape-maps`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", range: r === "all" ? undefined : r }) }).then(res => res.json()).then(data => { if (data.stats) setScraperStats(data.stats); }); }}
                    style={{ padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: "pointer", background: scraperDateFilter === r ? `${T.orange}20` : "rgba(255,255,255,0.04)", color: scraperDateFilter === r ? T.orange : T.muted, border: `1px solid ${scraperDateFilter === r ? T.orange + "40" : T.border}`, transition: "all 0.2s" }}>
                    {r === "today" ? "Today" : r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "All Time"}
                  </button>
                ))}
              </div>

              {/* Scraper configs */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="out-label" style={{ marginBottom: 0 }}>Scraper Configs</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {scrapeProgress && <span style={{ fontSize: 11, color: T.orange }}>{scrapeProgress}</span>}
                  <button className="out-btn-ghost" onClick={runAllScrapers} disabled={runningAllScrapers} style={{ fontSize: 12, padding: "6px 12px", color: runningAllScrapers ? T.muted : T.green, borderColor: runningAllScrapers ? T.border : T.green + "40" }}>
                    {runningAllScrapers ? "Scraping..." : "Run All Scrapers"}
                  </button>
                  <button className="out-btn-ghost" onClick={exportCSV} style={{ fontSize: 12, padding: "6px 12px" }}>Export CSV</button>
                  <button className="out-btn out-btn-sm" onClick={() => setShowScraperForm(!showScraperForm)}>
                    {showScraperForm ? "Cancel" : "+ Add Scraper"}
                  </button>
                </div>
              </div>

              {showScraperForm && (
                <div className="out-card" style={{ marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 100px", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>CITY</div>
                      <input style={inputStyle} placeholder="Warren" value={newScraper.city} onChange={e => {
                        const city = e.target.value;
                        const query = city ? `${newScraper.name || "businesses"} near ${city}${newScraper.state ? " " + newScraper.state : ""}` : newScraper.query;
                        setNewScraper({ ...newScraper, city, query: city ? query : newScraper.query });
                      }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>STATE</div>
                      <input style={inputStyle} placeholder="MI" value={newScraper.state} onChange={e => {
                        const state = e.target.value;
                        const query = newScraper.city ? `${newScraper.name || "businesses"} near ${newScraper.city} ${state}` : newScraper.query;
                        setNewScraper({ ...newScraper, state, query: newScraper.city ? query : newScraper.query });
                      }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>COUNTRY</div>
                      <select style={inputStyle} value={newScraper.country} onChange={e => setNewScraper({ ...newScraper, country: e.target.value })}>
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="UK">United Kingdom</option>
                        <option value="AU">Australia</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>DAILY COUNT</div>
                      <input style={inputStyle} type="number" value={newScraper.dailyCount} onChange={e => setNewScraper({ ...newScraper, dailyCount: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>NAME</div>
                      <input style={inputStyle} placeholder="e.g. plumbers, roofers, HVAC" value={newScraper.name} onChange={e => {
                        const name = e.target.value;
                        const query = newScraper.city ? `${name} near ${newScraper.city}${newScraper.state ? " " + newScraper.state : ""}` : "";
                        setNewScraper({ ...newScraper, name, query: newScraper.city ? query : newScraper.query });
                      }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>GOOGLE MAPS QUERY <span style={{ color: T.muted, fontWeight: 400 }}>(auto-generated or custom)</span></div>
                      <input style={inputStyle} placeholder="plumbers near Warren MI" value={newScraper.query} onChange={e => setNewScraper({ ...newScraper, query: e.target.value })} />
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
                (() => {
                  const grouped: Record<string, Record<string, unknown>[]> = {};
                  scraperConfigs.forEach((sc: Record<string, unknown>) => {
                    const campId = (sc.campaign_id as string) || "unassigned";
                    if (!grouped[campId]) grouped[campId] = [];
                    grouped[campId].push(sc);
                  });
                  const campName = (id: string) => {
                    if (id === "unassigned") return "Unassigned";
                    const c = campaigns.find((c: Record<string, unknown>) => c.id === id);
                    return c ? (c.name as string) : "Unknown";
                  };
                  return Object.entries(grouped).sort((a, b) => a[0] === "unassigned" ? 1 : b[0] === "unassigned" ? -1 : 0).map(([campId, configs]) => (
                    <div key={campId} style={{ marginBottom: 16 }}>
                      <div onClick={() => setExpandedSections(prev => ({ ...prev, [`scraper_${campId}`]: !prev[`scraper_${campId}`] }))}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: expandedSections[`scraper_${campId}`] ? 10 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{campName(campId)}</span>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: `${T.orange}15`, color: T.orange, fontWeight: 600 }}>{configs.length} scrapers</span>
                        </div>
                        <span style={{ color: T.orange, fontSize: 16, fontWeight: 300, transition: "transform 0.3s", transform: expandedSections[`scraper_${campId}`] ? "rotate(45deg)" : "rotate(0)" }}>+</span>
                      </div>
                      {expandedSections[`scraper_${campId}`] && configs.map((sc: Record<string, unknown>) => {
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
                })}
                    </div>
                  ));
                })()
              )}

              {/* Mass scrape */}
              <div className="out-card" style={{ marginTop: 20 }}>
                <div className="out-label">Mass Scrape + CSV Export</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 100px", gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>CITY</div>
                    <input style={inputStyle} placeholder="Warren" value={msCity} onChange={e => {
                      setMsCity(e.target.value);
                      if (e.target.value) setMassScrapeQuery(`${msName || "businesses"} near ${e.target.value}${msState ? " " + msState : ""}`);
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>STATE</div>
                    <input style={inputStyle} placeholder="MI" value={msState} onChange={e => {
                      setMsState(e.target.value);
                      if (msCity) setMassScrapeQuery(`${msName || "businesses"} near ${msCity} ${e.target.value}`);
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>COUNTRY</div>
                    <select style={inputStyle}>
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="UK">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MAX RESULTS</div>
                    <input style={inputStyle} type="number" value={massScrapeCount} onChange={e => setMassScrapeCount(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>NAME / TRADE</div>
                    <input style={inputStyle} placeholder="e.g. plumbers, roofers, HVAC" value={msName} onChange={e => {
                      setMsName(e.target.value);
                      if (msCity) setMassScrapeQuery(`${e.target.value} near ${msCity}${msState ? " " + msState : ""}`);
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>GOOGLE MAPS QUERY <span style={{ fontWeight: 400 }}>(auto-generated or custom)</span></div>
                    <input style={inputStyle} placeholder="plumbers near Warren MI" value={massScrapeQuery} onChange={e => setMassScrapeQuery(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MAX REVIEWS</div>
                    <input style={inputStyle} type="number" placeholder="e.g. 20" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MIN RATING</div>
                    <input style={inputStyle} type="number" step="0.5" placeholder="e.g. 3.0" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>MAX RATING</div>
                    <input style={inputStyle} type="number" step="0.5" placeholder="e.g. 5.0" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600 }}>CATEGORY</div>
                    <select style={inputStyle}>
                      <option value="">Any category</option>
                      <option value="Roofing contractor">Roofing</option>
                      <option value="HVAC contractor">HVAC</option>
                      <option value="Plumber">Plumbing</option>
                      <option value="Electrician">Electrical</option>
                      <option value="Landscaping">Landscaping</option>
                      <option value="Auto repair">Auto Repair</option>
                      <option value="Restaurant">Restaurant</option>
                      <option value="Dentist">Dental</option>
                      <option value="Medical spa">Med Spa</option>
                      <option value="Real estate">Real Estate</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="out-btn" onClick={runMassScrape} disabled={massScraping || !massScrapeQuery}>
                    {massScraping ? "Scraping..." : "Scrape + Download CSV"}
                  </button>
                  <button className="out-btn-ghost" onClick={exportCSV} style={{ fontSize: 12 }}>Export All CSV</button>
                </div>
              </div>

              {/* Activity Log */}
              <div className="out-card" style={{ marginTop: 20 }}>
                <div onClick={() => { setLogOpen(!logOpen); if (!logOpen && scraperLog.length === 0) { fetch("/api/outreach/scrape-maps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get-log", limit: 100 }) }).then(r => r.json()).then(d => setScraperLog(d.logs || [])); } }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div className="out-label" style={{ marginBottom: 0 }}>Activity Log</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button className="out-btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={e => { e.stopPropagation(); fetch("/api/outreach/scrape-maps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get-log", limit: 100 }) }).then(r => r.json()).then(d => setScraperLog(d.logs || [])); }}>Refresh</button>
                    <span style={{ color: T.orange, fontSize: 16, fontWeight: 300, transition: "transform 0.3s", transform: logOpen ? "rotate(45deg)" : "rotate(0)" }}>+</span>
                  </div>
                </div>
                {logOpen && (
                  <div style={{ marginTop: 14, maxHeight: 400, overflowY: "auto" }}>
                    {scraperLog.length === 0 ? (
                      <div style={{ color: T.muted, fontSize: 12, textAlign: "center", padding: 20 }}>No activity logged yet. Logs appear after scraper runs.</div>
                    ) : (
                      <table className="out-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Phase</th>
                            <th>Config</th>
                            <th>Stored</th>
                            <th>Emails</th>
                            <th>Verified</th>
                            <th>Added</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scraperLog.map((log: Record<string, unknown>, i: number) => (
                            <tr key={i}>
                              <td style={{ fontSize: 10, whiteSpace: "nowrap" }}>{log.created_at ? new Date(log.created_at as string).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</td>
                              <td><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: (log.phase as string) === "scrape" ? `${T.orange}15` : (log.phase as string) === "emails" ? `${T.blue}15` : `${T.green}15`, color: (log.phase as string) === "scrape" ? T.orange : (log.phase as string) === "emails" ? T.blue : T.green, textTransform: "uppercase" }}>{log.phase as string}</span></td>
                              <td style={{ fontSize: 11, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(log.config_name as string) || ""}</td>
                              <td style={{ textAlign: "center" }}>{(log.businesses_stored as number) || ""}</td>
                              <td style={{ textAlign: "center" }}>{(log.emails_found as number) || ""}</td>
                              <td style={{ textAlign: "center" }}>{(log.emails_verified as number) || ""}</td>
                              <td style={{ textAlign: "center" }}>{(log.contacts_added as number) || ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ============= MESSAGES TAB (Inbox + Sent) ============= */}
          {tab === "messages" && (
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              <button onClick={() => setMessagesSub("inbox")} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: messagesSub === "inbox" ? T.orange : "transparent", color: messagesSub === "inbox" ? "#fff" : T.muted, border: `1px solid ${messagesSub === "inbox" ? T.orange : T.border}`, borderRadius: 6, cursor: "pointer", position: "relative" }}>
                Inbox
                {unreadCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: T.red, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 8, padding: "1px 5px", minWidth: 14, textAlign: "center" }}>{unreadCount}</span>}
              </button>
              <button onClick={() => setMessagesSub("sent")} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: messagesSub === "sent" ? T.orange : "transparent", color: messagesSub === "sent" ? "#fff" : T.muted, border: `1px solid ${messagesSub === "sent" ? T.orange : T.border}`, borderRadius: 6, cursor: "pointer" }}>Sent</button>
            </div>
          )}

          {/* ============= SENT EMAILS (Messages > Sent) ============= */}
          {tab === "messages" && messagesSub === "sent" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div className="out-label" style={{ marginBottom: 0 }}>Sent Emails</div>
                <div style={{ fontSize: 11, color: T.muted }}>Last {recentEmails.length} cold emails</div>
              </div>

              {recentEmails.length === 0 ? (
                <div className="out-card" style={{ textAlign: "center", color: T.muted, padding: 40 }}>
                  No emails sent yet.
                </div>
              ) : (
                recentEmails.map((e, i) => {
                  const isExpanded = expandedEmail === i;
                  return (
                    <div
                      key={i}
                      className="health-card"
                      style={{ cursor: "pointer", borderColor: isExpanded ? `${T.orange}30` : T.border }}
                      onClick={() => setExpandedEmail(isExpanded ? null : i)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
                              background: e.status === "sent" ? `${T.green}15` : `${T.red}15`,
                              color: e.status === "sent" ? T.green : T.red,
                            }}>
                              {e.status}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${T.blue}15`, color: T.blue }}>
                              Step {e.step}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                              {e.first_name || "Unknown"} {e.last_name || ""}
                            </span>
                            {e.company && (
                              <span style={{ fontSize: 11, color: T.muted }}>— {e.company}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginTop: 4 }}>
                            {e.subject || "(no subject)"}
                          </div>
                          {!isExpanded && (
                            <div style={{ fontSize: 12, color: T.muted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 600 }}>
                              {(e.body || "").substring(0, 120)}...
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ fontSize: 11, color: T.muted }}>{e.sent_at ? new Date(e.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</div>
                          <div style={{ fontSize: 10, color: T.muted }}>{e.sent_at ? new Date(e.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}</div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
                            <div style={{ fontSize: 11, color: T.muted }}>To: <span style={{ color: T.text }}>{e.email}</span></div>
                            <div style={{ fontSize: 11, color: T.muted }}>From: <span style={{ color: T.text }}>{e.from_email}</span></div>
                            {e.city && <div style={{ fontSize: 11, color: T.muted }}>City: <span style={{ color: T.text }}>{e.city}</span></div>}
                            {e.niche && <div style={{ fontSize: 11, color: T.muted }}>Niche: <span style={{ color: T.text }}>{e.niche}</span></div>}
                          </div>
                          <div style={{
                            whiteSpace: "pre-wrap",
                            fontSize: 13,
                            color: T.text,
                            lineHeight: 1.6,
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 8,
                            padding: 14,
                            border: `1px solid ${T.border}`,
                          }}>
                            {e.body}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ============= INBOX (Messages > Inbox) ============= */}
          {tab === "messages" && messagesSub === "inbox" && (
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
                    onClick={() => openReply(r.id)}
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

                    {/* Expanded view — full conversation thread */}
                    {selectedReply === r.id && (
                      <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                        {/* Thread */}
                        {loadingThread ? (
                          <div style={{ color: T.muted, fontSize: 12, textAlign: "center", padding: 20 }}>Loading conversation...</div>
                        ) : threadMessages.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 500, overflowY: "auto", marginBottom: 14 }}>
                            {threadMessages.map((msg, idx) => (
                              <div key={idx} style={{
                                padding: 12,
                                borderRadius: 8,
                                background: msg.direction === "outbound" ? "rgba(232,106,42,0.06)" : "rgba(255,255,255,0.03)",
                                borderLeft: `3px solid ${msg.direction === "outbound" ? T.orange : T.blue}`,
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: msg.direction === "outbound" ? T.orange : T.blue }}>
                                    {msg.direction === "outbound" ? `You (${msg.from})` : msg.from}
                                  </span>
                                  <span style={{ fontSize: 10, color: T.muted }}>
                                    {new Date(msg.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                  </span>
                                </div>
                                {msg.subject && idx === 0 && <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>{msg.subject}</div>}
                                <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{msg.body}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 300, overflow: "auto", marginBottom: 14 }}>
                            {r.body}
                          </div>
                        )}

                        {/* Reply box */}
                        <div>
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
                            {r.outreach_contact_id && (
                              <button
                                className="out-btn-ghost"
                                onClick={e => { e.stopPropagation(); moveToCrm(r.outreach_contact_id!); }}
                                disabled={movingToCrm === r.outreach_contact_id}
                                style={{ fontSize: 11, padding: "5px 12px", color: T.green, borderColor: `${T.green}40` }}
                              >
                                {movingToCrm === r.outreach_contact_id ? "Moving..." : "Move to CRM"}
                              </button>
                            )}
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
              <button
                onClick={() => moveToCrm(selectedContact.id)}
                disabled={movingToCrm === selectedContact.id || selectedContact.converted}
                style={{ fontSize: 11, padding: "5px 12px", background: selectedContact.converted ? `${T.green}15` : `${T.green}20`, border: `1px solid ${T.green}40`, color: T.green, borderRadius: 6, cursor: selectedContact.converted ? "default" : "pointer", fontWeight: 600 }}
              >
                {selectedContact.converted ? "In CRM" : movingToCrm === selectedContact.id ? "Moving..." : "Move to CRM"}
              </button>
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

      {/* ============= GROUP POSTING TAB ============= */}
      {tab === "groupposting" && (() => {
        const WOLFPACK_GROUPS: { id: string; name: string; platform: "facebook" | "reddit"; niche: string; size: string; rules: string }[] = [
          { id: "wp1", name: "Roofing Contractors Network", platform: "facebook", niche: "Contractors", size: "Large", rules: "Business tools OK" },
          { id: "wp2", name: "HVAC Business Owners", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Check rules" },
          { id: "wp3", name: "Plumbing Business Owners", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp4", name: "Electricians & Electrical Biz", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Business tools OK" },
          { id: "wp5", name: "Home Service Business Owners", platform: "facebook", niche: "Contractors", size: "Large", rules: "Check pinned rules" },
          { id: "wp6", name: "Contractor Business Growth", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp7", name: "Trades & Contractor Entrepreneurs", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Business tools OK" },
          { id: "wp8", name: "Small Business Marketing Tips", platform: "facebook", niche: "SMB Owners", size: "Large", rules: "Promo threads OK" },
          { id: "wp9", name: "Local Business Owners Network", platform: "facebook", niche: "SMB Owners", size: "Large", rules: "Check rules" },
          { id: "wp10", name: "Service Business Owners", platform: "facebook", niche: "SMB Owners", size: "Large", rules: "Value first" },
          { id: "wp11", name: "General Contractors Network", platform: "facebook", niche: "Contractors", size: "Large", rules: "Business tools OK" },
          { id: "wp12", name: "Landscaping Business Owners", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Check rules" },
          { id: "wp13", name: "Painting Contractors Group", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp14", name: "Home Renovation Pros", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Business tools OK" },
          { id: "wp15", name: "Concrete & Masonry Contractors", platform: "facebook", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp16", name: "Pest Control Business Owners", platform: "facebook", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp17", name: "Pressure Washing Business Owners", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Business tools OK" },
          { id: "wp18", name: "Gutter Cleaning & Installation", platform: "facebook", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp19", name: "Flooring Contractors Network", platform: "facebook", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp20", name: "Solar Installation Business", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Business tools OK" },
          { id: "wp21", name: "Home Inspection Professionals", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Check rules" },
          { id: "wp22", name: "Fence & Deck Contractors", platform: "facebook", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp23", name: "Pool & Spa Service Owners", platform: "facebook", niche: "Contractors", size: "Small", rules: "Business tools OK" },
          { id: "wp24", name: "Appliance Repair Business Owners", platform: "facebook", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp25", name: "Home Service Entrepreneurs", platform: "facebook", niche: "Contractors", size: "Large", rules: "Business tools OK" },
          { id: "wp26", name: "Contractors & Tradesmen USA", platform: "facebook", niche: "Contractors", size: "Large", rules: "Value posts OK" },
          { id: "wp27", name: "Blue Collar Business Owners", platform: "facebook", niche: "Contractors", size: "Large", rules: "Business tools OK" },
          { id: "wp28", name: "Exterior Remodeling Contractors", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Check rules" },
          { id: "wp29", name: "Window & Door Contractors", platform: "facebook", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp30", name: "Drywall & Insulation Pros", platform: "facebook", niche: "Contractors", size: "Small", rules: "Business tools OK" },
          { id: "wp31", name: "Tile & Stone Contractors", platform: "facebook", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp32", name: "Handyman Business Owners", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp33", name: "Remodeling Contractors Network", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Business tools OK" },
          { id: "wp34", name: "Home Builders & Developers", platform: "facebook", niche: "Contractors", size: "Large", rules: "Check rules" },
          { id: "wp35", name: "Contractor Lead Generation Tips", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp36", name: "Trades Business Owners Network", platform: "facebook", niche: "Contractors", size: "Large", rules: "Business tools OK" },
          { id: "wp37", name: "Field Service Business Owners", platform: "facebook", niche: "SMB Owners", size: "Medium", rules: "Check rules" },
          { id: "wp38", name: "Local Services Business Growth", platform: "facebook", niche: "SMB Owners", size: "Large", rules: "Value posts OK" },
          { id: "wp39", name: "Home Services Digital Marketing", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Check rules" },
          { id: "wp40", name: "Contractor CRM & Software Tips", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Tools welcome" },
          { id: "wp41", name: "Residential Roofing Professionals", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Business tools OK" },
          { id: "wp42", name: "Commercial HVAC Professionals", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Check rules" },
          { id: "wp43", name: "Plumbers & Pipefitters Network", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp44", name: "Licensed Electricians Business", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Business tools OK" },
          { id: "wp45", name: "Tree Service Business Owners", platform: "facebook", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp46", name: "Snow Removal Business Owners", platform: "facebook", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp47", name: "Junk Removal Business Owners", platform: "facebook", niche: "Contractors", size: "Small", rules: "Business tools OK" },
          { id: "wp48", name: "Cleaning Business Owners Network", platform: "facebook", niche: "SMB Owners", size: "Medium", rules: "Value posts OK" },
          { id: "wp49", name: "Maid & House Cleaning Business", platform: "facebook", niche: "SMB Owners", size: "Medium", rules: "Business tools OK" },
          { id: "wp50", name: "Property Management Pros", platform: "facebook", niche: "SMB Owners", size: "Medium", rules: "Value posts OK" },
          { id: "wp51", name: "Septic & Drain Service Owners", platform: "facebook", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp52", name: "Irrigation & Sprinkler Business", platform: "facebook", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp53", name: "Chimney Sweep Business Owners", platform: "facebook", niche: "Contractors", size: "Small", rules: "Business tools OK" },
          { id: "wp54", name: "Air Duct Cleaning Business", platform: "facebook", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp55", name: "Masonry & Brick Contractors", platform: "facebook", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp56", name: "Cabinet & Millwork Business", platform: "facebook", niche: "Contractors", size: "Small", rules: "Business tools OK" },
          { id: "wp57", name: "Moving Company Business Owners", platform: "facebook", niche: "SMB Owners", size: "Small", rules: "Check rules" },
          { id: "wp58", name: "Auto Detailing Business Owners", platform: "facebook", niche: "SMB Owners", size: "Small", rules: "Value posts OK" },
          { id: "wp59", name: "Real Estate Investor Network", platform: "facebook", niche: "SMB Owners", size: "Large", rules: "Check rules" },
          { id: "wp60", name: "Contractor Websites & Marketing", platform: "facebook", niche: "Contractors", size: "Medium", rules: "Tools welcome" },
          { id: "wp61", name: "r/sweatystartup", platform: "reddit", niche: "Contractors", size: "Large", rules: "Value posts OK" },
          { id: "wp62", name: "r/smallbusiness", platform: "reddit", niche: "SMB Owners", size: "Large", rules: "Helpful posts OK" },
          { id: "wp63", name: "r/Entrepreneur", platform: "reddit", niche: "Entrepreneurs", size: "Very Large", rules: "No direct promo" },
          { id: "wp64", name: "r/HomeImprovement", platform: "reddit", niche: "Contractors", size: "Very Large", rules: "Value posts OK" },
          { id: "wp65", name: "r/Roofing", platform: "reddit", niche: "Contractors", size: "Medium", rules: "Check rules" },
          { id: "wp66", name: "r/HVAC", platform: "reddit", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp67", name: "r/Plumbing", platform: "reddit", niche: "Contractors", size: "Medium", rules: "Helpful posts OK" },
          { id: "wp68", name: "r/electricians", platform: "reddit", niche: "Contractors", size: "Medium", rules: "Check sidebar" },
          { id: "wp69", name: "r/Landscaping", platform: "reddit", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp70", name: "r/PressureWashing", platform: "reddit", niche: "Contractors", size: "Small", rules: "Helpful posts OK" },
          { id: "wp71", name: "r/solar", platform: "reddit", niche: "Contractors", size: "Medium", rules: "Check rules" },
          { id: "wp72", name: "r/cleaning", platform: "reddit", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp73", name: "r/PaintingandDecoration", platform: "reddit", niche: "Contractors", size: "Small", rules: "Check sidebar" },
          { id: "wp74", name: "r/pools", platform: "reddit", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp75", name: "r/lawncare", platform: "reddit", niche: "Contractors", size: "Medium", rules: "Helpful posts OK" },
          { id: "wp76", name: "r/pestcontrol", platform: "reddit", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp77", name: "r/realestateinvesting", platform: "reddit", niche: "SMB Owners", size: "Large", rules: "Value posts OK" },
          { id: "wp78", name: "r/PropertyManagement", platform: "reddit", niche: "SMB Owners", size: "Medium", rules: "Check rules" },
          { id: "wp79", name: "r/Handyman", platform: "reddit", niche: "Contractors", size: "Small", rules: "Helpful posts OK" },
          { id: "wp80", name: "r/construction", platform: "reddit", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp81", name: "r/generalcontractor", platform: "reddit", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp82", name: "r/Concrete", platform: "reddit", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp83", name: "r/HomeOwners", platform: "reddit", niche: "SMB Owners", size: "Large", rules: "Value posts OK" },
          { id: "wp84", name: "r/SideProject", platform: "reddit", niche: "Entrepreneurs", size: "Medium", rules: "Build-in-public OK" },
          { id: "wp85", name: "r/agency", platform: "reddit", niche: "Agency Owners", size: "Medium", rules: "Value-first" },
          { id: "wp86", name: "r/Flooring", platform: "reddit", niche: "Contractors", size: "Small", rules: "Helpful posts OK" },
          { id: "wp87", name: "r/HomeRenovation", platform: "reddit", niche: "Contractors", size: "Medium", rules: "Value posts OK" },
          { id: "wp88", name: "r/fencing", platform: "reddit", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp89", name: "r/treecare", platform: "reddit", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp90", name: "r/gutters", platform: "reddit", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp91", name: "r/junkremoval", platform: "reddit", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp92", name: "r/paving", platform: "reddit", niche: "Contractors", size: "Small", rules: "Helpful posts OK" },
          { id: "wp93", name: "r/Insulation", platform: "reddit", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp94", name: "r/msp", platform: "reddit", niche: "SMB Owners", size: "Medium", rules: "Check rules" },
          { id: "wp95", name: "r/marketing", platform: "reddit", niche: "Marketing", size: "Large", rules: "No self-promo" },
          { id: "wp96", name: "r/digital_marketing", platform: "reddit", niche: "Marketing", size: "Large", rules: "Self-promo limited" },
          { id: "wp97", name: "r/ApplianceRepair", platform: "reddit", niche: "Contractors", size: "Small", rules: "Check rules" },
          { id: "wp98", name: "r/framing", platform: "reddit", niche: "Contractors", size: "Small", rules: "Value posts OK" },
          { id: "wp99", name: "r/chimney", platform: "reddit", niche: "Contractors", size: "Small", rules: "Helpful posts OK" },
          { id: "wp100", name: "r/hvacadvice", platform: "reddit", niche: "Contractors", size: "Small", rules: "Value posts OK" },
        ];

        const BUENAONDA_GROUPS: { id: string; name: string; platform: "facebook" | "reddit"; niche: string; size: string; rules: string }[] = [
          { id: "bo1", name: "Affiliate Marketing Mastermind", platform: "facebook", niche: "Affiliate Marketers", size: "Large", rules: "Promo OK Fridays" },
          { id: "bo2", name: "Affiliate Marketing Group", platform: "facebook", niche: "Affiliate Marketers", size: "Large", rules: "Check pinned rules" },
          { id: "bo3", name: "SaaS Affiliate Programs", platform: "facebook", niche: "Affiliate Marketers", size: "Medium", rules: "Programs welcome" },
          { id: "bo4", name: "Passive Income & Affiliate Mktg", platform: "facebook", niche: "Affiliate Marketers", size: "Medium", rules: "Value posts OK" },
          { id: "bo5", name: "Super Affiliate Insiders", platform: "facebook", niche: "Affiliate Marketers", size: "Medium", rules: "Active promos OK" },
          { id: "bo6", name: "Affiliate Marketing for Beginners", platform: "facebook", niche: "Affiliate Marketers", size: "Large", rules: "Helpful posts" },
          { id: "bo7", name: "High Ticket Affiliate Marketing", platform: "facebook", niche: "Affiliate Marketers", size: "Medium", rules: "HT programs welcome" },
          { id: "bo8", name: "Recurring Commission Programs", platform: "facebook", niche: "Affiliate Marketers", size: "Small", rules: "Recurring focus" },
          { id: "bo9", name: "SaaS & Software Affiliates", platform: "facebook", niche: "Affiliate Marketers", size: "Small", rules: "Programs OK" },
          { id: "bo10", name: "Make Money Online Community", platform: "facebook", niche: "Affiliate Marketers", size: "Large", rules: "Check rules" },
          { id: "bo11", name: "Digital Marketing Agency Owners", platform: "facebook", niche: "Agency Owners", size: "Large", rules: "Promo in threads" },
          { id: "bo12", name: "Facebook Ads Mastery", platform: "facebook", niche: "Agency / Marketing", size: "Very Large", rules: "Value first" },
          { id: "bo13", name: "Google Ads PPC Experts", platform: "facebook", niche: "Agency / Marketing", size: "Large", rules: "No spam" },
          { id: "bo14", name: "Social Media Marketing Pros", platform: "facebook", niche: "Agency / Marketing", size: "Large", rules: "Check rules" },
          { id: "bo15", name: "Agency Growth Hackers", platform: "facebook", niche: "Agency Owners", size: "Medium", rules: "Promo threads OK" },
          { id: "bo16", name: "Marketing Agency Owners", platform: "facebook", niche: "Agency Owners", size: "Medium", rules: "Value posts OK" },
          { id: "bo17", name: "Freelance Digital Marketers", platform: "facebook", niche: "Agency / Marketing", size: "Large", rules: "Check rules" },
          { id: "bo18", name: "Media Buyers & Advertisers", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Promos OK" },
          { id: "bo19", name: "PPC Advertising Professionals", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Value first" },
          { id: "bo20", name: "eCommerce & Paid Ads Experts", platform: "facebook", niche: "eCommerce", size: "Large", rules: "Promo threads" },
          { id: "bo21", name: "SaaS Growth Hacks", platform: "facebook", niche: "SaaS / Tech", size: "Medium", rules: "Promos welcome" },
          { id: "bo22", name: "AI Tools & Automation", platform: "facebook", niche: "AI / Automation", size: "Large", rules: "Tools welcome" },
          { id: "bo23", name: "AI for Business Owners", platform: "facebook", niche: "AI / Automation", size: "Large", rules: "Value posts OK" },
          { id: "bo24", name: "Marketing Automation Pros", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Tools OK" },
          { id: "bo25", name: "GoHighLevel Community", platform: "facebook", niche: "Agency Owners", size: "Large", rules: "Tools/apps OK" },
          { id: "bo26", name: "GoHighLevel Users Group", platform: "facebook", niche: "Agency Owners", size: "Large", rules: "Value posts OK" },
          { id: "bo27", name: "ClickFunnels Community", platform: "facebook", niche: "Entrepreneurs", size: "Large", rules: "Check rules" },
          { id: "bo28", name: "ActiveCampaign Users Group", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Tools OK" },
          { id: "bo29", name: "Entrepreneurs & Business Owners", platform: "facebook", niche: "Entrepreneurs", size: "Very Large", rules: "Promo days" },
          { id: "bo30", name: "Growth Hacking Strategies", platform: "facebook", niche: "Entrepreneurs", size: "Large", rules: "Check rules" },
          { id: "bo31", name: "Online Business Owners Network", platform: "facebook", niche: "Entrepreneurs", size: "Large", rules: "Value first" },
          { id: "bo32", name: "Passive Income Ideas & Tips", platform: "facebook", niche: "Affiliate Marketers", size: "Large", rules: "Value posts OK" },
          { id: "bo33", name: "Digital Marketing Mastery", platform: "facebook", niche: "Agency / Marketing", size: "Large", rules: "Check rules" },
          { id: "bo34", name: "Email Marketing Pros", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Value posts OK" },
          { id: "bo35", name: "Shopify & eCommerce Marketing", platform: "facebook", niche: "eCommerce", size: "Large", rules: "Tools OK" },
          { id: "bo36", name: "Instagram & TikTok Ads Mastery", platform: "facebook", niche: "Agency / Marketing", size: "Large", rules: "Value first" },
          { id: "bo37", name: "Performance Marketing Network", platform: "facebook", niche: "Agency / Marketing", size: "Large", rules: "Promos OK" },
          { id: "bo38", name: "B2B Sales & Marketing Leaders", platform: "facebook", niche: "Agency Owners", size: "Large", rules: "Value posts OK" },
          { id: "bo39", name: "Funnel Building & Conversion", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Tools OK" },
          { id: "bo40", name: "Paid Traffic Mastery", platform: "facebook", niche: "Agency / Marketing", size: "Large", rules: "Value first" },
          { id: "bo41", name: "Meta Ads Agency Owners", platform: "facebook", niche: "Agency Owners", size: "Large", rules: "Promo threads OK" },
          { id: "bo42", name: "Google Ads Agency Network", platform: "facebook", niche: "Agency Owners", size: "Medium", rules: "Value posts OK" },
          { id: "bo43", name: "TikTok Ads & Marketing", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Check rules" },
          { id: "bo44", name: "eCommerce Brand Owners", platform: "facebook", niche: "eCommerce", size: "Large", rules: "Value posts OK" },
          { id: "bo45", name: "Dropshipping & eCommerce Ads", platform: "facebook", niche: "eCommerce", size: "Large", rules: "Check rules" },
          { id: "bo46", name: "SaaS Founders Network", platform: "facebook", niche: "SaaS / Founders", size: "Medium", rules: "Build-in-public OK" },
          { id: "bo47", name: "B2B SaaS Marketing Leaders", platform: "facebook", niche: "SaaS / Tech", size: "Medium", rules: "Value posts OK" },
          { id: "bo48", name: "Startup Founders & Entrepreneurs", platform: "facebook", niche: "SaaS / Founders", size: "Large", rules: "Check rules" },
          { id: "bo49", name: "AI Marketing Tools & Strategies", platform: "facebook", niche: "AI / Automation", size: "Large", rules: "Tools welcome" },
          { id: "bo50", name: "ChatGPT & AI for Business", platform: "facebook", niche: "AI / Automation", size: "Very Large", rules: "Value posts OK" },
          { id: "bo51", name: "Marketing Agency Scaling", platform: "facebook", niche: "Agency Owners", size: "Medium", rules: "Promo threads OK" },
          { id: "bo52", name: "White Label Marketing Services", platform: "facebook", niche: "Agency Owners", size: "Medium", rules: "Value posts OK" },
          { id: "bo53", name: "Lead Generation Experts", platform: "facebook", niche: "Agency / Marketing", size: "Large", rules: "Check rules" },
          { id: "bo54", name: "CRM & Sales Automation", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Tools OK" },
          { id: "bo55", name: "Zapier & Automation Experts", platform: "facebook", niche: "AI / Automation", size: "Medium", rules: "Tools welcome" },
          { id: "bo56", name: "Digital Agency Masterclass", platform: "facebook", niche: "Agency Owners", size: "Medium", rules: "Check rules" },
          { id: "bo57", name: "7-Figure Agency Owners", platform: "facebook", niche: "Agency Owners", size: "Medium", rules: "Value posts OK" },
          { id: "bo58", name: "Freelance PPC & Paid Ads", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Check rules" },
          { id: "bo59", name: "Klaviyo Email Marketing", platform: "facebook", niche: "eCommerce", size: "Medium", rules: "Value posts OK" },
          { id: "bo60", name: "HubSpot & CRM Community", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Tools OK" },
          { id: "bo61", name: "Affiliate Marketing Insiders", platform: "facebook", niche: "Affiliate Marketers", size: "Medium", rules: "Programs OK" },
          { id: "bo62", name: "Recurring Revenue Business", platform: "facebook", niche: "SaaS / Founders", size: "Medium", rules: "Value posts OK" },
          { id: "bo63", name: "YouTube Ads Experts", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Check rules" },
          { id: "bo64", name: "Content Marketing & SEO", platform: "facebook", niche: "Agency / Marketing", size: "Large", rules: "No spam" },
          { id: "bo65", name: "Amazon FBA & eCommerce Growth", platform: "facebook", niche: "eCommerce", size: "Large", rules: "Value posts OK" },
          { id: "bo66", name: "Remote Work & Side Hustles", platform: "facebook", niche: "Entrepreneurs", size: "Large", rules: "Check rules" },
          { id: "bo67", name: "Marketing Funnel Builders", platform: "facebook", niche: "Agency / Marketing", size: "Medium", rules: "Tools OK" },
          { id: "bo68", name: "Webflow & No-Code Builders", platform: "facebook", niche: "SaaS / Tech", size: "Medium", rules: "Value posts OK" },
          { id: "bo69", name: "r/affiliatemarketing", platform: "reddit", niche: "Affiliate Marketers", size: "Large", rules: "Self-promo Sat only" },
          { id: "bo70", name: "r/juststart", platform: "reddit", niche: "Affiliate Marketers", size: "Large", rules: "Value-first, no spam" },
          { id: "bo71", name: "r/passive_income", platform: "reddit", niche: "Affiliate Marketers", size: "Large", rules: "Check sidebar rules" },
          { id: "bo72", name: "r/Entrepreneur", platform: "reddit", niche: "Entrepreneurs", size: "Very Large", rules: "No direct promo" },
          { id: "bo73", name: "r/SaaS", platform: "reddit", niche: "SaaS / Tech", size: "Medium", rules: "Value posts OK" },
          { id: "bo74", name: "r/digital_marketing", platform: "reddit", niche: "Agency / Marketing", size: "Large", rules: "Self-promo limited" },
          { id: "bo75", name: "r/PPC", platform: "reddit", niche: "Agency / Marketing", size: "Medium", rules: "Helpful posts OK" },
          { id: "bo76", name: "r/FacebookAds", platform: "reddit", niche: "Agency / Marketing", size: "Medium", rules: "No blatant ads" },
          { id: "bo77", name: "r/GoogleAds", platform: "reddit", niche: "Agency / Marketing", size: "Medium", rules: "Check rules" },
          { id: "bo78", name: "r/agency", platform: "reddit", niche: "Agency Owners", size: "Medium", rules: "Value-first" },
          { id: "bo79", name: "r/marketing", platform: "reddit", niche: "Agency / Marketing", size: "Large", rules: "No self-promo" },
          { id: "bo80", name: "r/startups", platform: "reddit", niche: "SaaS / Founders", size: "Large", rules: "No spam" },
          { id: "bo81", name: "r/ecommerce", platform: "reddit", niche: "eCommerce", size: "Large", rules: "Check rules" },
          { id: "bo82", name: "r/dropshipping", platform: "reddit", niche: "eCommerce", size: "Large", rules: "No spam" },
          { id: "bo83", name: "r/indiehackers", platform: "reddit", niche: "SaaS / Founders", size: "Medium", rules: "Build-in-public OK" },
          { id: "bo84", name: "r/EntrepreneurRideAlong", platform: "reddit", niche: "Entrepreneurs", size: "Medium", rules: "Build-in-public OK" },
          { id: "bo85", name: "r/SEO", platform: "reddit", niche: "Agency / Marketing", size: "Large", rules: "No self-promo" },
          { id: "bo86", name: "r/socialmedia", platform: "reddit", niche: "Agency / Marketing", size: "Medium", rules: "Check sidebar" },
          { id: "bo87", name: "r/EmailMarketing", platform: "reddit", niche: "Agency / Marketing", size: "Medium", rules: "Value posts OK" },
          { id: "bo88", name: "r/chatgpt", platform: "reddit", niche: "AI / Automation", size: "Very Large", rules: "Value posts OK" },
          { id: "bo89", name: "r/ArtificialIntelligence", platform: "reddit", niche: "AI / Automation", size: "Large", rules: "Value posts OK" },
          { id: "bo90", name: "r/AutomateYourLife", platform: "reddit", niche: "AI / Automation", size: "Medium", rules: "Tools OK" },
          { id: "bo91", name: "r/smallbusiness", platform: "reddit", niche: "SMB Owners", size: "Large", rules: "Helpful posts OK" },
          { id: "bo92", name: "r/Blogging", platform: "reddit", niche: "Content Creators", size: "Medium", rules: "Value posts OK" },
          { id: "bo93", name: "r/content_marketing", platform: "reddit", niche: "Agency / Marketing", size: "Medium", rules: "Check rules" },
          { id: "bo94", name: "r/ycombinator", platform: "reddit", niche: "SaaS / Founders", size: "Medium", rules: "Value posts OK" },
          { id: "bo95", name: "r/Affiliatemarketing", platform: "reddit", niche: "Affiliate Marketers", size: "Medium", rules: "Check rules" },
          { id: "bo96", name: "r/sweatystartup", platform: "reddit", niche: "Entrepreneurs", size: "Large", rules: "Value posts OK" },
          { id: "bo97", name: "r/learnprogramming", platform: "reddit", niche: "Tech", size: "Very Large", rules: "No promo" },
          { id: "bo98", name: "r/webdev", platform: "reddit", niche: "Tech", size: "Very Large", rules: "No promo" },
        ];

        const WOLFPACK_SYSTEM = `You write Facebook and Reddit posts for Mike, the owner of thewolfpack.ai. He sells websites and CRM tools to home service contractors — roofers, HVAC, plumbers, electricians, landscapers, and other tradespeople.\n\nHis offers:\n- Contractor website: $500 flat, one-time. No monthly fees. Professional, mobile-ready.\n- CRM retainer: $97/month. Manages leads, follow-ups, pipelines.\n- Google Business Profile management: $49/month. Gets them ranking locally.\n\nReferral program (mention occasionally, not every post):\n- $100 cash when a referred contractor buys a website\n- $20/month recurring as long as the referral stays on CRM\n- The referred contractor gets their first month of CRM free\n\nMike's voice: casual, plain English, outcome-first, real numbers, no corporate fluff, never sounds salesy or desperate. He speaks like a contractor himself — direct and no-BS. Uses short punchy sentences. Never uses the word "leverage" or "synergy" or any buzzwords.\n\nEach post must feel completely different from the last. Rotate through angles: pain-point hook, results/numbers hook, curiosity hook, direct offer, question, contrarian take, story-based. Never start two posts the same way.\n\nOutput ONLY the post text. No intro, no "Here's a post:", no hashtags unless they feel natural, no quotation marks around the post.`;

        const BUENAONDA_SYSTEM = `You write Facebook and Reddit posts for Mike, the owner of buenaonda.ai.\n\nBuenaOnda is an autonomous AI ad management platform for Meta, Google, and TikTok. It manages campaigns on full autopilot — budget optimization, audience testing, performance reporting — without human babysitting.\n\nHis affiliate program:\n- 40% recurring commission on every referral\n- Monthly Stripe payouts\n- Affiliate signup page: buenaonda.ai/affiliates\n- Plans: Starter $97/mo ($38.80/mo commission), Pro $179/mo ($71.60/mo), Agency $1,499/mo ($599.60/mo)\n\nTarget audience for posts: affiliate marketers looking for recurring SaaS programs, agency owners who could use the tool AND refer it, media buyers, marketing freelancers.\n\nThe posts have two goals:\n1. Get affiliates to sign up at buenaonda.ai/affiliates (primary goal right now)\n2. Generate awareness of what the product does so affiliates can speak to it authentically\n\nMike's voice: casual, plain English, outcome-first, real dollar amounts not just percentages, no hype or get-rich-quick tone. Confident but not arrogant.\n\nEach post must feel completely different from the last. Rotate through angles: commission math hook, product capability hook, agency pain-point, affiliate income angle, behind-the-scenes build, curiosity hook, direct offer. Never start two posts the same way.\n\nAlways include buenaonda.ai/affiliates somewhere in the post naturally.\n\nOutput ONLY the post text. No intro, no "Here's a post:", no quotation marks around the post.`;

        const gpAccent = gpTab === "wolfpack" ? "#E94560" : "#00B894";
        const groups = gpTab === "wolfpack" ? WOLFPACK_GROUPS : BUENAONDA_GROUPS;
        const data = gpTab === "wolfpack" ? gpWolfpackData : gpBuenaondaData;
        const setData = gpTab === "wolfpack" ? setGpWolfpackData : setGpBuenaondaData;
        const storageKey = gpTab === "wolfpack" ? "wolfpack_tracker_v1" : "buenaonda_tracker_v1";

        const daysSince = (d: string | undefined) => !d ? null : Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
        const isOverdue = (d: string | undefined) => !d || (daysSince(d) ?? 999) >= 7;

        const angles = ["pain-point", "results", "curiosity", "direct offer", "question", "contrarian", "story"];
        const todayAngle = angles[new Date().getDay()];
        const today = new Date();
        const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
        const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

        const filtered = groups.filter(g => {
          if (gpSearch && !g.name.toLowerCase().includes(gpSearch.toLowerCase()) && !g.niche.toLowerCase().includes(gpSearch.toLowerCase())) return false;
          if (gpPlatformFilter !== "all" && g.platform !== gpPlatformFilter) return false;
          if (gpStatusFilter === "due" && !isOverdue(data[g.id]?.lastPosted)) return false;
          if (gpStatusFilter === "posted" && isOverdue(data[g.id]?.lastPosted)) return false;
          return true;
        });

        const postedThisWeek = groups.filter(g => { const d = daysSince(data[g.id]?.lastPosted); return d !== null && d <= 6; }).length;
        const dueCount = groups.filter(g => isOverdue(data[g.id]?.lastPosted)).length;

        const handleDone = (id: string) => {
          const newData = { ...data, [id]: { ...data[id], lastPosted: new Date().toISOString().split("T")[0] } };
          setData(newData);
          try { localStorage.setItem(storageKey, JSON.stringify(newData)); } catch {}
          setGpFlashId(id);
          setTimeout(() => setGpFlashId(null), 1200);
        };

        const handleUndo = (id: string) => {
          const newData = { ...data };
          if (newData[id]) { delete newData[id].lastPosted; }
          setData(newData);
          try { localStorage.setItem(storageKey, JSON.stringify(newData)); } catch {}
        };

        const handleUrlSave = (id: string, url: string) => {
          const newData = { ...data, [id]: { ...data[id], url } };
          setData(newData);
          try { localStorage.setItem(storageKey, JSON.stringify(newData)); } catch {}
          setGpEditingUrlId(null);
        };

        const handleGenerate = async () => {
          setGpIsGenerating(true);
          setGpCopied(false);
          try {
            const systemPrompt = gpTab === "wolfpack" ? WOLFPACK_SYSTEM : BUENAONDA_SYSTEM;
            const userPrompt = `Today is ${dayName}, ${dateStr}. Day seed: ${new Date().getDay() + 1}.\nWrite a unique post. Angle this time: ${todayAngle}.\nMake it feel fresh. Do not repeat hooks or openings from common patterns.`;
            const res = await fetch("/api/ai/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ system: systemPrompt, prompt: userPrompt, maxTokens: 400 }),
            });
            const d = await res.json();
            setGpGeneratedPost(d.text || d.content || "Generation failed — try again.");
          } catch {
            setGpGeneratedPost("Generation failed — check your connection.");
          }
          setGpIsGenerating(false);
        };

        return (
          <div>
            {/* Product tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              <button onClick={() => { setGpTab("wolfpack"); setGpGeneratedPost(""); }} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, background: gpTab === "wolfpack" ? "#E94560" : "transparent", color: gpTab === "wolfpack" ? "#fff" : T.muted, border: `1px solid ${gpTab === "wolfpack" ? "#E94560" : T.border}`, borderRadius: 6, cursor: "pointer" }}>THE WOLFPACK</button>
              <button onClick={() => { setGpTab("buenaonda"); setGpGeneratedPost(""); }} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, background: gpTab === "buenaonda" ? "#00B894" : "transparent", color: gpTab === "buenaonda" ? "#fff" : T.muted, border: `1px solid ${gpTab === "buenaonda" ? "#00B894" : T.border}`, borderRadius: 6, cursor: "pointer" }}>BUENA ONDA</button>
            </div>

            {/* Stats bar */}
            <div className="out-stats" style={{ marginBottom: 14 }}>
              {[
                { label: "Posted This Week", value: String(postedThisWeek), color: gpAccent },
                { label: "Due / Overdue", value: String(dueCount), color: dueCount > 0 ? T.red : T.green },
                { label: "Total Groups", value: String(groups.length), color: T.text },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Bebas Neue', sans-serif" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* AI Post Generator panel */}
            <div className="out-card" style={{ marginBottom: 16, background: "rgba(255,255,255,0.02)", borderColor: `${gpAccent}30` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Today&apos;s Post — {dateStr}</div>
                <div style={{ fontSize: 10, color: T.muted }}>Angle: {todayAngle}</div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={gpIsGenerating}
                style={{ padding: "10px 24px", fontSize: 13, fontWeight: 700, background: gpAccent, color: "#fff", border: "none", borderRadius: 6, cursor: gpIsGenerating ? "wait" : "pointer", opacity: gpIsGenerating ? 0.6 : 1, marginBottom: 12, width: "100%" }}
              >
                {gpIsGenerating ? "Generating..." : "Generate Today's Post"}
              </button>
              {gpGeneratedPost && (
                <>
                  <textarea
                    value={gpGeneratedPost}
                    onChange={e => setGpGeneratedPost(e.target.value)}
                    style={{ width: "100%", minHeight: 120, background: "rgba(0,0,0,0.3)", color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: 12, fontSize: 13, fontFamily: "'Courier New', monospace", resize: "vertical", lineHeight: 1.5 }}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(gpGeneratedPost); setGpCopied(true); setTimeout(() => setGpCopied(false), 2000); }}
                    style={{ marginTop: 8, padding: "8px 20px", fontSize: 12, fontWeight: 600, background: gpCopied ? T.green : "rgba(255,255,255,0.08)", color: gpCopied ? "#fff" : T.text, border: `1px solid ${gpCopied ? T.green : T.border}`, borderRadius: 6, cursor: "pointer" }}
                  >
                    {gpCopied ? "✓ Copied!" : "Copy to Clipboard"}
                  </button>
                </>
              )}
            </div>

            {/* Commission reference */}
            <div className="out-card" style={{ marginBottom: 16, padding: "10px 14px", borderColor: `${gpAccent}20` }}>
              {gpTab === "wolfpack" ? (
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 11, color: T.muted }}>
                  <span><strong style={{ color: T.text }}>Website:</strong> $500 flat → <strong style={{ color: gpAccent }}>$100 referral</strong></span>
                  <span><strong style={{ color: T.text }}>CRM:</strong> $97/mo → <strong style={{ color: gpAccent }}>$20/mo recurring</strong></span>
                  <span><strong style={{ color: T.text }}>GBP:</strong> $49/mo</span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 11, color: T.muted }}>
                  <span><strong style={{ color: T.text }}>Starter:</strong> $97/mo → <strong style={{ color: gpAccent }}>$38.80/mo</strong></span>
                  <span><strong style={{ color: T.text }}>Pro:</strong> $179/mo → <strong style={{ color: gpAccent }}>$71.60/mo</strong></span>
                  <span><strong style={{ color: T.text }}>Agency:</strong> $1,499/mo → <strong style={{ color: gpAccent }}>$599.60/mo</strong></span>
                </div>
              )}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Search groups..."
                value={gpSearch}
                onChange={e => setGpSearch(e.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", color: T.text, fontSize: 12, width: 200 }}
              />
              <div style={{ display: "flex", gap: 2 }}>
                {(["all", "due", "posted"] as const).map(s => (
                  <button key={s} onClick={() => setGpStatusFilter(s)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: gpStatusFilter === s ? gpAccent : "transparent", color: gpStatusFilter === s ? "#fff" : T.muted, border: `1px solid ${gpStatusFilter === s ? gpAccent : T.border}`, borderRadius: 4, cursor: "pointer", textTransform: "capitalize" }}>{s}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                {(["all", "facebook", "reddit"] as const).map(p => (
                  <button key={p} onClick={() => setGpPlatformFilter(p)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: gpPlatformFilter === p ? gpAccent : "transparent", color: gpPlatformFilter === p ? "#fff" : T.muted, border: `1px solid ${gpPlatformFilter === p ? gpAccent : T.border}`, borderRadius: 4, cursor: "pointer", textTransform: "capitalize" }}>{p}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginLeft: "auto" }}>Showing {filtered.length} of {groups.length} groups</div>
            </div>

            {/* Group list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {filtered.map(g => {
                const d = daysSince(data[g.id]?.lastPosted);
                const statusColor = d === null ? T.red : d <= 2 ? T.green : d <= 6 ? T.yellow : T.red;
                const statusText = d === null ? "Never" : d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
                const url = data[g.id]?.url;
                const isFlashing = gpFlashId === g.id;

                return (
                  <div
                    key={g.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                      background: isFlashing ? `${gpAccent}15` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${T.border}`, borderRadius: 6,
                      transition: "background 0.3s",
                    }}
                  >
                    {/* Platform badge */}
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: g.platform === "reddit" ? "rgba(255,140,0,0.15)" : "rgba(59,130,246,0.15)", color: g.platform === "reddit" ? "#FF8C00" : "#3B82F6", textTransform: "uppercase", whiteSpace: "nowrap" }}>{g.platform === "reddit" ? "Reddit" : "FB"}</span>

                    {/* Group info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
                      <div style={{ fontSize: 10, color: T.muted }}>{g.niche} · {g.size} · {g.rules}</div>
                    </div>

                    {/* URL field */}
                    <div style={{ width: 120, flexShrink: 0 }}>
                      {gpEditingUrlId === g.id ? (
                        <input
                          autoFocus
                          placeholder="Paste URL..."
                          defaultValue={url || ""}
                          onBlur={e => handleUrlSave(g.id, e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleUrlSave(g.id, (e.target as HTMLInputElement).value); }}
                          style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: `1px solid ${gpAccent}`, borderRadius: 4, padding: "3px 6px", color: T.text, fontSize: 11 }}
                        />
                      ) : url ? (
                        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: gpAccent, textDecoration: "none" }}>Open Group ↗</a>
                      ) : (
                        <span onClick={() => setGpEditingUrlId(g.id)} style={{ fontSize: 11, color: T.muted, cursor: "pointer", opacity: 0.5 }}>Paste URL...</span>
                      )}
                    </div>

                    {/* Status */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: statusColor, width: 70, textAlign: "center" }}>{statusText}</div>

                    {/* DONE / Undo */}
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <button
                        onClick={() => handleDone(g.id)}
                        style={{ padding: "4px 14px", fontSize: 11, fontWeight: 700, background: d === 0 ? "transparent" : gpAccent, color: d === 0 ? gpAccent : "#fff", border: `1px solid ${gpAccent}`, borderRadius: 4, cursor: "pointer", opacity: d === 0 ? 0.5 : 1 }}
                      >
                        {d === 0 ? "✓" : "DONE"}
                      </button>
                      {d === 0 && (
                        <button onClick={() => handleUndo(g.id)} style={{ fontSize: 10, color: T.muted, background: "none", border: "none", cursor: "pointer", padding: 2 }}>↩</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ============= POSTMASTER (Email Setup > Postmaster) ============= */}
      {tab === "emailsetup" && emailSetupSub === "postmaster" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div className="out-label">Google Postmaster Tools</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["7d", "30d", "90d"].map(r => (
                <button key={r} onClick={() => {
                  setPostmasterRange(r);
                  setPostmasterLoading(true);
                  fetch(`/api/outreach/postmaster?range=${r}`)
                    .then(res => res.json())
                    .then(d => { if (d.error) setPostmasterError(d.error); else { setPostmasterData(d); setPostmasterError(""); } setPostmasterLoading(false); })
                    .catch(() => { setPostmasterError("Failed to load"); setPostmasterLoading(false); });
                }}
                  style={{
                    padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${postmasterRange === r ? T.orange + "40" : T.border}`,
                    borderRadius: 6,
                    background: postmasterRange === r ? "rgba(232,106,42,0.15)" : "transparent",
                    color: postmasterRange === r ? T.orange : T.muted,
                  }}
                >
                  {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
                </button>
              ))}
            </div>
          </div>

          {postmasterLoading ? (
            <div style={{ textAlign: "center", color: T.muted, padding: 60 }}>Loading Postmaster data...</div>
          ) : postmasterError ? (
            <div className="out-card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 14, color: T.red, marginBottom: 12, whiteSpace: "pre-line" }}>{postmasterError}</div>
              {postmasterError.includes("reconnect") || postmasterError.includes("Reconnect") ? (
                <a href="/api/email/connect" style={{ padding: "10px 24px", background: T.orange, color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                  Reconnect Gmail →
                </a>
              ) : null}
            </div>
          ) : postmasterData?.domains?.length === 0 ? (
            <div className="out-card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 14, color: T.muted, marginBottom: 12 }}>
                {postmasterData.message || "No domains found in Postmaster Tools."}
              </div>
              <a href="https://postmaster.google.com" target="_blank" rel="noopener noreferrer"
                style={{ color: T.orange, fontSize: 13, fontWeight: 600 }}>
                Add domains at postmaster.google.com →
              </a>
            </div>
          ) : postmasterData?.domains ? (
            <div>
              {postmasterData.domains.map((d: {
                domain: string;
                status: string;
                summary: {
                  avgSpamRate: number | null;
                  avgSpfSuccess: number | null;
                  avgDkimSuccess: number | null;
                  avgDmarcSuccess: number | null;
                  domainReputation: string | null;
                  avgEncryption: number | null;
                };
                stats: Array<{
                  date: string;
                  spamRate?: number;
                  domainReputation?: string;
                  spfSuccessRatio?: number;
                  dkimSuccessRatio?: number;
                  dmarcSuccessRatio?: number;
                }>;
              }) => (
                <div key={d.domain} className="out-card" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 0.5 }}>{d.domain}</div>
                      <div style={{ fontSize: 11, color: d.status === "verified" ? T.green : T.muted }}>
                        {d.status === "verified" ? "Verified" : "Not Verified — verify at postmaster.google.com"}
                      </div>
                    </div>
                    {d.summary.domainReputation && (
                      <div style={{
                        padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                        background: d.summary.domainReputation === "HIGH" ? `${T.green}20` : d.summary.domainReputation === "MEDIUM" ? `${T.orange}20` : `${T.red}20`,
                        color: d.summary.domainReputation === "HIGH" ? T.green : d.summary.domainReputation === "MEDIUM" ? T.orange : T.red,
                      }}>
                        {d.summary.domainReputation} Reputation
                      </div>
                    )}
                  </div>

                  {d.status === "verified" && (
                    <>
                      {/* Summary stats */}
                      <div className="out-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                        <div className="out-stat">
                          <div className="out-stat-val" style={{
                            color: d.summary.avgSpamRate !== null ? (d.summary.avgSpamRate < 0.03 ? T.green : d.summary.avgSpamRate < 0.1 ? T.orange : T.red) : T.muted,
                          }}>
                            {d.summary.avgSpamRate !== null ? `${(d.summary.avgSpamRate * 100).toFixed(2)}%` : "—"}
                          </div>
                          <div className="out-stat-label">Spam Rate</div>
                        </div>
                        <div className="out-stat">
                          <div className="out-stat-val" style={{ color: d.summary.avgSpfSuccess !== null && d.summary.avgSpfSuccess > 0.95 ? T.green : T.orange }}>
                            {d.summary.avgSpfSuccess !== null ? `${(d.summary.avgSpfSuccess * 100).toFixed(0)}%` : "—"}
                          </div>
                          <div className="out-stat-label">SPF Pass Rate</div>
                        </div>
                        <div className="out-stat">
                          <div className="out-stat-val" style={{ color: d.summary.avgDkimSuccess !== null && d.summary.avgDkimSuccess > 0.95 ? T.green : T.orange }}>
                            {d.summary.avgDkimSuccess !== null ? `${(d.summary.avgDkimSuccess * 100).toFixed(0)}%` : "—"}
                          </div>
                          <div className="out-stat-label">DKIM Pass Rate</div>
                        </div>
                      </div>
                      <div className="out-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 0 }}>
                        <div className="out-stat">
                          <div className="out-stat-val" style={{ color: d.summary.avgDmarcSuccess !== null && d.summary.avgDmarcSuccess > 0.95 ? T.green : T.orange }}>
                            {d.summary.avgDmarcSuccess !== null ? `${(d.summary.avgDmarcSuccess * 100).toFixed(0)}%` : "—"}
                          </div>
                          <div className="out-stat-label">DMARC Pass Rate</div>
                        </div>
                        <div className="out-stat">
                          <div className="out-stat-val" style={{ color: d.summary.avgEncryption !== null && d.summary.avgEncryption > 0.95 ? T.green : T.muted }}>
                            {d.summary.avgEncryption !== null ? `${(d.summary.avgEncryption * 100).toFixed(0)}%` : "—"}
                          </div>
                          <div className="out-stat-label">Encryption</div>
                        </div>
                        <div className="out-stat">
                          <div className="out-stat-val" style={{ color: T.text }}>{d.stats.length}</div>
                          <div className="out-stat-label">Days of Data</div>
                        </div>
                      </div>

                      {/* Daily breakdown */}
                      {d.stats.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Daily Breakdown</div>
                          <div style={{ overflowX: "auto" }}>
                            <table className="out-table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Reputation</th>
                                  <th>Spam Rate</th>
                                  <th>SPF</th>
                                  <th>DKIM</th>
                                  <th>DMARC</th>
                                </tr>
                              </thead>
                              <tbody>
                                {d.stats.slice().reverse().map((s: {
                                  date: string;
                                  domainReputation?: string;
                                  spamRate?: number;
                                  spfSuccessRatio?: number;
                                  dkimSuccessRatio?: number;
                                  dmarcSuccessRatio?: number;
                                }, i: number) => (
                                  <tr key={i}>
                                    <td>{s.date || "—"}</td>
                                    <td>
                                      {s.domainReputation ? (
                                        <span style={{
                                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                                          background: s.domainReputation === "HIGH" ? `${T.green}20` : s.domainReputation === "MEDIUM" ? `${T.orange}20` : `${T.red}20`,
                                          color: s.domainReputation === "HIGH" ? T.green : s.domainReputation === "MEDIUM" ? T.orange : T.red,
                                        }}>
                                          {s.domainReputation}
                                        </span>
                                      ) : "—"}
                                    </td>
                                    <td style={{ color: s.spamRate !== undefined ? (s.spamRate < 0.03 ? T.green : s.spamRate < 0.1 ? T.orange : T.red) : T.muted }}>
                                      {s.spamRate !== undefined ? `${(s.spamRate * 100).toFixed(2)}%` : "—"}
                                    </td>
                                    <td style={{ color: s.spfSuccessRatio !== undefined && s.spfSuccessRatio > 0.95 ? T.green : T.orange }}>
                                      {s.spfSuccessRatio !== undefined ? `${(s.spfSuccessRatio * 100).toFixed(0)}%` : "—"}
                                    </td>
                                    <td style={{ color: s.dkimSuccessRatio !== undefined && s.dkimSuccessRatio > 0.95 ? T.green : T.orange }}>
                                      {s.dkimSuccessRatio !== undefined ? `${(s.dkimSuccessRatio * 100).toFixed(0)}%` : "—"}
                                    </td>
                                    <td style={{ color: s.dmarcSuccessRatio !== undefined && s.dmarcSuccessRatio > 0.95 ? T.green : T.orange }}>
                                      {s.dmarcSuccessRatio !== undefined ? `${(s.dmarcSuccessRatio * 100).toFixed(0)}%` : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {d.stats.length === 0 && (
                        <div style={{ textAlign: "center", color: T.muted, padding: 20, fontSize: 13 }}>
                          No traffic data for this period. Google needs sufficient email volume to generate stats.
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
