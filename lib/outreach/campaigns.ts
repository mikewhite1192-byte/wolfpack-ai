import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface Campaign {
  id: string;
  name: string;
  niche: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithDetails extends Campaign {
  senders: { id: string; email: string; display_name: string }[];
  templates: { step: number; subject: string; body: string }[];
  contactCount: number;
  activeCount: number;
}

export interface CampaignTemplate {
  step: number;
  subject: string;
  body: string;
}

// ─── CAMPAIGN CRUD ───────────────────────────────────────────────────────────

export async function createCampaign(params: {
  name: string;
  niche?: string;
  enabled?: boolean;
}): Promise<string> {
  const result = await sql`
    INSERT INTO campaigns (name, niche, enabled)
    VALUES (${params.name}, ${params.niche || null}, ${params.enabled ?? true})
    RETURNING id
  `;
  return result[0].id as string;
}

export async function updateCampaign(id: string, params: {
  name?: string;
  niche?: string;
  enabled?: boolean;
}) {
  if (params.name !== undefined) {
    await sql`UPDATE campaigns SET name = ${params.name}, updated_at = NOW() WHERE id = ${id}`;
  }
  if (params.niche !== undefined) {
    await sql`UPDATE campaigns SET niche = ${params.niche}, updated_at = NOW() WHERE id = ${id}`;
  }
  if (params.enabled !== undefined) {
    await sql`UPDATE campaigns SET enabled = ${params.enabled}, updated_at = NOW() WHERE id = ${id}`;
  }
}

export async function deleteCampaign(id: string) {
  // Unassign contacts first (don't delete them)
  await sql`UPDATE outreach_contacts SET campaign_id = NULL WHERE campaign_id = ${id}`;
  await sql`UPDATE scraper_config SET campaign_id = NULL WHERE campaign_id = ${id}`;
  await sql`DELETE FROM campaigns WHERE id = ${id}`;
}

export async function getCampaigns(): Promise<Campaign[]> {
  return await sql`SELECT * FROM campaigns ORDER BY created_at ASC` as unknown as Campaign[];
}

export async function getEnabledCampaigns(): Promise<Campaign[]> {
  return await sql`SELECT * FROM campaigns WHERE enabled = TRUE ORDER BY created_at ASC` as unknown as Campaign[];
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const rows = await sql`SELECT * FROM campaigns WHERE id = ${id} LIMIT 1`;
  return rows.length > 0 ? rows[0] as unknown as Campaign : null;
}

// ─── CAMPAIGN DETAILS (with senders, templates, stats) ──────────────────────

export async function getCampaignWithDetails(id: string): Promise<CampaignWithDetails | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  const senders = await getCampaignSenders(id);
  const templates = await getCampaignTemplates(id);
  const stats = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE sequence_status = 'active') as active
    FROM outreach_contacts WHERE campaign_id = ${id}
  `;

  return {
    ...campaign,
    senders,
    templates,
    contactCount: parseInt(stats[0].total as string || "0"),
    activeCount: parseInt(stats[0].active as string || "0"),
  };
}

export async function getAllCampaignsWithDetails(): Promise<CampaignWithDetails[]> {
  const campaigns = await getCampaigns();
  const detailed: CampaignWithDetails[] = [];

  for (const c of campaigns) {
    const full = await getCampaignWithDetails(c.id);
    if (full) detailed.push(full);
  }

  return detailed;
}

// ─── SENDER ASSIGNMENT ──────────────────────────────────────────────────────
// Each sender can only belong to ONE campaign (UNIQUE constraint on warmup_address_id)

export async function assignSenderToCampaign(campaignId: string, warmupAddressId: string) {
  // Remove from any other campaign first (enforce 1:1)
  await sql`DELETE FROM campaign_senders WHERE warmup_address_id = ${warmupAddressId}`;
  await sql`
    INSERT INTO campaign_senders (campaign_id, warmup_address_id)
    VALUES (${campaignId}, ${warmupAddressId})
    ON CONFLICT (campaign_id, warmup_address_id) DO NOTHING
  `;
}

export async function removeSenderFromCampaign(campaignId: string, warmupAddressId: string) {
  await sql`
    DELETE FROM campaign_senders
    WHERE campaign_id = ${campaignId} AND warmup_address_id = ${warmupAddressId}
  `;
}

export async function getCampaignSenders(campaignId: string): Promise<{ id: string; email: string; display_name: string }[]> {
  return await sql`
    SELECT w.id, w.email, w.display_name
    FROM campaign_senders cs
    JOIN warmup_addresses w ON w.id = cs.warmup_address_id
    WHERE cs.campaign_id = ${campaignId}
    ORDER BY w.email ASC
  ` as unknown as { id: string; email: string; display_name: string }[];
}

// Get the campaign a sender is assigned to (if any)
export async function getSenderCampaign(warmupAddressEmail: string): Promise<string | null> {
  const rows = await sql`
    SELECT cs.campaign_id FROM campaign_senders cs
    JOIN warmup_addresses w ON w.id = cs.warmup_address_id
    WHERE w.email = ${warmupAddressEmail}
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0].campaign_id as string : null;
}

