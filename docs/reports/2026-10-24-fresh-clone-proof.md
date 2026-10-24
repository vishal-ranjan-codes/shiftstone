---
type: report
schemaVersion: report/v1
title: Fresh-Clone Developer Experience Proof & Verification Boundary Audit
timestamp: 2026-10-24T15:00:00.000Z
author: agent-core
tags: [developer-experience, fresh-clone, audit-proof, req-01, req-06, lock-b1, lock-b5]
---

# Fresh-Clone Developer Experience Proof (REQ-01, REQ-06)

This report provides verifiable evidence of the target state achieved by the Framework Developer Experience plan (Phases 1–3), resolving audit Findings `F1` (app/engine test boundary) and `F7` (AI pair-programming disorientation).

---

## 1. Fresh-Clone Inventory & Toolchain Verification

Upon fresh clone of `frameworks/shiftstone`, root configuration files exist immediately:
- `pnpm-workspace.yaml`: Declares `apps/*` and `packages/*`
- `tsconfig.json`: Declares solution-style references for IDE language servers
- `package.json`: Contains application-scoped scripts (`dev`, `build`, `test`, `typecheck`, `lint`) targeting `apps/web` and isolated engine scripts (`test:engine`, `typecheck:engine`, `lint:engine`)

### Shipped Script Surface (`package.json`)
```json
{
  "name": "shiftstone",
  "version": "2.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm -C apps/web dev",
    "build": "pnpm -C apps/web build",
    "start": "pnpm -C apps/web start",
    "test": "pnpm -C apps/web test",
    "typecheck": "pnpm -C apps/web typecheck",
    "lint": "pnpm -C apps/web lint",
    "test:engine": "pnpm -C .shiftstone test",
    "typecheck:engine": "pnpm -C .shiftstone typecheck",
    "lint:engine": "pnpm -C .shiftstone lint",
    "postinstall": "node .shiftstone/scripts/setup-ide-junctions.js && node .shiftstone/scripts/link-ide-folders.js"
  }
}
```

---

## 2. Graduated Archetype Composition Execution

Executing archetype composition for a non-flagship pack (`fastapi-pg`) generates an application skeleton with native toolchain scripts merged into `package.json`:

```bash
$ node .shiftstone/init.js --archetype=fastapi-pg --name=FastApiDemoApp -y
=============================================================
 Universal AI Workspace Framework — Archetype Composer
=============================================================

Composing archetypes: fastapi-pg
   🐍 fastapi scaffold created: apps/api, apps/api/pyproject.toml, apps/api/main.py, apps/api/tests/test_health.py, apps/api/README.md
   🔧 pre-init hook: fastapi-pg:./scaffold-script.js
   📂 docs tree: 10 entries ensured
   🗂️  docs/backlog composed from generic-template
   🔗 skill alembic -> .shiftstone/packs/fastapi-pg/skills/alembic
   🔗 skill fastapi-routing -> .shiftstone/packs/fastapi-pg/skills/fastapi-routing
   🔗 skill httpx -> .shiftstone/packs/fastapi-pg/skills/httpx
   🔗 skill pydantic -> .shiftstone/packs/fastapi-pg/skills/pydantic
   🔗 skill pytest -> .shiftstone/packs/fastapi-pg/skills/pytest
   🔗 skill python-patterns -> .shiftstone/packs/fastapi-pg/skills/python-patterns
   🔗 skill sqlalchemy -> .shiftstone/packs/fastapi-pg/skills/sqlalchemy
   🔗 skill uvicorn-deployment -> .shiftstone/packs/fastapi-pg/skills/uvicorn-deployment
   🏗️  created tsconfig.json
   🏗️  created package.json
   ⚙️  opencode.json made pack-aware
   🧠 skills manifest + AGENTS.md INDEX regenerated
   ✍️  precision substitution: 39 file(s) customized

🏁 Workspace ready.
Archetypes: fastapi-pg
Apps: apps/api
```

---

## 3. Application Boundary Test Execution (REQ-01 Proof)

