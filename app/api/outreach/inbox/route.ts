import { NextRequest, NextResponse } from "next/server";
import {
  pollAllInboxes,
  getInboxReplies,
  markRead,
  toggleStar,
  replyCampaignEmail,
  getUnreadCount,
} from "@/lib/outreach/campaign-inbox";

// GET /api/outreach/inbox — get replies OR cron-triggered poll
// ?poll=true triggers inbox polling (for Vercel cron which uses GET)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const threadReplyId = url.searchParams.get("thread");
    const isPoll = url.searchParams.get("poll") === "true";

    // Get full conversation thread for a reply
    if (threadReplyId) {
      const { getConversationThread } = await import("@/lib/outreach/campaign-inbox");
      const thread = await getConversationThread(threadReplyId);
      return NextResponse.json({ thread });
    }

    if (isPoll) {
      const batchParam = url.searchParams.get("batch");
      const batch = batchParam != null ? parseInt(batchParam) : undefined;
      const result = await pollAllInboxes(batch);
      return NextResponse.json(result);
    }

    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unread") === "true";
    const starredOnly = url.searchParams.get("starred") === "true";
    const toAddresses = url.searchParams.getAll("address").filter(Boolean);
    const toAddress = toAddresses.length === 1 ? toAddresses[0] : undefined;

    const { replies, total } = await getInboxReplies({
      limit, offset, unreadOnly, starredOnly,
      toAddress,
      toAddresses: toAddresses.length > 1 ? toAddresses : undefined,
    });
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
        const result = await pollAllInboxes(body.batch ?? undefined);
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
