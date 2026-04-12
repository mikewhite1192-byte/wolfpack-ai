import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// ── Webhook idempotency guard ────────────────────────────────────────
// Prevents duplicate processing of webhooks that may be retried by
// external services (Stripe, Retell, SES/SNS, Loop, etc.).
//
// Uses INSERT ON CONFLICT with a unique(provider, event_id) constraint.
// If the insert succeeds (returns a row), the event is new → process it.
// If the insert conflicts (returns 0 rows), it's a duplicate → skip.
//
// Usage in a webhook handler:
//   const isNew = await markWebhookProcessed("stripe", event.id);
//   if (!isNew) return NextResponse.json({ received: true, duplicate: true });
//   // ... process the event ...

export async function markWebhookProcessed(
  provider: string,
  eventId: string,
): Promise<boolean> {
  const inserted = await sql`
    INSERT INTO processed_webhooks (provider, event_id)
    VALUES (${provider}, ${eventId})
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING id
  `;
  return inserted.length > 0;
}
