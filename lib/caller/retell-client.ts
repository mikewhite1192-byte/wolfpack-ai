import Retell from "retell-sdk";

// ── Retell SDK client ────────────────────────────────────────────────
// Requires env vars:
//   RETELL_API_KEY      — Retell API key (starts with key_)
//   RETELL_AGENT_ID     — Retell agent ID (starts with agent_)
//   RETELL_FROM_NUMBER  — E.164 phone number owned by Retell (+1...)

function getClient(): Retell {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    throw new Error("Retell not configured. Missing RETELL_API_KEY.");
  }
  return new Retell({ apiKey });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Retell not configured. Missing ${name}.`);
  return value;
}

// ── Normalize a phone number to E.164 ───────────────────────────────
// Accepts formats like "(248) 609-1109", "248.609.1109", "12486091109",
// "+12486091109". Returns "+1XXXXXXXXXX" for US numbers or null if the
// input doesn't look like a valid US phone number.
export function toE164US(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

// ── Start an outbound AI call to a lead ─────────────────────────────
export interface StartCallParams {
  toNumber: string;
  leadId: string;
  businessName?: string | null;
  contractorType?: string | null;
  city?: string | null;
  state?: string | null;
  firstName?: string | null;
}

export interface StartCallResult {
  callId: string;
  agentId: string;
}

export async function startOutboundCall(
  params: StartCallParams,
): Promise<StartCallResult> {
  const client = getClient();
  const agentId = requireEnv("RETELL_AGENT_ID");
  const fromNumber = requireEnv("RETELL_FROM_NUMBER");

  const toNumber = toE164US(params.toNumber);
  if (!toNumber) {
    throw new Error(`Invalid phone number for lead ${params.leadId}: ${params.toNumber}`);
  }

  // Dynamic variables are injected into the agent's system prompt at the
  // time of this call only — the agent's base prompt should reference them
  // like {{business_name}}, {{city}}, etc.
  const dynamicVars: Record<string, string> = {
    business_name: params.businessName || "your business",
    contractor_type: params.contractorType || "contractor",
    city: params.city || "your area",
    state: params.state || "",
    first_name: params.firstName || "there",
  };

  // Metadata is passed through to the webhook so we can correlate the
  // Retell call back to our lead when call_started / call_ended fires.
  const metadata = {
    lead_id: params.leadId,
    business_name: params.businessName || null,
    contractor_type: params.contractorType || null,
    city: params.city || null,
  };

  const response = await client.call.createPhoneCall({
    from_number: fromNumber,
    to_number: toNumber,
    override_agent_id: agentId,
    metadata,
    retell_llm_dynamic_variables: dynamicVars,
  });

  return {
    callId: response.call_id,
    agentId: response.agent_id,
  };
}
