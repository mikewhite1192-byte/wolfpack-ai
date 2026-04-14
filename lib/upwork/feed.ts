import { neon } from "@neondatabase/serverless";
import { sendMessage } from "@/lib/loop/client";

const sql = neon(process.env.DATABASE_URL!);

interface ParsedJob {
  upwork_id: string;
  title: string;
  description: string;
  budget: string | null;
  job_type: string | null;
  skills: string[];
  client_country: string | null;
  client_rating: number | null;
  client_hire_rate: number | null;
  client_payment_verified: boolean;
  job_url: string;
  posted_at: string | null;
}

// Convert search queries into Upwork search URLs
function buildSearchUrl(query: string, page: number = 1): string {
  const encoded = encodeURIComponent(query);
  return `https://www.upwork.com/nx/search/jobs/?q=${encoded}&sort=recency&per_page=20&page=${page}`;
}

// Parse search query from RSS-style URL or plain text
function parseSearchQuery(input: string): string {
  // If it's an old RSS URL, extract the query
  const rssMatch = input.match(/[?&]q=([^&]+)/);
  if (rssMatch) return decodeURIComponent(rssMatch[1].replace(/\+/g, " "));
  // Otherwise treat as a plain search query
  return input.trim();
}

// Scrape Upwork search results page
async function scrapeUpworkSearch(query: string): Promise<ParsedJob[]> {
  const url = buildSearchUrl(query);
  const jobs: ParsedJob[] = [];

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      console.error(`[upwork-feed] Search failed for "${query}": ${res.status}`);
      return jobs;
    }

    const html = await res.text();

    // Upwork embeds job data as JSON in the page (nextData or apollo state)
    // Try to extract the __NEXT_DATA__ JSON which contains all job listings
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const searchResults = findJobsInNextData(nextData);
        jobs.push(...searchResults);
        if (jobs.length > 0) {
          console.log(`[upwork-feed] Found ${jobs.length} jobs via NEXT_DATA for "${query}"`);
          return jobs;
        }
      } catch (err) {
        console.log(`[upwork-feed] NEXT_DATA parse failed, trying HTML extraction`);
      }
    }

    // Fallback: try to extract from Apollo state
    const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/);
    if (apolloMatch) {
      try {
        const apolloData = JSON.parse(apolloMatch[1]);
        const searchResults = findJobsInApolloState(apolloData);
        jobs.push(...searchResults);
        if (jobs.length > 0) {
          console.log(`[upwork-feed] Found ${jobs.length} jobs via Apollo for "${query}"`);
          return jobs;
        }
      } catch {
        console.log(`[upwork-feed] Apollo parse failed, trying regex extraction`);
      }
    }

    // Fallback: extract job links and titles from HTML with regex
    const jobLinkRegex = /href="(\/jobs\/[^"]*~[0-9a-zA-Z]+[^"]*)"/g;
    const titleRegex = /<h2[^>]*class="[^"]*job-tile-title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi;

    // Extract all job URLs
    const jobUrls = new Set<string>();
    let linkMatch;
    while ((linkMatch = jobLinkRegex.exec(html)) !== null) {
      const jobPath = linkMatch[1].split("?")[0]; // Remove query params
      jobUrls.add(`https://www.upwork.com${jobPath}`);
    }

    // Also try to find job data in JSON-LD or embedded scripts
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    for (const jm of jsonLdMatches) {
      try {
        const ld = JSON.parse(jm[1]);
        if (ld["@type"] === "JobPosting" || (Array.isArray(ld) && ld[0]?.["@type"] === "JobPosting")) {
          const postings = Array.isArray(ld) ? ld : [ld];
          for (const posting of postings) {
            const jobUrl = posting.url || "";
            const idMatch = jobUrl.match(/~([a-zA-Z0-9]+)/);
            if (idMatch) {
              jobs.push({
                upwork_id: idMatch[1],
                title: posting.title || "",
                description: (posting.description || "").replace(/<[^>]+>/g, " ").slice(0, 2000),
                budget: posting.baseSalary?.value?.value ? `$${posting.baseSalary.value.value}` : null,
                job_type: posting.employmentType === "CONTRACTOR" ? "fixed" : "hourly",
                skills: posting.skills?.map((s: { name: string }) => s.name) || [],
                client_country: posting.jobLocation?.address?.addressCountry || null,
                client_rating: null,
                client_hire_rate: null,
                client_payment_verified: false,
                job_url: jobUrl.startsWith("http") ? jobUrl : `https://www.upwork.com${jobUrl}`,
                posted_at: posting.datePosted || null,
              });
            }
          }
        }
      } catch { /* skip invalid JSON-LD */ }
    }

    // If we found job URLs but no structured data, create minimal entries
    if (jobs.length === 0 && jobUrls.size > 0) {
      for (const jobUrl of jobUrls) {
        const idMatch = jobUrl.match(/~([a-zA-Z0-9]+)/);
        if (idMatch) {
          jobs.push({
            upwork_id: idMatch[1],
            title: `Upwork Job ${idMatch[1]}`,
            description: "",
            budget: null,
            job_type: null,
            skills: [],
            client_country: null,
            client_rating: null,
            client_hire_rate: null,
            client_payment_verified: false,
            job_url: jobUrl,
            posted_at: null,
          });
        }
      }
      console.log(`[upwork-feed] Found ${jobs.length} job URLs (minimal data) for "${query}"`);
    }

  } catch (err) {
    console.error(`[upwork-feed] Scrape error for "${query}":`, err);
  }

  return jobs;
}

