import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";

const sql = neon(process.env.DATABASE_URL!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const lowerEmail = email.toLowerCase();
    const affiliates = await sql`
      SELECT id, name, email, stripe_account_id FROM affiliates WHERE email = ${lowerEmail} LIMIT 1
    `;

    if (affiliates.length === 0) {
      return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }

    const affiliate = affiliates[0];
    let accountId = affiliate.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: affiliate.email as string,
        capabilities: { transfers: { requested: true } },
        metadata: { affiliate_id: affiliate.id as string, affiliate_name: affiliate.name as string },
      });
      accountId = account.id;
      await sql`UPDATE affiliates SET stripe_account_id = ${accountId} WHERE id = ${affiliate.id}`;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thewolfpack.ai";
    const accountLink = await stripe.accountLinks.create({
      account: accountId as string,
      refresh_url: `${baseUrl}/affiliates/dashboard?stripe=refresh`,
      return_url: `${baseUrl}/affiliates/dashboard?stripe=complete`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("Stripe Connect error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
