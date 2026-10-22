---
type: walkthrough
timestamp: 2026-10-17T05:40:00.000Z
---
# Claude Code Walkthrough — init → skills → first loop → /verify

**IDE:** Claude Code · **Shim:** [`CLAUDE.md`](../../CLAUDE.md) · **Entry points:** `.claude/rules/`, `.claude/commands/`, `.claude/skills/` (junctions → `core/` + `.agents/skills/`)

**Recording:** _to be recorded_ (record against this document, then paste the URL here).

## 1. init — compose the workspace

```sh
mkdir my-project && cd my-project
git clone <framework-url> .
code .                                          # open Claude Code in the folder
node core/init.js --name="MyProject" -y         # or type /init in chat
```

- Alternative stack: `node core/init.js --archetype=sveltekit-supabase -y` — the resulting workspace contains zero React Router tokens.
- Polyglot: `node core/init.js --archetypes=rr8-supabase-cf,expo-react-native -y` — each app gets its own git remote (dual-repo engine).
- Init commits locally only; publishing happens via `/push`.

## 2. skills — progressive disclosure

- `.claude/commands/` → `core/workflows/` (slash commands), `.claude/rules/` → `core/path-scoped-rules/`, `.claude/skills/` → `.agents/skills/`.
- Claude Code loads `CLAUDE.md` (thin shim) → `AGENTS.md` (orientation, task routing, generated skill INDEX).
- Skills are 3-tier bundles; only the `SKILL.md` manifest is ever indexed up front, detail loads on demand within the token budget.
- Editing `apps/web/**` activates the RR8/Supabase/Cloudflare rules via `paths:` globs — no manual rule selection.

## 3. first loop — the harness runs the work

```sh
node core/harness/cli.js run diagnose-loop      # L1: drive core/ back to green
node core/harness/cli.js status new-feature-loop
```

- In chat: `/new-feature` (spec → implementation → verification, L4 with an outer gate) or `/schema-sync` (L1 drift detection).
- Loops declare trigger, budget, stagnation rule and 5 terminal states; state persists in `.loops/<id>/state.json`, specs are versioned in `docs/loops/`.
- Scheduled/event loops: `node core/harness/cli.js schedule <loop-id>`.

## 4. /verify — the outer gate

```
/verify <task-id>
```

- A **fresh-context Checker** reviews the work against the rubric — the maker never self-certifies.
- Score ≥ 0.8 → task closable (`[x]`); below → blocked with reasons.
- Always-on for irreversible actions (`/deploy`, `/push`, `/migrate`, `/new-cron-job`) and backlog closures; routine edits run on the inner gear with zero subagents.

## Where things live

| Question | Read first |
|---|---|
| Orientation + routing | `AGENTS.md` |
| Commands + loop CLI | `core/workflows/README.md` |
| Verification policy | `core/static-rules/verification.md` (Two-Gear boundary) |
