import { neon } from "@neondatabase/serverless";
import { notFound } from "next/navigation";

const sql = neon(process.env.DATABASE_URL!);

export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Look up the landing page by slug (across all workspaces since this is public)
  const pages = await sql`
    SELECT id, html_content, css_content, published
    FROM landing_pages
    WHERE slug = ${slug}
    LIMIT 1
  `;

  if (pages.length === 0 || !pages[0].published) {
    notFound();
  }

  const page = pages[0];

  // Increment visit count (fire and forget)
  sql`
    UPDATE landing_pages SET visits = visits + 1 WHERE id = ${page.id}
  `.catch(() => {});

  const htmlContent = page.html_content || "";

  // If the HTML is a full document (has DOCTYPE or <html>), render it as-is in an iframe-like approach
  // Otherwise wrap it
  const isFullDocument = htmlContent.toLowerCase().includes("<!doctype") || htmlContent.toLowerCase().includes("<html");

  if (isFullDocument) {
    // Return the raw HTML as the full page response
    return (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body>
          <div
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            style={{ all: "initial" }}
          />
          {page.css_content && (
            <style dangerouslySetInnerHTML={{ __html: page.css_content }} />
          )}
        </body>
      </html>
    );
  }

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {page.css_content && (
          <style dangerouslySetInnerHTML={{ __html: page.css_content }} />
        )}
      </head>
      <body>
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </body>
    </html>
  );
}
