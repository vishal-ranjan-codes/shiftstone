# core/workflows — Canonical Slash Commands

Single canonical home for every workspace workflow (anti-duplication mandate,
blueprint §6.6). `.agent/workflows/`, `.commandcode/commands/` and
`.opencode/commands/` are local junction links to this folder.

## Commands

| Command | Purpose |
|---|---|
| `/init` | One-prompt workspace onboarding: scoping interview, clone starter repo, configure Dual-Repo Git, pre-fill architecture bible |
| `/new-feature` | Start a new feature development loop — enforces bible-to-code parity |
| `/new-migration` | Any database schema change — creates `migration_plan.md` artifact |
| `/new-cron-job` | Adding a new scheduled/cron background job |
| `/status` | Start of any session — audit roadmap progress and files |
| `/sync-bible` | **Outer gate** — detect code ↔ documentation drift, then apply sync fixes only after a disjoint Checker sign-off ≥ 0.8 |
| `/schema-sync` | Verify database migrations, bible files, and TypeScript types are aligned |
| `/bug-report` | Log a bug in a standardized format to `docs/bugs/open-bugs.md` |
| `/research` | Research a new technical decision and save findings persistently |
| `/import-research` | Import external technology research into the standardized format |
| `/refresh-research` | Re-evaluate past research findings against the active stack |
| `/upgrade-research` | Upgrade completed research into a production implementation RFC |
| `/deploy` | Execute pre-flight checks and deploy to production |
| `/push` | Publish both the workspace governance repo and nested app repo to GitHub |
| `/verify` | **Outer gate** — spawn a disjoint Checker subagent; blocks `[/] → [x]` on verdict < 0.8 |
| `/review` | **AI first-pass review** — findings grouped by checklist category (hallucinated deps, error handling, correctness) before human review |
| `/lesson` | **Rule accumulation** — propose a static rule after an agent mistake; appends to `core/static-rules/global.md` only after human approval |
| `/nexus` | Run type-checks, lints, and fix compile errors |
| `/backlog-sync` | Perform auto-maintenance sweep and split overloaded backlogs |
| `/diagnose` | Run diagnostics loop to resolve type and lint compilation errors |

## Loop CLI

```sh
node core/harness/cli.js run <loop-id>       # manual trigger
node core/harness/cli.js schedule <loop-id>  # cron trigger
node core/harness/cli.js watch <loop-id>     # file-watch trigger
node core/harness/cli.js validate <loop-id>  # spec refusal gate
node core/harness/cli.js status <loop-id>    # oversight/budget/state
```

## Run Logging (cost tracker)

Loop runs are logged automatically by the harness. Every slash-command
workflow also appends exactly one row to `.loops/<id>/runs.jsonl` at
workflow end (task 5.1) via:

```sh
node core/scripts/record-run.js <workflow-id> --state <success|no_op|blocked|stalled|exhausted|error> --reason "<outcome>" [--tokens n] [--dollars n] [--accepted n]
```

Aggregate with `node core/scripts/status-dashboard.js` (CAC, first-pass rate,
token burn, terminal histogram). Opt out via `cost-tracker.enabled: false` in
`core/context/cost-tracker.json`.

## Workspace Commands

| Task | Command |
|---|---|
| Dev server | `{{PACKAGE_MANAGER}} dev` (in `{{APP_PATH}}/`) |
| Build | `{{PACKAGE_MANAGER}} build` |
| Type check (harness) | `pnpm typecheck` |
| Lint (harness) | `pnpm lint` |
| Tests (harness) | `pnpm test` |
| Database types | pack-provided type-generation command (see `docs/bible/03-database/`) |
| Deploy | `{{PACKAGE_MANAGER}} deploy` |
| Parity + OKF checks | `pnpm parity` |

## Session Flow

1. `/status` — audit which backlog item is active.
2. `/new-feature` (or `/bug-report`) — pull domain specs, generate the plan.
3. `/diagnose` or `/nexus` — typecheck/lint gate (inner gear).
4. `/verify <task-id>` — outer gate before marking a task `[x]`.
5. `/sync-bible` + `/backlog-sync` — documentation and ticket parity.
