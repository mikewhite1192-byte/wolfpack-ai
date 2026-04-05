import { neon } from "@neondatabase/serverless";
import { auth } from "@clerk/nextjs/server";

const sql = neon(process.env.DATABASE_URL!);

/**
 * Get or create a workspace for the current authenticated user.
 * Each Clerk user gets their own isolated workspace.
 */
export async function getOrCreateWorkspace() {
  // Try to get the Clerk user ID for proper multi-tenant isolation
  let clerkUserId: string | null = null;
  try {
    const { userId } = await auth();
    clerkUserId = userId;
  } catch {
    // auth() may fail in non-request contexts (cron jobs, webhooks)
    // Fall through to legacy lookup
  }

  if (clerkUserId) {
    // Look up workspace by Clerk user ID (stored in org_id)
    const existing = await sql`
      SELECT * FROM workspaces WHERE org_id = ${clerkUserId} AND status = 'active' LIMIT 1
    `;
    if (existing.length > 0) return existing[0];

    // Create workspace for this user
    const slug = `ws-${clerkUserId.replace(/[^a-z0-9]/gi, "").slice(0, 12)}-${Date.now().toString(36)}`;
    const workspace = await sql`
      INSERT INTO workspaces (org_id, name, slug)
      VALUES (${clerkUserId}, 'My Workspace', ${slug})
      RETURNING *
    `;

    if (workspace.length === 0) throw new Error("Failed to create workspace");

    // Create default pipeline
    const pipeline = await sql`
      INSERT INTO pipelines (workspace_id, name, is_default)
      VALUES (${workspace[0].id}, 'Sales Pipeline', true)
      RETURNING id
    `;

    // Create default stages linked to pipeline
    const stages = [
      { name: "New Lead", position: 0, color: "#3498db", is_won: false, is_lost: false },
      { name: "Contacted", position: 1, color: "#9b59b6", is_won: false, is_lost: false },
      { name: "Qualified", position: 2, color: "#E86A2A", is_won: false, is_lost: false },
      { name: "Proposal Sent", position: 3, color: "#f39c12", is_won: false, is_lost: false },
      { name: "Closed Won", position: 4, color: "#2ecc71", is_won: true, is_lost: false },
      { name: "Closed Lost", position: 5, color: "#e74c3c", is_won: false, is_lost: true },
    ];

    const pipelineId = pipeline.length > 0 ? pipeline[0].id : null;

    for (const s of stages) {
      await sql`
        INSERT INTO pipeline_stages (workspace_id, pipeline_id, name, position, color, is_won, is_lost)
        VALUES (${workspace[0].id}, ${pipelineId}, ${s.name}, ${s.position}, ${s.color}, ${s.is_won}, ${s.is_lost})
      `;
    }

    return workspace[0];
  }

  // Legacy fallback — no auth context (cron jobs, webhooks, etc.)
  // Get the first active workspace
  const existing = await sql`
    SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1
  `;

  if (existing.length > 0) return existing[0];

  // Absolute fallback — should never reach here in production
  const slug = `ws-default-${Date.now().toString(36)}`;
  const workspace = await sql`
    INSERT INTO workspaces (org_id, name, slug)
    VALUES ('system', 'Default Workspace', ${slug})
    RETURNING *
  `;

  return workspace[0];
}

/**
 * Get workspace for a specific Clerk user ID (used in webhooks/cron where auth() isn't available)
 */
export async function getWorkspaceByUserId(clerkUserId: string) {
  const existing = await sql`
    SELECT * FROM workspaces WHERE org_id = ${clerkUserId} AND status = 'active' LIMIT 1
  `;
  return existing.length > 0 ? existing[0] : null;
}
