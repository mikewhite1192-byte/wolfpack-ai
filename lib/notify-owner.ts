// Owner notification helper — sends iMessage/SMS via Loop
// Never crashes the main flow — all errors are silently caught

import { sendMessage } from "@/lib/loop/client";

/**
 * Notify the workspace owner via text message.
 * Falls back to OWNER_PHONE env var (per-workspace owner_phone not yet in schema).
 * Safe to call fire-and-forget — never throws.
 */
export async function notifyOwner(
  _workspaceId: string,
  message: string,
): Promise<void> {
  try {
    const phone = process.env.OWNER_PHONE;
    if (!phone) {
      console.log("[notify-owner] OWNER_PHONE not set, skipping notification");
      return;
    }
    await sendMessage(phone, message);
    console.log(`[notify-owner] Sent: "${message.substring(0, 60)}..."`);
  } catch (err) {
    console.error("[notify-owner] Failed to send notification:", err);
  }
}