// Extract jobs from Next.js page data
function findJobsInNextData(data: Record<string, unknown>): ParsedJob[] {
  const jobs: ParsedJob[] = [];

  // Recursively search for job arrays in the data structure
  function search(obj: unknown, depth: number = 0): void {
    if (depth > 10 || !obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item && typeof item === "object" && "title" in item && ("uid" in item || "ciphertext" in item || "id" in item)) {
          const j = item as Record<string, unknown>;
          const uid = (j.uid || j.ciphertext || j.id || "") as string;
          const title = (j.title || "") as string;

          if (uid && title) {
            const jobUrl = j.url as string || `https://www.upwork.com/jobs/~${uid}`;
            const desc = ((j.description || j.snippet || "") as string).replace(/<[^>]+>/g, " ").slice(0, 2000);
            const amt = j.amount as Record<string, unknown> | undefined;
            const bgt = j.budget as Record<string, unknown> | undefined;
            const budget = (amt?.amount ? `$${amt.amount}` : (bgt?.amount ? `$${bgt.amount}` : null)) as string | null;
            const skills = Array.isArray(j.skills) ? j.skills.map((s: unknown) => typeof s === "string" ? s : (s as Record<string, string>)?.name || (s as Record<string, string>)?.prettyName || "").filter(Boolean) : [];
            const client = (j.client || {}) as Record<string, unknown>;
            const clientLoc = client.location as Record<string, unknown> | undefined;

            jobs.push({
              upwork_id: uid,
              title,
              description: desc,
              budget: budget,
              job_type: (j.type || j.jobType || j.hourlyBudgetType || null) as string | null,
              skills,
              client_country: (client.country || clientLoc?.country || null) as string | null,
              client_rating: client.rating ? parseFloat(String(client.rating)) : null,
              client_hire_rate: client.hireRate ? parseFloat(String(client.hireRate)) : null,
              client_payment_verified: !!client.paymentVerificationStatus || !!client.paymentVerified,
              job_url: jobUrl.startsWith("http") ? jobUrl : `https://www.upwork.com${jobUrl}`,
              posted_at: (j.createdOn || j.publishedOn || j.postedOn || null) as string | null,
            });
          }
        }
        search(item, depth + 1);
      }
    } else {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        search(value, depth + 1);
      }
    }
  }

  search(data);
  return jobs;
}

// Extract jobs from Apollo cache state
function findJobsInApolloState(data: Record<string, unknown>): ParsedJob[] {
  const jobs: ParsedJob[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("Job:") || key.startsWith("SearchResult:")) {
      const j = value as Record<string, unknown>;
      const title = (j.title || "") as string;
      const uid = (j.uid || j.ciphertext || key.split(":")[1] || "") as string;

      if (title && uid) {
        jobs.push({
          upwork_id: uid,
          title,
          description: ((j.description || j.snippet || "") as string).replace(/<[^>]+>/g, " ").slice(0, 2000),
          budget: j.amount ? `$${(j.amount as Record<string, unknown>).amount || j.amount}` : null,
          job_type: (j.type || null) as string | null,
          skills: [],
          client_country: null,
          client_rating: null,
          client_hire_rate: null,
          client_payment_verified: false,
          job_url: `https://www.upwork.com/jobs/~${uid}`,
          posted_at: (j.createdOn || null) as string | null,
        });
      }
    }
  }

  return jobs;
}

// Main poll function — accepts RSS URLs (extracts query) or plain search terms
export async function pollUpworkRSS(feedUrls: string[]): Promise<number> {
  let newCount = 0;

  for (const input of feedUrls) {
    const query = parseSearchQuery(input);
    if (!query) continue;

    try {
      const jobs = await scrapeUpworkSearch(query);

      for (const job of jobs) {
        try {
          const result = await sql`
            INSERT INTO upwork_jobs (
              upwork_id, title, description, budget, job_type, skills,
              client_country, client_rating, client_hire_rate, client_payment_verified,
              job_url, posted_at, status
            ) VALUES (
              ${job.upwork_id}, ${job.title}, ${job.description}, ${job.budget},
              ${job.job_type}, ${job.skills}, ${job.client_country},
              ${job.client_rating}, ${job.client_hire_rate}, ${job.client_payment_verified},
              ${job.job_url}, ${job.posted_at ? new Date(job.posted_at).toISOString() : null}, 'new'
            )
            ON CONFLICT (upwork_id) DO NOTHING
            RETURNING id
          `;
          if (result.length > 0) {
            newCount++;
            if (process.env.OWNER_PHONE) {
              try {
                await sendMessage(
                  process.env.OWNER_PHONE,
                  `New Upwork job: ${job.title}\nBudget: ${job.budget || "not listed"}\n${job.job_url}`
                );
              } catch (err) {
                console.error(`[upwork-feed] Text notification failed for ${job.upwork_id}:`, err);
              }
            }
          }
        } catch (err) {
          console.error(`[upwork-feed] Insert error for ${job.upwork_id}:`, err);
        }
      }

      // Small delay between searches to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[upwork-feed] Error processing "${query}":`, err);
    }
  }

  return newCount;
}
