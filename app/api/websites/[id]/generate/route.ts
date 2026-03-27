import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getOrCreateWorkspace } from "@/lib/workspace";
import Anthropic from "@anthropic-ai/sdk";

const sql = neon(process.env.DATABASE_URL!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/websites/[id]/generate — generate or revise landing page with AI
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspace = await getOrCreateWorkspace();
    const body = await req.json();
    const { prompt, answers, revisionRequest } = body;

    const pages = await sql`
      SELECT * FROM landing_pages
      WHERE id = ${id} AND workspace_id = ${workspace.id}
    `;
    if (pages.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let userPrompt: string;

    if (revisionRequest && pages[0].html_content) {
      // Revision mode — modify existing page
      userPrompt = `Here is an existing landing page HTML. The user wants changes made:

CURRENT HTML:
${pages[0].html_content}

REQUESTED CHANGES:
${revisionRequest}

Apply the requested changes and return the complete updated HTML. Keep everything else the same.`;
    } else if (answers) {
      userPrompt = `Generate a complete landing page with these details:

BUSINESS NAME: ${answers.businessName || "Not specified"}
SERVICES/PRODUCTS: ${answers.services || "Not specified"}
TARGET CUSTOMER: ${answers.audience || "General audience"}
MAIN CTA: ${answers.cta || "Contact us"}
PHONE: ${answers.phone || ""}
EMAIL: ${answers.email || ""}
ADDRESS: ${answers.address || ""}
LOGO: ${answers.logo && answers.logo !== "no" ? answers.logo : "Use the business name as text logo"}
HEADLINE: ${answers.headline || "Create a compelling headline based on the business"}
COLORS: ${answers.colors || "Clean, modern. Pick colors that match the business type"}
TESTIMONIALS: ${answers.testimonials && answers.testimonials !== "skip" ? answers.testimonials : "Include 2-3 placeholder testimonials with realistic names"}
EXTRA INFO: ${answers.extras && answers.extras !== "no" ? answers.extras : ""}
INSPIRATION WEBSITES: ${answers.inspiration && answers.inspiration !== "skip" ? answers.inspiration : "None provided. Use best practices for this business type."}`;
    } else if (prompt) {
      userPrompt = prompt;
    } else {
      return NextResponse.json({ error: "Either prompt, answers, or revisionRequest required" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000,
      system: `You are an elite landing page designer and developer. Generate a complete, production-ready, single-page website.

DESIGN REQUIREMENTS:
- Modern, premium design that looks like it was built by an expensive agency
- Fully mobile responsive with CSS media queries
- Google Fonts via @import (use Inter for body text, plus a display font that matches the brand vibe)
- Smooth animations: fade-in on scroll, hover effects on buttons and cards
- ALL CSS inline in a <style> tag. Zero external dependencies except Google Fonts
- Use CSS variables for colors so the design is cohesive
- Subtle gradients, shadows, and spacing that makes it feel polished
- Buttons should have hover states with transitions

REQUIRED SECTIONS:
1. NAVIGATION — sticky top nav with business name/logo, nav links (smooth scroll), and CTA button
2. HERO — large headline, subheadline, CTA button, optional background image or gradient
3. SERVICES/FEATURES — 3-4 cards or grid showing what they offer with icons (use unicode/emoji icons)
4. ABOUT/WHY US — brief section on what makes them different
5. TESTIMONIALS — real looking review cards with names, stars, and quotes
6. CTA SECTION — strong call to action with a form or button
7. CONTACT — phone, email, address displayed clearly
8. FOOTER — business name, copyright, links

IF THE USER PROVIDED A PHONE NUMBER:
- Make it clickable (tel: link) in the nav and contact section
- Add a floating "Call Now" button on mobile

IF THE USER PROVIDED AN EMAIL:
- Make it clickable (mailto: link) in contact section

FORM HANDLING:
- If the CTA is a form, create a clean contact form with name, email, phone, message fields
- The form should look great with styled inputs
- Use action="#" for now (will be wired up later)

OUTPUT: Respond with ONLY the complete HTML (starting with <!DOCTYPE html> and ending with </html>).
No JSON wrapping. No markdown code blocks. Just the raw HTML.
Make it look INCREDIBLE.`,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

    // Extract HTML
    let html = "";
    const htmlMatch = rawText.match(/<!DOCTYPE[\s\S]*<\/html>/i);
    if (htmlMatch) {
      html = htmlMatch[0];
    } else {
      // Try JSON parse as fallback
      try {
        const parsed = JSON.parse(rawText);
        html = parsed.html || rawText;
      } catch {
        html = rawText;
      }
    }

    // Save to database
    await sql`
      UPDATE landing_pages SET
        html_content = ${html},
        css_content = '',
        updated_at = now()
      WHERE id = ${id} AND workspace_id = ${workspace.id}
    `;

    return NextResponse.json({ html, css: "" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[websites/generate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
