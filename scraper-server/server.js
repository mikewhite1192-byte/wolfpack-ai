const express = require("express");
const puppeteer = require("puppeteer-core");

const app = express();
app.use(express.json());

const API_KEY = process.env.SCRAPER_API_KEY || "wolfpack-scraper-2026";
const CHROME_PATH = "/usr/bin/google-chrome";

// ── User Agent Rotation ─────────────────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min, max) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function auth(req, res, next) {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── Persistent Browser Pool ─────────────────────────────────────────
let browserInstance = null;
let browserUseCount = 0;
const MAX_BROWSER_USES = 20; // restart browser every 20 scrapes to prevent memory leaks

async function getBrowser(proxy) {
  // Restart browser if it's been used too many times or is dead
  if (browserInstance) {
    try {
      // Check if browser is still alive
      await browserInstance.version();
      browserUseCount++;
      if (browserUseCount >= MAX_BROWSER_USES) {
        console.log("[browser] Recycling after " + browserUseCount + " uses");
        await browserInstance.close().catch(() => {});
        browserInstance = null;
      }
    } catch {
      console.log("[browser] Dead browser detected, creating new one");
      browserInstance = null;
    }
  }

  if (!browserInstance) {
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--no-first-run",
      "--disable-translate",
    ];
    if (proxy) args.push("--proxy-server=" + proxy);
    browserInstance = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: "new",
      args,
      defaultViewport: { width: 1280, height: 900 },
    });
    browserUseCount = 0;
    console.log("[browser] New browser launched");
  }

  return browserInstance;
}

// ── Request Interception — block images/fonts/css for speed ─────────
async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(getRandomUA());
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  });

  // Block heavy resources — but keep stylesheets for Google Maps layout
  await page.setRequestInterception(true);
  page.on("request", req => {
    const type = req.resourceType();
    const url = req.url();
    // Keep stylesheets for Google Maps (needed for clickable layout)
    // Block images, fonts, media for speed
    if (["image", "font", "media"].includes(type)) {
      req.abort();
    } else if (type === "stylesheet" && !url.includes("google")) {
      req.abort(); // block non-Google CSS only
    } else {
      req.continue();
    }
  });

  return page;
}

// ── Block Detection ─────────────────────────────────────────────────
async function isBlocked(page) {
  try {
    const content = await page.content();
    if (content.includes("unusual traffic") || content.includes("Please confirm") || content.includes("captcha") || content.includes("sorry/index")) {
      return true;
    }
  } catch {}
  return false;
}

// ── Extract Business Data ───────────────────────────────────────────
const JUNK_NAMES = ["results", "google maps", "map", "search", "directions", ""];

async function extractBiz(page) {
  const b = { name: "", phone: "", email: "", website: "", address: "", rating: null, reviewCount: null, category: "" };

  // Wait for the business detail panel to load (h1 inside the detail pane, not the search page)
  try {
    await page.waitForSelector('h1:not([class*="searchbox"])', { timeout: 5000 });
  } catch {
    // Detail panel didn't load — skip this one
    return b;
  }

  try { b.name = await page.$eval("h1", el => el.textContent?.trim() || ""); } catch {}

  // Reject junk names that come from the search page itself
  if (!b.name || JUNK_NAMES.includes(b.name.toLowerCase())) {
    b.name = "";
    return b;
  }

  try {
    const l = await page.$eval('div[role="img"][aria-label*="stars"]', el => el.getAttribute("aria-label") || "");
    const m = l.match(/([\d.]+)/);
    if (m) b.rating = parseFloat(m[1]);
  } catch {}
  try {
    const l = await page.$eval('button[aria-label*="reviews"]', el => el.getAttribute("aria-label") || "");
    const m = l.match(/([\d,]+)/);
    if (m) b.reviewCount = parseInt(m[1].replace(",", ""));
  } catch {}
  try { b.category = await page.$eval('button[jsaction*="category"]', el => el.textContent || ""); } catch {}
  try { b.phone = await page.$eval('button[data-tooltip="Copy phone number"]', el => el.textContent || ""); } catch {}
  try { b.website = await page.$eval('a[data-tooltip="Open website"]', el => el.getAttribute("href") || ""); } catch {}
  try { b.address = await page.$eval('button[data-tooltip="Copy address"]', el => el.textContent || ""); } catch {}
  return b;
}

function isValidEmail(email) {
  if (!email.includes("@") || email.length > 100) return false;
  const skip = ["noreply", "no-reply", "donotreply", "mailer-daemon", "postmaster", "webmaster", "hostmaster", "abuse", "example@", "test@", "demo@", "spam@"];
  if (skip.some(p => email.startsWith(p))) return false;
  const skipDomains = ["example.com", "test.com", "sentry.io", "wixpress.com", "squarespace.com", "godaddy.com", "googleapis.com", "cloudflare.com", "w3.org", "schema.org", "wordpress.org", "gravatar.com"];
  if (skipDomains.includes(email.split("@")[1])) return false;
  if (email.includes(".png") || email.includes(".jpg") || email.includes(".svg")) return false;
  return true;
}

