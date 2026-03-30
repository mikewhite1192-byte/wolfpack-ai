// Loop Message API Client (iMessage/SMS/RCS)
// Docs: https://docs.loopmessage.com/imessage-conversation-api/

const BASE_URL = "https://a.loopmessage.com/api/v1";
const API_KEY = process.env.LOOP_API_KEY || "";

// Ensure phone number is in E.164 format (+1XXXXXXXXXX)
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (phone.startsWith("+")) return phone;
  return "+" + digits;
}

export interface LoopSendResponse {
  message_id: string;
  contact?: string;
  text?: string;
  success?: boolean;
  message?: string; // error message on failure
}

// Send a text message via Loop (iMessage, SMS, or RCS)
export async function sendMessage(
  to: string,
  text: string,
  options?: {
    channel?: "imessage" | "sms" | "rcs";
    sender?: string;
    replyToId?: string;
    passthrough?: string;
  },
): Promise<LoopSendResponse> {
  if (!API_KEY) throw new Error("LOOP_API_KEY not configured");

  const contact = toE164(to);
  console.log(`[loop] Sending message to ${contact}`);

  const body: Record<string, unknown> = {
    contact,
    text,
  };

  if (options?.channel) body.channel = options.channel;
  if (options?.sender) body.sender = options.sender;
  if (options?.replyToId) body.reply_to_id = options.replyToId;
  if (options?.passthrough) body.passthrough = options.passthrough;

  const response = await fetch(`${BASE_URL}/message/send/`, {
    method: "POST",
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as LoopSendResponse;

  if (!response.ok || data.success === false) {
    console.error(`[loop] Send failed: ${data.message || response.status}`);
    throw new Error(`Loop API error: ${data.message || response.status}`);
  }

  console.log(`[loop] Message sent: ${data.message_id}`);
  return data;
}

// Send a message to a group
export async function sendGroupMessage(
  groupId: string,
  text: string,
): Promise<LoopSendResponse> {
  if (!API_KEY) throw new Error("LOOP_API_KEY not configured");

  const response = await fetch(`${BASE_URL}/message/send/`, {
    method: "POST",
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ group: groupId, text }),
  });

  const data = (await response.json()) as LoopSendResponse;

  if (!response.ok || data.success === false) {
    throw new Error(`Loop API error: ${data.message || response.status}`);
  }

  return data;
}

// Show typing indicator
export async function showTyping(
  contact: string,
  seconds: number = 5,
  messageId?: string,
): Promise<void> {
  if (!API_KEY) return;

  const body: Record<string, unknown> = {
    typing: Math.min(seconds, 60),
    read: true,
  };

  if (messageId) {
    body.message_id = messageId;
  } else {
    body.contact = toE164(contact);
  }

  try {
    await fetch(`${BASE_URL}/message/show-typing/`, {
      method: "POST",
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Typing indicator is non-critical
  }
}

// Send a reaction (tapback) to a message
export async function sendReaction(
  contact: string,
  messageId: string,
  reaction: "love" | "like" | "dislike" | "laugh" | "emphasize" | "question",
): Promise<void> {
  if (!API_KEY) return;

  await fetch(`${BASE_URL}/message/send/`, {
    method: "POST",
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contact: toE164(contact),
      message_id: messageId,
      reaction,
    }),
  });
}

// Webhook payload types
export interface LoopWebhookPayload {
  event: "message_inbound" | "message_delivered" | "message_failed" | "message_reaction" | "opt-in" | "inbound_call" | "unknown";
  contact: string; // E.164 phone or email
  text: string;
  message_id: string;
  webhook_id: string;
  message_type?: "text" | "reaction" | "audio" | "attachments" | "sticker" | "location";
  channel?: "iMessage" | "SMS" | "RCS";
  sender?: string;
  thread_id?: string;
  subject?: string;
  attachments?: string[];
  error_code?: number;
  group?: {
    id: string;
    name?: string;
    participants?: string[];
  };
  api_version: string;
}

// Helper to validate incoming webhook (check for auth header)
export function validateWebhook(authHeader: string | null): boolean {
  const expectedHeader = process.env.LOOP_WEBHOOK_SECRET;
  if (!expectedHeader) return true; // No secret configured, allow all
  return authHeader === expectedHeader;
}
