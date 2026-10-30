# ShiftStone — Engineering Hub Workspace Orientation

Universal entry point for AI IDEs developing {{PROJECT_NAME}}. Quirks: `ANTIGRAVITY.md`, `CLAUDE.md`, `COMMANDCODE.md`.

## Multi-Repo Ecosystem Layout
- `docs/`: SSOT for {{PROJECT_NAME}} (blueprints, research, loops, roadmap).
- `frameworks/`: Child repositories container (`apps/web/`, `workers/`).

## Universal Hard Rules
1. **NEVER put source code in workspace root** — root is monorepo config/steering; engine code in `.shiftstone/`, child apps in `apps/`.
2. **ALWAYS read the relevant `docs/bible/` section** before writing or modifying architecture code.
3. **ALWAYS read `docs/research/README.md`** before recommending or integrating external libraries.
4. **ALWAYS update the relevant `docs/bible/` documentation file** after any code change is complete.
5. **NEVER pre-populate `.commandcode/taste/taste.md`** — ships with no pre-populated preferences.

## Documentation Directory Map — Task Routing (visit this directory first)
| Intent | Directory |
|---|---|
| Feature / plan · backlog · bugs · research | `docs/plans/<id>/` · `docs/backlog/` · `docs/bugs/` · `docs/research/` |
| Reports & sync audits · decisions · architecture | `docs/reports/` · `docs/decisions/` (DEC/OQ) · `docs/bible/` (SSOT) |
| Autonomous loops · engine · frameworks · config | `docs/loops/` · `.shiftstone/` (packs) · `frameworks/` · `_config/` |

## Skill INDEX — generated from `.shiftstone/context/skills-manifest.yaml`
<!-- SKILL-INDEX:BEGIN -->
{{SKILL_INDEX}}
<!-- SKILL-INDEX:END -->

## Suggested Next Steps
<!-- NEXT-STEPS:BEGIN -->
| Command | Action | Recommended Timing |
|---|---|---|
| `/ss-plan` | Plan Phase 1 backlog items in docs/plans/ with bounded context and TDD | Immediately (Start here) |
| `/ss-nexus` | Run monorepo type-checks, lints, and test suites across all workspaces | Before committing or deploying code |
| `pnpm dev` | Start local development server and interactive application preview | When ready to interact with dev environment |
<!-- NEXT-STEPS:END -->

## Load Order & Canonical Locations
1. `.shiftstone/static-rules/` — always on: `global.md`, `product.md`, `security.md`, `verification.md`.
2. `.shiftstone/path-scoped-rules/*.md` — path-scoped rules pulled via dispatch table or `paths:` globs.
3. Skills — INDEX above; procedural detail loads through `.shiftstone/context/skills-loader.ts`.
4. `.agents/skills/ss-*/` — ShiftStone 3-tier core skills & slash commands; `docs/loops/` for loops.
5. Each `docs/*/README.md` — purpose registry for documentation tree.
