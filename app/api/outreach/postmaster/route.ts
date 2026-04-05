import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { refreshAccessToken } from "@/lib/gmail";

const sql = neon(process.env.DATABASE_URL!);

const POSTMASTER_BASE = "https://gmailpostmastertools.googleapis.com/v1beta1";

interface DomainTrafficStats {
  date: string;
  spamRate?: number;
  ipReputations?: Array<{ reputation: string; ipCount: number; sampleIps?: string[] }>;
  domainReputation?: string;
  userReportedSpamRatio?: number;
  spfSuccessRatio?: number;
  dkimSuccessRatio?: number;
  dmarcSuccessRatio?: number;
  outboundEncryptionRatio?: number;
  inboundEncryptionRatio?: number;
  deliveryErrors?: Array<{ errorType: string; errorRatio: number }>;
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7d";

    // Get workspace with Gmail tokens
    const ws = await sql`SELECT id, gmail_refresh_token, gmail_connected FROM workspaces WHERE clerk_user_id = ${userId} LIMIT 1`;
    if (!ws[0]?.gmail_connected || !ws[0]?.gmail_refresh_token) {
      return NextResponse.json({ error: "Gmail not connected. Reconnect Gmail to use Postmaster Tools.", needsReconnect: true });
    }

    // Refresh token
    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(ws[0].gmail_refresh_token as string);
    } catch {
      return NextResponse.json({ error: "Failed to refresh Google token. Reconnect Gmail.", needsReconnect: true });
    }

    // List domains
    const domainsRes = await fetch(`${POSTMASTER_BASE}/domains`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!domainsRes.ok) {
      const err = await domainsRes.json().catch(() => ({}));
      if (domainsRes.status === 403) {
        return NextResponse.json({
          error: "Postmaster API access denied. Make sure:\n1. Gmail Postmaster Tools API is enabled in Google Cloud Console\n2. You've reconnected Gmail to grant the new permission\n3. Your sending domains are verified in Google Postmaster Tools",
          needsReconnect: true,
        });
      }
      return NextResponse.json({ error: `Postmaster API error: ${JSON.stringify(err)}` }, { status: domainsRes.status });
    }

    const domainsData = await domainsRes.json();
    const domains = domainsData.domains || [];

    if (domains.length === 0) {
      return NextResponse.json({
        domains: [],
        message: "No domains found in Postmaster Tools. Add and verify your sending domains at https://postmaster.google.com",
      });
    }

    // Calculate date range
    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range] || 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch traffic stats for each domain
    const domainStats: Array<{
      domain: string;
      status: string;
      stats: DomainTrafficStats[];
      summary: {
        avgSpamRate: number | null;
        avgSpfSuccess: number | null;
        avgDkimSuccess: number | null;
        avgDmarcSuccess: number | null;
        domainReputation: string | null;
        avgEncryption: number | null;
      };
    }> = [];

    for (const domain of domains) {
      const domainName = domain.name?.replace("domains/", "") || "";
      const permission = domain.permission || "NONE";

      if (permission === "NONE") {
        domainStats.push({
          domain: domainName,
          status: "not_verified",
          stats: [],
          summary: { avgSpamRate: null, avgSpfSuccess: null, avgDkimSuccess: null, avgDmarcSuccess: null, domainReputation: null, avgEncryption: null },
        });
        continue;
      }

      // Fetch daily stats
      const statsRes = await fetch(
        `${POSTMASTER_BASE}/${domain.name}/trafficStats?startDate.year=${startDate.getFullYear()}&startDate.month=${startDate.getMonth() + 1}&startDate.day=${startDate.getDate()}&endDate.year=${endDate.getFullYear()}&endDate.month=${endDate.getMonth() + 1}&endDate.day=${endDate.getDate()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      let stats: DomainTrafficStats[] = [];

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        stats = statsData.trafficStats || [];
      }

      // Calculate averages
      const spamRates = stats.filter(s => s.spamRate !== undefined).map(s => s.spamRate!);
      const spfRates = stats.filter(s => s.spfSuccessRatio !== undefined).map(s => s.spfSuccessRatio!);
      const dkimRates = stats.filter(s => s.dkimSuccessRatio !== undefined).map(s => s.dkimSuccessRatio!);
      const dmarcRates = stats.filter(s => s.dmarcSuccessRatio !== undefined).map(s => s.dmarcSuccessRatio!);
      const encRates = stats.filter(s => s.outboundEncryptionRatio !== undefined).map(s => s.outboundEncryptionRatio!);
      const reputations = stats.filter(s => s.domainReputation).map(s => s.domainReputation!);

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

      domainStats.push({
        domain: domainName,
        status: "verified",
        stats: stats.map(s => ({
          date: `${s.date || ""}`,
          spamRate: s.spamRate,
          domainReputation: s.domainReputation,
          spfSuccessRatio: s.spfSuccessRatio,
          dkimSuccessRatio: s.dkimSuccessRatio,
          dmarcSuccessRatio: s.dmarcSuccessRatio,
          outboundEncryptionRatio: s.outboundEncryptionRatio,
          userReportedSpamRatio: s.userReportedSpamRatio,
          ipReputations: s.ipReputations,
          deliveryErrors: s.deliveryErrors,
        })),
        summary: {
          avgSpamRate: avg(spamRates),
          avgSpfSuccess: avg(spfRates),
          avgDkimSuccess: avg(dkimRates),
          avgDmarcSuccess: avg(dmarcRates),
          domainReputation: reputations[reputations.length - 1] || null,
          avgEncryption: avg(encRates),
        },
      });
    }

    return NextResponse.json({ domains: domainStats, range });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
