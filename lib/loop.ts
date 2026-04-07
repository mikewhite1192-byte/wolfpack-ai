// Loop Message convenience wrappers

import { sendMessage, showTyping } from "./loop/client";

// Send SMS via Loop — returns message ID or null on failure
export async function sendSMS(to: string, body: string, _from?: string): Promise<string | null> {
  try {
    const result = await sendMessage(to, body);
    return result.message_id || "sent";
  } catch (err) {
    console.error("[loop] sendSMS error:", err);
    return null;
  }
}

// Legacy alias — kept for callers that still reference the old name
export const sendLinqSMS = sendSMS;

// Re-export Loop functions
export { sendMessage as sendMessageToChat } from "./loop/client";
export { sendMessage as sendMessageToNumber } from "./loop/client";

export async function startTyping(contactOrChatId: string): Promise<void> {
  await showTyping(contactOrChatId, 5);
}

export async function stopTyping(_contactOrChatId: string): Promise<void> {
  // Loop typing indicator auto-expires, no stop needed
}

export async function markAsRead(_chatId: string): Promise<void> {
  // Loop handles read receipts differently — no-op for compatibility
}
