# {{PROJECT_NAME}} — Workspace Orientation

Universal entry point for every AI IDE (ICM Layer 0 identity + Layer 1 task routing). IDE quirks live in `ANTIGRAVITY.md`, `CLAUDE.md`, `COMMANDCODE.md`, `opencode.json`. Architecture SSOT: `docs/bible/`.

## Universal Hard Rules

1. **NEVER put source code in the workspace root** — root is monorepo config, AI steering and documentation only; application code belongs in `{{APP_PATH}}/`.
2. **ALWAYS read the relevant `docs/bible/` section** before writing or modifying any application code.
3. **ALWAYS read `docs/research/README.md`** before recommending or integrating an external library.
4. **ALWAYS update the relevant `docs/bible/` documentation file** after any code change is complete.
5. **NEVER pre-populate `.commandcode/taste/taste.md`** — ships with no pre-populated preferences (pointer stub allowed; never pre-populate); the taste-learning system owns it.

## Documentation Directory Map — Task Routing (visit this directory first)

| Intent | Directory |
|---|---|
| Feature / implementation plan | `docs/plans/<id>/` (backlog state: `docs/backlog/`) |
| Bug | `docs/bugs/` (`open-bugs.md` — never delete) |
| Technology research | `docs/research/` (read its `README.md` first) |
| Audit, progress, sync report | `docs/reports/` (incl. `status/` · `sync/` · `learning/`) |
| Decision / open question (ADR) | `docs/decisions/` (`DEC-XXX` · `OQ-XXX`) — compiled into `docs/bible/DECISIONS.md` |
| Architecture change (SSOT) | `docs/bible/` (read before code, update after code) |
| New automation loop | `docs/loops/` — author with the `loop-author` skill |
| Harness / framework engine code · stack archetype packs (skills, bible overlays, scaffolds) | `.shiftstone/` · `.shiftstone/packs/<pack>/` |
| Stable conventions, style, constraints | `_config/` (ICM Layer 3 — referenced from CONTEXT.md) |

## Skill INDEX — generated from `.shiftstone/context/skills-manifest.yaml`

<!-- SKILL-INDEX:BEGIN -->
- backlog, ci-cd-cloudflare, cloudflare-cron, cloudflare-d1, cloudflare-kv, cloudflare-queues, cloudflare-r2, cloudflare-workers, design-tokens, find-skills, graceful-degradation, jobs, playwright-e2e
- rate-limiting, react-router-actions-forms, react-router-data-loading, react-router-error-boundaries, react-router-middleware, react-router-routing, react-router-typegen, research-methodology
- security-headers, shadcn-ui, ss-add-skill, ss-backlog, ss-backlog-sync, ss-bible, ss-bookkeeping, ss-brainstorm, ss-brand, ss-brand-naming, ss-bug-report, ss-deploy, ss-diagnose, ss-docs
- ss-execute-plan, ss-import-research, ss-init, ss-lesson, ss-loop-author, ss-new-cron-job, ss-new-feature, ss-new-migration, ss-nexus, ss-plan, ss-push, ss-refresh-research, ss-research, ss-review
- ss-schema-sync, ss-simplify, ss-status, ss-steering, ss-sync-bible, ss-sync-engine, ss-upgrade-research, ss-upgrade-skill, ss-verify, stack, storage, supabase-api-keys, supabase-auth
- supabase-migrations, supabase-postgres, supabase-realtime, supabase-rls, swarm, tailwind-v4, theme-management, ui, vitest-testing, web-design-guidelines, zod-validation
<!-- SKILL-INDEX:END -->

## Load Order & Canonical Locations

1. `.shiftstone/static-rules/` — always on: `global.md` (task→rule dispatch + mode detection), `product.md` (identity), `security.md`, `verification.md` (Two-Gear boundary).
2. `.shiftstone/path-scoped-rules/*.md` — path-scoped rules, pulled via the dispatch table or `paths:` globs.
3. Skills — INDEX above; procedural detail loads through `.shiftstone/context/skills-loader.ts` (budget-enforced).
4. `.agents/skills/ss-*/` — ShiftStone 3-tier core skills and slash commands; `docs/loops/` for autonomous loops.
5. Each `docs/*/README.md` — purpose registry for the documentation tree (blueprint §10.15).
