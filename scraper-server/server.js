const express = require("express");
const puppeteer = require("puppeteer-core");

const app = express();
app.use(express.json());

const API_KEY = process.env.SCRAPER_API_KEY || "wolfpack-scraper-2026";
const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome";

// ── Proxy Rotation ──────────────────────────────────────────────────
// Set SCRAPER_PROXIES="user:pass@host:port,user:pass@host2:port" in env
const PROXY_LIST = (process.env.SCRAPER_PROXIES || "").split(",").map(p => p.trim()).filter(Boolean);
let proxyIndex = 0;

function getNextProxy() {
  if (PROXY_LIST.length === 0) return null;
  const proxy = PROXY_LIST[proxyIndex % PROXY_LIST.length];
  proxyIndex++;
  return proxy;
}

// ── User Agent Rotation ─────────────────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
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
let currentBrowserProxy = null;
const MAX_BROWSER_USES = 15; // recycle more often with proxy rotation

async function getBrowser(proxy) {
  // If proxy changed, restart browser
  if (browserInstance && proxy !== currentBrowserProxy) {
    console.log("[browser] Proxy changed, recycling");
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }

  // Restart if used too many times or dead
  if (browserInstance) {
    try {
      await browserInstance.version();
      browserUseCount++;
      if (browserUseCount >= MAX_BROWSER_USES) {
        console.log("[browser] Recycling after " + browserUseCount + " uses");
        await browserInstance.close().catch(() => {});
        browserInstance = null;
      }
    } catch {
      console.log("[browser] Dead browser, creating new one");
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
      "--disable-blink-features=AutomationControlled", // hide automation
      "--disable-infobars",
    ];
    if (proxy) {
      // Support user:pass@host:port format
      const atIdx = proxy.lastIndexOf("@");
      if (atIdx > -1) {
        args.push("--proxy-server=" + proxy.substring(atIdx + 1));
      } else {
        args.push("--proxy-server=" + proxy);
      }
    }
    browserInstance = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: "new",
      args,
      defaultViewport: { width: 1280 + Math.floor(Math.random() * 200), height: 800 + Math.floor(Math.random() * 200) },
    });
    currentBrowserProxy = proxy;
    browserUseCount = 0;
    console.log("[browser] Launched" + (proxy ? " with proxy" : ""));
  }

  return browserInstance;
}

