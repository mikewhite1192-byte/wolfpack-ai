import { NextResponse } from "next/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { getGmailToken, gmailFetch, createRawEmail } from "@/lib/gmail";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/email/send — send, reply, or forward an email
export async function POST(req: Request) {
  try {
    const workspace = await getOrCreateWorkspace();
    const token = await getGmailToken(workspace.id);
    if (!token) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

    const { to, subject, body, threadId, inReplyTo, references, action } = await req.json();

    if (!to || !body) {
      return NextResponse.json({ error: "to and body required" }, { status: 400 });
    }

    const fromEmail = (await sql`SELECT gmail_email FROM workspaces WHERE id = ${workspace.id}`)[0]?.gmail_email || "";
    const raw = createRawEmail(to, fromEmail, subject || "", body, inReplyTo, references);

    const endpoint = threadId
      ? `messages/send`
      : `messages/send`;

    const result = await gmailFetch(token, endpoint, {
      method: "POST",
      body: JSON.stringify({
        raw,
        threadId: threadId || undefined,
      }),
    });

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ messageId: result.id, threadId: result.threadId });
  } catch (err) {
    console.error("[email-send] Error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
