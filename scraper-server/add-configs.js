#!/usr/bin/env node
/**
 * Bulk add scraper configs — 50 cities × 10 trades = 500 configs
 * Run: DATABASE_URL="postgres://..." node add-configs.js [campaignId]
 */

const { Client } = require("pg");

const TRADES = [
  "plumbers",
  "electricians",
  "roofers",
  "HVAC",
  "landscapers",
  "auto repair",
  "painters",
  "concrete contractors",
  "fencing contractors",
  "pest control",
];

const CITIES = [
  // Michigan (20)
  { city: "Warren", state: "MI" },
  { city: "Sterling Heights", state: "MI" },
  { city: "Troy", state: "MI" },
  { city: "Rochester Hills", state: "MI" },
  { city: "Shelby Township", state: "MI" },
  { city: "Clinton Township", state: "MI" },
  { city: "Macomb", state: "MI" },
  { city: "Detroit", state: "MI" },
  { city: "Livonia", state: "MI" },
  { city: "Dearborn", state: "MI" },
  { city: "Ann Arbor", state: "MI" },
  { city: "Flint", state: "MI" },
  { city: "Grand Rapids", state: "MI" },
  { city: "Lansing", state: "MI" },
  { city: "Kalamazoo", state: "MI" },
  { city: "Southfield", state: "MI" },
  { city: "Royal Oak", state: "MI" },
  { city: "Novi", state: "MI" },
  { city: "Canton", state: "MI" },
  { city: "Westland", state: "MI" },
  // Ohio (15)
  { city: "Columbus", state: "OH" },
  { city: "Cleveland", state: "OH" },
  { city: "Cincinnati", state: "OH" },
  { city: "Toledo", state: "OH" },
  { city: "Akron", state: "OH" },
  { city: "Dayton", state: "OH" },
  { city: "Canton", state: "OH" },
  { city: "Youngstown", state: "OH" },
  { city: "Parma", state: "OH" },
  { city: "Lorain", state: "OH" },
  { city: "Hamilton", state: "OH" },
  { city: "Springfield", state: "OH" },
  { city: "Lakewood", state: "OH" },
  { city: "Elyria", state: "OH" },
  { city: "Mentor", state: "OH" },
  // Indiana (15)
  { city: "Indianapolis", state: "IN" },
  { city: "Fort Wayne", state: "IN" },
  { city: "Evansville", state: "IN" },
  { city: "South Bend", state: "IN" },
  { city: "Carmel", state: "IN" },
  { city: "Fishers", state: "IN" },
  { city: "Bloomington", state: "IN" },
  { city: "Hammond", state: "IN" },
  { city: "Gary", state: "IN" },
  { city: "Lafayette", state: "IN" },
  { city: "Muncie", state: "IN" },
  { city: "Terre Haute", state: "IN" },
  { city: "Noblesville", state: "IN" },
  { city: "Greenwood", state: "IN" },
  { city: "Anderson", state: "IN" },
];

async function run() {
  const campaignId = process.argv[2] || null;
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  var added = 0;
  var skipped = 0;

  for (var i = 0; i < CITIES.length; i++) {
    var loc = CITIES[i];
    for (var j = 0; j < TRADES.length; j++) {
      var trade = TRADES[j];
      var name = trade + " " + loc.city + " " + loc.state;
      var query = trade + " near " + loc.city + " " + loc.state;

      try {
        var result = await db.query(
          "INSERT INTO scraper_config (name, query, source, enabled, daily_count, max_reviews, min_rating, campaign_id) VALUES ($1, $2, 'google_maps', TRUE, 10, 20, 3.0, $3) ON CONFLICT (query) DO NOTHING RETURNING id",
          [name, query, campaignId]
        );
        if (result.rowCount > 0) {
          added++;
          if (added % 50 === 0) console.log("[add] " + added + " added so far...");
        } else {
          skipped++;
        }
      } catch (e) {
        skipped++;
      }
    }
  }

  console.log("[add] DONE: " + added + " added, " + skipped + " skipped (already exist)");
  await db.end();
}

run().catch(function(e) { console.error(e); process.exit(1); });
