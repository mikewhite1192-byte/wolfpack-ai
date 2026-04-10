import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const OWNER_SECRET = process.env.OWNER_DASHBOARD_SECRET || process.env.CRON_SECRET;

// POST /api/owner/grant-free-access
// Body: { email: string, plan?: string }
// Auth: Bearer OWNER_DASHBOARD_SECRET
//
// Grants a free subscription to the user with the given email.
// The user must have already signed up via Clerk.
// Creates a subscriptions row with status='free', which /api/stripe/link
// GET now treats as active — unlocking full CRM access.
export async function POST(req: Request) {
  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    const providedToken = authHeader?.replace("Bearer ", "");
    if (!OWNER_SECRET || providedToken !== OWNER_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, plan } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    // Look up Clerk user by email
    const client = await clerkClient();
    const users = await client.users.getUserList({
      emailAddress: [email.toLowerCase()],
    });

    if (users.data.length === 0) {
      return NextResponse.json(
        { error: `No Clerk user found for ${email}. Ask them to sign up at /sign-up first.` },
        { status: 404 }
      );
    }

    const user = users.data[0];
    const userId = user.id;
    const planName = plan || "free";

    // Upsert: if a subscription row already exists for this user, update it;
    // otherwise insert a new one.
    const existing = await sql`
      SELECT id FROM subscriptions WHERE org_id = ${userId} LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE subscriptions
        SET plan = ${planName}, status = 'free'
        WHERE org_id = ${userId}
      `;
    } else {
      await sql`
        INSERT INTO subscriptions (org_id, plan, status)
        VALUES (${userId}, ${planName}, 'free')
      `;
    }

    return NextResponse.json({
      success: true,
      email,
      userId,
      plan: planName,
      status: "free",
    });
  } catch (err) {
    console.error("[owner/grant-free-access] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

// DELETE /api/owner/grant-free-access
// Body: { email: string }
// Revokes free access by deleting the subscription row.
export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const providedToken = authHeader?.replace("Bearer ", "");
    if (!OWNER_SECRET || providedToken !== OWNER_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const client = await clerkClient();
    const users = await client.users.getUserList({
      emailAddress: [email.toLowerCase()],
    });
    if (users.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = users.data[0].id;

    await sql`
      DELETE FROM subscriptions
      WHERE org_id = ${userId} AND status = 'free'
    `;

    return NextResponse.json({ success: true, email, userId });
  } catch (err) {
    console.error("[owner/grant-free-access] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
