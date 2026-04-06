#!/usr/bin/env node
/**
 * Cron Master — runs ALL scheduled jobs from the DigitalOcean droplet.
 * Replaces all Vercel cron entries. No timeouts, bigger batches, fewer runs.
 *
 * Usage: node cron-master.js
 * Runs continuously with internal scheduling via setInterval.
 *
 * Required env vars:
 *   DATABASE_URL — Neon Postgres connection string
 *
 * Optional env vars:
 *   VERCEL_URL — defaults to https://thewolfpack.ai
 *   SCRAPER_URL — defaults to http://localhost:3001
 */

const { Pool } = require("pg");

const VERCEL_URL = process.env.VERCEL_URL || "https://thewolfpack.ai";
const SCRAPER_URL = process.env.SCRAPER_URL || "http://localhost:3001";
const API_KEY = process.env.SCRAPER_API_KEY || "wolfpack-scraper-2026";

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) { return delay(min + Math.random() * (max - min)); }

// Track what's running to prevent overlaps
const running = {};

function isRunning(name) {
  return running[name] === true;
}

function setRunning(name, val) {
  running[name] = val;
  if (val) console.log("[master] ▶ " + name);
  else console.log("[master] ✓ " + name + " done");
}

// ── Call Vercel API route ───────────────────────────────────────────
async function callVercel(path, method, timeoutMs) {
  method = method || "GET";
  timeoutMs = timeoutMs || 120000; // 2 min default (no Vercel timeout applies from droplet)
  var url = VERCEL_URL + path;
  try {
    var r = await fetch(url, { method: method, signal: AbortSignal.timeout(timeoutMs) });
    var data = await r.json().catch(function() { return {}; });
    return data;
  } catch (e) {
    console.error("[master] " + path + " failed: " + e.message);
    // Alert owner on critical cron failures
    notifyCronError(path, e.message).catch(function() {});
    return { error: e.message };
  }
}

// Send SMS alert on cron failures (max 1 per route per hour to avoid spam)
var errorCooldowns = {};
async function notifyCronError(path, message) {
  var key = path;
  var now = Date.now();
  if (errorCooldowns[key] && now - errorCooldowns[key] < 3600000) return; // 1 hour cooldown
  errorCooldowns[key] = now;
  var ownerPhone = process.env.OWNER_PHONE;
  if (!ownerPhone) return;
  try {
    await callVercel("/api/webhooks/loop?notify=true", "POST", 10000);
  } catch (e2) {
    // Can't notify, just log
    console.error("[master] Failed to send error alert:", e2.message);
  }
}

