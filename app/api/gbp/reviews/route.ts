import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { processReviews, processReviewNudges } from "@/lib/gbp";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/gbp/reviews — list stored reviews or trigger review check
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");
    const process_flag = searchParams.get("process");

    // Cron trigger — process all reviews
    if (process_flag === "true") {
      const result = await processReviews();
      return NextResponse.json(result);
    }

    // Cron trigger — process review nudges
    const nudge_flag = searchParams.get("nudge");
    if (nudge_flag === "true") {
      const result = await processReviewNudges();
      return NextResponse.json(result);
    }

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId required" }, { status: 400 });
    }

    const reviews = await sql`
      SELECT * FROM gbp_reviews WHERE connection_id = ${connectionId}
      ORDER BY review_time DESC LIMIT 50
    `;

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error("[gbp-reviews] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/gbp/reviews — manual actions (approve/edit reply)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, reviewId, replyText } = body;

    if (action === "reply") {
      // Get review and connection info
      const reviews = await sql`
        SELECT r.*, c.account_id, c.location_id
        FROM gbp_reviews r
        JOIN gbp_connections c ON c.id = r.connection_id
        WHERE r.id = ${reviewId}
      `;
      if (reviews.length === 0) return NextResponse.json({ error: "Review not found" }, { status: 404 });

      const review = reviews[0];
      const { getGbpToken, replyToReview } = await import("@/lib/gbp");
      const token = await getGbpToken(review.connection_id as string);
      if (!token) return NextResponse.json({ error: "Not connected" }, { status: 400 });

      const accountId = (review.account_id as string).replace("accounts/", "");
      const locationId = (review.location_id as string).replace("locations/", "");

      await replyToReview(token, accountId, locationId, review.google_review_id as string, replyText);

      await sql`
        UPDATE gbp_reviews SET reply_text = ${replyText}, reply_status = 'replied', replied_at = NOW()
        WHERE id = ${reviewId}
      `;

      return NextResponse.json({ success: true });
    }

    if (action === "skip") {
      await sql`UPDATE gbp_reviews SET reply_status = 'skipped' WHERE id = ${reviewId}`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[gbp-reviews] Action error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
