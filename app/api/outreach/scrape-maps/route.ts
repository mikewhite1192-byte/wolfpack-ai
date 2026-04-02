import { NextRequest, NextResponse } from "next/server";
import {
  getEnabledConfigs,
  getScraperConfigs,
  upsertScraperConfig,
  toggleScraperConfig,
  updateScraperCount,
  deleteScraperConfig,
  scrapeGoogleMapsPhase,
  findEmailsPhase,
  verifyAndAddPhase,
  massScrape,
  businessesToCSV,
  exportScrapedToCSV,
  getScraperStats,
} from "@/lib/outreach/google-maps-scraper";

// GET /api/outreach/scrape-maps — Vercel cron handler
// Runs the 3-phase pipeline in rotation:
//   ?phase=scrape  → Phase 1: scrape Google Maps (store businesses)
//   ?phase=emails  → Phase 2: find emails from websites (small batch)
//   ?phase=verify  → Phase 3: verify emails + add to sequence
//   ?phase=status  → Return scraper configs + stats
//   no phase       → auto-run: scrape if enabled configs have remaining quota, else find emails, else verify
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const phase = url.searchParams.get("phase");

  try {
    if (phase === "scrape") {
      const configId = url.searchParams.get("configId");
      return await runScrapePhase(configId || undefined);
    }
    if (phase === "emails") {
      const batch = parseInt(url.searchParams.get("batch") || "3");
      const result = await findEmailsPhase(batch);
      return NextResponse.json(result);
    }
    if (phase === "verify") {
      const batch = parseInt(url.searchParams.get("batch") || "5");
      const result = await verifyAndAddPhase(batch);
      return NextResponse.json(result);
    }
    if (phase === "status") {
      const configs = await getScraperConfigs();
      const stats = await getScraperStats();
      return NextResponse.json({ configs, stats });
    }

    // Auto mode: run whichever phase has work
    return await runScrapePhase();
  } catch (err) {
    console.error("[maps-scraper] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/outreach/scrape-maps — config management + mass scrape + CSV export
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    // ── Config management ──
    if (action === "add" || action === "update") {
      const id = await upsertScraperConfig({
        name: body.name,
        query: body.query,
        source: body.source,
        enabled: body.enabled,
        dailyCount: body.dailyCount,
        maxReviews: body.maxReviews ?? null,
        minRating: body.minRating ?? null,
        maxRating: body.maxRating ?? null,
        categoryFilter: body.categoryFilter ?? null,
      });
      return NextResponse.json({ id, message: `Scraper config ${action === "add" ? "added" : "updated"}` });
    }

    if (action === "toggle") {
      await toggleScraperConfig(body.id, body.enabled);
      return NextResponse.json({ message: `Scraper ${body.enabled ? "enabled" : "disabled"}` });
    }

    if (action === "set-count") {
      await updateScraperCount(body.id, body.dailyCount);
      return NextResponse.json({ message: `Daily count set to ${body.dailyCount}` });
    }

    if (action === "delete") {
      await deleteScraperConfig(body.id);
      return NextResponse.json({ message: "Scraper config deleted" });
    }

    // ── Mass scrape — run a big scrape now, return results or CSV ──
    if (action === "mass-scrape") {
      const query = body.query as string;
      const maxResults = body.maxResults || 50;
      const format = body.format || "json"; // "json" or "csv"

      const businesses = await massScrape(query, maxResults);

      if (format === "csv") {
        const csv = businessesToCSV(businesses);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="scrape-${Date.now()}.csv"`,
          },
        });
      }

      return NextResponse.json({ query, count: businesses.length, businesses });
    }

    // ── Export all scraped data as CSV ──
    if (action === "export-csv") {
      const csv = await exportScrapedToCSV(body.configId);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="scraped-leads-${Date.now()}.csv"`,
        },
      });
    }

    // ── Get status ──
    if (action === "status") {
      const configs = await getScraperConfigs();
      const stats = await getScraperStats(body.range);
      return NextResponse.json({ configs, stats });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[maps-scraper] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// Run Phase 1 for one enabled config (round-robin based on day, or specific config if configId provided)
async function runScrapePhase(configId?: string) {
  const configs = await getEnabledConfigs();

  if (configs.length === 0) {
    return NextResponse.json({ message: "No enabled scraper configs", phase: "scrape" });
  }

  // If configId provided, use that specific config
  let config;
  if (configId) {
    config = configs.find((c: any) => c.id === configId);
    if (!config) {
      return NextResponse.json({ error: "Config not found or not enabled" }, { status: 404 });
    }
  } else {
    // Rotate through configs by day
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    config = configs[dayOfYear % configs.length];
  }

  // Cap at 5 per cron call to stay within Vercel timeout — multiple cron calls per day add up
  const batchSize = Math.min(config.daily_count, 5);
  const stored = await scrapeGoogleMapsPhase(config.id, config.query, batchSize, {
    maxReviews: config.max_reviews,
    minRating: config.min_rating,
    maxRating: config.max_rating,
    categoryFilter: config.category_filter,
  });

  return NextResponse.json({
    phase: "scrape",
    config: config.name,
    query: config.query,
    stored,
  });
}
