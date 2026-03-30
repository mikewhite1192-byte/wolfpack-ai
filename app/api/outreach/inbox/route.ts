import { NextRequest, NextResponse } from "next/server";
import {
  pollAllInboxes,
  getInboxReplies,
  markRead,
  toggleStar,
  replyCampaignEmail,
  getUnreadCount,
} from "@/lib/outreach/campaign-inbox";

// GET /api/outreach/inbox — get replies
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unread") === "true";
    const starredOnly = url.searchParams.get("starred") === "true";
    const toAddress = url.searchParams.get("address") || undefined;

    const { replies, total } = await getInboxReplies({ limit, offset, unreadOnly, starredOnly, toAddress });
    const unreadCount = await getUnreadCount();

    return NextResponse.json({ replies, total, unreadCount });
  } catch (err) {
    console.error("[inbox] Error:", err);
    return NextResponse.json({ replies: [], total: 0, unreadCount: 0 });
  }
}

// POST /api/outreach/inbox — actions: poll, read, star, reply
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "poll": {
        // Can be called by cron or manually
        const auth = req.headers.get("authorization");
        const isCron = auth === `Bearer ${process.env.CRON_SECRET}`;
        // Allow both cron and manual admin triggers
        const result = await pollAllInboxes();
        return NextResponse.json(result);
      }

      case "read": {
        await markRead(body.replyId);
        return NextResponse.json({ success: true });
      }

      case "star": {
        await toggleStar(body.replyId);
        return NextResponse.json({ success: true });
      }

      case "reply": {
        const result = await replyCampaignEmail(body.replyId, body.body);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[inbox] Action error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
