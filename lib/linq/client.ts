// Linq Blue V3 API Client
// Based on: https://github.com/linq-team/ai-agent-example

const BASE_URL = process.env.LINQ_API_BASE_URL || 'https://api.linqapp.com/api/partner/v3';
const API_TOKEN = process.env.LINQ_API_TOKEN;

// Ensure phone number is in E.164 format (+1XXXXXXXXXX)
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (phone.startsWith('+')) return phone;
  return '+' + digits;
}

function truncateError(text: string, maxLen = 100): string {
  if (text.includes('<!DOCTYPE') || text.includes('<html')) {
    return '[HTML error page]';
  }
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

export interface SendMessageResponse {
  chat_id: string;
  message: {
    id: string;
    parts: Array<{ type: string; value?: string }>;
    sent_at: string;
    delivery_status: 'pending' | 'queued' | 'sent' | 'delivered' | 'failed';
    is_read: boolean;
  };
}

// Send message to an existing chat (reply)
export async function sendMessage(chatId: string, text: string): Promise<SendMessageResponse> {
  if (!API_TOKEN) throw new Error('LINQ_API_TOKEN not configured');

  const url = `${BASE_URL}/chats/${chatId}/messages`;
  console.log(`[linq] Sending message to chat ${chatId}`);

  const parts: Array<{ type: string; value?: string }> = [];
  if (text) parts.push({ type: 'text', value: text });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { parts } }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[linq] API error ${response.status}: ${truncateError(errorText)}`);
    throw new Error(`Linq API error: ${response.status} ${truncateError(errorText)}`);
  }

  const data = await response.json() as SendMessageResponse;
  console.log(`[linq] Message sent: ${data.message.id}`);
  return data;
}

// Create a new chat and send first message (outbound to new number)
export async function createChat(from: string, to: string, text: string): Promise<SendMessageResponse> {
  if (!API_TOKEN) throw new Error('LINQ_API_TOKEN not configured');

  const url = `${BASE_URL}/chats`;
  const formattedFrom = toE164(from);
  const formattedTo = toE164(to);
  console.log(`[linq] Creating chat from ${formattedFrom} to ${formattedTo}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      from: formattedFrom,
      to: [formattedTo],
      message: {
        parts: [{ type: 'text', value: text }],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[linq] API error ${response.status}: ${truncateError(errorText)}`);
    throw new Error(`Linq API error: ${response.status} ${truncateError(errorText)}`);
  }

  const raw = await response.json();
  // Linq V3 returns { chat: { id: "...", message: { ... } } } not { chat_id: "..." }
  const data: SendMessageResponse = {
    chat_id: raw.chat_id || raw.chat?.id || "",
    message: raw.message || raw.chat?.message || { id: "", parts: [], sent_at: "", delivery_status: "pending", is_read: false },
  };
  console.log(`[linq] Chat created: ${data.chat_id}`);
  return data;
}

// Mark chat as read
export async function markAsRead(chatId: string): Promise<void> {
  if (!API_TOKEN) return;
  try {
    await fetch(`${BASE_URL}/chats/${chatId}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    });
  } catch { /* silent */ }
}

// Start typing indicator
export async function startTyping(chatId: string): Promise<void> {
  if (!API_TOKEN) return;
  try {
    await fetch(`${BASE_URL}/chats/${chatId}/typing`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    });
  } catch { /* silent */ }
}

// Stop typing indicator
export async function stopTyping(chatId: string): Promise<void> {
  if (!API_TOKEN) return;
  try {
    await fetch(`${BASE_URL}/chats/${chatId}/typing`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    });
  } catch { /* silent */ }
}
