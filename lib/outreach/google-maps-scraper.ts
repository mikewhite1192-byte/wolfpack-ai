import { neon } from "@neondatabase/serverless";
import type { Browser, Page } from "puppeteer-core";

const sql = neon(process.env.DATABASE_URL!);

export interface ScrapedBusiness {
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  category: string;
}

export interface ScraperConfig {
  id: string;
  name: string;
  query: string;
  source: string;
  enabled: boolean;
  daily_count: number;
  max_reviews: number | null;
  min_rating: number | null;
  max_rating: number | null;
  category_filter: string | null;
}

// ─── SCRAPER CONFIG MANAGEMENT ───────────────────────────────────────────────

export async function getScraperConfigs(): Promise<ScraperConfig[]> {
  return await sql`SELECT * FROM scraper_config ORDER BY created_at ASC` as unknown as ScraperConfig[];
}

export async function getEnabledConfigs(): Promise<ScraperConfig[]> {
  return await sql`SELECT * FROM scraper_config WHERE enabled = TRUE ORDER BY created_at ASC` as unknown as ScraperConfig[];
}

export async function upsertScraperConfig(config: {
  name: string;
  query: string;
  source?: string;
  enabled?: boolean;
  dailyCount?: number;
  maxReviews?: number | null;
  minRating?: number | null;
  maxRating?: number | null;
  categoryFilter?: string | null;
}): Promise<string> {
  const result = await sql`
    INSERT INTO scraper_config (name, query, source, enabled, daily_count, max_reviews, min_rating, max_rating, category_filter)
    VALUES (${config.name}, ${config.query}, ${config.source || "google_maps"}, ${config.enabled ?? true}, ${config.dailyCount || 15},
            ${config.maxReviews ?? null}, ${config.minRating ?? null}, ${config.maxRating ?? null}, ${config.categoryFilter ?? null})
    ON CONFLICT (query) DO UPDATE SET
      name = ${config.name},
      enabled = ${config.enabled ?? true},
      daily_count = ${config.dailyCount || 15},
      max_reviews = ${config.maxReviews ?? null},
      min_rating = ${config.minRating ?? null},
      max_rating = ${config.maxRating ?? null},
      category_filter = ${config.categoryFilter ?? null},
      updated_at = NOW()
    RETURNING id
  `;
  return result[0].id as string;
}

export async function toggleScraperConfig(id: string, enabled: boolean) {
  await sql`UPDATE scraper_config SET enabled = ${enabled}, updated_at = NOW() WHERE id = ${id}`;
}

export async function updateScraperCount(id: string, dailyCount: number) {
  await sql`UPDATE scraper_config SET daily_count = ${dailyCount}, updated_at = NOW() WHERE id = ${id}`;
}

export async function deleteScraperConfig(id: string) {
  await sql`DELETE FROM scraper_config WHERE id = ${id}`;
}

// ─── PROXY ROTATION ──────────────────────────────────────────────────────────

function getProxies(): string[] {
  const raw = process.env.SCRAPER_PROXIES || "";
  return raw.split(",").map(p => p.trim()).filter(Boolean);
}

function getRandomProxy(proxies: string[]): string | undefined {
  if (proxies.length === 0) return undefined;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

// ─── BROWSER MANAGEMENT (puppeteer-core + @sparticuz/chromium) ──────────────

async function launchBrowser(proxy?: string): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;

  let executablePath: string;
  let args: string[];

  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    executablePath = await chromium.executablePath();
    args = chromium.args;
  } catch {
    // Local dev fallback — use system Chrome
    executablePath = process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome";
    args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
  }

  if (proxy) args.push(`--proxy-server=${proxy}`);

  return puppeteer.launch({
    executablePath,
    headless: true,
    args,
    defaultViewport: { width: 1280, height: 900 },
  });
}

// ─── PHASE 1: SCRAPE GOOGLE MAPS ────────────────────────────────────────────

