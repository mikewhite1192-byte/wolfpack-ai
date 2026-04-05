import { NextResponse } from "next/server";

interface CheckResult {
  name: string;
  category: "performance" | "seo" | "security" | "mobile" | "content";
  score: number; // 0-100
  status: "good" | "warning" | "bad";
  detail: string;
}

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "WolfPackScorer/1.0" } });
    clearTimeout(id);
    return response;
  } catch {
    clearTimeout(id);
    throw new Error("Request timed out");
  }
}

export async function POST(req: Request) {
  try {
    const { url: rawUrl } = await req.json();
    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Normalize URL
    let url = rawUrl.trim();
    if (!url.startsWith("http")) url = `https://${url}`;
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    const checks: CheckResult[] = [];
    let html = "";
    let loadTimeMs = 0;
    let isHttps = urlObj.protocol === "https:";
    let statusCode = 0;

    // ── Fetch the page ──
    try {
      const start = Date.now();
      const res = await fetchWithTimeout(url);
      loadTimeMs = Date.now() - start;
      statusCode = res.status;
      html = await res.text();
      isHttps = res.url.startsWith("https:");
    } catch (e) {
      return NextResponse.json({ error: `Could not reach ${domain}. Make sure the site is live.` }, { status: 400 });
    }

    const htmlLower = html.toLowerCase();

    // ── SSL / HTTPS ──
    checks.push({
      name: "SSL Certificate (HTTPS)",
      category: "security",
      score: isHttps ? 100 : 0,
      status: isHttps ? "good" : "bad",
      detail: isHttps ? "Site is served over HTTPS with a valid SSL certificate." : "Site is NOT using HTTPS. This hurts trust, SEO, and browser warnings.",
    });

    // ── Page Load Time ──
    const loadScore = loadTimeMs < 1500 ? 100 : loadTimeMs < 3000 ? 70 : loadTimeMs < 5000 ? 40 : 10;
    checks.push({
      name: "Page Load Speed",
      category: "performance",
      score: loadScore,
      status: loadScore >= 70 ? "good" : loadScore >= 40 ? "warning" : "bad",
      detail: `Page loaded in ${(loadTimeMs / 1000).toFixed(2)}s. ${loadScore >= 70 ? "Good speed." : loadScore >= 40 ? "Could be faster." : "Very slow — visitors are leaving."}`,
    });

    // ── Status Code ──
    checks.push({
      name: "HTTP Status",
      category: "performance",
      score: statusCode === 200 ? 100 : 50,
      status: statusCode === 200 ? "good" : "warning",
      detail: `Server returned status ${statusCode}. ${statusCode === 200 ? "Page loads correctly." : "Non-200 status may indicate issues."}`,
    });

    // ── Title Tag ──
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || "";
    const titleScore = title.length > 10 && title.length < 70 ? 100 : title.length > 0 ? 60 : 0;
    checks.push({
      name: "Title Tag",
      category: "seo",
      score: titleScore,
      status: titleScore >= 70 ? "good" : titleScore > 0 ? "warning" : "bad",
      detail: title ? `"${title.substring(0, 60)}${title.length > 60 ? "..." : ""}" (${title.length} chars). ${titleScore === 100 ? "Good length." : "Should be 10-70 characters."}` : "Missing title tag. This is critical for SEO.",
    });

    // ── Meta Description ──
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const desc = descMatch?.[1]?.trim() || "";
    const descScore = desc.length > 50 && desc.length < 160 ? 100 : desc.length > 0 ? 60 : 0;
    checks.push({
      name: "Meta Description",
      category: "seo",
      score: descScore,
      status: descScore >= 70 ? "good" : descScore > 0 ? "warning" : "bad",
      detail: desc ? `${desc.length} characters. ${descScore === 100 ? "Good length." : "Should be 50-160 characters."}` : "Missing meta description. Google uses this in search results.",
    });

    // ── Viewport Meta (Mobile) ──
    const hasViewport = htmlLower.includes('name="viewport"') || htmlLower.includes("name='viewport'");
    checks.push({
      name: "Mobile Viewport",
      category: "mobile",
      score: hasViewport ? 100 : 0,
      status: hasViewport ? "good" : "bad",
      detail: hasViewport ? "Viewport meta tag found. Site is configured for mobile." : "Missing viewport meta tag. Site may not render properly on mobile devices.",
    });

    // ── H1 Tag ──
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h1Text = h1Match?.[1]?.replace(/<[^>]*>/g, "").trim() || "";
    checks.push({
      name: "H1 Heading",
      category: "seo",
      score: h1Text.length > 0 ? 100 : 0,
      status: h1Text.length > 0 ? "good" : "bad",
      detail: h1Text ? `Found: "${h1Text.substring(0, 50)}${h1Text.length > 50 ? "..." : ""}"` : "Missing H1 heading. Every page should have exactly one H1.",
    });

    // ── Open Graph Tags ──
    const hasOGTitle = htmlLower.includes('property="og:title"') || htmlLower.includes("property='og:title'");
    const hasOGImage = htmlLower.includes('property="og:image"') || htmlLower.includes("property='og:image'");
    const ogScore = hasOGTitle && hasOGImage ? 100 : hasOGTitle || hasOGImage ? 50 : 0;
    checks.push({
      name: "Open Graph Tags",
      category: "seo",
      score: ogScore,
      status: ogScore >= 70 ? "good" : ogScore > 0 ? "warning" : "bad",
      detail: `${hasOGTitle ? "og:title found. " : "Missing og:title. "}${hasOGImage ? "og:image found." : "Missing og:image."} These control how your site looks when shared on social media.`,
    });

    // ── Images with Alt Text ──
    const imgTags = html.match(/<img[^>]*>/gi) || [];
    const imgsWithAlt = imgTags.filter(img => /alt=["'][^"']+["']/i.test(img)).length;
    const imgScore = imgTags.length === 0 ? 100 : Math.round((imgsWithAlt / imgTags.length) * 100);
    checks.push({
      name: "Image Alt Text",
      category: "content",
      score: imgScore,
      status: imgScore >= 70 ? "good" : imgScore >= 40 ? "warning" : "bad",
      detail: imgTags.length === 0 ? "No images found on page." : `${imgsWithAlt} of ${imgTags.length} images have alt text (${imgScore}%). Alt text helps SEO and accessibility.`,
    });

    // ── Schema Markup ──
    const hasSchema = htmlLower.includes("application/ld+json") || htmlLower.includes("itemscope");
    checks.push({
      name: "Schema Markup",
      category: "seo",
      score: hasSchema ? 100 : 0,
      status: hasSchema ? "good" : "warning",
      detail: hasSchema ? "Structured data found. This helps Google understand your content." : "No schema markup detected. Adding structured data can improve search visibility.",
    });

    // ── Canonical Tag ──
    const hasCanonical = htmlLower.includes('rel="canonical"') || htmlLower.includes("rel='canonical'");
    checks.push({
      name: "Canonical Tag",
      category: "seo",
      score: hasCanonical ? 100 : 30,
      status: hasCanonical ? "good" : "warning",
      detail: hasCanonical ? "Canonical tag found. Prevents duplicate content issues." : "Missing canonical tag. Can cause duplicate content issues in search.",
    });

    // ── Favicon ──
    const hasFavicon = htmlLower.includes('rel="icon"') || htmlLower.includes("rel='icon'") || htmlLower.includes('rel="shortcut icon"');
    checks.push({
      name: "Favicon",
      category: "content",
      score: hasFavicon ? 100 : 20,
      status: hasFavicon ? "good" : "warning",
      detail: hasFavicon ? "Favicon found. Builds brand recognition in browser tabs." : "Missing favicon. Small detail that looks unprofessional without.",
    });

    // ── Google PageSpeed Insights (free API) ──
    let lighthousePerf: number | null = null;
    let lighthouseAccess: number | null = null;
    let lighthouseSeo: number | null = null;
    try {
      const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeedtest?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=accessibility&category=seo`;
      const psiRes = await fetchWithTimeout(psiUrl, 30000);
      if (psiRes.ok) {
        const psiData = await psiRes.json();
        const cats = psiData.lighthouseResult?.categories;
        lighthousePerf = cats?.performance?.score ? Math.round(cats.performance.score * 100) : null;
        lighthouseAccess = cats?.accessibility?.score ? Math.round(cats.accessibility.score * 100) : null;
        lighthouseSeo = cats?.seo?.score ? Math.round(cats.seo.score * 100) : null;

        if (lighthousePerf !== null) {
          checks.push({
            name: "Google Lighthouse Performance",
            category: "performance",
            score: lighthousePerf,
            status: lighthousePerf >= 70 ? "good" : lighthousePerf >= 40 ? "warning" : "bad",
            detail: `Mobile performance score: ${lighthousePerf}/100. ${lighthousePerf >= 90 ? "Excellent." : lighthousePerf >= 70 ? "Good but could improve." : lighthousePerf >= 40 ? "Needs work." : "Poor — significantly impacting user experience."}`,
          });
        }
        if (lighthouseAccess !== null) {
          checks.push({
            name: "Accessibility Score",
            category: "content",
            score: lighthouseAccess,
            status: lighthouseAccess >= 70 ? "good" : lighthouseAccess >= 40 ? "warning" : "bad",
            detail: `Accessibility score: ${lighthouseAccess}/100. ${lighthouseAccess >= 90 ? "Excellent." : "Room for improvement — impacts users with disabilities."}`,
          });
        }
        if (lighthouseSeo !== null) {
          checks.push({
            name: "Google SEO Score",
            category: "seo",
            score: lighthouseSeo,
            status: lighthouseSeo >= 70 ? "good" : lighthouseSeo >= 40 ? "warning" : "bad",
            detail: `Google's SEO audit score: ${lighthouseSeo}/100. ${lighthouseSeo >= 90 ? "Well optimized." : "SEO improvements needed."}`,
          });
        }
      }
    } catch {
      // PageSpeed timeout — skip, we have our own checks
    }

    // ── Calculate overall score ──
    const totalScore = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length);
    const goodCount = checks.filter(c => c.status === "good").length;
    const warningCount = checks.filter(c => c.status === "warning").length;
    const badCount = checks.filter(c => c.status === "bad").length;

    const grade = totalScore >= 90 ? "A+" : totalScore >= 80 ? "A" : totalScore >= 70 ? "B" : totalScore >= 60 ? "C" : totalScore >= 50 ? "D" : "F";

    return NextResponse.json({
      url,
      domain,
      title: title || domain,
      score: totalScore,
      grade,
      checks,
      summary: { good: goodCount, warning: warningCount, bad: badCount, total: checks.length },
      lighthouse: { performance: lighthousePerf, accessibility: lighthouseAccess, seo: lighthouseSeo },
      loadTimeMs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
