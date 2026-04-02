#!/usr/bin/env node
/**
 * Scraper cron — runs on the DigitalOcean droplet.
 * Loops through ALL enabled scraper configs and scrapes each one.
 * No Vercel timeout limits. Run via crontab.
 *
 * Usage: DATABASE_URL="postgres://..." node cron.js
 * Optional: SCRAPER_URL (default http://localhost:3001), SCRAPER_API_KEY, SCRAPER_PROXIES
 */

const { Client } = require("pg");

const SCRAPER_URL = process.env.SCRAPER_URL || "http://localhost:3001";
const API_KEY = process.env.SCRAPER_API_KEY || "wolfpack-scraper-2026";

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callScraper(endpoint, body, timeoutMs = 120000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SCRAPER_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Scraper error: ${res.status} ${await res.text()}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function getRandomProxy() {
  const raw = process.env.SCRAPER_PROXIES || "";
  const proxies = raw.split(",").map(p => p.trim()).filter(Boolean);
  if (proxies.length === 0) return undefined;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

async function run() {
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  try {
    // Get all enabled configs
    const { rows: configs } = await db.query("SELECT * FROM scraper_config WHERE enabled = TRUE ORDER BY created_at ASC");
    console.log(`[cron] Found ${configs.length} enabled configs`);

    if (configs.length === 0) {
      console.log("[cron] No enabled configs, exiting");
      return;
    }

    let totalStored = 0;

    for (const config of configs) {
      const { id, name, query, daily_count, max_reviews, min_rating, max_rating, category_filter } = config;
      const batchSize = Math.min(daily_count || 15, 25); // Up to 25 per config per run

      console.log(`\n[cron] Scraping: "${name}" (${query}) — max ${batchSize}`);

      try {
        const result = await callScraper("/scrape", {
          query,
          maxResults: batchSize,
          proxy: getRandomProxy(),
          filters: { maxReviews: max_reviews, minRating: min_rating, maxRating: max_rating, categoryFilter: category_filter },
        });

        const businesses = result.businesses || [];
        let stored = 0;

        for (const biz of businesses) {
          try {
            await db.query(
              `INSERT INTO scraped_businesses (config_id, name, phone, website, address, rating, review_count, category, email_status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
               ON CONFLICT (name, address) DO NOTHING`,
              [id, biz.name, biz.phone || null, biz.website || null, biz.address || null, biz.rating, biz.reviewCount, biz.category || null]
            );
            stored++;
          } catch (e) { /* dedup */ }
        }

        console.log(`[cron] ✓ ${name}: ${stored} businesses stored`);
        totalStored += stored;
      } catch (err) {
        console.error(`[cron] ✗ ${name}: ${err.message}`);
      }

      // Pause between configs to avoid hammering Google
      if (configs.indexOf(config) < configs.length - 1) {
        console.log("[cron] Waiting 10s before next config...");
        await delay(10000);
      }
    }

    // --- Phase 2: Find emails for pending businesses ---
    console.log("\n[cron] Phase 2: Finding emails...");
    const { rows: pending } = await db.query(
      "SELECT id, name, website FROM scraped_businesses WHERE email_status = 'pending' AND website IS NOT NULL AND email_find_attempts < 2 ORDER BY created_at ASC LIMIT 20"
    );

    let emailsFound = 0;
    for (const biz of pending) {
      try {
        const result = await callScraper("/find-emails", { website: biz.website, proxy: getRandomProxy() }, 30000);
        const emails = result.emails || [];
        if (emails.length > 0) {
          const best = emails.find(e => e.startsWith("info@") || e.startsWith("contact@")) || emails[0];
          await db.query("UPDATE scraped_businesses SET email = $1, email_status = 'found', email_find_attempts = email_find_attempts + 1, updated_at = NOW() WHERE id = $2", [best, biz.id]);
          emailsFound++;
          console.log(`[cron] Email found: ${biz.name} → ${best}`);
        } else {
          await db.query("UPDATE scraped_businesses SET email_status = 'not_found', email_find_attempts = email_find_attempts + 1, updated_at = NOW() WHERE id = $1", [biz.id]);
        }
      } catch (err) {
        console.error(`[cron] Email error for ${biz.name}: ${err.message}`);
        await db.query("UPDATE scraped_businesses SET email_find_attempts = email_find_attempts + 1, updated_at = NOW() WHERE id = $1", [biz.id]);
      }
    }

    console.log(`\n[cron] Done! ${totalStored} scraped, ${emailsFound} emails found`);
  } finally {
    await db.end();
  }
}

run().catch(err => {
  console.error("[cron] Fatal:", err);
  process.exit(1);
});
