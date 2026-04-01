const express = require("express");
const puppeteer = require("puppeteer-core");

const app = express();
app.use(express.json());

const API_KEY = process.env.SCRAPER_API_KEY || "wolfpack-scraper-2026";
const CHROME_PATH = "/usr/bin/google-chrome";

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function auth(req, res, next) {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

async function launchBrowser(proxy) {
  const args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];
  if (proxy) args.push("--proxy-server=" + proxy);
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args,
    defaultViewport: { width: 1280, height: 900 },
  });
}

async function extractBiz(page) {
  const b = { name: "", phone: "", email: "", website: "", address: "", rating: null, reviewCount: null, category: "" };
  try { b.name = await page.$eval("h1", el => el.textContent || "").catch(() => ""); } catch {}
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

// POST /scrape — scrape Google Maps
app.post("/scrape", auth, async (req, res) => {
  const { query, maxResults = 15, proxy, filters } = req.body;
  if (!query) return res.status(400).json({ error: "query required" });

  console.log("[scrape] Starting:", query, "max=" + maxResults);
  const browser = await launchBrowser(proxy);
  const businesses = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    await page.goto("https://www.google.com/maps/search/" + encodeURIComponent(query), { waitUntil: "domcontentloaded", timeout: 25000 });
    await delay(3000);

    try {
      const btn = await page.$('button[aria-label="Accept all"]');
      if (btn) { await btn.click(); await delay(1000); }
    } catch {}

    let prev = 0;
    for (let s = 0; s < 10; s++) {
      const items = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
      if (items.length >= maxResults || items.length === prev) break;
      prev = items.length;
      await page.evaluate(() => { const f = document.querySelector('div[role="feed"]'); if (f) f.scrollTop = f.scrollHeight; });
      await delay(2000);
    }

    const links = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
    const count = Math.min(links.length, maxResults);
    console.log("[scrape] Found", count, "results");

    for (let i = 0; i < count; i++) {
      try {
        const cur = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
        if (i >= cur.length) break;
        await cur[i].click();
        await delay(2000);

        const biz = await extractBiz(page);
        if (!biz.name) { await page.goBack({ waitUntil: "domcontentloaded" }); await delay(1500); continue; }

        if (filters) {
          if (filters.maxReviews != null && biz.reviewCount != null && biz.reviewCount > filters.maxReviews) { await page.goBack({ waitUntil: "domcontentloaded" }); await delay(1500); continue; }
          if (filters.minRating != null && biz.rating != null && biz.rating < filters.minRating) { await page.goBack({ waitUntil: "domcontentloaded" }); await delay(1500); continue; }
          if (filters.maxRating != null && biz.rating != null && biz.rating > filters.maxRating) { await page.goBack({ waitUntil: "domcontentloaded" }); await delay(1500); continue; }
          if (filters.categoryFilter && biz.category && !biz.category.toLowerCase().includes(filters.categoryFilter.toLowerCase())) { await page.goBack({ waitUntil: "domcontentloaded" }); await delay(1500); continue; }
        }

        businesses.push(biz);
        console.log("[scrape]", businesses.length + "/" + count + ":", biz.name, "|", biz.phone, "|", biz.website);

        await page.goBack({ waitUntil: "domcontentloaded" });
        await delay(1500);
      } catch (err) { console.error("[scrape] Error on result " + i + ":", err.message); }
    }
  } finally {
    await browser.close();
  }

  console.log("[scrape] Done:", businesses.length, "businesses");
  res.json({ businesses, count: businesses.length });
});

// POST /find-emails — find emails from a website
app.post("/find-emails", auth, async (req, res) => {
  const { website, proxy } = req.body;
  if (!website) return res.status(400).json({ error: "website required" });

  const browser = await launchBrowser(proxy);
  const emails = new Set();

  try {
    const page = await browser.newPage();
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
  } finally {
    await browser.close();
  }

  res.json({ emails: Array.from(emails) });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(3001, "0.0.0.0", () => console.log("[scraper] Running on port 3001"));
