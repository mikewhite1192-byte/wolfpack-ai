import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  gbp: process.env.STRIPE_GBP_PRICE_ID,
};

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { plan } = await req.json();
  const priceId = PRICE_IDS[plan];

  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/sign-up?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/#pricing`,
    allow_promotion_codes: true,
    metadata: { plan },
  });

  return NextResponse.json({ url: session.url });
}
