# {{PROJECT_NAME}} — Anti-Gravity Workspace Guide

> Layer 1 shim for Anti-Gravity. Universal rules, task routing and skill INDEX live in `AGENTS.md` — read it first.

## Configuration Layout

- `.agent/rules/` — junction → `.shiftstone/static-rules/` (always-on Layer 0: `global.md`, `product.md`, `security.md`, `verification.md`).
- `.shiftstone/path-scoped-rules/*.md` — pulled per dispatch table in `global.md`.
- `.agents/skills/` — 3-tier skills (`SKILL.md` + `instructions.md` + `resources/`).
- Skill INDEX: `AGENTS.md` (generated from `.shiftstone/context/skills-manifest.yaml`).

## Documentation Directory Map

Purpose of every `docs/` tree: `docs/index.md` (5-field registry, blueprint §10.15); intent → directory routing: `AGENTS.md`.

## Recommended Session Flow

Canonical: `/ss-status` → `/ss-plan` → `/ss-execute-plan` → `/ss-verify` → `/ss-sync-bible`.
Conventional Commits on every edit; run `pnpm typecheck && pnpm test` before wrapping up.