// ── POST /scrape — scrape Google Maps ───────────────────────────────
app.post("/scrape", auth, async (req, res) => {
  const { query, maxResults = 5, proxy, filters } = req.body;
  if (!query) return res.status(400).json({ error: "query required" });

  console.log("[scrape] Starting:", query, "max=" + maxResults);
  let page = null;

  try {
    const browser = await getBrowser(proxy);
    page = await setupPage(browser);

    // Navigate with retry
    let navigated = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto("https://www.google.com/maps/search/" + encodeURIComponent(query), {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        navigated = true;
        break;
      } catch (err) {
        console.log("[scrape] Nav attempt " + (attempt + 1) + " failed: " + err.message);
        if (attempt < 2) await delay(3000);
      }
    }

    if (!navigated) {
      await page.close().catch(() => {});
      return res.json({ businesses: [], count: 0, error: "Navigation failed" });
    }

    await randomDelay(2000, 4000);

    // Check if blocked
    if (await isBlocked(page)) {
      console.log("[scrape] BLOCKED by Google for:", query);
      await page.close().catch(() => {});
      return res.json({ businesses: [], count: 0, error: "blocked" });
    }

    // Accept cookies if present
    try {
      const btn = await page.$('button[aria-label="Accept all"]');
      if (btn) { await btn.click(); await randomDelay(500, 1500); }
    } catch {}

    // Scroll to load results
    let prev = 0;
    for (let s = 0; s < 6; s++) {
      const items = await page.$$('a.hfpxzc');
      if (items.length >= maxResults || items.length === prev) break;
      prev = items.length;
      await page.evaluate(() => { const f = document.querySelector('div[role="feed"]'); if (f) f.scrollTop = f.scrollHeight; });
      await randomDelay(1500, 3000);
    }

    const links = await page.$$('a.hfpxzc');
    const count = Math.min(links.length, maxResults);
    console.log("[scrape] Found", count, "results");

    const businesses = [];

    for (let i = 0; i < count; i++) {
      try {
        const cur = await page.$$('a.hfpxzc');
        if (i >= cur.length) break;
        // Use evaluate click — more reliable than puppeteer .click()
        await page.evaluate((idx) => {
          const items = document.querySelectorAll('a.hfpxzc');
          if (items[idx]) items[idx].click();
        }, i);
        await randomDelay(1500, 3000);

        const biz = await extractBiz(page);
        if (!biz.name) { await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {}); await randomDelay(1000, 2000); continue; }

        if (filters) {
          if (filters.maxReviews != null && biz.reviewCount != null && biz.reviewCount > filters.maxReviews) { await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {}); await randomDelay(1000, 2000); continue; }
          if (filters.minRating != null && biz.rating != null && biz.rating < filters.minRating) { await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {}); await randomDelay(1000, 2000); continue; }
          if (filters.maxRating != null && biz.rating != null && biz.rating > filters.maxRating) { await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {}); await randomDelay(1000, 2000); continue; }
          if (filters.categoryFilter && biz.category && !biz.category.toLowerCase().includes(filters.categoryFilter.toLowerCase())) { await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {}); await randomDelay(1000, 2000); continue; }
        }

        businesses.push(biz);
        console.log("[scrape]", businesses.length + "/" + count + ":", biz.name, "|", biz.phone, "|", biz.website);

        await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
        await randomDelay(1000, 2500);
      } catch (err) {
        console.error("[scrape] Error on result " + i + ":", err.message);
        // Check if page is still usable
        try {
          await page.evaluate(() => document.title);
        } catch {
          console.log("[scrape] Page died, stopping early");
          break;
        }
      }
    }

    await page.close().catch(() => {});
    console.log("[scrape] Done:", businesses.length, "businesses");
    res.json({ businesses, count: businesses.length });
  } catch (err) {
    console.error("[scrape] Fatal:", err.message);
    if (page) await page.close().catch(() => {});
    // If browser died, clear it so next request gets a fresh one
    if (err.message.includes("Protocol error") || err.message.includes("Target closed")) {
      browserInstance = null;
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /find-emails — find emails from a website ──────────────────
app.post("/find-emails", auth, async (req, res) => {
  const { website, proxy } = req.body;
  if (!website) return res.status(400).json({ error: "website required" });

  let page = null;
  try {
    const browser = await getBrowser(proxy);
    page = await setupPage(browser);
    const emails = new Set();

    let url = website.trim();
    if (!url.startsWith("http")) url = "https://" + url;

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
      const content = await page.content();
      const found = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      found.forEach(e => { if (isValidEmail(e.toLowerCase())) emails.add(e.toLowerCase()); });
    } catch {}

    const baseUrl = new URL(url).origin;
    for (const path of ["/contact", "/contact-us", "/about", "/about-us", "/team"]) {
      if (emails.size >= 3) break;
      try {
        await page.goto(baseUrl + path, { waitUntil: "domcontentloaded", timeout: 8000 });
        const content = await page.content();
        const found = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        found.forEach(e => { if (isValidEmail(e.toLowerCase())) emails.add(e.toLowerCase()); });
      } catch {}
    }

    try {
      const mailtos = await page.$$eval('a[href^="mailto:"]', links => links.map(a => (a.getAttribute("href") || "").replace("mailto:", "").split("?")[0].trim().toLowerCase()));
      mailtos.forEach(e => { if (isValidEmail(e)) emails.add(e); });
    } catch {}

    await page.close().catch(() => {});
    res.json({ emails: Array.from(emails) });
  } catch (err) {
    console.error("[find-emails] Fatal:", err.message);
    if (page) await page.close().catch(() => {});
    if (err.message.includes("Protocol error") || err.message.includes("Target closed")) {
      browserInstance = null;
    }
    res.json({ emails: [] });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok", browserAlive: !!browserInstance, browserUses: browserUseCount }));

app.listen(3001, "0.0.0.0", () => console.log("[scraper] Running on port 3001"));

// Graceful shutdown
process.on("SIGTERM", async () => {
  if (browserInstance) await browserInstance.close().catch(() => {});
  process.exit(0);
});
