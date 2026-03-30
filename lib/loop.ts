// Loop Message wrapper — drop-in replacement for Linq
// All existing code that calls sendLinqSMS will now route through Loop

import { sendMessage, showTyping } from "./loop/client";

// Drop-in replacement for the old sendLinqSMS interface
export async function sendLinqSMS(to: string, body: string, _from?: string): Promise<string | null> {
  try {
    const result = await sendMessage(to, body);
    return result.message_id || "sent";
  } catch (err) {
    console.error("[loop] sendLinqSMS error:", err);
    return null;
  }
}

// Re-export Loop functions with Linq-compatible names
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
