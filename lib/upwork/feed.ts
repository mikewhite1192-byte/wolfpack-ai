import { neon } from "@neondatabase/serverless";

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

function extractUpworkId(url: string): string {
  // Upwork job URLs: https://www.upwork.com/jobs/~01abc123
  const match = url.match(/~([a-zA-Z0-9]+)/);
  return match ? match[1] : url;
}

function parseDescription(html: string): {
  budget: string | null;
  job_type: string | null;
  skills: string[];
  client_country: string | null;
  client_rating: number | null;
  client_hire_rate: number | null;
  client_payment_verified: boolean;
  cleanDescription: string;
} {
  // Strip HTML tags for clean text
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  // Extract budget
  let budget: string | null = null;
  const budgetMatch = text.match(/Budget:\s*\$([0-9,]+(?:\s*-\s*\$[0-9,]+)?)/i) ||
    text.match(/\$([0-9,]+(?:\s*-\s*\$[0-9,]+)?)/);
  if (budgetMatch) budget = "$" + budgetMatch[1];

  // Extract job type
  let job_type: string | null = null;
  if (/hourly/i.test(text)) job_type = "hourly";
  else if (/fixed.price/i.test(text)) job_type = "fixed";

  // Extract skills from bold tags or "Skills:" section
  const skills: string[] = [];
  const skillsMatch = html.match(/Skills?:\s*(.*?)(?:<br|<\/)/i);
  if (skillsMatch) {
    const skillText = skillsMatch[1].replace(/<[^>]+>/g, "");
    skillText.split(/,\s*/).forEach(s => {
      const trimmed = s.trim();
      if (trimmed) skills.push(trimmed);
    });
  }
  // Also look for <b> tagged skills in Upwork RSS
  const boldSkills = html.matchAll(/<b>\s*([^<]+)\s*<\/b>/gi);
  for (const m of boldSkills) {
    const skill = m[1].trim();
    if (skill && skill.length < 40 && !skills.includes(skill) && !/budget|hourly|fixed|posted|country/i.test(skill)) {
      skills.push(skill);
    }
  }

  // Extract client country
  let client_country: string | null = null;
  const countryMatch = text.match(/Country:\s*([A-Za-z\s]+?)(?:\s{2}|\.|$)/i) ||
    text.match(/Location:\s*([A-Za-z\s]+?)(?:\s{2}|\.|$)/i);
  if (countryMatch) client_country = countryMatch[1].trim();

  // Extract client rating
  let client_rating: number | null = null;
  const ratingMatch = text.match(/Rating:\s*([0-9.]+)/i);
  if (ratingMatch) client_rating = parseFloat(ratingMatch[1]);

  // Extract hire rate
  let client_hire_rate: number | null = null;
  const hireMatch = text.match(/Hire Rate:\s*([0-9.]+)%?/i) ||
    text.match(/([0-9.]+)%\s*hire rate/i);
  if (hireMatch) client_hire_rate = parseFloat(hireMatch[1]);

  // Payment verified
  const client_payment_verified = /payment (method )?verified/i.test(text);

  // Clean description (first ~1000 chars of plain text)
  const cleanDescription = text.slice(0, 2000);

  return { budget, job_type, skills, client_country, client_rating, client_hire_rate, client_payment_verified, cleanDescription };
}

function parseRSSItems(xml: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      item.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = item.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) ||
      item.match(/<link>([\s\S]*?)<\/link>/);
    const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
      item.match(/<description>([\s\S]*?)<\/description>/);
    const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

    if (!titleMatch || !linkMatch) continue;

    const title = titleMatch[1].trim();
    const job_url = linkMatch[1].trim();
    const rawDesc = descMatch ? descMatch[1] : "";
    const posted_at = dateMatch ? dateMatch[1].trim() : null;

    const parsed = parseDescription(rawDesc);

    jobs.push({
      upwork_id: extractUpworkId(job_url),
      title,
      description: parsed.cleanDescription,
      budget: parsed.budget,
      job_type: parsed.job_type,
      skills: parsed.skills,
      client_country: parsed.client_country,
      client_rating: parsed.client_rating,
      client_hire_rate: parsed.client_hire_rate,
      client_payment_verified: parsed.client_payment_verified,
      job_url,
      posted_at,
    });
  }

  return jobs;
}

export async function pollUpworkRSS(feedUrls: string[]): Promise<number> {
  let newCount = 0;

  for (const url of feedUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WolfPackCRM/1.0)",
        },
      });
      if (!res.ok) {
        console.error(`[upwork-feed] Failed to fetch ${url}: ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const jobs = parseRSSItems(xml);

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
          if (result.length > 0) newCount++;
        } catch (err) {
          console.error(`[upwork-feed] Insert error for ${job.upwork_id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[upwork-feed] Fetch error for ${url}:`, err);
    }
  }

  return newCount;
}
