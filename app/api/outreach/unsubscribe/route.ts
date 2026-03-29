import { NextRequest, NextResponse } from "next/server";
import { markUnsubscribed } from "@/lib/outreach/sequence";

// GET /api/outreach/unsubscribe?email=xxx — unsubscribe link handler
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return new Response("<h1>Invalid link</h1>", { headers: { "Content-Type": "text/html" } });
  }

  await markUnsubscribed(decodeURIComponent(email));

  return new Response(`
    <html>
      <head><title>Unsubscribed</title></head>
      <body style="font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0a0a0a; color: #e8eaf0; margin: 0;">
        <div style="text-align: center; max-width: 400px;">
          <h1 style="font-size: 24px; margin-bottom: 12px;">You've been unsubscribed</h1>
          <p style="color: #888; font-size: 14px;">You won't receive any more emails from us. Sorry for the inconvenience.</p>
        </div>
      </body>
    </html>
  `, { headers: { "Content-Type": "text/html" } });
}
