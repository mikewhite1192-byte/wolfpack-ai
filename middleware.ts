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
  if (path.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|map)$/)) return false;
  return true;
}

function getVisitorId(req: NextRequest): string {
  // Use existing cookie or generate new one
  const existing = req.cookies.get("_wv")?.value;
  if (existing) return existing;
  return crypto.randomUUID();
}

export default clerkMiddleware(async (_auth, req) => {
  const path = req.nextUrl.pathname;

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

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
