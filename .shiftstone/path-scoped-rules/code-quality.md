---
activation: always
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# {{PROJECT_NAME}} — Code Quality Rules

## TypeScript & Route Typing

- Strict mode — NO `any` unless explicitly required and commented with a detailed rationale.
- **Always import route types** from `./+types/<route-filename>` (e.g. `Route.LoaderArgs`, `Route.ActionArgs`, `Route.ComponentProps`). Never hand-craft custom loaderData interfaces.
- File naming: `kebab-case` for files (or framework dot-notation like `auth.callback.ts`), `PascalCase` for React components, `camelCase` for utilities/helpers.
- Zod schema naming: `[resource]Schema` (e.g., `updateProfileSchema`).
- RPC function naming: `[prefix]_[verb]_[noun]` (e.g., `api_update_user_profile`).
- Route actions: always extract validation logic and business rules into reusable helper modules when complex.

## Database Standards

- Database naming: `snake_case`. Table names should be descriptive and pluralized.
- Primary Key: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`.
- Timestamps: `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ DEFAULT NOW()`.
- Foreign Keys: Explicit `ON DELETE CASCADE` or `ON DELETE SET NULL`.
- Always enable Row-Level Security (RLS) on all tables: `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`.
- Index foreign keys and columns frequently queried in `WHERE` and `ORDER BY` clauses.

## Error Handling & Error Boundaries

- Always provide user-facing feedback (via `sonner` toast or inline form alert) — NEVER silently swallow failures.
- Every layout and major route module should export an `ErrorBoundary` handling `isRouteErrorResponse(error)`.
- Never use native browser `alert()` or `prompt()`.
- Return typed error responses or throw `Response` objects (`new Response("Not Found", { status: 404 })`).
- Never leak stack traces in production (gate behind `import.meta.env.DEV`).

## Git

- Commit format: Conventional Commits — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`.

## Documentation

- Every architecture decision → append to `docs/bible/DECISIONS.md` as a new DEC-XXX entry.
- Every shipped change → append to `docs/bible/CHANGELOG.md`.
- Technical research findings → `docs/research/<topic>/`.
