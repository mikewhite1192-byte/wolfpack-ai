import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { processWeeklyPosts, getGbpToken, createPost } from "@/lib/gbp";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/gbp/posts — list posts or trigger weekly post cron
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");
    const process_flag = searchParams.get("process");

    if (process_flag === "true") {
      const result = await processWeeklyPosts();
      return NextResponse.json(result);
    }

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId required" }, { status: 400 });
    }

    const posts = await sql`
      SELECT * FROM gbp_posts WHERE connection_id = ${connectionId}
      ORDER BY posted_at DESC LIMIT 30
    `;

    return NextResponse.json({ posts });
  } catch (err) {
    console.error("[gbp-posts] Error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST /api/gbp/posts — create a manual post
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { connectionId, summary, topicType, imageUrl, ctaType, ctaUrl } = body;

    if (!connectionId || !summary) {
      return NextResponse.json({ error: "connectionId and summary required" }, { status: 400 });
    }

    const conn = await sql`SELECT * FROM gbp_connections WHERE id = ${connectionId} AND connected = TRUE`;
    if (conn.length === 0) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    const token = await getGbpToken(connectionId);
    if (!token) return NextResponse.json({ error: "Token refresh failed" }, { status: 400 });

    const accountId = (conn[0].account_id as string).replace("accounts/", "");
    const locationId = (conn[0].location_id as string).replace("locations/", "");

    const result = await createPost(token, accountId, locationId, {
      summary,
      topicType: topicType || "STANDARD",
      imageUrl,
      ctaType,
      ctaUrl,
    });

    await sql`
      INSERT INTO gbp_posts (connection_id, google_post_id, post_type, summary, cta_type, cta_url, image_url, status)
      VALUES (${connectionId}, ${result.name || null}, ${topicType || "STANDARD"}, ${summary}, ${ctaType || null}, ${ctaUrl || null}, ${imageUrl || null}, 'published')
    `;

    return NextResponse.json({ success: true, post: result });
  } catch (err) {
    console.error("[gbp-posts] Create error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
