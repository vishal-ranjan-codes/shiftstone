---
type: walkthrough
timestamp: 2026-10-17T05:40:00.000Z
---
# OpenCode Walkthrough — init → skills → first loop → /verify

**IDE:** OpenCode · **Config:** [`opencode.json`](../../opencode.json) (instructions, permissions, MCP) · **Entry points:** `.opencode/commands/` (junction → `core/workflows/`)

**Recording:** _to be recorded_ (record against this document, then paste the URL here).

## 1. init — compose the workspace

```sh
mkdir my-project && cd my-project
git clone <framework-url> .
opencode                                          # open OpenCode in the folder
node core/init.js --name="MyProject" -y           # or type /init in chat
```

- `opencode.json` drives behavior: `instructions[]` loads `AGENTS.md` + the always-on `core/static-rules/*`, `permission` scopes bash/edit/external-directory (pack-aware: `{{APP_PATH}}/**` after composition).
- Alternative-stack and polyglot flags are the same as every IDE; nothing is pushed by init.

## 2. skills — progressive disclosure

- `.opencode/commands/` → `core/workflows/` (all slash commands incl. `/verify`).
- Skills are discovered through `AGENTS.md`'s INDEX + `core/context/skills-loader.ts` (budget-enforced, path-scoped) — OpenCode consumes the same manifest as every other IDE.
- **Tool access is MCP:** the `mcp` block in `opencode.json` (e.g. the GitHub server) plus pack-provided `composition.opencode.mcp` fragments (e.g. the Supabase server in `rr8-supabase-cf`) merged at composition — see blueprint §10.18.

## 3. first loop — the harness runs the work

```sh
node core/harness/cli.js run diagnose-loop
node core/harness/cli.js run new-feature-loop
```

- Slash equivalents: `/new-feature`, `/diagnose`, `/schema-sync`.
- Every run ends in one of the five terminal states and appends cost rows to `.loops/runs.jsonl` (CAC tracking).
- Triggers actuate too: `node core/harness/cli.js schedule <loop-id>` / `watch` / `trigger`.

## 4. /verify — the outer gate

```
/verify <task-id>
```

- A disjoint Checker subagent scores the work; < 0.8 blocks the closure.
- Mandatory outer-gate actions: `/deploy`, `/push`, `/new-migration`, `/new-cron-job`, backlog `[x]` transitions.
- Inner gear stays fast: routine edits run solo on L1/L2 with zero subagents.

## Where things live

| Question | Read first |
|---|---|
| Orientation + task routing | `AGENTS.md` |
| OpenCode config (permissions, MCP) | `opencode.json` + blueprint §10.18 |
| Commands + loop CLI | `core/workflows/README.md` |
