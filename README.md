# ShiftStone — Universal AI Development Workspace Framework

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/Package_Manager-pnpm_Workspaces-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React Router](https://img.shields.io/badge/Flagship-React_Router_8-F44250?style=flat-square&logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![Supabase](https://img.shields.io/badge/Flagship-Supabase_2026-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudflare](https://img.shields.io/badge/Flagship-Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

A **cloneable governance engine for AI development**: engineered loops with hard verification, progressive-disclosure skills within token budgets, cost telemetry, and a **Core + Packs** architecture that fits *any* stack — consumed identically by **Google Antigravity**, **Claude Code**, **Command Code**, and **OpenCode**.

> **Meta-layer, not a competitor** (blueprint §10.13): the framework replaces the *governance layer* around your IDE and model — rules, skills, workflows, loops, dual-repo architecture — not the IDE or the model themselves.

**Start here:** [Quick start](#-quick-start--3-ways-to-start) · [Choose a journey](#-three-journeys-one-framework) · [Pack gallery](#-pack-gallery) · [IDE walkthroughs](./docs/videos/README.md) · [Development Bible](./docs/bible/README.md)

---

## 💡 What is This Framework?

Not a boilerplate — a **production harness for AI pair-programming**:

1. **Loop harness** (`.shiftstone/harness/`) — every automated task is a `LoopSpecification`: declared trigger (manual/scheduled/event — actually actuated), verification ladder **L1–L5**, budget + stagnation brakes, and exactly **five terminal states** (`success` / `no_op` / `blocked` / `stalled` / `exhausted`). Specs that can't prove their check works (red-before/green-after), recurse, or lack an off-ramp **refuse to compile**.
2. **Two-Gear Verification** — inner gear: solo maker on deterministic L1/L2 checks, zero subagents, zero latency. Outer gear: a **mandatory disjoint Checker** (`/verify`, score ≥ 0.8) for deploys, pushes, migrations, cron changes and **every backlog `[x]`**. The maker never self-certifies.
3. **Evals in CI** — tests cover the deterministic half; labeled eval datasets, 5-dimension rubrics and trajectory scoring cover the non-deterministic half. A regressed eval blocks the merge (`.github/workflows/evals-in-ci.yml`).
4. **Context engine** — 42 skills (37 pack + 5 core) with progressive disclosure (`SKILL.md` → `instructions.md` → `resources/` where deep reference warrants), a budget-enforced loader, path-scoped rules, and ≤200-line static context per IDE.
5. **Observability** — every workflow appends to `runs.jsonl`; **Cost per Accepted Change (CAC)** per loop, per archetype, per week; lineage tracing and drift dashboards.
6. **Dual-Repo Monorepo Architecture** — root workspace governance/docs stay separate from the nested app repo (`apps/<app>/`), each with its own remote; staged locally, pushed on demand (`/push`).
7. **Pack-based stack decoupling** — the Core is stack-agnostic; stacks ship as **archetype packs** (manifest + skills + bible overlays + scaffold), validated in CI.

---

## 🎯 Three Journeys, One Framework

### 🏆 Journey 1 — Flagship (RR8 + Supabase + Cloudflare)

Clone and be immediately productive with the default archetype — 42 skills (37 pack + 5 core), bible overlays, 9 ADRs, dual-repo wiring:

```sh
git clone https://github.com/vishal-ranjan-codes/shiftstone.git my-saas
cd my-saas
node .shiftstone/init.js --name="MySaaS" --clone-starter -y
```

Or in your AI IDE: create a folder, clone into it, type `/init`.

### 🔀 Journey 2 — Alternative Stack (zero RR8 pollution)

Pick a different archetype at init — the composed workspace contains **zero React Router tokens** (verified exit criterion; tested in CI):

```sh
git clone https://github.com/vishal-ranjan-codes/shiftstone.git my-app
cd my-app

node .shiftstone/init.js --archetype=sveltekit-supabase  --name="MyWeb"  -y   # SvelteKit + Supabase
node .shiftstone/init.js --archetype=fastapi-pg           --name="MyApi"  -y   # FastAPI + PostgreSQL
node .shiftstone/init.js --archetype=go-chi-postgres      --name="MyGo"   -y   # Go + Chi + PostgreSQL
```

### 🧩 Journey 3 — Additive Polyglot Monorepo

Compose multiple archetypes side by side — each app gets its own folder, path-scoped skills and **independent git remote** under one workspace root:

```sh
git clone https://github.com/vishal-ranjan-codes/shiftstone.git my-platform
cd my-platform

node .shiftstone/init.js --archetypes=rr8-supabase-cf,fastapi-pg --name="MyPlatform" -y
# apps/web/  → React Router 8 + Supabase + Cloudflare   (own remote)
# apps/api/  → FastAPI + PostgreSQL                      (own remote)

# attach a mobile leg later:
node .shiftstone/init.js --archetypes=rr8-supabase-cf,expo-react-native,go-chi-postgres --name="MyPlatform" -y
```

Conflicting packs (two packs owning the same folder) are **refused with an explanation** (blueprint §10.4); `--force-namespace` is the power-user escape hatch.

> **Already on v1.x?** Run `node .shiftstone/migrate-v1-to-v2.js` — dry-run by default, never touches your code/backlog/decisions. See [Migrating from v1.x](#-migrating-from-v1x).

---

## 🖼️ Pack Gallery

| Pack | Tier | Stack | App path | Status | Notes |
|---|---|---|---|---|---|
| [`rr8-supabase-cf`](./.shiftstone/packs/rr8-supabase-cf/manifest.yaml) | **flagship** | React Router 8 · Supabase · Cloudflare Workers | `apps/web` | **full** — 38 skills, bible overlays, 9 ADRs, scaffold | Default; ships MCP `supabase` server |
| [`nextjs-prisma-pg`](./.shiftstone/packs/nextjs-prisma-pg/manifest.yaml) | starter | Next.js · Prisma · PostgreSQL | `apps/web` | scaffolded (manifest + scaffold; skills later) | Conflicts with `rr8-supabase-cf` (owns `apps/web`) |
| [`sveltekit-supabase`](./.shiftstone/packs/sveltekit-supabase/manifest.yaml) | starter | SvelteKit · Supabase | `apps/web` | scaffolded (manifest + scaffold; skills later) | Conflicts with `rr8-supabase-cf`, `nextjs-prisma-pg` |
| [`fastapi-pg`](./.shiftstone/packs/fastapi-pg/manifest.yaml) | starter | FastAPI · PostgreSQL | `apps/api` | scaffolded (manifest + scaffold; skills later) | Polyglot-ready |
| [`expo-react-native`](./.shiftstone/packs/expo-react-native/manifest.yaml) | starter | Expo · React Native | `apps/mobile` | scaffolded (manifest + scaffold; skills later) | Mobile leg of a polyglot monorepo |
| [`go-chi-postgres`](./.shiftstone/packs/go-chi-postgres/manifest.yaml) | starter | Go · chi · PostgreSQL | `apps/api-go` | scaffolded (manifest + scaffold; skills later) | Polyglot-ready alongside `fastapi-pg` |

**Labels:** *full* = skills + overlays shipped; *scaffolded* = valid manifest + working app skeleton, skills/bible overlays authored incrementally (the [contributor checklist](./CONTRIBUTING.md) covers graduating a pack). Every manifest validates against [`.shiftstone/packs/_schema.json`](./.shiftstone/packs/_schema.json) in CI (`.github/workflows/validate-packs.yml`).

---

## 🧭 What's Inside (Core Engine)

| Area | Path | What it does |
|---|---|---|
| Loop harness | `.shiftstone/harness/` | Loop runner, verifier ladder (L1–L5), terminal-state machine, brakes, triggers (cron/event/webhook), checker spawn |
| Context engine | `.shiftstone/context/` | Skills manifest + loader, token budgets, model routing |
| Static & path rules | `.shiftstone/static-rules/`, `.shiftstone/path-scoped-rules/` | Always-on 200-line budget: task dispatch, product identity, security, Two-Gear boundary; glob-scoped stack/UI/quality rules |
| Governance | `.shiftstone/governance/` | OKF index generator, bible ToC generator, stage contracts, changelog compiler |
| Observability | `.shiftstone/observability/` | Cost tracker, CAC aggregator, drift dashboard, lineage tracer, trace visualizer |
| Core Skills | `.agents/skills/ss-*/` | 30 first-party 3-tier skills (`/ss-*` slash commands incl. `/ss-verify`) |
| Evals | `evals/` | Labeled datasets + runner (`node .shiftstone/harness/evals/run.js --strict`) |
| Archetype composer | `.shiftstone/init.js`, `.shiftstone/init/` | `--archetype`/`--archetypes`/`--validate`, dual-repo engine, seed governance |
| Migration | `.shiftstone/migrate-v1-to-v2.js` | v1.x → v2.0 (dry-run default, non-destructive) |
| IDE shims | `.shiftstone/ide-shims/`, root `.md` shims | Per-IDE thin shims; junction links enforce zero-drift parity |

**CI gates:** `parity-check.yml` (duplication, junctions, budgets, loop specs, OKF frontmatter, links, indexes, changelog, backlog signatures, ownership) · `evals-in-ci.yml` (eval regression) · `validate-packs.yml` (every pack manifest + composition conflicts).

---

## 🧭 Tool Access — MCP

**MCP (Model Context Protocol) is the framework's tool-access standard** (blueprint §10.18):

- Root [`opencode.json`](./opencode.json) carries workspace servers (e.g. `github`), credentials via environment variables only.
- Packs contribute servers through `composition.opencode.mcp` (e.g. `supabase` in `rr8-supabase-cf`), merged at composition.
- New integrations ship as MCP servers — bespoke per-IDE glue is refused at review.
- **A2A agent-to-agent delegation is explicitly deferred** (rationale in blueprint §10.18); intra-workspace delegation is served by the Checker subagent.

Docs: [`.shiftstone/ide-shims/opencode/README.md`](./.shiftstone/ide-shims/opencode/README.md).

---

## ⚡ Quick Start — 3 Ways to Start a Project

### 🌅 Day-0 order (clone → install → scaffold → run)

```sh
git clone https://github.com/vishal-ranjan-codes/shiftstone.git my-app
cd my-app
pnpm install                                                                # engine + tooling
node .shiftstone/packs/rr8-supabase-cf/scaffold-script.js --root=. --yes    # scaffold apps/web
npm run dev                                                                 # develop the application
npm test                                                                    # test the application (apps/web)
```

The core six scripts (`dev` / `build` / `start` / `test` / `typecheck` / `lint`) target **your application** in `apps/web`; framework engine checks are namespaced as `test:engine` / `typecheck:engine` / `lint:engine`. **Before scaffolding, `npm run test:engine` is the only green test command** — `apps/web` does not exist yet.

### 🥇 Option 1: IDE-First (recommended for AI IDEs — zero folder renaming)

1. Create an empty folder and open it in your AI IDE (Antigravity / Claude Code / Command Code / OpenCode).
2. In the AI chat, paste:
   ```
   Clone https://github.com/vishal-ranjan-codes/shiftstone.git into this folder and initialize the workspace.
   ```
3. The agent clones into `.` and runs `/init` — no folder renaming, no file-lock surprises.

### 💻 Option 2: Terminal-First

```sh
git clone https://github.com/vishal-ranjan-codes/shiftstone.git my-awesome-project
cd my-awesome-project
code .
# in chat: /init     — or in a terminal: node .shiftstone/init.js
```

> [!TIP]
> **Why name the folder at clone time?** On Windows and Unix, running processes hold locks on their CWD. Naming during `git clone` avoids `EBUSY` rename failures.

### 🌐 Option 3: GitHub-First ("Use this template")

1. Click **Use this template** → name your workspace repo.
2. `git clone https://github.com/<you>/<repo>.git my-project && cd my-project`
3. Open your IDE, type `/init`.

### ⚙️ Initializer flags

```sh
# Non-interactive, flagship default
node .shiftstone/init.js --name="AcmeSaaS" --gh-user="me" --skills="stripe,resend" --layout="monorepo" --pm="pnpm" --clone-starter -y

# Alternative stack / polyglot (see journeys above)
node .shiftstone/init.js --archetype=fastapi-pg --name="MyApi" -y
node .shiftstone/init.js --archetypes=rr8-supabase-cf,fastapi-pg --name="MyPlatform" -y

# CI: validate every pack manifest without writing anything
node .shiftstone/init.js --validate
```

*(Offline: pass `--starter-path=<local starter dir>` to copy from disk instead of cloning.)*

**Init never pushes to the internet** — it stages and commits both repositories locally.

---

## 🚀 Publishing On-Demand (`/push`)

When you're ready:

```
/push          (or: "Push to GitHub")
```

The agent reads `.workspace-git.json`, creates both GitHub repositories (`<project>-app` + `<project>-workspace`) via `gh` if authenticated, pushes the app repo then the workspace repo, and returns clickable links. `/push` always runs the outer-gate `/verify` first — no push without Checker sign-off.

---

## 🧠 41 Specialist AI Skills

Shipped by the flagship pack + core (3-tier bundles, indexed by `.shiftstone/context/skills-manifest.yaml`, junctioned into `.agents/skills/`):

| Pillar | Skills | Core Focus |
|---|---|---|
| **React Router 8** | `react-router-routing`, `react-router-middleware`, `react-router-data-loading`, `react-router-actions-forms`, `react-router-typegen`, `react-router-error-boundaries` | Native `Route.MiddlewareFunction` & `createContext`, `data()` / `redirect()` helpers, React 19 `useActionState`, typegen props. |
| **Supabase SSR 2026** | `supabase-auth`, `supabase-rls`, `supabase-postgres`, `supabase-migrations`, `supabase-api-keys`, `supabase-realtime` | 2026 opaque keys (`sb_publishable_...` / `sb_secret_...`), zero-latency JWKS JWT validation via `getClaims()`, network verification via `getUser()`, declarative RLS. |
| **Cloudflare Edge** | `cloudflare-workers`, `cloudflare-r2`, `cloudflare-cron`, `cloudflare-kv`, `cloudflare-d1`, `cloudflare-queues` | 128MB V8 isolate memory ceiling, streaming uploads, cron handlers with PostgreSQL advisory locks, high-performance KV caching. |
| **UI & Design System** | `tailwind-v4`, `design-tokens`, `shadcn-ui`, `theme-management` | Tailwind CSS v4 `@theme` directive, CSS custom properties, self-hosted Inter variable font, SSR dark-mode anti-flicker script. |
| **Validation & Security**| `zod-validation`, `security-headers`, `rate-limiting`, `graceful-degradation` | Standardized `ActionResult<T>`, dynamic nonce CSP, sliding-window rate limiters, mock fallback services. |
| **Testing & CI/CD** | `vitest-testing`, `playwright-e2e`, `ci-cd-cloudflare` | Workerd unit testing, browser E2E, automated GitHub Actions deployment. |
| **Master & Governance** | `stack`, `ui`, `jobs`, `storage`, `ss-docs`, `backlog`, `ss-bookkeeping`, `find-skills`, `research-methodology`, `swarm`, `web-design-guidelines`, `ss-loop-author`, `ss-add-skill`, `ss-upgrade-skill`, `ss-brand-naming`, `ss-plan`, `ss-execute-plan`, `ss-simplify`, `ss-brainstorm` | Orchestration, documentation sync, knowledge-bundle bookkeeping, finding/installing skills from skills.sh, swarm coordination, loop/skill authoring. |

Path-scoped loading: editing `apps/web/**` pulls the RR8/Supabase/Cloudflare skills; editing `docs/bible/**` pulls the bible rules — always within the token budget. Project-specific skills (Stripe, Resend, pgvector, …) are synthesized at init and registered in `AGENTS.md`.

---

## 🛠️ Daily AI Slash Commands (ShiftStone ss-* Skills)

| Command | Action |
|---|---|
| `/ss-init` | Compose your archetype(s), set up dual-repo git, pre-fill the architecture bible. |
| `/ss-plan` | Author structured ICM implementation plans and Plan Units in `docs/plans/`. |
| `/ss-execute-plan` | Execute approved implementation plans unit-by-unit with bounded context. |
| `/ss-new-feature` | Feature loop: spec (human gate) → implement → verify (L4, outer gate). |
| `/ss-new-migration` | Database migration with automated RLS policy plan (outer gate). |
| `/ss-new-cron-job` | Scheduled background worker with advisory locking (outer gate). |
| `/ss-sync-bible` | Audit code against the doc SSOT; fixes apply only after Checker sign-off ≥ 80. |
| `/ss-schema-sync` | Sync migrations ↔ types ↔ bible schemas (incremental, fingerprint-gated). |
| `/ss-diagnose` | Typecheck/lint/build triage loop — inner gear, auto-rollback on regression. |
| `/ss-verify <task>` | **Mandatory outer gate**: disjoint Checker; score < 80 blocks closure. |
| `/ss-status` | Dashboard: CAC, terminal-state histogram, oversight modes. |
| `/ss-push` | Verify, then push workspace + app repos to GitHub. |

Full reference: [`.agents/skills/`](./.agents/skills/) · Loop CLI: `node .shiftstone/harness/cli.js run|schedule|watch|trigger|validate|status <loop-id>`

---

## 🏛️ Dual-Repo Monorepo Architecture

```
Your Project Workspace (Local Filesystem)
│
├── [Root Workspace Git Repository]           ← Tracks: docs/, .shiftstone/, .agent/, .agents/skills/, .claude/, .commandcode/
│   │                                            Remote: github.com/<user>/<project>-workspace.git
│   ├── .git/                                 ← Root Git database
│   ├── docs/                                 ← Living architecture bible & backlog
│   ├── .shiftstone/                          ← Harness engine: loop runner, context, governance, composer, packs
│   ├── .agents/skills/                       ← 42 skills (junctioned from packs + core) + synthesized project skills
│   ├── pnpm-workspace.yaml · package.json    ← Monorepo config + root script orchestrator
│   └── .workspace-git.json                   ← Staging metadata (gitignored)
│
└── apps/web/                                 ← [Nested App Git Repository] (remote: ...-app.git)
    │                                            Independent .git/, pushed/deployed on its own
    ├── app/ · workers/ · wrangler.jsonc      ← React Router 8 + Cloudflare (flagship shape)
    └── package.json                          ← Package @<project>-web
```

- **Zero pollution** — the app repo stays clean and deployable; governance history lives in the workspace repo.
- **Unified local DX** — `pnpm dev` / `pnpm build` / `pnpm test` from the workspace root across `pnpm-workspace.yaml`.
- **Per-archetype remotes** — every composed app gets an independent `.git` + remote (dual-repo engine, `.shiftstone/init/dual-repo.js`).

---

## 🗺️ Architecture & Governance Docs

The ShiftStone framework is governed by its integrated Development Bible and decision logs:

- **Architecture SSOT (Development Bible)**: [`docs/bible/README.md`](./docs/bible/README.md) · [`docs/bible/01-architecture/architecture-overview.md`](./docs/bible/01-architecture/architecture-overview.md)
- **Implementation Plans & Backlog**: [`docs/plans/README.md`](./docs/plans/README.md) · [`docs/backlog/HOW-TO-USE.md`](./docs/backlog/HOW-TO-USE.md)
- **Architecture Decision Records**: [`docs/bible/DECISIONS.md`](./docs/bible/DECISIONS.md)

---

## 🔄 Migrating from v1.x

```sh
node .shiftstone/migrate-v1-to-v2.js            # dry-run: detect + plan, writes nothing
node .shiftstone/migrate-v1-to-v2.js --apply    # migrate + write docs/reports/<ts>-v1-to-v2-migration.md
```

Guarantees: dry-run by default; harness files merge **missing-only** (existing files always win); your **code (`apps/**`), backlog, bible/decisions and custom skills are never touched**; RR8-coupled skills relocate into the pack only when the pack doesn't already ship them; every apply emits a migration report. `--root=<dir>` migrates another workspace; `--archetype=<name>` overrides the suggestion.

---

## 🤝 Contributing

New pack? New skill? Harness change? Follow **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — end-to-end pack checklist, two-tier skill review (auto-merge tier vs. foundation tier), and the verification commands CI runs on every PR.

**IDE walkthroughs** (init → skills → first loop → `/verify`): [`docs/videos/README.md`](./docs/videos/README.md) — Antigravity · Claude Code · Command Code · OpenCode.

---

## 🛡️ Harness Ownership (as-code governance)

The AI harness — steering files, rules, workflows, evals and skills — is treated like production code: versioned, PR-reviewed, with named owners ([`CODEOWNERS`](./CODEOWNERS), rule: [`.shiftstone/static-rules/governance.md`](./.shiftstone/static-rules/governance.md)).

| Harness Area | Paths | Owner |
|---|---|---|
| Orientation & prompts | `AGENTS.md`, `ANTIGRAVITY.md`, `CLAUDE.md`, `COMMANDCODE.md` | `@vishal-ranjan-codes` |
| Rules | `.shiftstone/static-rules/`, `.shiftstone/path-scoped-rules/` | `@vishal-ranjan-codes` |
| Evals | `evals/` | `@vishal-ranjan-codes` |
| Skills (core + pack bundles) | `.agents/skills/`, `.shiftstone/packs/*/skills/` | `@vishal-ranjan-codes` |

**Change rule:** harness files change only via pull request with the self-review checklist from `.shiftstone/static-rules/governance.md` (parity, tests, regenerated indexes, why + evidence). Solo repositories degrade to the same checklist as a mandatory self-review — CI enforces ownership coverage either way (`node .shiftstone/scripts/check-harness-ownership.js --strict`).

---

## 📜 License

MIT License. Designed with ❤️ for the modern AI engineering era.
