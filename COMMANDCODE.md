# {{PROJECT_NAME}} — Command Code Workspace Guide

> Layer 1 shim for Command Code. `AGENTS.md` is auto-loaded as project memory — read it first.

## Configuration Layout

- `.commandcode/settings.json` — permissions (`deny` / `ask` / `allow`), safety guards and tools.
- `.commandcode/rules/` — junction → `.shiftstone/path-scoped-rules/` (glob-scoped rules).
- `.commandcode/skills/` — junction → `.agents/skills/` (3-tier skills: `SKILL.md` + `instructions.md`).

## Taste File — NON-ACTION Rule

`.commandcode/taste/taste.md` ships with no pre-populated preferences. The taste-learning system populates it automatically as preferences are learned. Never manually edit or pre-fill preferences.

## Commands & Session Flow

Harness gates: `pnpm typecheck`, `pnpm test`. Loop harness: `node .shiftstone/harness/cli.js`.
Canonical flow: `/ss-status` → `/ss-plan` → `/ss-execute-plan` → `/ss-verify` → `/ss-sync-bible`.
Conventional Commits on every edit; run `pnpm typecheck && pnpm test` before wrapping up.
