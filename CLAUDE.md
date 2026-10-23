# {{PROJECT_NAME}} — Claude Code Workspace Guide

> Layer 1 shim for Claude Code. Universal rules, task routing and skill INDEX live in `AGENTS.md` (auto-loaded) — read it first.

## Configuration Layout

- `.claude/settings.json` — configuration and command-level permissions.
- `.claude/rules/` — junction → `.shiftstone/path-scoped-rules/` (glob `paths:` frontmatter).
- `.claude/skills/` — junction → `.agents/skills/` (3-tier skills: `SKILL.md` + `instructions.md`).
- Always-on rules: `.shiftstone/static-rules/` — `global.md`, `product.md`, `security.md`, `verification.md`.

## Commands & Session Flow

Dev/build/test commands: `package.json`. Loop harness: `node .shiftstone/harness/cli.js`.
Canonical flow: `/ss-status` → `/ss-plan` → `/ss-execute-plan` → `/ss-verify` → `/ss-sync-bible`.
Conventional Commits on every edit; run `pnpm typecheck && pnpm test` before wrapping up.
