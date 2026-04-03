var { Pool } = require("pg");
var SCRAPER_URL = "http://localhost:3001";
var API_KEY = "wolfpack-scraper-2026";

async function run() {
  var db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
  var res = await db.query("SELECT * FROM scraper_config WHERE enabled = TRUE ORDER BY created_at ASC OFFSET 500 LIMIT 30");
  var configs = res.rows;
  console.log("[test] Running " + configs.length + " PA/IL configs");
  var total = 0;
  for (var i = 0; i < configs.length; i++) {
    var cfg = configs[i];
    console.log("[test] " + (i + 1) + "/" + configs.length + " " + cfg.name);
    try {
      var c = new AbortController();
      var t = setTimeout(function() { c.abort(); }, 180000);
      var r = await fetch(SCRAPER_URL + "/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ query: cfg.query, maxResults: 5, filters: { maxReviews: cfg.max_reviews, minRating: cfg.min_rating } }),
        signal: c.signal,
      });
      clearTimeout(t);
      var data = await r.json();
      var bizs = data.businesses || [];
      var stored = 0;
      for (var j = 0; j < bizs.length; j++) {
        try {
          await db.query("INSERT INTO scraped_businesses (config_id, name, phone, website, address, rating, review_count, category, email_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') ON CONFLICT (name, address) DO NOTHING", [cfg.id, bizs[j].name, bizs[j].phone || null, bizs[j].website || null, bizs[j].address || null, bizs[j].rating, bizs[j].reviewCount, bizs[j].category || null]);
          stored++;
        } catch (e) {}
      }
      console.log("[test] " + cfg.name + ": " + stored + " stored");
      total += stored;
    } catch (e) { console.error("[test] " + cfg.name + ": " + e.message); }
    await new Promise(function(r) { setTimeout(r, 8000 + Math.random() * 7000); });
  }
  console.log("[test] DONE: " + total + " total stored");
  await db.end();
}
run().catch(function(e) { console.error(e); process.exit(1); });
