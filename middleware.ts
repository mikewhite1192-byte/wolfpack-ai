import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

// Track page views on public pages
function shouldTrack(path: string): boolean {
  // Only track actual pages, not API routes, assets, or internal paths
  if (path.startsWith("/api/")) return false;
  if (path.startsWith("/_next/")) return false;
  if (path.startsWith("/sign-in")) return false;
  if (path.startsWith("/sign-up")) return false;
  if (path.startsWith("/dashboard")) return false;
  if (path.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|map|json|xml|txt)$/)) return false;
  // Filter bot probes and non-page paths
  if (path.startsWith("/.env")) return false;
  if (path.startsWith("/.git")) return false;
  if (path.startsWith("/wp-")) return false;
  if (path.startsWith("/admin")) return false;
  if (path === "/robots.txt") return false;
  if (path === "/sitemap.xml") return false;
  if (path === "/favicon.ico") return false;
  return true;
}

function getVisitorId(req: NextRequest): string {
  // Use existing cookie or generate new one
  const existing = req.cookies.get("_wv")?.value;
  if (existing) return existing;
  return crypto.randomUUID();
}

export default clerkMiddleware(async (authFn, req) => {
  const path = req.nextUrl.pathname;

  // Protect dashboard and API routes (except public APIs)
  const isProtected = path.startsWith("/dashboard") || (
    path.startsWith("/api/") &&
    !path.startsWith("/api/stripe/webhook") &&
    !path.startsWith("/api/analytics/traffic") &&
    !path.startsWith("/api/score/") &&
    !path.startsWith("/api/try") &&
    !path.startsWith("/api/calendar/demo") &&
    !path.startsWith("/api/chat-widget") &&
    !path.startsWith("/api/affiliates") &&
    !path.startsWith("/api/cron") &&
    !path.startsWith("/api/loop") &&
    !path.startsWith("/api/book") &&
    !path.startsWith("/api/outreach") &&
    !path.startsWith("/api/webhooks") &&
    !path.startsWith("/api/ai-agent/follow-up") &&
    !path.startsWith("/api/ai-agent/reminders") &&
    !path.startsWith("/api/ai-agent/learn") &&
    !path.startsWith("/api/ai-agent/daily-report") &&
    !path.startsWith("/api/email-assistant") &&
    !path.startsWith("/api/gbp") &&
    !path.startsWith("/api/leads") &&
    !path.startsWith("/api/owner") &&
    !path.startsWith("/api/upwork/webhook") &&
    !path.startsWith("/api/upwork/poll") &&
    !path.startsWith("/api/caller/")
  );

  if (isProtected) {
    await authFn.protect();
  }

  if (shouldTrack(path)) {
    const visitorId = getVisitorId(req);
    const referrer = req.headers.get("referer") || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Fire and forget — don't block the response
    const baseUrl = req.nextUrl.origin;
    fetch(`${baseUrl}/api/analytics/traffic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, referrer, userAgent, visitorId }),
    }).catch(() => {});

    // Set visitor cookie if new
    if (!req.cookies.get("_wv")) {
      const res = NextResponse.next();
      res.cookies.set("_wv", visitorId, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
      return res;
    }
  }

  // If a ?ref= param is present, set a 90-day affiliate cookie and track the click
  const ref = req.nextUrl.searchParams.get("ref");
  if (ref && /^[a-z0-9-]{3,30}$/.test(ref)) {
    fetch(`${req.nextUrl.origin}/api/affiliates/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref }),
    }).catch(() => {});

    const res = NextResponse.next();
    res.cookies.set("wp_ref", ref, {
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
    return res;
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
