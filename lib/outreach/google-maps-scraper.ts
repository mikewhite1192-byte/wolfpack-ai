import { neon } from "@neondatabase/serverless";

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

// ─── REMOTE SCRAPER (DigitalOcean droplet) ──────────────────────────────────

const SCRAPER_URL = process.env.SCRAPER_URL || "http://165.227.127.162:3001";
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || "wolfpack-scraper-2026";

async function callScraper(endpoint: string, body: Record<string, unknown>, timeoutMs: number = 55000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SCRAPER_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": SCRAPER_API_KEY },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Scraper error: ${res.status} ${await res.text()}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ─── PHASE 1: SCRAPE GOOGLE MAPS (calls remote scraper) ─────────────────────

export async function scrapeGoogleMapsPhase(configId: string, query: string, maxResults: number, filters?: {
  maxReviews?: number | null;
  minRating?: number | null;
  maxRating?: number | null;
  categoryFilter?: string | null;
}): Promise<number> {
  const proxies = getProxies();
  const proxy = getRandomProxy(proxies);

  const result = await callScraper("/scrape", {
    query, maxResults, proxy,
    filters: filters ? {
      maxReviews: filters.maxReviews,
      minRating: filters.minRating,
      maxRating: filters.maxRating,
      categoryFilter: filters.categoryFilter,
    } : undefined,
  }) as { businesses: ScrapedBusiness[]; count: number };

  let stored = 0;
  for (const biz of result.businesses) {
    try {
      await sql`
        INSERT INTO scraped_businesses (config_id, name, phone, website, address, rating, review_count, category, email_status)
        VALUES (${configId}, ${biz.name}, ${biz.phone || null}, ${biz.website || null}, ${biz.address || null},
                ${biz.rating}, ${biz.reviewCount}, ${biz.category || null}, 'pending')
        ON CONFLICT (name, address) DO NOTHING
      `;
      stored++;
    } catch { /* dedup */ }
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
      const proxy = getRandomProxy(getProxies());
      const result = await callScraper("/find-emails", { website, proxy }) as { emails: string[] };
      const emails = result.emails || [];
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
      city: extractCity(biz.address as string || ""),
      reviewCount: (biz.review_count as number) || undefined,
      niche: (biz.category as string) || undefined,
      address: (biz.address as string) || undefined,
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
  const proxy = getRandomProxy(getProxies());
  const result = await callScraper("/scrape", { query, maxResults, proxy }) as { businesses: ScrapedBusiness[] };
  return result.businesses || [];
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

export async function getScraperStats(range?: string) {
  if (range === "today") {
    const stats = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE email_status = 'pending') as pending, COUNT(*) FILTER (WHERE email_status = 'found') as found, COUNT(*) FILTER (WHERE email_status = 'not_found') as not_found, COUNT(*) FILTER (WHERE email_status = 'verified') as verified, COUNT(*) FILTER (WHERE email_status = 'invalid') as invalid, COUNT(*) FILTER (WHERE email_status = 'added') as added FROM scraped_businesses WHERE created_at >= CURRENT_DATE`;
    return stats[0];
  }
  if (range === "7d") {
    const stats = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE email_status = 'pending') as pending, COUNT(*) FILTER (WHERE email_status = 'found') as found, COUNT(*) FILTER (WHERE email_status = 'not_found') as not_found, COUNT(*) FILTER (WHERE email_status = 'verified') as verified, COUNT(*) FILTER (WHERE email_status = 'invalid') as invalid, COUNT(*) FILTER (WHERE email_status = 'added') as added FROM scraped_businesses WHERE created_at >= NOW() - INTERVAL '7 days'`;
    return stats[0];
  }
  if (range === "30d") {
    const stats = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE email_status = 'pending') as pending, COUNT(*) FILTER (WHERE email_status = 'found') as found, COUNT(*) FILTER (WHERE email_status = 'not_found') as not_found, COUNT(*) FILTER (WHERE email_status = 'verified') as verified, COUNT(*) FILTER (WHERE email_status = 'invalid') as invalid, COUNT(*) FILTER (WHERE email_status = 'added') as added FROM scraped_businesses WHERE created_at >= NOW() - INTERVAL '30 days'`;
    return stats[0];
  }
  const stats = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE email_status = 'pending') as pending, COUNT(*) FILTER (WHERE email_status = 'found') as found, COUNT(*) FILTER (WHERE email_status = 'not_found') as not_found, COUNT(*) FILTER (WHERE email_status = 'verified') as verified, COUNT(*) FILTER (WHERE email_status = 'invalid') as invalid, COUNT(*) FILTER (WHERE email_status = 'added') as added FROM scraped_businesses`;
  return stats[0];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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

function extractCity(address: string): string {
  if (!address) return "";
  const parts = address.split(",").map(s => s.trim());
  if (parts.length >= 2) {
    // City is usually the second to last part (before "STATE ZIP")
    const cityPart = parts[parts.length - 2];
    return cityPart || "";
  }
  return "";
}
