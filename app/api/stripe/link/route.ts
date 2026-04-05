import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/stripe/link — link a Stripe checkout session to the current Clerk user
// Called after signup when user has a session_id from Stripe checkout
export async function POST(req: Request) {
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
      WHERE org_id = ${userId} AND (status = 'active' OR status = 'trialing')
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
