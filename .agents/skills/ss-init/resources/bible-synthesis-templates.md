# Development Bible Modular Synthesis Templates & Contracts

Architectural blueprints and standard structures for synthesizing high-cohesion, modular Development Bible chapters during Step 9 (`step_9_bible_backlog_synthesis`).

---

## The Modular Subfolder Invariant

1. **Discrete Topic Files:** Every chapter subfolder contains an `index.md` (Map of Content) and $\ge 2$ discrete topic files.
2. **Line and Token Limits:** No single markdown file may exceed 400 lines ($\le 4,500$ tokens). Monolithic markdown chapters are strictly prohibited.
3. **Deep Synthesis (Zero Placeholders):** Literal tokens (`{{PROJECT_NAME}}`), `TODO` comments, and *"Describe X here"* placeholders are strictly forbidden. The AI product architect consumes the full Socratic interview context and generates concrete schemas, RLS policies, invariants, and route contracts.

---

## Core Chapter Specifications (`01`–`08`)

### Chapter 01: `01-architecture/`
- **`index.md`**: Map of Content, links to sub-topics, high-level architectural statement.
- **`topology.md`**: Physical & runtime topology: Edge runtime (edge isolates / serverless compute), SSR container, managed SQL database instance, CDN edge caching, and Monorepo folder layout.
- **`system-context.md`**: C4 Level 1 & Level 2 system context. Primary actors, frontend clients, API layer, database, background workers, and external service providers.
- **`operational-envelope.md`**: SLA targets, latency envelopes (P95 < 200ms), cold-start tolerances, compute memory boundaries (128MB worker limit), and concurrency assumptions.

### Chapter 02: `02-setup-and-workflow/`
- **`index.md`**: Map of Content.
- **`local-environment.md`**: Runtime and package manager versions, required CLI tools, environment variable specifications (`.env.example`), and local database emulation.
- **`dev-workflow.md`**: Daily engineering loop: starting local dev servers, running type generation (`pnpm db:types`), running Vitest unit & integration suites, and Red-First TDD discipline.

### Chapter 03: `03-database/`
- **`index.md`**: Map of Content.
- **`schema-reference.md`**: Complete PostgreSQL DDL: tables, columns with exact types (`uuid`, `timestamptz`, `text`), primary keys, foreign key constraints (`ON DELETE CASCADE`), indexes (`btree`, `gin`), and table-level comments.
- **`rls-policies.md`**: Complete Row Level Security policy matrix covering `SELECT`, `INSERT`, `UPDATE`, and `DELETE` for every user role (`anon`, `authenticated`, `admin`). Explicit helper functions (`auth.uid()`, tenant boundary checks).
- **`migrations.md`**: Migration naming conventions (`YYYYMMDDHHMMSS_<slug>.sql`), idempotency patterns, rollback procedures, and test data seeding scripts.

### Chapter 04: `04-auth-and-rbac/`
- **`index.md`**: Map of Content.
- **`identity-providers.md`**: Active auth methods (Email+Password, 6-digit OTP, Magic Link, Google OAuth), secure session cookie storage, JWKS local JWT validation via `getClaims()`.
- **`permissions-matrix.md`**: Role-Based Access Control matrix. Role hierarchy, permission sets, resource actions, and tenant isolation rules.
- **`route-guards.md`**: Framework route middleware guards, redirect behaviors for unauthenticated requests, session refresh hooks, and graceful degradation in zero-credential environments.

### Chapter 05: `05-core-systems/`
- **`index.md`**: Map of Content.
- **`domain-invariants.md`**: Non-negotiable business rules identified in Gate 3. Validation limits, state prerequisites, mathematical invariants, and billing integrity rules.
- **`state-machines.md`**: Mermaid state transition diagrams (`stateDiagram-v2`) showing core entity lifecycles, valid transitions, guard conditions, and terminal states.
- **`error-taxonomy.md`**: Standard application error classes, domain error codes, HTTP status mappings (400, 401, 403, 404, 409, 422, 500), and client-facing error payloads.

### Chapter 06: `06-integrations/`
- **`index.md`**: Map of Content.
- **`third-party-services.md`**: External APIs (Stripe, object storage, Postmark, OpenAI), client configuration, SDK initialization, timeout policies, and circuit breakers.
- **`webhooks.md`**: Webhook receivers, cryptographic signature verification (HMAC SHA-256), replay protection, idempotency keys, and dead-letter queues.

### Chapter 07: `07-frontend/`
- **`index.md`**: Map of Content.
- **`design-tokens.md`**: Design tokens and `@theme` configuration, semantic color tokens mapped to OKLCH values, dark/light surface tokens, and font families.
- **`route-hierarchy.md`**: Complete application nested route map (`routes.ts`), layout wrappers, error boundaries (`ErrorBoundary`), and suspense fallback strategy.
- **`component-standards.md`**: Component library usage, accessibility compliance (WCAG 2.1 AA), responsive breakpoints, and client-side form validation UX.

### Chapter 08: `08-api-contracts/`
- **`index.md`**: Map of Content.
- **`route-actions.md`**: Concrete server action contracts: form action endpoints, request payload shapes, Zod validation schemas, mutation return types, and optimistic UI hooks.
- **`route-loaders.md`**: Server loader contracts: loader data types, parallel data fetching, cache control headers (`Cache-Control: private, max-age=...`), and 404/redirect response contracts.

---

## Specialized Chapter Specifications

### `plugin-architecture/` (CLI / DevTool Archetypes)
- **`index.md`**: Map of Content.
- **`plugin-lifecycle.md`**: Plugin registration, initialization hooks, runtime sandboxing, and disposal.
- **`hook-system.md`**: Extensibility points, middleware event emitters, and configuration hooks.

### `cli-commands-and-flags/` (CLI / DevTool Archetypes)
- **`index.md`**: Map of Content.
- **`command-reference.md`**: Positional CLI commands, subcommands, arguments, and exit code matrix.
- **`flags-and-arguments.md`**: Global flags (`--verbose`, `--json`, `--help`), environment variable overrides, and configuration file precedence.

### `compliance-and-ledger/` (Fintech / Compliance Archetypes)
- **`index.md`**: Map of Content.
- **`ledger-model.md`**: Double-entry bookkeeping schema, immutability guarantees, transaction balancing invariants.
- **`regulatory-controls.md`**: PCI-DSS / SOC2 compliance controls, PII data handling, retention limits.

### `audit-and-security/` (Fintech / Compliance Archetypes)
- **`index.md`**: Map of Content.
- **`audit-logging.md`**: Append-only audit trail schemas, actor attribution, cryptographic hashes.
- **`threat-model.md`**: STRIDE threat matrix, attack vectors, rate limiting, and egress protections.

### `vector-storage-and-embeddings/` (AI Agent / RAG Archetypes)
- **`index.md`**: Map of Content.
- **`vector-index-schemas.md`**: pgvector extension DDL, vector dimensions, HNSW / IVFFlat index parameters.
- **`similarity-search.md`**: Cosine distance queries, hybrid keyword + semantic search, chunking strategies.

### `evals-and-prompt-chains/` (AI Agent / RAG Archetypes)
- **`index.md`**: Map of Content.
- **`eval-benchmarks.md`**: Quantitative evaluation rubrics, accuracy scoring, regression test suites.
- **`prompt-orchestration.md`**: System prompt topologies, token budget enforcement, multi-step tool calls.
