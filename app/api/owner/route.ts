import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";

const sql = neon(process.env.DATABASE_URL!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const OWNER_SECRET = process.env.OWNER_DASHBOARD_SECRET || process.env.CRON_SECRET;

export async function GET(req: Request) {
  try {
    // Auth: require Bearer token or query param
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const tokenParam = searchParams.get("token");
    const providedToken = authHeader?.replace("Bearer ", "") || tokenParam;

    if (!OWNER_SECRET || providedToken !== OWNER_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ── Stripe Revenue & Subscription Data ──
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Get all active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.customer"],
    });

    // Get canceled (churned) subscriptions from last 30 days
    const canceledSubs = await stripe.subscriptions.list({
      status: "canceled",
      limit: 100,
      created: { gte: Math.floor(startOfLastMonth.getTime() / 1000) },
    });

    // Calculate MRR and plan breakdown
    let mrr = 0;
    let starterCount = 0;
    let proCount = 0;
    let agencyCount = 0;
    const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID;
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID;

    for (const sub of subscriptions.data) {
      const amount = sub.items.data.reduce((sum, item) => sum + (item.price.unit_amount || 0) * (item.quantity || 1), 0);
      mrr += amount;

      const priceId = sub.items.data[0]?.price.id;
      if (priceId === starterPriceId) starterCount++;
      else if (priceId === proPriceId) proCount++;
      else agencyCount++;
    }

    // MRR in dollars
    mrr = mrr / 100;

    // Get charges this month for actual revenue
    const charges = await stripe.charges.list({
      created: { gte: Math.floor(startOfMonth.getTime() / 1000) },
      limit: 100,
    });
    const revenueThisMonth = charges.data
      .filter(c => c.paid && !c.refunded)
      .reduce((sum, c) => sum + c.amount, 0) / 100;

    // Last month revenue
    const lastMonthCharges = await stripe.charges.list({
      created: {
        gte: Math.floor(startOfLastMonth.getTime() / 1000),
        lt: Math.floor(startOfMonth.getTime() / 1000),
      },
      limit: 100,
    });
    const revenueLastMonth = lastMonthCharges.data
      .filter(c => c.paid && !c.refunded)
      .reduce((sum, c) => sum + c.amount, 0) / 100;

    // Churn
    const churnedThisMonth = canceledSubs.data.filter(s => {
      const canceledAt = s.canceled_at ? new Date(s.canceled_at * 1000) : null;
      return canceledAt && canceledAt >= startOfMonth;
    }).length;

    const totalEverSubscribed = subscriptions.data.length + canceledSubs.data.length;
    const churnRate = totalEverSubscribed > 0
      ? ((churnedThisMonth / totalEverSubscribed) * 100)
      : 0;

    // ── Database Stats ──

    // Total workspaces
    const workspaceCount = await sql`SELECT COUNT(*) as count FROM workspaces WHERE status = 'active'`;

    // Total contacts across all workspaces
    const contactCount = await sql`SELECT COUNT(*) as count FROM contacts`;

    // Total conversations
    const conversationCount = await sql`SELECT COUNT(*) as count FROM conversations`;

    // Active conversations (last 7 days)
    const activeConvos = await sql`
      SELECT COUNT(*) as count FROM conversations
      WHERE last_message_at >= NOW() - INTERVAL '7 days' AND status = 'open'
    `;

    // Total messages sent by AI
    const aiMessages = await sql`SELECT COUNT(*) as count FROM messages WHERE sent_by = 'ai'`;

    // Total bookings
    const bookingCount = await sql`SELECT COUNT(*) as count FROM bookings`;

    // Bookings this month
    const bookingsThisMonth = await sql`
      SELECT COUNT(*) as count FROM bookings
      WHERE created_at >= ${startOfMonth.toISOString()}
    `;

    // Deals won
    const dealsWon = await sql`
      SELECT COUNT(*) as count, COALESCE(SUM(value::numeric), 0) as total_value
      FROM deals d
      JOIN pipeline_stages ps ON ps.id = d.stage_id
      WHERE ps.is_won = TRUE
    `;

    // Outreach stats
    const outreachStats = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE sequence_status = 'replied') as replied,
        COUNT(*) FILTER (WHERE sequence_status = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE converted = TRUE) as converted
      FROM outreach_contacts
    `;

    // Recent signups (new workspaces last 30 days)
    const recentSignups = await sql`
      SELECT COUNT(*) as count FROM workspaces
      WHERE created_at >= NOW() - INTERVAL '30 days' AND status = 'active'
    `;

    // ── Affiliate Stats ──
    const affiliateStats = await sql`
      SELECT
        COUNT(*) as total_affiliates,
        COALESCE(SUM(total_earned::numeric), 0) as total_earned,
        COALESCE(SUM(total_paid::numeric), 0) as total_paid
      FROM affiliates WHERE status = 'active'
    `;

    const activeReferrals = await sql`
      SELECT COUNT(*) as count FROM referrals WHERE status = 'active'
    `;

    return NextResponse.json({
      // Revenue
      mrr,
      revenueThisMonth,
      revenueLastMonth,
      revenueGrowth: revenueLastMonth > 0
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100)
        : 0,

      // Subscriptions
      totalSubscribers: subscriptions.data.length,
      starterCount,
      proCount,
      agencyCount,
      churnedThisMonth,
      churnRate,

      // Platform
      totalWorkspaces: parseInt(workspaceCount[0].count as string),
      totalContacts: parseInt(contactCount[0].count as string),
      totalConversations: parseInt(conversationCount[0].count as string),
      activeConversations: parseInt(activeConvos[0].count as string),
      totalAiMessages: parseInt(aiMessages[0].count as string),
      totalBookings: parseInt(bookingCount[0].count as string),
      bookingsThisMonth: parseInt(bookingsThisMonth[0].count as string),
      dealsWon: parseInt(dealsWon[0].count as string),
      dealValueWon: parseFloat(dealsWon[0].total_value as string),
      recentSignups: parseInt(recentSignups[0].count as string),

      // Outreach
      outreachTotal: parseInt(outreachStats[0].total as string),
      outreachReplied: parseInt(outreachStats[0].replied as string),
      outreachBounced: parseInt(outreachStats[0].bounced as string),
      outreachConverted: parseInt(outreachStats[0].converted as string),

      // Affiliates
      totalAffiliates: parseInt(affiliateStats[0].total_affiliates as string),
      affiliateEarned: parseFloat(affiliateStats[0].total_earned as string),
      affiliatePaid: parseFloat(affiliateStats[0].total_paid as string),
      activeReferrals: parseInt(activeReferrals[0].count as string),
    });
  } catch (err) {
    console.error("[owner] Dashboard error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
