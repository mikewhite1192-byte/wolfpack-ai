import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/stripe/link — link a Stripe checkout session to the current Clerk user
// Called after signup when user has a session_id from Stripe checkout
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "session_id required" }, { status: 400 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.payment_status !== "paid") {
      return NextResponse.json({ error: "Invalid or unpaid session" }, { status: 400 });
    }

    const customerId = session.customer as string;
    const plan = session.metadata?.plan || "pro";
    const customerEmail = session.customer_details?.email;

    // Link subscription to this Clerk user
    await sql`
      UPDATE subscriptions
      SET org_id = ${userId}
      WHERE stripe_customer_id = ${customerId}
    `;

    // Also update the workspace org_id if it was created with the customer ID
    await sql`
      UPDATE workspaces
      SET org_id = ${userId}
      WHERE org_id = ${customerId} AND status = 'active'
    `;

    // ── Activate affiliate referral if this user came through a ref link ──
    const refCode = req.cookies.get("wp_ref")?.value;
    if (refCode) {
      try {
        // Look up the affiliate
        const affRows = await sql`
          SELECT id FROM affiliates WHERE code = ${refCode} AND status = 'active' LIMIT 1
        `;
        if (affRows.length > 0) {
          const affiliateId = affRows[0].id;
          const monthlyValue = plan === "gbp" ? 49 : 97; // CRM default, GBP if specified
          const commission = plan === "gbp" ? 10 : 20;

          // Don't double-insert
          const existingRef = await sql`
            SELECT id FROM referrals WHERE affiliate_id = ${affiliateId} AND org_id = ${userId} LIMIT 1
          `;
          if (existingRef.length === 0) {
            await sql`
              INSERT INTO referrals (affiliate_id, org_id, status, monthly_value, commission)
              VALUES (${affiliateId}, ${userId}, 'active', ${monthlyValue}, ${commission})
            `;
            console.log(`[stripe/link] Created referral: affiliate=${refCode}, user=${userId}, plan=${plan}`);
          }
        }
      } catch (err) {
        console.error("[stripe/link] Referral tracking error:", err);
      }
    }

    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    console.error("[stripe/link] Error:", e);
    return NextResponse.json({ error: "Failed to link subscription" }, { status: 500 });
  }
}

// GET /api/stripe/link — check if current user has an active subscription
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ active: false });

    const sub = await sql`
      SELECT plan, status FROM subscriptions
      WHERE org_id = ${userId} AND (status = 'active' OR status = 'trialing' OR status = 'free')
      LIMIT 1
    `;

    if (sub.length > 0) {
      return NextResponse.json({ active: true, plan: sub[0].plan, status: sub[0].status });
    }

    return NextResponse.json({ active: false });
  } catch {
    return NextResponse.json({ active: false });
  }
}
