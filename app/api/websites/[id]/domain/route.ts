import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";

const sql = neon(process.env.DATABASE_URL!);

// POST /api/websites/[id]/domain — add custom domain via Vercel API
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspace = await getOrCreateWorkspace();
    const body = await req.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 });
    }

    // Verify page exists
    const pages = await sql`
      SELECT * FROM landing_pages
      WHERE id = ${id} AND workspace_id = ${workspace.id}
    `;
    if (pages.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;

    if (!vercelToken || !vercelProjectId) {
      return NextResponse.json(
        { error: "Vercel integration not configured" },
        { status: 500 }
      );
    }

    // Add domain to Vercel project
    const vercelRes = await fetch(
      `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: domain }),
      }
    );

    const vercelData = await vercelRes.json();

    if (!vercelRes.ok) {
      return NextResponse.json(
        { error: vercelData.error?.message || "Failed to add domain to Vercel" },
        { status: vercelRes.status }
      );
    }

    // Save custom domain to database
    await sql`
      UPDATE landing_pages SET
        custom_domain = ${domain},
        updated_at = now()
      WHERE id = ${id} AND workspace_id = ${workspace.id}
    `;

    // Return DNS instructions
    const dnsInstructions = [];

    if (vercelData.apexName === domain) {
      // Apex domain — needs A record
      dnsInstructions.push({
        type: "A",
        name: "@",
        value: "76.76.21.21",
        ttl: "Auto",
      });
    } else {
      // Subdomain — needs CNAME
      dnsInstructions.push({
        type: "CNAME",
        name: domain.replace(`.${vercelData.apexName}`, ""),
        value: "cname.vercel-dns.com",
        ttl: "Auto",
      });
    }

    // TXT verification if needed
    if (vercelData.verification) {
      for (const v of vercelData.verification) {
        dnsInstructions.push({
          type: v.type,
          name: v.domain,
          value: v.value,
          ttl: "Auto",
        });
      }
    }

    return NextResponse.json({
      domain,
      verified: vercelData.verified || false,
      dns: dnsInstructions,
      message: vercelData.verified
        ? "Domain added and verified!"
        : "Domain added. Configure these DNS records, then it will verify automatically.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
