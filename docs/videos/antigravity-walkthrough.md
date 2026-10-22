---
type: walkthrough
timestamp: 2026-10-17T05:40:00.000Z
---
# Antigravity Walkthrough — init → skills → first loop → /verify

**IDE:** Google Antigravity · **Shim:** [`ANTIGRAVITY.md`](../../ANTIGRAVITY.md) · **Entry points:** `.agent/rules/` + `.agent/workflows/` (junctions → `core/`)

**Recording:** _to be recorded_ (record against this document, then paste the URL here).

## 1. init — compose the workspace

```sh
mkdir my-project && cd my-project
git clone <framework-url> . 
node core/init.js --name="MyProject" -y        # or type /init in the Antigravity chat
```

- Flagship default needs no flags: `node core/init.js --name="MyProject" --clone-starter -y`.
- Alternative stack: `node core/init.js --archetype=fastapi-pg -y` (zero RR8 tokens in the result).
- Polyglot: `node core/init.js --archetypes=rr8-supabase-cf,fastapi-pg -y`.
- Init **stages and commits locally — nothing is pushed** until `/push`.

## 2. skills — progressive disclosure

- `.agent/` is a junction to `core/`; skills live in `.agents/skills/` (3-tier: `SKILL.md` + `instructions.md` + `resources/`).
- The skill INDEX in `AGENTS.md` is generated from `core/context/skills-manifest.yaml` — never hand-edit it.
- Path-scoped loading: opening `apps/web/**` pulls React Router/Supabase/Cloudflare skills; `docs/bible/**` pulls bible rules — within the token budget (`core/context/token-budget.json`).

## 3. first loop — the harness runs the work

```sh
node core/harness/cli.js status diagnose-loop   # inspect a loop
node core/harness/cli.js run diagnose-loop      # run it end to end
```

- Reference loops: `diagnose-loop` (L1), `schema-sync-loop` (L1), `new-feature-loop` (L4, outer gear), `bible-sync-loop`, `quality-flywheel-loop`.
- Every loop ends in exactly one of five terminal states: `success` / `no_op` / `blocked` / `stalled` / `exhausted`.
- In chat, `/new-feature` starts the feature loop; runtime state lands in `.loops/` (gitignored), specs live in `docs/loops/`.

## 4. /verify — the outer gate

```
/verify <task-id>
```

- Spawns a **disjoint Checker** in a fresh context (maker ≠ checker; L4+ requires a different model family).
- Verdict ≥ 0.8 → the backlog task may be marked `[x]`; < 0.8 → **blocked**, retry or escalate.
- Mandatory for: `/deploy`, `/push`, `/new-migration`, `/new-cron-job`, backlog closures, and any irreversible action. Routine edits stay on the inner gear (solo maker, L1/L2, zero subagents).

## Where things live

| Question | Read first |
|---|---|
| What is this workspace? | `AGENTS.md` (orientation + task routing) |
| What commands exist? | `core/workflows/README.md` (`/init`, `/new-feature`, `/push`, `/verify`, …) |
| Which rule applies to this path? | `ANTIGRAVITY.md` → dispatch table in `core/static-rules/global.md` |
