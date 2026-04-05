import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/email/callback`
  : "https://thewolfpack.ai/api/email/callback";

export function getGoogleAuthUrl() {
  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/postmaster.readonly",
  ];

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

export async function getGmailToken(workspaceId: string): Promise<string | null> {
  const ws = await sql`SELECT gmail_access_token, gmail_refresh_token, gmail_connected FROM workspaces WHERE id = ${workspaceId}`;
  if (!ws[0]?.gmail_connected || !ws[0]?.gmail_refresh_token) return null;

  // Always refresh to ensure valid token
  try {
    const newToken = await refreshAccessToken(ws[0].gmail_refresh_token as string);
    await sql`UPDATE workspaces SET gmail_access_token = ${newToken} WHERE id = ${workspaceId}`;
    return newToken;
  } catch {
    return ws[0].gmail_access_token as string;
  }
}

// Gmail API helpers
export async function gmailFetch(token: string, endpoint: string, options?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  return res.json();
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  snippet: string;
}

export function parseGmailMessage(msg: Record<string, unknown>): EmailMessage {
  const headers = (msg.payload as Record<string, unknown>)?.headers as Array<{ name: string; value: string }> || [];
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  // Get body
  let body = "";
  const payload = msg.payload as Record<string, unknown>;
  if (payload?.body && (payload.body as Record<string, unknown>)?.data) {
    body = Buffer.from((payload.body as Record<string, unknown>).data as string, "base64url").toString("utf-8");
  } else if (payload?.parts) {
    const parts = payload.parts as Array<Record<string, unknown>>;
    // Prefer text/plain, fallback to text/html
    const textPart = parts.find(p => p.mimeType === "text/plain") || parts.find(p => p.mimeType === "text/html");
    if (textPart?.body && (textPart.body as Record<string, unknown>)?.data) {
      body = Buffer.from((textPart.body as Record<string, unknown>).data as string, "base64url").toString("utf-8");
    }
    // Handle nested multipart
    if (!body) {
      for (const part of parts) {
        if (part.parts) {
          const nested = (part.parts as Array<Record<string, unknown>>).find(p => p.mimeType === "text/plain");
          if (nested?.body && (nested.body as Record<string, unknown>)?.data) {
            body = Buffer.from((nested.body as Record<string, unknown>).data as string, "base64url").toString("utf-8");
            break;
          }
        }
      }
    }
  }

  // Strip HTML if needed
  if (body.includes("<html") || body.includes("<div")) {
    body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  const labelIds = msg.labelIds as string[] || [];

  return {
    id: msg.id as string,
    threadId: msg.threadId as string,
    from: getHeader("From"),
    to: getHeader("To"),
    subject: getHeader("Subject"),
    body,
    date: getHeader("Date"),
    isRead: !labelIds.includes("UNREAD"),
    snippet: (msg.snippet as string) || "",
  };
}

export function createRawEmail(to: string, from: string, subject: string, body: string, inReplyTo?: string, references?: string): string {
  const headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);

  const raw = headers.join("\r\n") + "\r\n\r\n" + body;
  return Buffer.from(raw).toString("base64url");
}