// Get sender emails for a campaign
export async function getCampaignSenderEmails(campaignId: string): Promise<string[]> {
  const senders = await getCampaignSenders(campaignId);
  return senders.map(s => s.email);
}

// ─── CAMPAIGN TEMPLATES ─────────────────────────────────────────────────────

export async function setCampaignTemplate(campaignId: string, step: number, subject: string, body: string) {
  await sql`
    INSERT INTO campaign_templates (campaign_id, step, subject, body)
    VALUES (${campaignId}, ${step}, ${subject}, ${body})
    ON CONFLICT (campaign_id, step) DO UPDATE SET
      subject = ${subject},
      body = ${body}
  `;
}

export async function setCampaignTemplates(campaignId: string, templates: CampaignTemplate[]) {
  for (const t of templates) {
    await setCampaignTemplate(campaignId, t.step, t.subject, t.body);
  }
}

export async function getCampaignTemplates(campaignId: string): Promise<CampaignTemplate[]> {
  return await sql`
    SELECT step, subject, body FROM campaign_templates
    WHERE campaign_id = ${campaignId}
    ORDER BY step ASC
  ` as unknown as CampaignTemplate[];
}

// Get template for a specific step in a campaign (with variable substitution)
export async function getCampaignTemplate(
  campaignId: string,
  step: number,
  contact: Record<string, unknown>,
): Promise<{ subject: string; body: string } | null> {
  const rows = await sql`
    SELECT subject, body FROM campaign_templates
    WHERE campaign_id = ${campaignId} AND step = ${step}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  let { subject, body } = rows[0] as { subject: string; body: string };

  // Variable substitution — rotate intros when no real first name
  const INTROS = ["Hey there", "Hi", "Hey", "Quick question"];
  const contactId = (contact.id as string) || "";
  let hash = 0;
  for (let i = 0; i < contactId.length; i++) { hash = ((hash << 5) - hash) + contactId.charCodeAt(i); hash |= 0; }
  const firstName = (contact.first_name as string) || INTROS[Math.abs(hash) % INTROS.length];
  const vars: Record<string, string> = {
    "{{firstName}}": firstName,
    "{{lastName}}": (contact.last_name as string) || "",
    "{{company}}": (contact.company as string) || "your company",
    "{{state}}": (contact.state as string) || "",
    "{{niche}}": (contact.niche as string) || "",
  };

  for (const [key, val] of Object.entries(vars)) {
    subject = subject.replaceAll(key, val);
    body = body.replaceAll(key, val);
  }

  return { subject, body };
}

// ─── LINK SCRAPER TO CAMPAIGN ───────────────────────────────────────────────

export async function linkScraperToCampaign(scraperConfigId: string, campaignId: string) {
  await sql`UPDATE scraper_config SET campaign_id = ${campaignId}, updated_at = NOW() WHERE id = ${scraperConfigId}`;
}

export async function getScraperCampaignId(scraperConfigId: string): Promise<string | null> {
  const rows = await sql`SELECT campaign_id FROM scraper_config WHERE id = ${scraperConfigId} LIMIT 1`;
  return rows.length > 0 ? rows[0].campaign_id as string | null : null;
}
