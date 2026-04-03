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
  // Pennsylvania (15)
  { city: "Philadelphia", state: "PA" },
  { city: "Pittsburgh", state: "PA" },
  { city: "Allentown", state: "PA" },
  { city: "Erie", state: "PA" },
  { city: "Reading", state: "PA" },
  { city: "Bethlehem", state: "PA" },
  { city: "Lancaster", state: "PA" },
  { city: "Harrisburg", state: "PA" },
  { city: "York", state: "PA" },
  { city: "King of Prussia", state: "PA" },
  { city: "Bensalem", state: "PA" },
  { city: "Levittown", state: "PA" },
  { city: "Doylestown", state: "PA" },
  { city: "Media", state: "PA" },
  { city: "West Chester", state: "PA" },
  // Illinois (15)
  { city: "Chicago", state: "IL" },
  { city: "Aurora", state: "IL" },
  { city: "Naperville", state: "IL" },
  { city: "Joliet", state: "IL" },
  { city: "Rockford", state: "IL" },
  { city: "Springfield", state: "IL" },
  { city: "Elgin", state: "IL" },
  { city: "Peoria", state: "IL" },
  { city: "Schaumburg", state: "IL" },
  { city: "Arlington Heights", state: "IL" },
  { city: "Evanston", state: "IL" },
  { city: "Orland Park", state: "IL" },
  { city: "Tinley Park", state: "IL" },
  { city: "Oak Lawn", state: "IL" },
  { city: "Plainfield", state: "IL" },
  // Minnesota (10)
  { city: "Minneapolis", state: "MN" },
  { city: "Saint Paul", state: "MN" },
  { city: "Rochester", state: "MN" },
  { city: "Bloomington", state: "MN" },
  { city: "Plymouth", state: "MN" },
  { city: "Woodbury", state: "MN" },
  { city: "Maple Grove", state: "MN" },
  { city: "Eagan", state: "MN" },
  { city: "Eden Prairie", state: "MN" },
  { city: "Burnsville", state: "MN" },
  // Wisconsin (10)
  { city: "Milwaukee", state: "WI" },
  { city: "Madison", state: "WI" },
  { city: "Green Bay", state: "WI" },
  { city: "Kenosha", state: "WI" },
  { city: "Racine", state: "WI" },
  { city: "Appleton", state: "WI" },
  { city: "Waukesha", state: "WI" },
  { city: "Oshkosh", state: "WI" },
  { city: "Eau Claire", state: "WI" },
  { city: "Brookfield", state: "WI" },
];

async function run() {
  var campaignId = process.argv[2] || null;
  var db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
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
  console.log("[add] DONE: " + added + " added, " + skipped + " skipped");
  await db.end();
}

run().catch(function(e) { console.error(e); process.exit(1); });
