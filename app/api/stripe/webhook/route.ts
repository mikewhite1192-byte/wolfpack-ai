import { NextResponse } from "next/server";
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const plan = session.metadata?.plan || "pro";
        const customerEmail = session.customer_details?.email;

        console.log(`[stripe webhook] Checkout completed: ${customerEmail}, plan: ${plan}, sub: ${subscriptionId}`);

        // Get subscription details for period dates
        let periodStart: string | null = null;
        let periodEnd: string | null = null;
        if (subscriptionId) {
          try {
            const subData = await stripe.subscriptions.retrieve(subscriptionId);
            const raw = JSON.parse(JSON.stringify(subData));
            periodStart = raw.current_period_start ? new Date(raw.current_period_start * 1000).toISOString() : null;
            periodEnd = raw.current_period_end ? new Date(raw.current_period_end * 1000).toISOString() : null;
          } catch {}
        }

        // Upsert subscription record
        const existing = await sql`SELECT id FROM subscriptions WHERE stripe_customer_id = ${customerId} LIMIT 1`;
        if (existing.length > 0) {
          await sql`
            UPDATE subscriptions SET
              stripe_subscription_id = ${subscriptionId},
              plan = ${plan},
              status = 'active',
              current_period_start = ${periodStart},
              current_period_end = ${periodEnd}
            WHERE stripe_customer_id = ${customerId}
          `;
        } else {
          await sql`
            INSERT INTO subscriptions (org_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end)
            VALUES (${customerId}, ${customerId}, ${subscriptionId}, ${plan}, 'active', ${periodStart}, ${periodEnd})
          `;
        }

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const raw = JSON.parse(JSON.stringify(sub));
        const status = sub.status === "active" || sub.status === "trialing" ? "active" : raw.cancel_at_period_end ? "canceling" : sub.status;

        const updStart = raw.current_period_start ? new Date(raw.current_period_start * 1000).toISOString() : null;
        const updEnd = raw.current_period_end ? new Date(raw.current_period_end * 1000).toISOString() : null;

        await sql`
          UPDATE subscriptions SET
            status = ${status},
            current_period_start = ${updStart},
            current_period_end = ${updEnd}
          WHERE stripe_subscription_id = ${sub.id}
        `;
        console.log(`[stripe webhook] Subscription updated: ${sub.id}, status: ${status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // Get the org_id before marking canceled so we can deactivate referrals
        const canceledRows = await sql`
          UPDATE subscriptions SET status = 'canceled' WHERE stripe_subscription_id = ${sub.id} RETURNING org_id
        `;
        if (canceledRows.length > 0) {
          const orgId = canceledRows[0].org_id;
          await sql`UPDATE referrals SET status = 'churned' WHERE org_id = ${orgId} AND status = 'active'`;
        }
        console.log(`[stripe webhook] Subscription canceled: ${sub.id}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoiceRaw = JSON.parse(JSON.stringify(event.data.object));
        const subId = invoiceRaw.subscription as string;
        if (subId) {
          await sql`UPDATE subscriptions SET status = 'past_due' WHERE stripe_subscription_id = ${subId}`;
          console.log(`[stripe webhook] Payment failed: ${subId}`);
        }
        break;
      }

      default:
        // Unhandled event type — that's fine
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
