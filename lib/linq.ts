// Re-export from linq/client for backward compatibility
export { sendMessage as sendMessageToChat, createChat as sendMessageToNumber, markAsRead, startTyping, stopTyping } from "./linq/client";

import { createChat } from "./linq/client";

// Convenience wrapper for the old sendLinqSMS interface
export async function sendLinqSMS(to: string, body: string, from?: string): Promise<string | null> {
  try {
    const result = await createChat(from || process.env.LINQ_PHONE_NUMBER || "", to, body);
    return result.message?.id || result.chat_id || "sent";
  } catch (err) {
    console.error("[linq] sendLinqSMS error:", err);
    return null;
  }
}
