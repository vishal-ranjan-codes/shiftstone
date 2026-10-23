---
activation: always
paths:
  - "apps/**"
---

# {{PROJECT_NAME}} — Folder Structure Rules

## Hard Rules

- **NEVER write application code directly to the workspace root** (only docs, monorepo configuration, and workspace orchestration belong there).
- All application code strictly lives inside `{{APP_PATH}}/`.
- Enforce strict separation of concerns:
  - Entry / routing definitions at the framework's route entry point
  - Route (page) modules in their own directory
  - Middleware / hooks functions in a dedicated directory
  - Data-layer & integration helpers under a `lib/` (or equivalent) directory
  - Auth configuration & provider wrappers in a dedicated auth module
  - Background/runtime handlers in the pack-provided worker location (if any)
  - UI primitives in a shared components directory
  - Generated types in a dedicated types directory

---

## Route / Module Hierarchy

Follow the active pack's routing conventions (see the pack's scaffold and
`packs/<pack>/manifest.yaml`). Keep the route table declarative where the
framework supports it: public routes first, then protected layouts, then
resource/API endpoints.

---

## Detailed Directory Map

```
{{APP_PATH}}/
├── entry / routes entry point   ← Master route or router hierarchy
├── routes/ (or pages/)          ← Route modules (public, protected, API)
├── middleware/ (or hooks/)      ← Request / lifecycle hooks
├── lib/                         ← Data-layer, auth, and integration helpers
├── components/                  ← Shared UI primitives
├── types/                       ← Generated and shared type declarations
├── public/                      ← Static assets
└── <pack runtime config>        ← Runtime/scheduler config shipped by the active pack
```

The exact file names are stack-specific — the active pack's bible overlays
(`docs/bible/01-architecture/`) and path rules describe the precise layout
once a pack is composed.

---

## Monorepo Commands

| Task | Root Command | Inside `{{APP_PATH}}/` |
|---|---|---|
| Run Dev Server | `{{PACKAGE_MANAGER}} dev` | `{{PACKAGE_MANAGER}} dev` |
| Build Production | `{{PACKAGE_MANAGER}} build` | `{{PACKAGE_MANAGER}} build` |
| Lint Check | `{{PACKAGE_MANAGER}} lint` | `{{PACKAGE_MANAGER}} lint` |
| Type Check | `{{PACKAGE_MANAGER}} typecheck` | `{{PACKAGE_MANAGER}} typecheck` |
| Run Tests | `{{PACKAGE_MANAGER}} test` | `{{PACKAGE_MANAGER}} test` |
| E2E Tests | `{{PACKAGE_MANAGER}} test:e2e` | `{{PACKAGE_MANAGER}} test:e2e` |