// ── Page Setup with Stealth ─────────────────────────────────────────
async function setupPage(browser, proxy) {
  const page = await browser.newPage();
  const ua = getRandomUA();
  await page.setUserAgent(ua);
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  });

  // Stealth: hide webdriver flag
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    // Fake plugins
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    // Fake languages
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    // Chrome object
    window.chrome = { runtime: {} };
  });

  // Proxy auth if credentials embedded in proxy string
  if (proxy) {
    const atIdx = proxy.lastIndexOf("@");
    if (atIdx > -1) {
      const creds = proxy.substring(0, atIdx);
      const [user, pass] = creds.split(":");
      if (user && pass) {
        await page.authenticate({ username: user, password: pass });
      }
    }
  }

  // Block heavy resources for speed
  await page.setRequestInterception(true);
  page.on("request", req => {
    const type = req.resourceType();
    const url = req.url();
    if (["image", "font", "media"].includes(type)) {
      req.abort();
    } else if (type === "stylesheet" && !url.includes("google")) {
      req.abort();
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
    if (content.includes("unusual traffic") || content.includes("Please confirm") || content.includes("captcha") || content.includes("sorry/index") || content.includes("detected unusual traffic")) {
      return true;
    }
  } catch {}
  return false;
}

// ── Junk Name Filter ────────────────────────────────────────────────
const JUNK_NAMES = new Set(["results", "google maps", "map", "search", "directions", "google", ""]);

function isJunkName(name) {
  if (!name) return true;
  const lower = name.toLowerCase().trim();
  if (JUNK_NAMES.has(lower)) return true;
  if (lower.length < 2) return true;
  if (lower.startsWith("search results")) return true;
  return false;
}

// ── Extract Preview Data from Feed (no click needed) ────────────────
async function extractFeedCards(page, maxResults) {
  return page.evaluate((max) => {
    const cards = document.querySelectorAll('div.Nv2PK');
    const results = [];

    for (let i = 0; i < cards.length && results.length < max; i++) {
      const card = cards[i];
      try {
        // Name
        const nameEl = card.querySelector('.qBF1Pd');
        const name = nameEl ? nameEl.textContent.trim() : "";
        if (!name) continue;

        // Link URL (for direct navigation)
        const linkEl = card.querySelector('a.hfpxzc');
        const url = linkEl ? linkEl.getAttribute("href") : "";

        // Rating
        const ratingEl = card.querySelector('.MW4etd');
        const rating = ratingEl ? parseFloat(ratingEl.textContent) : null;

        // Review count
        const reviewEl = card.querySelector('.UY7F9');
        let reviewCount = null;
        if (reviewEl) {
          const match = reviewEl.textContent.match(/([\d,]+)/);
          if (match) reviewCount = parseInt(match[1].replace(/,/g, ""));
        }

        // Category / type (first .W4Efsd element often has it)
        let category = "";
        const infoEls = card.querySelectorAll('.W4Efsd');
        if (infoEls.length > 0) {
          // Category is often in a span inside the second W4Efsd
          const spans = infoEls[infoEls.length > 1 ? 1 : 0].querySelectorAll("span");
          for (const sp of spans) {
            const t = sp.textContent.trim();
            if (t && !t.startsWith("·") && !t.match(/^\d/) && t.length > 2 && t.length < 40) {
              category = t;
              break;
            }
          }
        }

        results.push({ name, url, rating, reviewCount, category, index: i });
      } catch {}
    }
    return results;
  }, maxResults);
}

// ── Extract Full Business Data from Detail Page ─────────────────────
async function extractDetailPage(page) {
  const b = { name: "", phone: "", email: "", website: "", address: "", rating: null, reviewCount: null, category: "" };

  // Wait for detail panel
  try {
    await page.waitForSelector('h1', { timeout: 6000 });
    await randomDelay(500, 1000);
  } catch {
    return b;
  }

  try { b.name = await page.$eval("h1", el => el.textContent?.trim() || ""); } catch {}
  if (isJunkName(b.name)) { b.name = ""; return b; }

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

// ── POST /scrape — scrape Google Maps (pro edition) ─────────────────
// Phase 1: Extract feed cards (name, rating, reviews) — no clicking
// Phase 2: Pre-filter by reviews/rating in the feed — skip junk before clicking
// Phase 3: Navigate directly to each listing URL for phone/website/address
app.post("/scrape", auth, async (req, res) => {
  const { query, maxResults = 10, proxy: reqProxy, filters, gridSearch } = req.body;
  if (!query) return res.status(400).json({ error: "query required" });

  // Use proxy rotation: request proxy > next from pool > none
  const proxy = reqProxy || getNextProxy();
  console.log("[scrape] Starting:", query, "max=" + maxResults + (proxy ? " proxy=" + proxy.substring(proxy.lastIndexOf("@") + 1) : " no proxy"));

  let page = null;

  try {
    const browser = await getBrowser(proxy);
    page = await setupPage(browser, proxy);

    // Build search URL — support grid search with coordinates
    let searchUrl = "https://www.google.com/maps/search/" + encodeURIComponent(query);
    if (gridSearch && gridSearch.lat && gridSearch.lng) {
      searchUrl += "/@" + gridSearch.lat + "," + gridSearch.lng + "," + (gridSearch.zoom || 14) + "z";
    }

    // Navigate with retry
    let navigated = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        navigated = true;
        break;
      } catch (err) {
        console.log("[scrape] Nav attempt " + (attempt + 1) + " failed: " + err.message);
        if (attempt < 2) await randomDelay(2000, 5000);
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
      return res.json({ businesses: [], count: 0, blocked: true, error: "blocked" });
    }

    // Accept cookies if present
    try {
      const btn = await page.$('button[aria-label="Accept all"]');
      if (btn) { await btn.click(); await randomDelay(500, 1500); }
    } catch {}

    // ── Phase 1: Scroll feed to load results ────────────────────────
    // Request more than needed since we'll filter some out
    const scrollTarget = Math.min(maxResults * 3, 120); // never exceed Google's 120 limit
    let prev = 0;
    for (let s = 0; s < 15; s++) {
      const items = await page.$$('a.hfpxzc');
      if (items.length >= scrollTarget || items.length === prev) break;
      prev = items.length;
      await page.evaluate(() => {
        const f = document.querySelector('div[role="feed"]');
        if (f) f.scrollTop = f.scrollHeight;
      });
      await randomDelay(1000, 2500);
    }

    // ── Phase 2: Extract feed cards and pre-filter ──────────────────
    const feedCards = await extractFeedCards(page, scrollTarget);
    console.log("[scrape] Feed cards extracted:", feedCards.length);

    // Pre-filter using feed data (before clicking into any listing)
    const candidates = feedCards.filter(card => {
      if (isJunkName(card.name)) return false;
      if (filters) {
        if (filters.maxReviews != null && card.reviewCount != null && card.reviewCount > filters.maxReviews) return false;
        if (filters.minRating != null && card.rating != null && card.rating < filters.minRating) return false;
        if (filters.maxRating != null && card.rating != null && card.rating > filters.maxRating) return false;
        // Category filter from feed (rough match — detail page has exact category)
        if (filters.categoryFilter && card.category && !card.category.toLowerCase().includes(filters.categoryFilter.toLowerCase())) return false;
      }
      return true;
    });

    const skipped = feedCards.length - candidates.length;
    if (skipped > 0) console.log("[scrape] Pre-filtered:", skipped, "skipped,", candidates.length, "candidates");

    // ── Phase 3: Navigate directly to each candidate for full data ──
    const businesses = [];
    const toProcess = candidates.slice(0, maxResults);

    for (let i = 0; i < toProcess.length; i++) {
      const card = toProcess[i];

      try {
        if (!card.url) continue;

        // Navigate directly to the listing URL — no click+goBack
        await page.goto(card.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        await randomDelay(800, 2000);

        // Check for blocks mid-scrape
        if (await isBlocked(page)) {
          console.log("[scrape] BLOCKED mid-scrape at result", i);
          break;
        }

        const biz = await extractDetailPage(page);
        if (!biz.name) {
          // Use feed data as fallback
          biz.name = card.name;
          biz.rating = card.rating;
          biz.reviewCount = card.reviewCount;
          biz.category = card.category;
        }

        if (isJunkName(biz.name)) continue;

        // Fill in from feed data if detail page missed anything
        if (!biz.rating && card.rating) biz.rating = card.rating;
        if (!biz.reviewCount && card.reviewCount) biz.reviewCount = card.reviewCount;
        if (!biz.category && card.category) biz.category = card.category;

        businesses.push(biz);
        console.log("[scrape]", businesses.length + "/" + toProcess.length + ":", biz.name, "|", biz.phone || "no phone", "|", biz.website ? "has site" : "no site");

        await randomDelay(800, 2000);
      } catch (err) {
        console.error("[scrape] Error on result " + i + " (" + card.name + "):", err.message);
        // Check if page is still usable
        try { await page.evaluate(() => document.title); } catch {
          console.log("[scrape] Page died, stopping");
          break;
        }
      }
    }

    await page.close().catch(() => {});
    console.log("[scrape] Done:", businesses.length, "businesses from", feedCards.length, "feed results (" + skipped + " pre-filtered)");
    res.json({ businesses, count: businesses.length, feedTotal: feedCards.length, preFiltered: skipped });
  } catch (err) {
    console.error("[scrape] Fatal:", err.message);
    if (page) await page.close().catch(() => {});
    if (err.message.includes("Protocol error") || err.message.includes("Target closed")) {
      browserInstance = null;
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /scrape-grid — grid search to beat 120-result cap ──────────
// Splits a search area into grid cells and scrapes each one
app.post("/scrape-grid", auth, async (req, res) => {
  const { query, lat, lng, radiusMiles = 10, gridSize = 3, maxPerCell = 20, filters } = req.body;
  if (!query || !lat || !lng) return res.status(400).json({ error: "query, lat, lng required" });

  console.log("[grid] Starting grid search:", query, "center=" + lat + "," + lng, "radius=" + radiusMiles + "mi", gridSize + "x" + gridSize);

  // Convert radius from miles to degrees (rough: 1 degree ≈ 69 miles)
  const radiusDeg = radiusMiles / 69;
  const step = (radiusDeg * 2) / gridSize;
  const startLat = lat - radiusDeg;
  const startLng = lng - radiusDeg;

  const allBusinesses = [];
  const seen = new Set(); // deduplicate by name+address
  let cellsProcessed = 0;
  let cellsBlocked = 0;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cellLat = startLat + (row + 0.5) * step;
      const cellLng = startLng + (col + 0.5) * step;

      console.log("[grid] Cell " + (cellsProcessed + 1) + "/" + (gridSize * gridSize) + ": " + cellLat.toFixed(4) + "," + cellLng.toFixed(4));

      try {
        // Call the regular scrape endpoint internally
        const result = await new Promise((resolve, reject) => {
          const mockReq = {
            headers: { "x-api-key": API_KEY },
            body: { query, maxResults: maxPerCell, filters, gridSearch: { lat: cellLat, lng: cellLng, zoom: 15 } },
          };
          const mockRes = {
            json: (data) => resolve(data),
            status: (code) => ({ json: (data) => resolve({ ...data, statusCode: code }) }),
          };
          // Simulate the request through the scrape handler
          app.handle({ ...mockReq, method: "POST", url: "/scrape" }, mockRes, () => {});
        });

        if (result.blocked) {
          cellsBlocked++;
          if (cellsBlocked >= 2) {
            console.log("[grid] Too many blocks, stopping");
            break;
          }
          await delay(60000); // back off 60s
          continue;
        }

        // Deduplicate
        for (const biz of (result.businesses || [])) {
          const key = (biz.name + "|" + biz.address).toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            allBusinesses.push(biz);
          }
        }

        cellsProcessed++;
      } catch (err) {
        console.error("[grid] Cell error:", err.message);
      }

      // Delay between cells
      await randomDelay(5000, 10000);
    }
    if (cellsBlocked >= 2) break;
  }

  console.log("[grid] Done:", allBusinesses.length, "unique businesses from", cellsProcessed, "cells");
  res.json({ businesses: allBusinesses, count: allBusinesses.length, cellsProcessed, cellsBlocked });
});

// ── POST /find-emails — find emails from a website ──────────────────
app.post("/find-emails", auth, async (req, res) => {
  const { website, proxy: reqProxy } = req.body;
  if (!website) return res.status(400).json({ error: "website required" });

  const proxy = reqProxy || getNextProxy();
  let page = null;

  try {
    const browser = await getBrowser(proxy);
    page = await setupPage(browser, proxy);
    const emails = new Set();

    let url = website.trim();
    if (!url.startsWith("http")) url = "https://" + url;

    // Check homepage
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
      const content = await page.content();
      const found = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      found.forEach(e => { if (isValidEmail(e.toLowerCase())) emails.add(e.toLowerCase()); });

      // Check mailto links on homepage
      try {
        const mailtos = await page.$$eval('a[href^="mailto:"]', links => links.map(a => (a.getAttribute("href") || "").replace("mailto:", "").split("?")[0].trim().toLowerCase()));
        mailtos.forEach(e => { if (isValidEmail(e)) emails.add(e); });
      } catch {}

      // Check footer specifically (many contractor sites put email only in footer)
      try {
        const footerText = await page.$eval("footer", el => el.textContent || "");
        const footerEmails = footerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        footerEmails.forEach(e => { if (isValidEmail(e.toLowerCase())) emails.add(e.toLowerCase()); });
      } catch {}
    } catch {}

    // Check common subpages
    if (emails.size === 0) {
      const baseUrl = new URL(url).origin;
      for (const path of ["/contact", "/contact-us", "/about", "/about-us", "/team", "/get-in-touch", "/reach-us"]) {
        if (emails.size >= 3) break;
        try {
          await page.goto(baseUrl + path, { waitUntil: "domcontentloaded", timeout: 8000 });
          const content = await page.content();
          const found = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
          found.forEach(e => { if (isValidEmail(e.toLowerCase())) emails.add(e.toLowerCase()); });

          // Check mailto links on subpages too
          try {
            const mailtos = await page.$$eval('a[href^="mailto:"]', links => links.map(a => (a.getAttribute("href") || "").replace("mailto:", "").split("?")[0].trim().toLowerCase()));
            mailtos.forEach(e => { if (isValidEmail(e)) emails.add(e); });
          } catch {}
        } catch {}
      }
    }

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

// ── Health Check ────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({
  status: "ok",
  browserAlive: !!browserInstance,
  browserUses: browserUseCount,
  proxyCount: PROXY_LIST.length,
  proxyIndex: proxyIndex,
}));

app.listen(3001, "0.0.0.0", () => {
  console.log("[scraper] Running on port 3001");
  console.log("[scraper] Proxies configured:", PROXY_LIST.length);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  if (browserInstance) await browserInstance.close().catch(() => {});
  process.exit(0);
});
