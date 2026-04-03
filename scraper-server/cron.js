const { Pool } = require("pg");
const SCRAPER_URL = "http://localhost:3001";
const API_KEY = "wolfpack-scraper-2026";

function delay(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function randomDelay(min, max) { return delay(min + Math.random() * (max - min)); }

async function callScraper(endpoint, body, tms) {
  tms = tms || 180000; // 3 min timeout
  var c = new AbortController();
  var t = setTimeout(function() { c.abort(); }, tms);
  try {
    var r = await fetch(SCRAPER_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify(body),
      signal: c.signal,
    });
    if (!r.ok) {
      var text = await r.text().catch(function() { return ""; });
      // Check for block detection
      if (text.includes("blocked")) return { businesses: [], blocked: true };
      throw new Error("err " + r.status);
    }
    return r.json();
  } finally { clearTimeout(t); }
}

async function run() {
  // Use Pool instead of Client — handles connection drops gracefully
  var db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    var res = await db.query("SELECT * FROM scraper_config WHERE enabled = TRUE ORDER BY created_at ASC");
    var allConfigs = res.rows;
    console.log("[cron] " + allConfigs.length + " total configs");

    // Batch: pick 30 configs per run based on hour (round-robin)
    var BATCH = 30;
    var hour = new Date().getHours();
    var minute = new Date().getMinutes();
    var runIndex = hour * 2 + (minute >= 30 ? 1 : 0); // ~48 slots per day
    var start = (runIndex * BATCH) % allConfigs.length;
    var configs = [];
    for (var x = 0; x < BATCH && x < allConfigs.length; x++) {
      configs.push(allConfigs[(start + x) % allConfigs.length]);
    }
    console.log("[cron] Batch " + runIndex + ": configs " + start + "-" + (start + configs.length - 1) + " (" + configs.length + " configs)");

    var total = 0;
    var blocked = 0;

    for (var i = 0; i < configs.length; i++) {
      var cfg = configs[i];
      var batch = Math.min(cfg.daily_count || 10, 10); // cap at 10 per config
      console.log("[cron] " + (i + 1) + "/" + configs.length + " " + cfg.name);

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

        // If blocked, back off heavily
        if (result.blocked) {
          console.log("[cron] BLOCKED — backing off 60s");
          blocked++;
          if (blocked >= 3) {
            console.log("[cron] Too many blocks, stopping scrape phase");
            break;
          }
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
        console.log("[cron] " + cfg.name + ": " + stored + " stored");
        total += stored;
      } catch (e) {
        console.error("[cron] " + cfg.name + ": " + e.message);
      }

      // Random delay between configs — look human
      if (i < configs.length - 1) {
        await randomDelay(8000, 15000);
      }
    }

    // Phase 2: Find emails
    console.log("[cron] Phase 2: emails");
    var p = await db.query("SELECT id, name, website FROM scraped_businesses WHERE email_status = 'pending' AND website IS NOT NULL AND email_find_attempts < 2 ORDER BY created_at ASC LIMIT 400");
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

    // Phase 3: Trigger verify on Vercel
    console.log("[cron] Phase 3: verify");
    for (var v = 0; v < 5; v++) {
      try {
        var vr = await fetch("https://thewolfpack.ai/api/outreach/scrape-maps?phase=verify&batch=10", { signal: AbortSignal.timeout(30000) });
        var vd = await vr.json();
        console.log("[cron] Verify " + (v + 1) + ": " + (vd.verified || 0) + " verified, " + (vd.added || 0) + " added");
        if ((vd.verified || 0) === 0) break;
      } catch (e) { console.log("[cron] Verify error: " + e.message); break; }
    }

    // Log activity to database
    try {
      await db.query("INSERT INTO scraper_log (phase, businesses_stored, emails_found, emails_verified, contacts_added, error) VALUES ('cron_run', $1, $2, 0, 0, $3)", [total, found, blocked > 0 ? blocked + " blocks" : null]);
    } catch (e) { console.error("[cron] Log error:", e.message); }

    // Log alert if scraper is failing
    if (total === 0 && configs.length > 5) {
      try {
        await db.query("INSERT INTO scraper_log (phase, error) VALUES ('ALERT', $1)", ["0 businesses stored from " + configs.length + " configs. " + blocked + " blocks detected."]);
      } catch (e) {}
      console.log("[cron] ALERT: 0 stored — scraper may be broken!");
    }

    console.log("[cron] DONE: " + total + " scraped, " + found + " emails, " + blocked + " blocks");
  } finally {
    await db.end();
  }
}

run().catch(function(e) { console.error("[cron] Fatal:", e); process.exit(1); });
