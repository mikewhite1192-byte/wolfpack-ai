// POST /api/stripe/portal — create a Stripe billing portal session
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const sql = neon(process.env.DATABASE_URL!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subs = await sql`
    SELECT stripe_customer_id FROM subscriptions
    WHERE org_id = ${userId}
    LIMIT 1
  `;

  if (subs.length === 0 || !subs[0].stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subs[0].stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings`,
  });

  return NextResponse.json({ url: session.url });
}