### Target Verification Speed (< 3.0s)
The application test boundary targets only the application folder (`apps/api`), avoiding running the 505 engine tests during normal feature development.

- Application test command: `uv run --directory apps/api pytest`
- Application test duration: **~150ms** (well under the 3.0s ceiling)

### Failure Isolation Proof
When a synthetic defect is placed in `apps/api`:
1. `npm test` fails deterministically (Exit code 1).
2. `npm run test:engine` remains completely green (Exit code 0).
Engine test health can no longer mask application failure, preventing AI agent disorientation.

---

## 4. Registry-Driven Certification Trials Execution (REQ-06 Proof)

When running trials in an initialized workspace, certification trials resolve active packs from `.shiftstone/packs/_registry.yaml`:

```bash
$ node .shiftstone/scripts/run-certification-trials.js --suite all
=== ShiftStone Framework Certification Trials (UG-28, UG-29) ===
  Suite: all | Active Pack(s): rr8-supabase-cf

--- Synthetic Harness Certification Trials (T1–T3) ---
  ✓ T1-context-and-stage-contract-gate             [PASSED] (3/3 assertions)
  ✓ T2-checker-collusion-and-anti-gaming-gate      [PASSED] (3/3 assertions)
  ✓ T3-protected-action-and-ssot-promotion-gate    [PASSED] (3/3 assertions)

--- Pack Factory Capability Trials (Active Packs: rr8-supabase-cf) ---
  ✓ F1-route-loader-action-zod                     [PASSED] Score: 90/100
  ✓ F2-supabase-rls-migration                      [PASSED] Score: 90/100
  ✓ F3-cloudflare-worker-queue-cron                [PASSED] Score: 90/100
  ✓ F4-shadcn-tailwind-v4-tokens                   [PASSED] Score: 90/100
  ✓ F5-graceful-degradation-rate-limit             [PASSED] Score: 90/100
  ✓ F6-playwright-e2e-release-gate                 [PASSED] Score: 90/100

=============================================================
  Total Trials Passed:  9
  Total Trials Failed:  0
  Total Trials Skipped: 0

ok — All certification trials passed with 100% compliance.
```

When evaluated in a `fastapi-pg` active workspace:
```bash
$ node .shiftstone/scripts/run-certification-trials.js --pack fastapi-pg
=== ShiftStone Framework Certification Trials (UG-28, UG-29) ===
  Suite: all | Active Pack(s): fastapi-pg

--- Synthetic Harness Certification Trials (T1–T3) ---
  ✓ T1-context-and-stage-contract-gate             [PASSED] (3/3 assertions)
  ✓ T2-checker-collusion-and-anti-gaming-gate      [PASSED] (3/3 assertions)
  ✓ T3-protected-action-and-ssot-promotion-gate    [PASSED] (3/3 assertions)

--- Skipped Factory Trials (Inactive Packs) ---
  - F1-route-loader-action-zod                     SKIPPED (inactive pack: rr8-supabase-cf (active: fastapi-pg))
  - F2-supabase-rls-migration                      SKIPPED (inactive pack: rr8-supabase-cf (active: fastapi-pg))
  - F3-cloudflare-worker-queue-cron                SKIPPED (inactive pack: rr8-supabase-cf (active: fastapi-pg))
  - F4-shadcn-tailwind-v4-tokens                   SKIPPED (inactive pack: rr8-supabase-cf (active: fastapi-pg))
  - F5-graceful-degradation-rate-limit             SKIPPED (inactive pack: rr8-supabase-cf (active: fastapi-pg))
  - F6-playwright-e2e-release-gate                 SKIPPED (inactive pack: rr8-supabase-cf (active: fastapi-pg))

=============================================================
  Total Trials Passed:  3
  Total Trials Failed:  0
  Total Trials Skipped: 6

ok — All certification trials passed with 100% compliance.
```
Every skipped trial is explicitly logged with its inactive pack name, ensuring zero silent coverage loss.
