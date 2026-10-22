# ShiftStone — Universal AI Development Workspace Framework

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/Package_Manager-pnpm_Workspaces-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React Router](https://img.shields.io/badge/Flagship-React_Router_8-F44250?style=flat-square&logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![Supabase](https://img.shields.io/badge/Flagship-Supabase_2026-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudflare](https://img.shields.io/badge/Flagship-Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

A **cloneable governance engine for AI development**: engineered loops with hard verification, progressive-disclosure skills within token budgets, cost telemetry, and a **Core + Packs** architecture that fits *any* stack â€” consumed identically by **Google Antigravity**, **Claude Code**, **Command Code**, and **OpenCode**.

> **Meta-layer, not a competitor** (blueprint Â§10.13): the framework replaces the *governance layer* around your IDE and model â€” rules, skills, workflows, loops, dual-repo architecture â€” not the IDE or the model themselves.

**Start here:** [Quick start](#-quick-start--3-ways-to-start) Â· [Choose a journey](#-three-journeys-one-framework) Â· [Pack gallery](#-pack-gallery) Â· [IDE walkthroughs](./docs/videos/README.md) Â· [Development Bible](./docs/bible/README.md)

---

## ðŸ’¡ What is This Framework?

Not a boilerplate â€” a **production harness for AI pair-programming**:

1. **Loop harness** (`core/harness/`) â€” every automated task is a `LoopSpecification`: declared trigger (manual/scheduled/event â€” actually actuated), verification ladder **L1â€“L5**, budget + stagnation brakes, and exactly **five terminal states** (`success` / `no_op` / `blocked` / `stalled` / `exhausted`). Specs that can't prove their check works (red-before/green-after), recurse, or lack an off-ramp **refuse to compile**.
2. **Two-Gear Verification** â€” inner gear: solo maker on deterministic L1/L2 checks, zero subagents, zero latency. Outer gear: a **mandatory disjoint Checker** (`/verify`, score â‰¥ 0.8) for deploys, pushes, migrations, cron changes and **every backlog `[x]`**. The maker never self-certifies.
3. **Evals in CI** â€” tests cover the deterministic half; labeled eval datasets, 5-dimension rubrics and trajectory scoring cover the non-deterministic half. A regressed eval blocks the merge (`.github/workflows/evals-in-ci.yml`).
4. **Context engine** â€” 42 skills (37 pack + 5 core) with progressive disclosure (`SKILL.md` â†’ `instructions.md` â†’ `resources/` where deep reference warrants), a budget-enforced loader, path-scoped rules, and â‰¤200-line static context per IDE.
5. **Observability** â€” every workflow appends to `runs.jsonl`; **Cost per Accepted Change (CAC)** per loop, per archetype, per week; lineage tracing and drift dashboards.
6. **Dual-Repo Monorepo Architecture** â€” root workspace governance/docs stay separate from the nested app repo (`apps/<app>/`), each with its own remote; staged locally, pushed on demand (`/push`).
7. **Pack-based stack decoupling** â€” the Core is stack-agnostic; stacks ship as **archetype packs** (manifest + skills + bible overlays + scaffold), validated in CI.

---

## ðŸŽ¯ Three Journeys, One Framework

### ðŸ† Journey 1 â€” Flagship (RR8 + Supabase + Cloudflare)

Clone and be immediately productive with the default archetype â€” 42 skills (37 pack + 5 core), bible overlays, 9 ADRs, dual-repo wiring:

```sh
git clone https://github.com/vishal-ranjan-codes/react-router-supabase-workspace-framework.git my-saas
cd my-saas
node core/init.js --name="MySaaS" --clone-starter -y
```

Or in your AI IDE: create a folder, clone into it, type `/init`.

### ðŸ”€ Journey 2 â€” Alternative Stack (zero RR8 pollution)

Pick a different archetype at init â€” the composed workspace contains **zero React Router tokens** (verified exit criterion; tested in CI):

```sh
git clone https://github.com/vishal-ranjan-codes/react-router-supabase-workspace-framework.git my-app
cd my-app

node core/init.js --archetype=sveltekit-supabase  --name="MyWeb"  -y   # SvelteKit + Supabase
node core/init.js --archetype=fastapi-pg           --name="MyApi"  -y   # FastAPI + PostgreSQL
node core/init.js --archetype=go-chi-postgres      --name="MyGo"   -y   # Go + Chi + PostgreSQL
```

### ðŸ§© Journey 3 â€” Additive Polyglot Monorepo

Compose multiple archetypes side by side â€” each app gets its own folder, path-scoped skills and **independent git remote** under one workspace root:

```sh
git clone https://github.com/vishal-ranjan-codes/react-router-supabase-workspace-framework.git my-platform
cd my-platform

node core/init.js --archetypes=rr8-supabase-cf,fastapi-pg --name="MyPlatform" -y
# apps/web/  â†’ React Router 8 + Supabase + Cloudflare   (own remote)
# apps/api/  â†’ FastAPI + PostgreSQL                      (own remote)

# attach a mobile leg later:
node core/init.js --archetypes=rr8-supabase-cf,expo-react-native,go-chi-postgres --name="MyPlatform" -y
```

Conflicting packs (two packs owning the same folder) are **refused with an explanation** (blueprint Â§10.4); `--force-namespace` is the power-user escape hatch.

> **Already on v1.x?** Run `node core/migrate-v1-to-v2.js` â€” dry-run by default, never touches your code/backlog/decisions. See [Migrating from v1.x](#-migrating-from-v1x).

---

## ðŸ–¼ï¸ Pack Gallery

| Pack | Tier | Stack | App path | Status | Notes |
|---|---|---|---|---|---|
| [`rr8-supabase-cf`](./packs/rr8-supabase-cf/manifest.yaml) | **flagship** | React Router 8 Â· Supabase Â· Cloudflare Workers | `apps/web` | **full** â€” 38 skills, bible overlays, 9 ADRs, scaffold | Default; ships MCP `supabase` server |
| [`nextjs-prisma-pg`](./packs/nextjs-prisma-pg/manifest.yaml) | starter | Next.js Â· Prisma Â· PostgreSQL | `apps/web` | scaffolded (manifest + scaffold; skills later) | Conflicts with `rr8-supabase-cf` (owns `apps/web`) |
| [`sveltekit-supabase`](./packs/sveltekit-supabase/manifest.yaml) | starter | SvelteKit Â· Supabase | `apps/web` | scaffolded (manifest + scaffold; skills later) | Conflicts with `rr8-supabase-cf`, `nextjs-prisma-pg` |
| [`fastapi-pg`](./packs/fastapi-pg/manifest.yaml) | starter | FastAPI Â· PostgreSQL | `apps/api` | scaffolded (manifest + scaffold; skills later) | Polyglot-ready |
| [`expo-react-native`](./packs/expo-react-native/manifest.yaml) | starter | Expo Â· React Native | `apps/mobile` | scaffolded (manifest + scaffold; skills later) | Mobile leg of a polyglot monorepo |
| [`go-chi-postgres`](./packs/go-chi-postgres/manifest.yaml) | starter | Go Â· chi Â· PostgreSQL | `apps/api-go` | scaffolded (manifest + scaffold; skills later) | Polyglot-ready alongside `fastapi-pg` |

**Labels:** *full* = skills + overlays shipped; *scaffolded* = valid manifest + working app skeleton, skills/bible overlays authored incrementally (the [contributor checklist](./CONTRIBUTING.md) covers graduating a pack). Every manifest validates against [`packs/_schema.json`](./packs/_schema.json) in CI (`.github/workflows/validate-packs.yml`).

---

## ðŸ§­ What's Inside (Core Engine)

| Area | Path | What it does |
|---|---|---|
| Loop harness | `core/harness/` | Loop runner, verifier ladder (L1â€“L5), terminal-state machine, brakes, triggers (cron/event/webhook), checker spawn |
| Context engine | `core/context/` | Skills manifest + loader, token budgets, model routing |
| Static & path rules | `core/static-rules/`, `core/path-scoped-rules/` | Always-on 200-line budget: task dispatch, product identity, security, Two-Gear boundary; glob-scoped stack/UI/quality rules |
| Governance | `core/governance/` | OKF index generator, bible ToC generator, stage contracts, changelog compiler |
| Observability | `core/observability/` | Cost tracker, CAC aggregator, drift dashboard, lineage tracer, trace visualizer |
| Core Skills | `.agents/skills/ss-*/` | 30 first-party 3-tier skills (`/ss-*` slash commands incl. `/ss-verify`) |
| Evals | `evals/` | Labeled datasets + runner (`node core/harness/evals/run.js --strict`) |
| Archetype composer | `core/init.js`, `core/init/` | `--archetype`/`--archetypes`/`--validate`, dual-repo engine, seed governance |
| Migration | `core/migrate-v1-to-v2.js` | v1.x â†’ v2.0 (dry-run default, non-destructive) |
| IDE shims | `core/ide-shims/`, root `.md` shims | Per-IDE thin shims; junction links enforce zero-drift parity |

**CI gates:** `parity-check.yml` (duplication, junctions, budgets, loop specs, OKF frontmatter, links, indexes, changelog, backlog signatures, ownership) Â· `evals-in-ci.yml` (eval regression) Â· `validate-packs.yml` (every pack manifest + composition conflicts).

---

## ðŸ§­ Tool Access â€” MCP

**MCP (Model Context Protocol) is the framework's tool-access standard** (blueprint Â§10.18):

- Root [`opencode.json`](./opencode.json) carries workspace servers (e.g. `github`), credentials via environment variables only.
- Packs contribute servers through `composition.opencode.mcp` (e.g. `supabase` in `rr8-supabase-cf`), merged at composition.
- New integrations ship as MCP servers â€” bespoke per-IDE glue is refused at review.
- **A2A agent-to-agent delegation is explicitly deferred** (rationale in blueprint Â§10.18); intra-workspace delegation is served by the Checker subagent.

Docs: [`core/ide-shims/opencode/README.md`](./core/ide-shims/opencode/README.md).

---

## âš¡ Quick Start â€” 3 Ways to Start a Project

### ðŸ¥‡ Option 1: IDE-First (recommended for AI IDEs â€” zero folder renaming)

1. Create an empty folder and open it in your AI IDE (Antigravity / Claude Code / Command Code / OpenCode).
2. In the AI chat, paste:
   ```
   Clone https://github.com/vishal-ranjan-codes/react-router-supabase-workspace-framework.git into this folder and initialize the workspace.
   ```
3. The agent clones into `.` and runs `/init` â€” no folder renaming, no file-lock surprises.

### ðŸ’» Option 2: Terminal-First

```sh
git clone https://github.com/vishal-ranjan-codes/react-router-supabase-workspace-framework.git my-awesome-project
cd my-awesome-project
code .
# in chat: /init     â€” or in a terminal: node core/init.js
```

> [!TIP]
> **Why name the folder at clone time?** On Windows and Unix, running processes hold locks on their CWD. Naming during `git clone` avoids `EBUSY` rename failures.

### ðŸŒ Option 3: GitHub-First ("Use this template")

1. Click **Use this template** â†’ name your workspace repo.
2. `git clone https://github.com/<you>/<repo>.git my-project && cd my-project`
3. Open your IDE, type `/init`.

### âš™ï¸ Initializer flags

```sh
# Non-interactive, flagship default
node core/init.js --name="AcmeSaaS" --gh-user="me" --skills="stripe,resend" --layout="monorepo" --pm="pnpm" --clone-starter -y

# Alternative stack / polyglot (see journeys above)
node core/init.js --archetype=fastapi-pg --name="MyApi" -y
node core/init.js --archetypes=rr8-supabase-cf,fastapi-pg --name="MyPlatform" -y

# CI: validate every pack manifest without writing anything
node core/init.js --validate
```

*(Offline: pass `--starter-path=<local starter dir>` to copy from disk instead of cloning.)*

**Init never pushes to the internet** â€” it stages and commits both repositories locally.

---

## ðŸš€ Publishing On-Demand (`/push`)

When you're ready:

```
/push          (or: "Push to GitHub")
```

The agent reads `.workspace-git.json`, creates both GitHub repositories (`<project>-app` + `<project>-workspace`) via `gh` if authenticated, pushes the app repo then the workspace repo, and returns clickable links. `/push` always runs the outer-gate `/verify` first â€” no push without Checker sign-off.

---

## ðŸ§  41 Specialist AI Skills

Shipped by the flagship pack + core (3-tier bundles, indexed by `core/context/skills-manifest.yaml`, junctioned into `.agents/skills/`):

| Pillar | Skills | Core Focus |
|---|---|---|
| **React Router 8** | `react-router-routing`, `react-router-middleware`, `react-router-data-loading`, `react-router-actions-forms`, `react-router-typegen`, `react-router-error-boundaries` | Native `Route.MiddlewareFunction` & `createContext`, `data()` / `redirect()` helpers, React 19 `useActionState`, typegen props. |
| **Supabase SSR 2026** | `supabase-auth`, `supabase-rls`, `supabase-postgres`, `supabase-migrations`, `supabase-api-keys`, `supabase-realtime` | 2026 opaque keys (`sb_publishable_...` / `sb_secret_...`), zero-latency JWKS JWT validation via `getClaims()`, network verification via `getUser()`, declarative RLS. |
| **Cloudflare Edge** | `cloudflare-workers`, `cloudflare-r2`, `cloudflare-cron`, `cloudflare-kv`, `cloudflare-d1`, `cloudflare-queues` | 128MB V8 isolate memory ceiling, streaming uploads, cron handlers with PostgreSQL advisory locks, high-performance KV caching. |
| **UI & Design System** | `tailwind-v4`, `design-tokens`, `shadcn-ui`, `theme-management` | Tailwind CSS v4 `@theme` directive, CSS custom properties, self-hosted Inter variable font, SSR dark-mode anti-flicker script. |
| **Validation & Security**| `zod-validation`, `security-headers`, `rate-limiting`, `graceful-degradation` | Standardized `ActionResult<T>`, dynamic nonce CSP, sliding-window rate limiters, mock fallback services. |
| **Testing & CI/CD** | `vitest-testing`, `playwright-e2e`, `ci-cd-cloudflare` | Workerd unit testing, browser E2E, automated GitHub Actions deployment. |
| **Master & Governance** | `stack`, `ui`, `jobs`, `storage`, `ss-docs`, `backlog`, `ss-bookkeeping`, `find-skills`, `research-methodology`, `swarm`, `web-design-guidelines`, `ss-loop-author`, `ss-add-skill`, `ss-upgrade-skill`, `ss-brand-naming`, `ss-plan`, `ss-execute-plan`, `ss-simplify`, `ss-brainstorm` | Orchestration, documentation sync, knowledge-bundle bookkeeping, finding/installing skills from skills.sh, swarm coordination, loop/skill authoring. |

Path-scoped loading: editing `apps/web/**` pulls the RR8/Supabase/Cloudflare skills; editing `docs/bible/**` pulls the bible rules â€” always within the token budget. Project-specific skills (Stripe, Resend, pgvector, â€¦) are synthesized at init and registered in `AGENTS.md`.

---

## ðŸ› ï¸ Daily AI Slash Commands (ShiftStone ss-* Skills)

| Command | Action |
|---|---|
| `/ss-init` | Compose your archetype(s), set up dual-repo git, pre-fill the architecture bible. |
| `/ss-plan` | Author structured ICM implementation plans and Plan Units in `docs/plans/`. |
| `/ss-execute-plan` | Execute approved implementation plans unit-by-unit with bounded context. |
| `/ss-new-feature` | Feature loop: spec (human gate) â†’ implement â†’ verify (L4, outer gate). |
| `/ss-new-migration` | Database migration with automated RLS policy plan (outer gate). |
| `/ss-new-cron-job` | Scheduled background worker with advisory locking (outer gate). |
| `/ss-sync-bible` | Audit code against the doc SSOT; fixes apply only after Checker sign-off â‰¥ 80. |
| `/ss-schema-sync` | Sync migrations â†” types â†” bible schemas (incremental, fingerprint-gated). |
| `/ss-diagnose` | Typecheck/lint/build triage loop â€” inner gear, auto-rollback on regression. |
| `/ss-verify <task>` | **Mandatory outer gate**: disjoint Checker; score < 80 blocks closure. |
| `/ss-status` | Dashboard: CAC, terminal-state histogram, oversight modes. |
| `/ss-push` | Verify, then push workspace + app repos to GitHub. |

Full reference: [`.agents/skills/`](./.agents/skills/) Â· Loop CLI: `node core/harness/cli.js run|schedule|watch|trigger|validate|status <loop-id>`

---

## ðŸ›ï¸ Dual-Repo Monorepo Architecture

```
Your Project Workspace (Local Filesystem)
â”‚
â”œâ”€â”€ [Root Workspace Git Repository]           â† Tracks: docs/, core/, packs/, .agent/, .agents/skills/, .claude/, .commandcode/
â”‚   â”‚                                            Remote: github.com/<user>/<project>-workspace.git
â”‚   â”œâ”€â”€ .git/                                 â† Root Git database
â”‚   â”œâ”€â”€ docs/                                 â† Living architecture bible & backlog
â”‚   â”œâ”€â”€ core/                                 â† Harness engine: loop runner, context, governance, composer
â”‚   â”œâ”€â”€ packs/                                â† Stack archetype packs (manifests, skills, overlays, scaffolds)
â”‚   â”œâ”€â”€ .agents/skills/                       â† 42 skills (junctioned from packs + core) + synthesized project skills
â”‚   â”œâ”€â”€ pnpm-workspace.yaml Â· package.json    â† Monorepo config + root script orchestrator
â”‚   â””â”€â”€ .workspace-git.json                   â† Staging metadata (gitignored)
â”‚
â””â”€â”€ apps/web/                                 â† [Nested App Git Repository] (remote: ...-app.git)
    â”‚                                            Independent .git/, pushed/deployed on its own
    â”œâ”€â”€ app/ Â· workers/ Â· wrangler.jsonc      â† React Router 8 + Cloudflare (flagship shape)
    â””â”€â”€ package.json                          â† Package @<project>-web
```

- **Zero pollution** â€” the app repo stays clean and deployable; governance history lives in the workspace repo.
- **Unified local DX** â€” `pnpm dev` / `pnpm build` / `pnpm test` from the workspace root across `pnpm-workspace.yaml`.
- **Per-archetype remotes** â€” every composed app gets an independent `.git` + remote (dual-repo engine, `core/init/dual-repo.js`).

---

## 🗺️ Architecture & Development Bible

The Single Source of Truth (SSOT) for architecture and development conventions:

- **Development Bible (SSOT)**: [docs/bible/README.md](./docs/bible/README.md)
- **Architecture Overview**: [docs/bible/01-architecture/architecture-overview.md](./docs/bible/01-architecture/architecture-overview.md)
- **ADRs & Decisions**: [docs/bible/DECISIONS.md](./docs/bible/DECISIONS.md)
- **Development Backlog**: [docs/backlog/MOC.md](./docs/backlog/MOC.md)
---

## ðŸ”„ Migrating from v1.x

```sh
node core/migrate-v1-to-v2.js            # dry-run: detect + plan, writes nothing
node core/migrate-v1-to-v2.js --apply    # migrate + write docs/reports/<ts>-v1-to-v2-migration.md
```

Guarantees: dry-run by default; harness files merge **missing-only** (existing files always win); your **code (`apps/**`), backlog, bible/decisions and custom skills are never touched**; RR8-coupled skills relocate into the pack only when the pack doesn't already ship them; every apply emits a migration report. `--root=<dir>` migrates another workspace; `--archetype=<name>` overrides the suggestion.

---

## ðŸ¤ Contributing

New pack? New skill? Harness change? Follow **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** â€” end-to-end pack checklist, two-tier skill review (auto-merge tier vs. foundation tier), and the verification commands CI runs on every PR.

**IDE walkthroughs** (init â†’ skills â†’ first loop â†’ `/verify`): [`docs/videos/README.md`](./docs/videos/README.md) â€” Antigravity Â· Claude Code Â· Command Code Â· OpenCode.

---

## ðŸ›¡ï¸ Harness Ownership (as-code governance)

The AI harness â€” steering files, rules, workflows, evals and skills â€” is treated like production code: versioned, PR-reviewed, with named owners ([`CODEOWNERS`](./CODEOWNERS), rule: [`core/static-rules/governance.md`](./core/static-rules/governance.md)).

| Harness Area | Paths | Owner |
|---|---|---|
| Orientation & prompts | `AGENTS.md`, `ANTIGRAVITY.md`, `CLAUDE.md`, `COMMANDCODE.md` | `@vishal-ranjan-codes` |
| Rules | `core/static-rules/`, `core/path-scoped-rules/` | `@vishal-ranjan-codes` |
| Evals | `evals/` | `@vishal-ranjan-codes` |
| Skills (core + pack bundles) | `.agents/skills/`, `packs/*/skills/` | `@vishal-ranjan-codes` |

**Change rule:** harness files change only via pull request with the self-review checklist from `core/static-rules/governance.md` (parity, tests, regenerated indexes, why + evidence). Solo repositories degrade to the same checklist as a mandatory self-review â€” CI enforces ownership coverage either way (`node core/scripts/check-harness-ownership.js --strict`).

---

## ðŸ“œ License

MIT License. Designed with â¤ï¸ for the modern AI engineering era.
