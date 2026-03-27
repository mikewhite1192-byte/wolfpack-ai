import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Simple workspace getter — no auth dependency
// Auth is handled client-side via Clerk's useUser hook
export async function getOrCreateWorkspace() {
  // For now, get the first active workspace
  // Multi-tenancy will be added when we build team management
  const existing = await sql`
    SELECT * FROM workspaces WHERE status = 'active' ORDER BY created_at ASC LIMIT 1
  `;

  if (existing.length > 0) return existing[0];

  // Create default workspace + pipeline stages
  const workspace = await sql`
    INSERT INTO workspaces (org_id, name, slug)
    VALUES ('default', 'My Workspace', 'default')
    RETURNING *
  `;

  const stages = [
    { name: "New Lead", position: 0, color: "#3498db", is_won: false, is_lost: false },
    { name: "Contacted", position: 1, color: "#9b59b6", is_won: false, is_lost: false },
    { name: "Qualified", position: 2, color: "#E86A2A", is_won: false, is_lost: false },
    { name: "Proposal Sent", position: 3, color: "#f39c12", is_won: false, is_lost: false },
    { name: "Closed Won", position: 4, color: "#2ecc71", is_won: true, is_lost: false },
    { name: "Closed Lost", position: 5, color: "#e74c3c", is_won: false, is_lost: true },
  ];

  for (const s of stages) {
    await sql`
      INSERT INTO pipeline_stages (workspace_id, name, position, color, is_won, is_lost)
      VALUES (${workspace[0].id}, ${s.name}, ${s.position}, ${s.color}, ${s.is_won}, ${s.is_lost})
    `;
  }

  return workspace[0];
}