export async function scrapeGoogleMapsPhase(configId: string, query: string, maxResults: number, filters?: {
  maxReviews?: number | null;
  minRating?: number | null;
  maxRating?: number | null;
  categoryFilter?: string | null;
}): Promise<number> {
  const proxies = getProxies();
  const proxy = getRandomProxy(proxies);
  const browser = await launchBrowser(proxy);
  let stored = 0;

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await delay(3000);

    // Handle consent dialog
    try {
      const consentBtn = await page.$('button[aria-label="Accept all"]');
      if (consentBtn) { await consentBtn.click(); await delay(1000); }
    } catch { /* no consent */ }

    // Scroll results panel to load more
    let previousCount = 0;
    for (let scroll = 0; scroll < 8; scroll++) {
      const items = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
      if (items.length >= maxResults || items.length === previousCount) break;
      previousCount = items.length;
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollTop = feed.scrollHeight;
      });
      await delay(2000);
    }

    // Click each result and extract details
    const resultLinks = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
    const count = Math.min(resultLinks.length, maxResults);

    for (let i = 0; i < count; i++) {
      try {
        // Re-query links each time (DOM changes after navigation)
        const links = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
        if (i >= links.length) break;

        await links[i].click();
        await delay(2000);

        const biz = await extractBusinessDetails(page);
        if (!biz.name) continue;

        // Apply filters
        if (filters) {
          if (filters.maxReviews != null && biz.reviewCount != null && biz.reviewCount > filters.maxReviews) continue;
          if (filters.minRating != null && biz.rating != null && biz.rating < filters.minRating) continue;
          if (filters.maxRating != null && biz.rating != null && biz.rating > filters.maxRating) continue;
          if (filters.categoryFilter && biz.category && !biz.category.toLowerCase().includes(filters.categoryFilter.toLowerCase())) continue;
        }

        await sql`
          INSERT INTO scraped_businesses (config_id, name, phone, website, address, rating, review_count, category, email_status)
          VALUES (${configId}, ${biz.name}, ${biz.phone || null}, ${biz.website || null}, ${biz.address || null},
                  ${biz.rating}, ${biz.reviewCount}, ${biz.category || null}, 'pending')
          ON CONFLICT (name, address) DO NOTHING
        `;
        stored++;
        console.log(`[maps-scraper] ${stored}/${count}: ${biz.name} | ${biz.phone} | ${biz.website}`);

        // Go back to results
        await page.goBack({ waitUntil: "domcontentloaded" });
        await delay(1500);
      } catch (err) {
        console.error(`[maps-scraper] Error on result ${i}:`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[maps-scraper] Phase 1 done: ${stored} businesses stored for "${query}"`);
  return stored;
}

// ─── PHASE 2: FIND EMAILS ───────────────────────────────────────────────────

export async function findEmailsPhase(batchSize: number = 3): Promise<{ found: number; notFound: number; errors: number }> {
  const pending = await sql`
    SELECT id, name, website FROM scraped_businesses
    WHERE email_status = 'pending' AND website IS NOT NULL AND email_find_attempts < 2
    ORDER BY created_at ASC
    LIMIT ${batchSize}
  `;

  if (pending.length === 0) return { found: 0, notFound: 0, errors: 0 };

  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (const biz of pending) {
    const id = biz.id as string;
    const website = biz.website as string;
    const name = biz.name as string;

    try {
      const emails = await findEmailsFromWebsite(website);
      if (emails.length > 0) {
        const bestEmail = emails.find(e => e.startsWith("info@") || e.startsWith("contact@")) || emails[0];
        await sql`
          UPDATE scraped_businesses SET email = ${bestEmail}, email_status = 'found',
            email_find_attempts = email_find_attempts + 1, updated_at = NOW()
          WHERE id = ${id}
        `;
        found++;
        console.log(`[email-finder] Found: ${name} -> ${bestEmail}`);
      } else {
        await sql`
          UPDATE scraped_businesses SET email_status = 'not_found',
            email_find_attempts = email_find_attempts + 1, updated_at = NOW()
          WHERE id = ${id}
        `;
        notFound++;
      }
    } catch (err) {
      console.error(`[email-finder] Error for ${name}:`, err instanceof Error ? err.message : err);
      await sql`
        UPDATE scraped_businesses SET email_find_attempts = email_find_attempts + 1, updated_at = NOW()
        WHERE id = ${id}
      `;
      errors++;
    }
  }

  await sql`
    UPDATE scraped_businesses SET email_status = 'not_found', updated_at = NOW()
    WHERE email_status = 'pending' AND website IS NULL
  `;

  console.log(`[email-finder] Phase 2: ${found} found, ${notFound} not found, ${errors} errors`);
  return { found, notFound, errors };
}

// ─── PHASE 3: VERIFY EMAILS AND ADD TO SEQUENCE ─────────────────────────────

export async function verifyAndAddPhase(batchSize: number = 5): Promise<{ verified: number; invalid: number; added: number }> {
  const { validateEmails } = await import("./validate-email");
  const { addToSequence } = await import("./sequence");

  const found = await sql`
    SELECT sb.id, sb.name, sb.email, sb.phone, sb.address, sb.config_id,
           sc.campaign_id
    FROM scraped_businesses sb
    LEFT JOIN scraper_config sc ON sc.id = sb.config_id
    WHERE sb.email_status = 'found' AND sb.email IS NOT NULL
    ORDER BY sb.created_at ASC
    LIMIT ${batchSize}
  `;

  if (found.length === 0) return { verified: 0, invalid: 0, added: 0 };

  const emails = found.map(b => (b.email as string).toLowerCase());
  const existing = await sql`SELECT email FROM outreach_contacts WHERE email = ANY(${emails})`;
  const existingSet = new Set(existing.map(r => (r.email as string).toLowerCase()));

  const newBiz = found.filter(b => !existingSet.has((b.email as string).toLowerCase()));
  const dupeIds = found.filter(b => existingSet.has((b.email as string).toLowerCase())).map(b => b.id as string);

  if (dupeIds.length > 0) {
    for (const id of dupeIds) {
      await sql`UPDATE scraped_businesses SET email_status = 'added', updated_at = NOW() WHERE id = ${id}`;
    }
  }

  if (newBiz.length === 0) return { verified: 0, invalid: 0, added: dupeIds.length };

  const emailList = newBiz.map(b => b.email as string);
  const results = await validateEmails(emailList);

  let verified = 0;
  let invalid = 0;
  let added = 0;

  const byCampaign = new Map<string | null, typeof newBiz>();

  for (const biz of newBiz) {
    const email = (biz.email as string).toLowerCase();
    const id = biz.id as string;
    const validation = results.get(email);
    const campaignId = (biz.campaign_id as string) || null;

    if (validation?.valid) {
      await sql`UPDATE scraped_businesses SET email_status = 'verified', updated_at = NOW() WHERE id = ${id}`;
      verified++;
      if (!byCampaign.has(campaignId)) byCampaign.set(campaignId, []);
      byCampaign.get(campaignId)!.push(biz);
    } else {
      await sql`UPDATE scraped_businesses SET email_status = 'invalid', updated_at = NOW() WHERE id = ${id}`;
      invalid++;
    }
  }

  for (const [campaignId, bizList] of byCampaign) {
    const contacts = bizList.map(biz => ({
      email: (biz.email as string).toLowerCase(),
      firstName: extractFirstName(biz.name as string),
      company: biz.name as string,
      state: extractState(biz.address as string || "") || "",
    }));

    const result = await addToSequence(contacts, undefined, campaignId || undefined);
    added += result.added;

    for (const c of contacts) {
      await sql`
        UPDATE scraped_businesses SET email_status = 'added', updated_at = NOW()
        WHERE email = ${c.email} AND email_status = 'verified'
      `;
    }
  }

  console.log(`[verify] Phase 3: ${verified} verified, ${invalid} invalid, ${added} added to sequence`);
  return { verified, invalid, added };
}

// ─── MASS SCRAPE ────────────────────────────────────────────────────────────

export async function massScrape(query: string, maxResults: number): Promise<ScrapedBusiness[]> {
  const proxies = getProxies();
  const proxy = getRandomProxy(proxies);
  const browser = await launchBrowser(proxy);
  const businesses: ScrapedBusiness[] = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await delay(3000);

    try {
      const consentBtn = await page.$('button[aria-label="Accept all"]');
      if (consentBtn) { await consentBtn.click(); await delay(1000); }
    } catch { /* no consent */ }

    let previousCount = 0;
    for (let scroll = 0; scroll < 15; scroll++) {
      const items = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
      if (items.length >= maxResults || items.length === previousCount) break;
      previousCount = items.length;
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollTop = feed.scrollHeight;
      });
      await delay(2000);
    }

    const resultLinks = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
    const count = Math.min(resultLinks.length, maxResults);

    for (let i = 0; i < count; i++) {
      try {
        const links = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
        if (i >= links.length) break;
        await links[i].click();
        await delay(2000);
        const biz = await extractBusinessDetails(page);
        if (biz.name) businesses.push(biz);
        await page.goBack({ waitUntil: "domcontentloaded" });
        await delay(1500);
      } catch (err) {
        console.error(`[mass-scrape] Error on result ${i}:`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    await browser.close();
  }

  return businesses;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export function businessesToCSV(businesses: ScrapedBusiness[]): string {
  const headers = ["Name", "Phone", "Email", "Website", "Address", "Rating", "Reviews", "Category"];
  const rows = businesses.map(b => [
    csvEscape(b.name), csvEscape(b.phone), csvEscape(b.email), csvEscape(b.website),
    csvEscape(b.address), b.rating?.toString() || "", b.reviewCount?.toString() || "", csvEscape(b.category),
  ].join(","));
  return [headers.join(","), ...rows].join("\n");
}

export async function exportScrapedToCSV(configId?: string): Promise<string> {
  let rows;
  if (configId) {
    rows = await sql`SELECT name, phone, email, website, address, rating, review_count, category, email_status FROM scraped_businesses WHERE config_id = ${configId} ORDER BY created_at DESC`;
  } else {
    rows = await sql`SELECT name, phone, email, website, address, rating, review_count, category, email_status FROM scraped_businesses ORDER BY created_at DESC`;
  }
  const headers = ["Name", "Phone", "Email", "Website", "Address", "Rating", "Reviews", "Category", "Email Status"];
  const csvRows = rows.map(r => [
    csvEscape(r.name as string || ""), csvEscape(r.phone as string || ""), csvEscape(r.email as string || ""),
    csvEscape(r.website as string || ""), csvEscape(r.address as string || ""),
    (r.rating as number)?.toString() || "", (r.review_count as number)?.toString() || "",
    csvEscape(r.category as string || ""), r.email_status as string || "",
  ].join(","));
  return [headers.join(","), ...csvRows].join("\n");
}

function csvEscape(val: string): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

// ─── STATS ───────────────────────────────────────────────────────────────────

export async function getScraperStats() {
  const stats = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE email_status = 'pending') as pending,
      COUNT(*) FILTER (WHERE email_status = 'found') as found,
      COUNT(*) FILTER (WHERE email_status = 'not_found') as not_found,
      COUNT(*) FILTER (WHERE email_status = 'verified') as verified,
      COUNT(*) FILTER (WHERE email_status = 'invalid') as invalid,
      COUNT(*) FILTER (WHERE email_status = 'added') as added
    FROM scraped_businesses
  `;
  return stats[0];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function extractBusinessDetails(page: Page): Promise<ScrapedBusiness> {
  const biz: ScrapedBusiness = {
    name: "", phone: "", email: "", website: "",
    address: "", rating: null, reviewCount: null, category: "",
  };

  try {
    // Business name
    biz.name = await page.$eval("h1", el => el.textContent || "").catch(() => "");

    // Rating
    try {
      const ratingLabel = await page.$eval('div[role="img"][aria-label*="stars"]', el => el.getAttribute("aria-label") || "");
      const m = ratingLabel.match(/([\d.]+)/);
      if (m) biz.rating = parseFloat(m[1]);
    } catch { /* no rating */ }

    // Review count
    try {
      const reviewLabel = await page.$eval('button[aria-label*="reviews"]', el => el.getAttribute("aria-label") || "");
      const m = reviewLabel.match(/([\d,]+)/);
      if (m) biz.reviewCount = parseInt(m[1].replace(",", ""));
    } catch { /* no reviews */ }

    // Category
    try {
      biz.category = await page.$eval('button[jsaction*="category"]', el => el.textContent || "");
    } catch { /* no category */ }

    // Phone
    try {
      biz.phone = await page.$eval('button[data-tooltip="Copy phone number"]', el => el.textContent || "");
    } catch { /* no phone */ }

    // Website
    try {
      biz.website = await page.$eval('a[data-tooltip="Open website"]', el => el.getAttribute("href") || "");
    } catch { /* no website */ }

    // Address
    try {
      biz.address = await page.$eval('button[data-tooltip="Copy address"]', el => el.textContent || "");
    } catch { /* no address */ }
  } catch (err) {
    console.error(`[maps-scraper] Detail extraction error:`, err instanceof Error ? err.message : err);
  }

  return biz;
}

async function findEmailsFromWebsite(websiteUrl: string): Promise<string[]> {
  const proxies = getProxies();
  const proxy = getRandomProxy(proxies);
  const browser = await launchBrowser(proxy);
  const emails = new Set<string>();

  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(12000);

    let url = websiteUrl.trim();
    if (!url.startsWith("http")) url = `https://${url}`;

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
      await extractEmailsFromPage(page, emails);
    } catch { return []; }

    const contactPaths = ["/contact", "/contact-us", "/about", "/about-us", "/team"];
    const baseUrl = new URL(url).origin;

    for (const path of contactPaths) {
      if (emails.size >= 3) break;
      try {
        await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 8000 });
        await extractEmailsFromPage(page, emails);
      } catch { /* page doesn't exist */ }
    }

    // Check mailto links
    try {
      const mailtos = await page.$$eval('a[href^="mailto:"]', links =>
        links.map(a => a.getAttribute("href")?.replace("mailto:", "").split("?")[0]?.trim().toLowerCase() || "")
      );
      for (const email of mailtos) {
        if (isValidBusinessEmail(email)) emails.add(email);
      }
    } catch { /* ok */ }
  } finally {
    await browser.close();
  }

  return Array.from(emails);
}

