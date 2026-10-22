---
type: walkthrough
timestamp: 2026-10-17T05:40:00.000Z
---
# Command Code Walkthrough — init → skills → first loop → /verify

**IDE:** Command Code · **Shim:** [`COMMANDCODE.md`](../../COMMANDCODE.md) · **Entry points:** `.commandcode/rules/`, `.commandcode/commands/`, `.commandcode/skills/` (junctions → `core/`), taste learning

**Recording:** _to be recorded_ (record against this document, then paste the URL here).

## 1. init — compose the workspace

```sh
mkdir my-project && cd my-project
git clone <framework-url> .
node core/init.js --name="MyProject" -y          # or type /init in chat
```

- Stack choices are identical to every IDE (flagship default / `--archetype=` / `--archetypes=` for polyglot).
- `.commandcode/settings.json` ships team-shared permissions; init never pushes — commits stay local until `/push`.

## 2. skills — progressive disclosure + taste

- Command Code auto-loads `AGENTS.md` (universal hard rules, task routing, skill INDEX) — `COMMANDCODE.md` covers IDE quirks.
- `.commandcode/skills/` → `.agents/skills/` (3-tier bundles, budget-enforced loader).
- **Taste:** `.commandcode/taste/taste.md` starts **empty by design** — the taste-learning system fills it as you correct the agent. Never pre-populate it.
- Path-scoped rules pull in per-directory expertise automatically; skill INDEX lines are generated, never hand-edited.

## 3. first loop — the harness runs the work

```sh
node core/harness/cli.js run diagnose-loop
node core/harness/cli.js validate new-feature-loop
```

- Chat equivalents: `/new-feature`, `/diagnose`, `/schema-sync`, `/sync-bible`.
- Terminal states are exhaustive: `success` · `no_op` · `blocked` · `stalled` · `exhausted` — a loop never hangs silently.
- Budgets and stagnation brakes live in the spec (`brakes.budget`, `brakes.stagnation`); runtime state in `.loops/`.

## 4. /verify — the outer gate

```
/verify <task-id>
```

- Spawns a **disjoint Checker** (fresh context, preferably a different model family) — no self-approval.
- ≥ 0.8 sign-off unlocks `[x]`; otherwise the task stays open with a blocked verdict.
- Recommended session flow (from `COMMANDCODE.md`): `/status` → `/new-feature` → `/diagnose` → `/verify` → `/sync-bible` + `/backlog-sync`.

## Where things live

| Question | Read first |
|---|---|
| Orientation + hard rules | `AGENTS.md` |
| Command Code specifics | `COMMANDCODE.md` |
| Commands + loop CLI | `core/workflows/README.md` |
