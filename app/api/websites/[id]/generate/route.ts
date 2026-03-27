import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/websites/[id]/generate — generate landing page with AI
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspace = await getOrCreateWorkspace();
    const body = await req.json();
    const { prompt, answers } = body;

    // Verify page exists
    const pages = await sql`
      SELECT * FROM landing_pages
      WHERE id = ${id} AND workspace_id = ${workspace.id}
    `;
    if (pages.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Build the generation prompt
    let userPrompt: string;
    if (answers) {
      userPrompt = `Generate a landing page with the following details:
- Business/Service: ${answers.business || "Not specified"}
- Target Customer: ${answers.audience || "Not specified"}
- Main CTA Goal: ${answers.cta || "Not specified"}
- Headline: ${answers.headline || "Come up with a compelling headline"}
- Colors/Branding: ${answers.colors || "Use a clean, modern default color scheme"}
- Page Name: ${pages[0].name}`;
    } else if (prompt) {
      userPrompt = prompt;
    } else {
      return NextResponse.json({ error: "Either prompt or answers required" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      system: `You are an expert landing page designer. Generate a complete, production-ready single-page landing page.

REQUIREMENTS:
- Clean, modern design with great typography
- Fully mobile responsive using CSS media queries
- Include these sections: Hero with headline + CTA, Features/Benefits (3-4 items), Social proof/testimonials placeholder, Final CTA section, Footer
- ALL CSS must be inline in a <style> tag — no external dependencies whatsoever
- Use Google Fonts via @import at the top of the style tag (Inter for body, plus one accent font)
- The design should feel premium and professional
- Use the color scheme specified, or pick a great one based on the business type
- Include subtle animations (fade-in, hover effects)
- The CTA buttons should be prominent and compelling
- Make the page feel complete and real — not like a template

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown:
{"html": "<the complete HTML including <!DOCTYPE html>>", "css": ""}

Put all CSS inside the HTML <style> tag. The css field should be empty string.
Do NOT wrap the response in markdown code blocks. Return raw JSON only.`,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

    let html = "";
    let css = "";

    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(rawText);
      html = parsed.html || "";
      css = parsed.css || "";
    } catch {
      // If JSON parsing fails, try to extract HTML from the response
      const htmlMatch = rawText.match(/<!DOCTYPE[\s\S]*<\/html>/i);
      if (htmlMatch) {
        html = htmlMatch[0];
      } else {
        html = rawText;
      }
    }

    // Save to database
    await sql`
      UPDATE landing_pages SET
        html_content = ${html},
        css_content = ${css},
        updated_at = now()
      WHERE id = ${id} AND workspace_id = ${workspace.id}
    `;

    return NextResponse.json({ html, css });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[websites/generate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
