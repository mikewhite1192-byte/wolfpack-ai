// Post-call SMS follow-up via Loop iMessage
// Sends different messages based on call outcome
import { sendMessage as sendLoop } from "@/lib/loop/client";
import type { CallerLead } from "./retell-tools";

const MIKE_PHONE = process.env.OWNER_PHONE || "";
const TRY_LINK = "https://thewolfpack.ai/try";

// ── Send Post-Call Follow-Up ────────────────────────────────────────
export async function sendPostCallFollowup(lead: CallerLead): Promise<void> {
  // Skip if demo was booked — confirmations handle that
  if (lead.status === "demo_booked") {
    console.log(`[caller-followup] Skipping follow-up for booked demo: ${lead.id}`);
    return;
  }

  if (!lead.phone) {
    console.log(`[caller-followup] No phone for lead ${lead.id}, skipping`);
    return;
  }

  const firstName = lead.contact_name?.split(" ")[0] || "there";
  const businessName = lead.business_name || "your business";
  const contractorType = lead.contractor_type || "contractor";
  const city = lead.city || "your area";

  let message: string;

  switch (lead.status) {
    case "voicemail":
      message = `Hey ${firstName}, tried reaching you about getting ${businessName} on Google. I build sites for ${contractorType}s — $500, done in 24 hours. Worth a quick look? Reply here or call me back at ${MIKE_PHONE}.`;
      break;

    case "not_interested":
      message = `Hey ${firstName}, appreciate you taking the call. If things change, here's what we do for ${contractorType}s in ${city}: ${TRY_LINK}. No pressure.`;
      break;

    case "hung_up":
    case "no_answer":
      message = `Hey ${firstName}, tried calling about getting ${businessName} showing up on Google. Quick question — are you getting leads from Google right now? If not, I can show you how in 15 min. Reply here.`;
      break;

    case "callback_requested":
      message = `Hey ${firstName}, sounds good — I'll try you back. In the meantime, here's a quick look at what we do for ${contractorType}s in ${city}: ${TRY_LINK}`;
      break;

    default:
      console.log(`[caller-followup] Unknown status ${lead.status}, skipping follow-up`);
      return;
  }

  try {
    await sendLoop(lead.phone, message);
    console.log(`[caller-followup] Sent ${lead.status} follow-up to ${lead.phone}`);
  } catch (err) {
    console.error(`[caller-followup] Failed to send follow-up to ${lead.phone}:`, err);
  }
}
