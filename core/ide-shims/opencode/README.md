---
type: readme
timestamp: 2026-10-17T05:50:00.000Z
---
# core/ide-shims/opencode/ — OpenCode shim & MCP tool-access standard (B12)

OpenCode consumes the framework through the root [`opencode.json`](../../../opencode.json)
(instructions, permissions, MCP). This file documents the **MCP (Model Context Protocol) tool-access
standard** declared in blueprint §10.18.

## Where MCP servers come from

| Source | Shape | When it lands in `opencode.json` |
|---|---|---|
| **Workspace root** | top-level `"mcp"` block (e.g. `github`) | ships with the framework; edited directly by the workspace owner |
| **Pack fragment** | `composition.opencode.mcp` in `packs/<name>/manifest.yaml` (e.g. `supabase` in rr8) | merged by `core/init/seed-governance.js` at composition (`⚙️ opencode.json made pack-aware`) |

## Root servers (shipped)

```jsonc
"mcp": {
  "github": {
    "type": "local",
    "enabled": true,
    "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}" }
  }
}
```

**Environment variables expected** (never hard-code credentials):

| Variable | Used by |
|---|---|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | root `github` server |
| `SUPABASE_ACCESS_TOKEN` | `supabase` server, merged from `rr8-supabase-cf` |

## Rules

1. **New tool integrations are MCP servers** — workspace-owned servers go in the
   root `mcp` block; stack-owned servers go in the pack's
   `composition.opencode.mcp` fragment so they compose with the archetype.
2. **Bespoke per-IDE plugin glue is refused at review** (blueprint §10.18 rule 4) —
   that standardisation is what avoids re-platforming when tools change.
3. **A2A agent-to-agent delegation is deferred** (v2.x future work) with rationale
   in blueprint §10.18 — intra-workspace delegation is served by the Checker
   subagent (`/verify`) and the harness spawn interfaces.

**See also:** [blueprint §10.18](../../../docs/plans/universal-ai-workspace-framework/universal-ai-workspace-framework-blueprint.md) ·
[rr8 manifest MCP fragment](../../../packs/rr8-supabase-cf/manifest.yaml) ·
[OpenCode walkthrough](../../../docs/videos/opencode-walkthrough.md)
