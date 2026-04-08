// Sync AI Cold Caller leads into the main CRM (contacts, deals, conversations)
import { neon } from "@neondatabase/serverless";
import type { CallerLead } from "./retell-tools";

const sql = neon(process.env.DATABASE_URL!);

interface SyncResult {
  contactId: string;
  dealId: string | null;
  conversationId: string;
  alreadyExisted: boolean;
}

/**
 * Sync a caller_lead into the CRM:
 *  1. Find or create a contact by phone
 *  2. Create a deal in the first pipeline stage
 *  3. Create an SMS conversation (for inbound replies)
 *  4. Store crm_contact_id back on the caller_lead
 */
export async function syncCallerLeadToCRM(
  leadId: string,
  workspaceId?: string,
): Promise<SyncResult | null> {
  try {
    // 1. Get the caller_lead
    const leads = await sql`SELECT * FROM caller_leads WHERE id = ${leadId}`;
    if (leads.length === 0) {
      console.error(`[caller-sync] Lead ${leadId} not found`);
      return null;
    }
    const lead = leads[0] as unknown as CallerLead & { crm_contact_id?: string };

    // Already synced?
    if (lead.crm_contact_id) {
      console.log(`[caller-sync] Lead ${leadId} already synced to contact ${lead.crm_contact_id}`);
      return {
        contactId: lead.crm_contact_id,
        dealId: null,
        conversationId: "",
        alreadyExisted: true,
      };
    }

    // 2. Resolve workspace
    let wsId = workspaceId;
    if (!wsId) {
      const ws = await sql`
        SELECT id FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1
      `;
      if (ws.length === 0) {
        console.error("[caller-sync] No active workspace found");
        return null;
      }
      wsId = ws[0].id as string;
    }

    // 3. Normalize phone for matching
    const rawPhone = lead.phone;
    const digits = rawPhone.replace(/\D/g, "");
    const phoneE164 =
      digits.startsWith("1") && digits.length === 11
        ? "+" + digits
        : digits.length === 10
          ? "+1" + digits
          : rawPhone;

    // 4. Check if contact already exists by phone
    let contact = await sql`
      SELECT * FROM contacts
      WHERE workspace_id = ${wsId}
        AND (phone = ${rawPhone} OR phone = ${phoneE164})
      LIMIT 1
    `;

    let alreadyExisted = false;

    if (contact.length > 0) {
      alreadyExisted = true;
      console.log(`[caller-sync] Found existing contact ${contact[0].id} for ${rawPhone}`);
    } else {
      // Determine lead score based on outcome
      let leadScore = 30;
      if (lead.status === "demo_booked") leadScore = 70;
      else if (lead.status === "callback_requested") leadScore = 40;

      // Extract first name from contact_name or business_name
      const firstName =
        lead.contact_name?.split(" ")[0] ||
        lead.business_name ||
        null;
      const lastName =
        lead.contact_name && lead.contact_name.includes(" ")
          ? lead.contact_name.split(" ").slice(1).join(" ")
          : null;

      contact = await sql`
        INSERT INTO contacts (
          workspace_id, first_name, last_name, phone, email,
          source, source_detail, lead_score
        ) VALUES (
          ${wsId},
          ${firstName},
          ${lastName},
          ${phoneE164},
          ${lead.email || null},
          'ai_caller',
          'cold_call',
          ${leadScore}
        )
        RETURNING *
      `;
      console.log(`[caller-sync] Created contact ${contact[0].id} for ${rawPhone}`);
    }

    const contactId = contact[0].id as string;

    // 5. Create a deal in the first pipeline stage (skip if contact already had one)
    let dealId: string | null = null;
    if (!alreadyExisted) {
      const firstStage = await sql`
        SELECT id FROM pipeline_stages
        WHERE workspace_id = ${wsId}
        ORDER BY position ASC LIMIT 1
      `;
      if (firstStage.length > 0) {
        const title = `${lead.business_name || lead.contact_name || "Unknown"} — AI Caller`;
        const deal = await sql`
          INSERT INTO deals (workspace_id, contact_id, stage_id, title, value)
          VALUES (${wsId}, ${contactId}, ${firstStage[0].id}, ${title}, 500)
          RETURNING id
        `;
        dealId = deal[0].id as string;
        console.log(`[caller-sync] Created deal ${dealId}`);
      }
    }

    // 6. Find or create conversation
    let conversation = await sql`
      SELECT * FROM conversations
      WHERE workspace_id = ${wsId} AND contact_id = ${contactId} AND channel = 'sms'
      LIMIT 1
    `;
    if (conversation.length === 0) {
      conversation = await sql`
        INSERT INTO conversations (workspace_id, contact_id, channel, status, ai_enabled)
        VALUES (${wsId}, ${contactId}, 'sms', 'open', TRUE)
        RETURNING *
      `;
      console.log(`[caller-sync] Created conversation ${conversation[0].id}`);
    }

    const conversationId = conversation[0].id as string;

    // 7. Store CRM contact_id back on the caller_lead
    await sql`
      UPDATE caller_leads SET crm_contact_id = ${contactId} WHERE id = ${leadId}
    `;

    console.log(`[caller-sync] Lead ${leadId} synced — contact=${contactId}, deal=${dealId}, conv=${conversationId}`);

    return { contactId, dealId, conversationId, alreadyExisted };
  } catch (err) {
    console.error("[caller-sync] Error syncing lead to CRM:", err);
    return null;
  }
}
