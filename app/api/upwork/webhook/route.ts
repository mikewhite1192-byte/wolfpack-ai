import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { scoreAndDraftProposal } from "@/lib/upwork/scorer";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/upwork/webhook — receives new job notifications from Vollna
export async function POST(req: Request) {
  try {
    // Verify auth token
    const authHeader = req.headers.get("authorization");
    const token = process.env.CALLER_API_TOKEN;
    if (token && authHeader !== `Bearer ${token}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("[upwork-webhook] Received:", JSON.stringify(body).slice(0, 500));

    // Vollna can send single job or array of jobs
    const jobs = Array.isArray(body) ? body : (body.jobs || body.projects || body.data || [body]);

    let newCount = 0;
    const newJobIds: string[] = [];

    for (const job of jobs) {
      if (!job) continue;

      // Extract fields — Vollna's format may vary, handle multiple field names
      const title = job.title || job.name || "";
      const description = (job.description || job.snippet || job.details || "").slice(0, 2000);
      const jobUrl = job.url || job.link || job.job_url || "";
      const budget = job.budget || job.amount || job.price || null;
      const jobType = job.job_type || job.type || job.contractType || null;
      const skills = Array.isArray(job.skills)
        ? job.skills.map((s: unknown) => typeof s === "string" ? s : (s as Record<string, string>)?.name || "").filter(Boolean)
        : [];
      const clientCountry = job.client_country || job.country || (job.client as Record<string, unknown>)?.country || null;
      const clientRating = job.client_rating || (job.client as Record<string, unknown>)?.rating || null;
      const clientHireRate = job.client_hire_rate || (job.client as Record<string, unknown>)?.hireRate || null;
      const paymentVerified = job.payment_verified || job.client_payment_verified || (job.client as Record<string, unknown>)?.paymentVerified || false;
      const postedAt = job.posted_at || job.publishedAt || job.created_at || job.date || null;

      // Extract upwork ID from URL
      const idMatch = (jobUrl as string).match(/~([a-zA-Z0-9]+)/);
      const upworkId = idMatch ? idMatch[1] : (job.id || job.upwork_id || `vollna-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

      if (!title) continue;

      try {
        const result = await sql`
          INSERT INTO upwork_jobs (
            upwork_id, title, description, budget, job_type, skills,
            client_country, client_rating, client_hire_rate, client_payment_verified,
            job_url, posted_at, status
          ) VALUES (
            ${upworkId}, ${title}, ${description}, ${typeof budget === "object" ? JSON.stringify(budget) : String(budget || "")},
            ${jobType}, ${skills}, ${clientCountry as string},
            ${clientRating ? parseFloat(String(clientRating)) : null},
            ${clientHireRate ? parseFloat(String(clientHireRate)) : null},
            ${!!paymentVerified},
            ${jobUrl}, ${postedAt ? new Date(postedAt as string).toISOString() : null}, 'new'
          )
          ON CONFLICT (upwork_id) DO NOTHING
          RETURNING id
        `;
        if (result.length > 0) {
          newCount++;
          newJobIds.push(result[0].id as string);
        }
      } catch (err) {
        console.error(`[upwork-webhook] Insert error:`, err);
      }
    }

    // Score new jobs in background
    for (const jobId of newJobIds) {
      try {
        await scoreAndDraftProposal(jobId);
      } catch (err) {
        console.error(`[upwork-webhook] Scoring error for ${jobId}:`, err);
      }
    }

    console.log(`[upwork-webhook] Processed ${jobs.length} jobs, ${newCount} new, ${newJobIds.length} scored`);
    return NextResponse.json({ success: true, received: jobs.length, new: newCount, scored: newJobIds.length });
  } catch (err) {
    console.error("[upwork-webhook] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
