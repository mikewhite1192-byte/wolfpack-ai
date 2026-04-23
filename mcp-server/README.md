# Wolf Pack Finance MCP Server

Read-only MCP server that lets Claude Desktop (or any MCP client) query Mike's
finance data directly from Neon. Runs locally as a stdio process — no hosting,
no remote API, Claude Desktop spawns it on demand.

## What it exposes

- `list_accounts` — Mercury + manual balance sheet
- `list_transactions` — filter by workspace, date, category, amount, merchant
- `get_net_worth` — current personal + business + combined
- `get_spending_by_category` — rollup by category for a period
- `get_top_vendors` — top merchants by spend
- `search_transactions` — substring search across descriptions
- `get_business_candidates` — reclassification queue
- `get_pnl` — business revenue / expenses / net income for a period
- `get_credit_summary` — latest credit-report snapshot
- `get_sync_status` — when Mercury last synced and any errors

All tools are read-only. No write paths (reclassify, manual expense, etc.)
are exposed by design — those still happen in the CRM UI so they produce
visible state changes Mike can confirm before committing.

## Setup

### 1. Build

```bash
cd /Volumes/External_HD/WolfPack_Site/wolfpack-ai/mcp-server
npm install
npm run build
```

This compiles to `dist/index.js`.

### 2. Wire up Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`. If
the file doesn't exist yet, create it:

```json
{
  "mcpServers": {
    "wolfpack-finance": {
      "command": "node",
      "args": [
        "/Volumes/External_HD/WolfPack_Site/wolfpack-ai/mcp-server/dist/index.js"
      ],
      "env": {
        "DATABASE_URL": "postgresql://neondb_owner:...@...neon.tech/...?sslmode=require"
      }
    }
  }
}
```

Copy the exact `DATABASE_URL` value from `.env.local` at the repo root.

### 3. Restart Claude Desktop

Quit fully (`Cmd+Q`) and reopen. The MCP indicator should appear in the chat
input area, and you should see `wolfpack-finance` listed when you click the
tools menu.

### 4. Try it

```
What's my current net worth?
Show me all transactions over $100 this month.
Who are my top vendors on the business account?
Any errors on the last Mercury sync?
```

## Notes

- **External HD**: the compiled entry is on `/Volumes/External_HD/`. If that
  drive isn't mounted when Claude Desktop launches, the server will fail to
  start. Plug the drive in before opening Claude Desktop, or copy the repo
  to your internal disk and update the path.
- **Secrets**: `claude_desktop_config.json` stores `DATABASE_URL` in plain
  text. That's fine for a single-user local setup, but don't sync this file
  to a shared location.
- **Adding tools**: edit `src/index.ts` — each tool has a definition in the
  `tools` array and a handler switched in `CallToolRequestSchema`. Rebuild
  and restart Claude Desktop to pick up changes.
- **Write tools (future)**: when you want Claude Desktop to actually
  reclassify or add manual expenses, we can add write tools here. For now
  everything destructive stays in the CRM UI.

## Smoke test

```bash
# Verify the server starts and lists tools without Claude Desktop.
DATABASE_URL='postgresql://...' npm run build && \
  (printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_net_worth"}}' ; \
    sleep 1) | node dist/index.js
```

Expect a JSON-RPC response with your personal + business net-worth breakdown.
