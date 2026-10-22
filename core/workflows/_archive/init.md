---
cost_tracking: workflow-end
description: Archetype composition interview + one-prompt workspace initializer — selects stack archetype packs, seeds governance, configures dual-repo git.
---

# /init — One-Prompt Workspace Initializer Workflow

> Use this workflow when initializing a fresh project: it runs the archetype composer (`core/init.js`), which selects stack archetype packs, seeds governance from them, and configures dual-repo git.

---

## Phase 1 — Scoping Interview

1. Conduct a brief 3-4 question scoping interview to capture:
   - **Stack Archetype**: which pack(s) to compose (default: the flagship pack; see `node core/init.js --validate` and `packs/_registry.yaml` for the available packs).
   - **SaaS Name**: Name of the SaaS application.
   - **User Segments**: Who will use the platform (e.g. public, authenticated users, admins).
   - **Primary Models**: Core tables to track (e.g. profiles, items, files).
   - **Integrations & Third-Party Services**: Payment providers (Stripe/Lemon Squeezy), transactional emails (Resend), AI/LLM vectors (pgvector/OpenAI), analytics, etc.
   - **GitHub Account / Org**: Username or organization for automated Dual-Repo Git remote setup.

---

## Phase 2 — Boilerplate & Configuration Execution

2. Propose and execute the one-step initialization command:
   ```powershell
   node core/init.js --name="ProjectName" --gh-user="my-github-user" --skills="stripe,resend" --layout="monorepo" --pm="pnpm" --clone-starter -y
   ```
   Add `--archetype=<pack>` / `--archetypes=<a>,<b>` to compose alternative or multiple stacks (or omit for the flagship default).

   *(Or in offline environments, supply `--starter-path="<local-path-to-the-starter>"`)*.

3. The composer automatically:
   - Validates every selected pack manifest against `packs/_schema.json` and refuses conflicting packs (`--force-namespace` overrides).
   - Runs each pack's `pre_init` hooks: the flagship pack clones its starter framework into `apps/web/`, placeholders create their app folders.
   - Seeds governance from the packs: applies `bible-overlays/` over `docs/bible/`, renders `decisions-seed.yaml` into `DECISIONS.md`, materializes pack skills as `.agents/skills/` junctions, writes `packs/_registry.yaml`, and regenerates `core/context/skills-manifest.yaml` + the `AGENTS.md` Skill INDEX.
   - Configures the **Dual-Repo Git Architecture**:
     - Detaches upstream starter Git remote in each `apps/<app>/`, sets user app origin, stages and commits locally on `main`.
     - Detaches upstream template remote in root, sets user workspace origin, ignores every app dir in root `.gitignore`, stages and commits locally on `main`.
     - Writes `.workspace-git.json` (version 2, one entry per archetype).
   - Generates root `pnpm-workspace.yaml` and `package.json` for monorepo orchestration (JS packagings).
   - Synthesizes project-specific skills inside `.agents/skills/<skill-name>/SKILL.md`.
   - Precision replaces template placeholders across documentation, rules, and package manifests.
   - Creates documentation directories and shared skills junctions for Claude Code (`.claude/skills`) and Command Code (`.commandcode/skills`).

---

## Phase 3 — Pre-fill Documentation & Synthesize Skills

4. Pre-fill initial schemas and guidelines directly:
   - Write SQL schemas inside `docs/bible/03-database/schema-reference.md`.
   - Write security policies inside `docs/bible/03-database/rls-policies.md`.
   - Write session guarding guidelines inside `docs/bible/04-auth-and-rbac/auth-overview.md`.
   - Write core domain rules inside `docs/bible/05-core-systems/core-domain-rules.md`.
   - Write route contracts inside `docs/bible/08-api-contracts/route-contracts.md`.
   - Append the first workspace-specific ADR (`DEC-010` onward — `DEC-001`…`DEC-009` are pack-seeded) inside `docs/bible/DECISIONS.md`.
   - Append initial entry to `docs/bible/CHANGELOG.md`.
   - If custom skills were synthesized, register them in `AGENTS.md`, `ANTIGRAVITY.md`, and `COMMANDCODE.md` under `## Project-Specific Skills`.

---

## Post-Write Checkpoint

- [ ] All directories created successfully
- [ ] Starter boilerplate cloned into `apps/web/` with independent `.git` repository
- [ ] Root `.gitignore` contains `/apps/web/` and `.workspace-git.json`
- [ ] Shared skills junctions (`.claude/skills` and `.commandcode/skills`) created
- [ ] Staging metadata written to `.workspace-git.json` (`"pushed": false`)
- [ ] Root `pnpm-workspace.yaml` and `package.json` created
- [ ] `docs/bugs/open-bugs.md` and `docs/research/README.md` initialized
- [ ] Database schemas pre-written into `schema-reference.md`
- [ ] Seeded ADRs (`DEC-001`…) present in `DECISIONS.md`
- [ ] Remind user: when ready to publish to GitHub, type `Push to GitHub` or run `/push`.

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node core/scripts/record-run.js init --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `core/context/cost-tracker.json`.
