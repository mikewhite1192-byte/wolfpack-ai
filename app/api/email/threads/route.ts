import { NextResponse } from "next/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { getGmailToken, gmailFetch, parseGmailMessage, type EmailMessage } from "@/lib/gmail";

// GET /api/email/threads — list email threads, optionally filtered by contact email
export async function GET(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const token = await getGmailToken(workspace.id);

    if (!token) {
      return NextResponse.json({ error: "Gmail not connected", connected: false }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const contactEmail = searchParams.get("contact");
    const page = searchParams.get("pageToken");
    const maxResults = searchParams.get("max") || "20";

    // Build Gmail query
    let query = "in:inbox OR in:sent";
    if (contactEmail) {
      query = `from:${contactEmail} OR to:${contactEmail}`;
    }

    const params = new URLSearchParams({
      q: query,
      maxResults,
    });
    if (page) params.set("pageToken", page);

    const threadList = await gmailFetch(token, `threads?${params}`);

    if (threadList.error) {
      console.error("[email] Gmail API error:", threadList.error);
      return NextResponse.json({ error: "Gmail API error", details: threadList.error.message }, { status: 500 });
    }

    if (!threadList.threads || threadList.threads.length === 0) {
      return NextResponse.json({ threads: [], nextPageToken: null, connected: true });
    }

    // Fetch thread details
    const threads = await Promise.all(
      threadList.threads.slice(0, 15).map(async (t: { id: string }) => {
        const thread = await gmailFetch(token, `threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`);
        const messages = (thread.messages || []) as Array<Record<string, unknown>>;

        if (messages.length === 0) return null;

        const first = messages[0];
        const last = messages[messages.length - 1];
        const headers = (first.payload as Record<string, unknown>)?.headers as Array<{ name: string; value: string }> || [];
        const lastHeaders = (last.payload as Record<string, unknown>)?.headers as Array<{ name: string; value: string }> || [];
        const getHeader = (hdrs: Array<{ name: string; value: string }>, name: string) =>
          hdrs.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        const labelIds = last.labelIds as string[] || [];

        return {
          id: thread.id,
          subject: getHeader(headers, "Subject") || "(no subject)",
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          lastFrom: getHeader(lastHeaders, "From"),
          date: getHeader(lastHeaders, "Date"),
          snippet: (last.snippet as string) || "",
          messageCount: messages.length,
          isRead: !labelIds.includes("UNREAD"),
        };
      })
    );

    return NextResponse.json({
      threads: threads.filter(Boolean),
      nextPageToken: threadList.nextPageToken || null,
      connected: true,
    });
  } catch (err) {
    console.error("[email-threads] Error:", err);
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
}