// ── Call local scraper server ───────────────────────────────────────
async function callScraper(endpoint, body, tms) {
  tms = tms || 180000;
  try {
    var r = await fetch(SCRAPER_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(tms),
    });
    if (!r.ok) {
      var text = await r.text().catch(function() { return ""; });
      if (text.includes("blocked")) return { businesses: [], blocked: true };
      throw new Error("err " + r.status);
    }
    return r.json();
  } catch (e) {
    console.error("[scraper] " + endpoint + " failed: " + e.message);
    return { error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// JOB DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

// ── 1. SCRAPER + EMAIL FINDER + VERIFY (every 30 min) ───────────
async function jobScrapeAndProcess() {
  if (isRunning("scrape")) return;
  setRunning("scrape", true);

  try {
    // Phase 1: Scrape businesses
    var res = await db.query("SELECT * FROM scraper_config WHERE enabled = TRUE ORDER BY created_at ASC");
    var allConfigs = res.rows;
    console.log("[scrape] " + allConfigs.length + " total configs");

    var BATCH = 30;
    var hour = new Date().getHours();
    var minute = new Date().getMinutes();
    var runIndex = hour * 2 + (minute >= 30 ? 1 : 0);
    var start = (runIndex * BATCH) % allConfigs.length;
    var configs = [];
    for (var x = 0; x < BATCH && x < allConfigs.length; x++) {
      configs.push(allConfigs[(start + x) % allConfigs.length]);
    }
    console.log("[scrape] Batch " + runIndex + ": " + configs.length + " configs");

    var total = 0;
    var blocked = 0;

    for (var i = 0; i < configs.length; i++) {
      var cfg = configs[i];
      var batch = Math.min(cfg.daily_count || 10, 10);
      console.log("[scrape] " + (i + 1) + "/" + configs.length + " " + cfg.name);

      try {
        var result = await callScraper("/scrape", {
          query: cfg.query,
          maxResults: batch,
          filters: {
            maxReviews: cfg.max_reviews,
            minRating: cfg.min_rating,
            maxRating: cfg.max_rating,
            categoryFilter: cfg.category_filter,
          },
        });

        if (result.blocked) {
          console.log("[scrape] BLOCKED — backing off 60s");
          blocked++;
          if (blocked >= 3) { console.log("[scrape] Too many blocks, stopping"); break; }
          await delay(60000);
          continue;
        }

        var bizs = result.businesses || [];
        var stored = 0;
        for (var j = 0; j < bizs.length; j++) {
          try {
            await db.query(
              "INSERT INTO scraped_businesses (config_id, name, phone, website, address, rating, review_count, category, email_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') ON CONFLICT (name, address) DO NOTHING",
              [cfg.id, bizs[j].name, bizs[j].phone || null, bizs[j].website || null, bizs[j].address || null, bizs[j].rating, bizs[j].reviewCount, bizs[j].category || null]
            );
            stored++;
          } catch (e) { /* dedup */ }
        }
        console.log("[scrape] " + cfg.name + ": " + stored + " stored");
        total += stored;
      } catch (e) {
        console.error("[scrape] " + cfg.name + ": " + e.message);
      }

      if (i < configs.length - 1) await randomDelay(8000, 15000);
    }

    // Phase 2: Find emails (big batch — no timeout limit)
    console.log("[emails] Phase 2: finding emails");
    var p = await db.query("SELECT id, name, website FROM scraped_businesses WHERE email_status = 'pending' AND website IS NOT NULL AND website != '' AND email_find_attempts < 2 ORDER BY created_at ASC LIMIT 400");
    var found = 0;
    for (var k = 0; k < p.rows.length; k++) {
      var biz = p.rows[k];
      try {
        var er = await callScraper("/find-emails", { website: biz.website }, 30000);
        var emails = er.emails || [];
        if (emails.length > 0) {
          var best = emails[0];
          for (var m = 0; m < emails.length; m++) {
            if (emails[m].startsWith("info@") || emails[m].startsWith("contact@")) { best = emails[m]; break; }
          }
          await db.query("UPDATE scraped_businesses SET email = $1, email_status = 'found', email_find_attempts = email_find_attempts + 1, updated_at = NOW() WHERE id = $2", [best, biz.id]);
          found++;
        } else {
          await db.query("UPDATE scraped_businesses SET email_status = 'not_found', email_find_attempts = email_find_attempts + 1, updated_at = NOW() WHERE id = $1", [biz.id]);
        }
      } catch (e) {
        await db.query("UPDATE scraped_businesses SET email_find_attempts = email_find_attempts + 1, updated_at = NOW() WHERE id = $1", [biz.id]);
      }
    }
    console.log("[emails] Found " + found + " emails from " + p.rows.length + " checked");

    // Phase 3: Verify and add to sequence
    console.log("[verify] Phase 3: verify");
    for (var v = 0; v < 10; v++) {
      var vd = await callVercel("/api/outreach/scrape-maps?phase=verify&batch=10");
      console.log("[verify] Batch " + (v + 1) + ": " + (vd.verified || 0) + " verified, " + (vd.added || 0) + " added");
      if ((vd.verified || 0) === 0) break;
    }

    // Log activity
    try {
      await db.query("INSERT INTO scraper_log (phase, businesses_stored, emails_found, emails_verified, contacts_added, error) VALUES ('cron_run', $1, $2, 0, 0, $3)", [total, found, blocked > 0 ? blocked + " blocks" : null]);
    } catch (e) {}

    console.log("[scrape] DONE: " + total + " scraped, " + found + " emails, " + blocked + " blocks");
  } catch (e) {
    console.error("[scrape] Fatal: " + e.message);
  } finally {
    setRunning("scrape", false);
  }
}

// ── 2. COLD EMAIL SENDING (every 30 min during business hours) ──
async function jobColdSend() {
  if (isRunning("cold-send")) return;
  setRunning("cold-send", true);
  try {
    var result = await callVercel("/api/outreach/send", "GET", 300000); // 5 min timeout
    console.log("[cold-send] Sent: " + (result.sent || 0) + ", Failed: " + (result.failed || 0));
  } catch (e) {
    console.error("[cold-send] " + e.message);
  } finally {
    setRunning("cold-send", false);
  }
}

// ── 3. WARMUP — SENDS (every 2 hours) ──────────────────────────
async function jobWarmupSend() {
  if (isRunning("warmup-send")) return;
  setRunning("warmup-send", true);
  try {
    // Send warmup for all batches (0, 1, 2)
    for (var b = 0; b <= 2; b++) {
      var result = await callVercel("/api/outreach/warmup?type=send&batch=" + b, "GET", 120000);
      console.log("[warmup-send] Batch " + b + ": " + JSON.stringify(result).substring(0, 100));
      await delay(5000);
    }
  } catch (e) {
    console.error("[warmup-send] " + e.message);
  } finally {
    setRunning("warmup-send", false);
  }
}

// ── 4. WARMUP — REPLIES (every 2 hours) ─────────────────────────
async function jobWarmupReply() {
  if (isRunning("warmup-reply")) return;
  setRunning("warmup-reply", true);
  try {
    for (var b = 0; b <= 6; b++) {
      var result = await callVercel("/api/outreach/warmup?type=reply&batch=" + b, "GET", 120000);
      console.log("[warmup-reply] Batch " + b + ": " + JSON.stringify(result).substring(0, 100));
      await delay(3000);
    }
  } catch (e) {
    console.error("[warmup-reply] " + e.message);
  } finally {
    setRunning("warmup-reply", false);
  }
}

// ── 5. WARMUP — BOUNCE CHECK (2x daily) ─────────────────────────
async function jobWarmupBounce() {
  if (isRunning("warmup-bounce")) return;
  setRunning("warmup-bounce", true);
  try {
    for (var b = 0; b <= 2; b++) {
      await callVercel("/api/outreach/warmup?type=bounce&batch=" + b, "GET", 120000);
      await delay(3000);
    }
  } catch (e) {
    console.error("[warmup-bounce] " + e.message);
  } finally {
    setRunning("warmup-bounce", false);
  }
}

// ── 6. INBOX POLLING (every 30 min) ─────────────────────────────
async function jobPollInbox() {
  if (isRunning("inbox")) return;
  setRunning("inbox", true);
  try {
    // Poll all inboxes — no batch limit needed from droplet
    for (var b = 0; b <= 2; b++) {
      var result = await callVercel("/api/outreach/inbox?poll=true&batch=" + b, "GET", 180000);
      console.log("[inbox] Batch " + b + ": fetched " + (result.fetched || 0));
      await delay(3000);
    }
  } catch (e) {
    console.error("[inbox] " + e.message);
  } finally {
    setRunning("inbox", false);
  }
}

// ── 7. EMAIL ASSISTANT — PROCESS REPLIES (every 30 min) ─────────
async function jobEmailAssistant() {
  if (isRunning("email-assistant")) return;
  setRunning("email-assistant", true);
  try {
    var result = await callVercel("/api/email-assistant/process", "GET", 300000);
    console.log("[email-assistant] Processed: " + (result.processed || 0));
  } catch (e) {
    console.error("[email-assistant] " + e.message);
  } finally {
    setRunning("email-assistant", false);
  }
}

// ── 8. EMAIL ASSISTANT — REMINDERS (every 10 min) ───────────────
async function jobReminders() {
  if (isRunning("reminders")) return;
  setRunning("reminders", true);
  try {
    var result = await callVercel("/api/email-assistant/reminders", "GET", 60000);
    if (result.sent > 0) console.log("[reminders] Sent: " + result.sent);
  } catch (e) {
    console.error("[reminders] " + e.message);
  } finally {
    setRunning("reminders", false);
  }
}

// ── 9. EMAIL ASSISTANT — POST-CALL FOLLOW-UPS (every 2 hours) ──
async function jobPostCall() {
  if (isRunning("post-call")) return;
  setRunning("post-call", true);
  try {
    var result = await callVercel("/api/email-assistant/post-call", "GET", 120000);
    if (result.processed > 0) console.log("[post-call] Processed: " + result.processed);
  } catch (e) {
    console.error("[post-call] " + e.message);
  } finally {
    setRunning("post-call", false);
  }
}

// ── 10. AI AGENT — FOLLOW-UPS (every 2 hours) ──────────────────
async function jobAiFollowUp() {
  if (isRunning("ai-followup")) return;
  setRunning("ai-followup", true);
  try {
    var result = await callVercel("/api/ai-agent/follow-up", "POST", 120000);
    console.log("[ai-followup] " + JSON.stringify(result).substring(0, 100));
  } catch (e) {
    console.error("[ai-followup] " + e.message);
  } finally {
    setRunning("ai-followup", false);
  }
}

// ── 11. AI AGENT — OWNER REMINDERS (daily at 7am ET) ────────────
async function jobAiReminders() {
  if (isRunning("ai-reminders")) return;
  setRunning("ai-reminders", true);
  try {
    await callVercel("/api/ai-agent/reminders", "POST", 60000);
  } catch (e) {
    console.error("[ai-reminders] " + e.message);
  } finally {
    setRunning("ai-reminders", false);
  }
}

// ── 12. AI AGENT — LEARN FROM OUTCOMES (daily) ──────────────────
async function jobAiLearn() {
  if (isRunning("ai-learn")) return;
  setRunning("ai-learn", true);
  try {
    await callVercel("/api/ai-agent/learn", "POST", 60000);
  } catch (e) {
    console.error("[ai-learn] " + e.message);
  } finally {
    setRunning("ai-learn", false);
  }
}

// ── 13. UPGRADE SEQUENCE (daily) ────────────────────────────────
async function jobUpgrade() {
  if (isRunning("upgrade")) return;
  setRunning("upgrade", true);
  try {
    await callVercel("/api/outreach/upgrade", "POST", 60000);
  } catch (e) {
    console.error("[upgrade] " + e.message);
  } finally {
    setRunning("upgrade", false);
  }
}

// ── 14. MAYA WEBHOOK (every 10 min) ─────────────────────────────
async function jobMaya() {
  try {
    await callVercel("/api/webhooks/maya", "GET", 30000);
  } catch (e) {}
}

// ── 15. GBP — REVIEW CHECK (every 6 hours) ──────────────────────
async function jobGbpReviews() {
  if (isRunning("gbp-reviews")) return;
  setRunning("gbp-reviews", true);
  try {
    var result = await callVercel("/api/gbp/reviews?process=true", "GET", 300000);
    console.log("[gbp-reviews] Checked: " + (result.checked || 0) + ", Replied: " + (result.replied || 0));
  } catch (e) {
    console.error("[gbp-reviews] " + e.message);
  } finally {
    setRunning("gbp-reviews", false);
  }
}

// ── 16. GBP — WEEKLY POSTS (daily check, posts if 7+ days since last) ─
async function jobGbpPosts() {
  if (isRunning("gbp-posts")) return;
  setRunning("gbp-posts", true);
  try {
    var result = await callVercel("/api/gbp/posts?process=true", "GET", 120000);
    if (result.posted > 0) console.log("[gbp-posts] Posted: " + result.posted);
  } catch (e) {
    console.error("[gbp-posts] " + e.message);
  } finally {
    setRunning("gbp-posts", false);
  }
}

// ── 17. GBP — MONTHLY INSIGHTS REPORT ───────────────────────────
async function jobGbpInsights() {
  if (isRunning("gbp-insights")) return;
  setRunning("gbp-insights", true);
  try {
    var result = await callVercel("/api/gbp/insights?process=true", "GET", 120000);
    if (result.sent > 0) console.log("[gbp-insights] Reports sent: " + result.sent);
  } catch (e) {
    console.error("[gbp-insights] " + e.message);
  } finally {
    setRunning("gbp-insights", false);
  }
}

// ── 18. GBP — REVIEW NUDGES (daily) ─────────────────────────────
async function jobGbpNudges() {
  if (isRunning("gbp-nudges")) return;
  setRunning("gbp-nudges", true);
  try {
    var result = await callVercel("/api/gbp/reviews?nudge=true", "GET", 120000);
    if (result.sent > 0 || result.completed > 0) console.log("[gbp-nudges] Sent: " + (result.sent || 0) + ", Completed: " + (result.completed || 0));
  } catch (e) {
    console.error("[gbp-nudges] " + e.message);
  } finally {
    setRunning("gbp-nudges", false);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SCHEDULER
// ═══════════════════════════════════════════════════════════════════

function getETHour() {
  return new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
}

function isBusinessHours() {
  var h = parseInt(getETHour());
  return h >= 8 && h <= 21;
}

console.log("[master] ═══════════════════════════════════════");
console.log("[master] Cron Master starting...");
console.log("[master] Vercel: " + VERCEL_URL);
console.log("[master] Scraper: " + SCRAPER_URL);
console.log("[master] ET hour: " + getETHour());
console.log("[master] ═══════════════════════════════════════");

// Every 10 minutes — reminders + maya
setInterval(function() {
  jobReminders();
  jobMaya();
}, 10 * 60 * 1000);

// Every 30 minutes — scrape, cold send, inbox, email assistant
setInterval(function() {
  jobScrapeAndProcess();
  if (isBusinessHours()) {
    jobColdSend();
  }
  jobPollInbox();
  jobEmailAssistant();
}, 30 * 60 * 1000);

// Every 2 hours — warmup, follow-ups, post-call
setInterval(function() {
  jobWarmupSend();
  jobWarmupReply();
  jobAiFollowUp();
  jobPostCall();
}, 2 * 60 * 60 * 1000);

// Every 6 hours — GBP reviews
setInterval(function() {
  jobGbpReviews();
}, 6 * 60 * 60 * 1000);

// Daily — GBP posts + monthly insights check + review nudges
setInterval(function() {
  var h = parseInt(getETHour());
  if (h === 10) {
    jobGbpPosts();
    jobGbpInsights();
    jobGbpNudges();
  }
}, 60 * 60 * 1000);

// Every 12 hours — bounce checks
setInterval(function() {
  jobWarmupBounce();
}, 12 * 60 * 60 * 1000);

// Daily at 7am ET — AI reminders, learn, upgrade, morning report
setInterval(function() {
  var h = parseInt(getETHour());
  if (h === 7) {
    jobAiReminders();
    jobAiLearn();
    jobUpgrade();
    // Morning daily report
    callVercel("/api/ai-agent/daily-report", "POST", { type: "morning" })
      .then(function(r) { console.log("[master] Morning report:", JSON.stringify(r)); })
      .catch(function(e) { console.error("[master] Morning report failed:", e.message); });
  }
  if (h === 17) {
    // End-of-day report
    callVercel("/api/ai-agent/daily-report", "POST", { type: "eod" })
      .then(function(r) { console.log("[master] EOD report:", JSON.stringify(r)); })
      .catch(function(e) { console.error("[master] EOD report failed:", e.message); });
  }
}, 60 * 60 * 1000); // check every hour

// Run critical jobs immediately on startup
setTimeout(function() {
  console.log("[master] Running initial jobs...");
  jobScrapeAndProcess();
  jobReminders();
  jobPollInbox();
  jobEmailAssistant();
  if (isBusinessHours()) jobColdSend();
  jobWarmupSend();
  jobWarmupReply();
}, 5000);

// Keep process alive
process.on("SIGTERM", async function() {
  console.log("[master] Shutting down...");
  await db.end();
  process.exit(0);
});

process.on("SIGINT", async function() {
  console.log("[master] Interrupted, shutting down...");
  await db.end();
  process.exit(0);
});

console.log("[master] All schedules registered. Running forever.");