async function extractEmailsFromPage(page: Page, emails: Set<string>) {
  try {
    const content = await page.content();
    const found = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const email of found) {
      const lower = email.toLowerCase();
      if (isValidBusinessEmail(lower)) emails.add(lower);
    }
  } catch { /* ok */ }
}

function isValidBusinessEmail(email: string): boolean {
  if (!email.includes("@") || email.length > 100) return false;
  const skipPrefixes = ["noreply", "no-reply", "donotreply", "mailer-daemon", "postmaster",
    "webmaster", "hostmaster", "abuse", "support@google", "support@facebook", "example@", "test@", "demo@", "spam@"];
  if (skipPrefixes.some(p => email.startsWith(p))) return false;
  const skipDomains = ["example.com", "test.com", "sentry.io", "wixpress.com", "squarespace.com",
    "godaddy.com", "googleapis.com", "cloudflare.com", "w3.org", "schema.org", "wordpress.org", "gravatar.com"];
  const domain = email.split("@")[1];
  if (skipDomains.includes(domain)) return false;
  if (email.includes(".png") || email.includes(".jpg") || email.includes(".svg")) return false;
  return true;
}

function extractFirstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0].length > 1 && parts[0][0] === parts[0][0].toUpperCase()) {
    const businessWords = ["insurance", "agency", "group", "inc", "llc", "corp", "company", "services", "associates", "the"];
    if (businessWords.some(w => parts[0].toLowerCase() === w)) return "";
    return parts[0];
  }
  return "";
}

function extractState(address: string): string {
  if (!address) return "";
  const match = address.match(/\b([A-Z]{2})\b\s*\d{5}/);
  return match?.[1] || "";
}
