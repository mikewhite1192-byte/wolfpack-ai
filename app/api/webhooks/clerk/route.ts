// Handles Clerk webhooks: user.deleted → cancel Stripe subscription
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";

const sql = neon(process.env.DATABASE_URL!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "No webhook secret" }, { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();

  let event: { type: string; data: { id: string; organization_id?: string } };
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // When a user or org is deleted, cancel their Stripe subscription
  if (event.type === "user.deleted" || event.type === "organization.deleted") {
    const orgId = event.data.organization_id || event.data.id;
    try {
      const subs = await sql`
        SELECT stripe_subscription_id FROM subscriptions
        WHERE org_id = ${orgId} AND status IN ('active', 'trialing')
      `;
      for (const sub of subs) {
        if (sub.stripe_subscription_id) {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        }
      }
      await sql`
        UPDATE subscriptions SET status = 'canceled'
        WHERE org_id = ${orgId}
      `;
    } catch (err) {
      console.error("Failed to cancel Stripe on user/org delete:", err);
    }
    return NextResponse.json({ ok: true, action: "subscriptions_cancelled" });
  }

  return NextResponse.json({ ok: true });
}
