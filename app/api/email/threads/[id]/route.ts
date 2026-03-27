import { NextResponse } from "next/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { getGmailToken, gmailFetch, parseGmailMessage } from "@/lib/gmail";

// GET /api/email/threads/[id] — get full thread with all messages
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await getOrCreateWorkspace();
    const token = await getGmailToken(workspace.id);
    if (!token) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

    const { id } = await params;
    const thread = await gmailFetch(token, `threads/${id}?format=full`);

    if (thread.error) {
      return NextResponse.json({ error: thread.error.message }, { status: 500 });
    }

    const messages = (thread.messages || []).map((m: Record<string, unknown>) => parseGmailMessage(m));

    // Mark as read
    await gmailFetch(token, `threads/${id}/modify`, {
      method: "POST",
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    });

    return NextResponse.json({ threadId: id, messages });
  } catch (err) {
    console.error("[email-thread] Error:", err);
    return NextResponse.json({ error: "Failed to fetch thread" }, { status: 500 });
  }
}
