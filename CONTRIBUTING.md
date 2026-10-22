# Contributing

Thank you for contributing to the **Universal AI Development Workspace Framework**.

Harness files (steering, rules, workflows, evals, skills) are treated like production code: versioned, PR-reviewed, with named owners — see [`CODEOWNERS`](./CODEOWNERS) and the PR checklist in [`core/static-rules/governance.md`](./core/static-rules/governance.md). Solo repositories degrade to the same checklist as a mandatory self-review.

---

## Adding a New Pack — End-to-End Checklist

A **pack** (`packs/<name>/`) is a stack archetype: manifest + skills + bible overlays + scaffold. Work the list top to bottom; CI validates it on every PR (`.github/workflows/validate-packs.yml`).

- [ ] **1. Read the contract.** The manifest schema is [`packs/_schema.json`](./packs/_schema.json) (blueprint §5.2). Model your pack on [`packs/rr8-supabase-cf/manifest.yaml`](./packs/rr8-supabase-cf/manifest.yaml) (full) or [`packs/fastapi-pg/manifest.yaml`](./packs/fastapi-pg/manifest.yaml) (starter).
- [ ] **2. Create `packs/<name>/manifest.yaml`** with `apiVersion: workspace/v1`, `kind: StackArchetype`, and:
      - `metadata.name` **must equal** the directory name; pick `tier` honestly (`flagship` | `starter` | `community`).
      - `spec.defaultAppPath` must be **unique** across packs, **or** you must declare `conflicts.with` (blueprint §10.4 decision D: two packs may not own the same folder — `nextjs-prisma-pg` ↔ `rr8-supabase-cf` both own `apps/web`, so they conflict).
      - `spec.packaging` must come from the schema's enum; `{{VARIABLE}}` entries need a `type` (`enum` types need an `enum` list).
      - `composition.skills.include` ≥ 1 pattern (supports `*` wildcards).
- [ ] **3. Add `packs/<name>/packaging.json`** (name, version, tier, license, packaging) and **`packs/<name>/scaffold-script.js`** exporting `run(context)` — it must create the app skeleton under `defaultAppPath` without overwriting existing files.
- [ ] **4. Author pack skills** (can follow later for a starter): each skill is a 3-tier bundle — `skills/<skill>/SKILL.md` + `instructions.md` + optional `resources/` — with OKF frontmatter (`type: skill`, ISO-8601 `timestamp`). Use the `skills-author` skill.
- [ ] **5. Optional pack surfaces:** `bible-overlays/<chapter>/*.md` (stack chapters, OKF frontmatter), `decisions-seed.yaml` (ADRs applied only when the pack is installed), `folder-hooks/`, and a `composition.opencode.mcp` fragment for pack-specific MCP servers.
- [ ] **6. Register nothing by hand.** `packs/index.md` is generated; regenerate the skills manifest after adding skills: `node core/scripts/generate-skills-manifest.js`.
- [ ] **7. Validate locally:**

      ```sh
      node core/init.js --validate                       # every pack manifest
      node core/init.js --archetype=<name>,<peer> --validate   # conflict resolution for intended compositions
      ```

- [ ] **8. Log the change** (OKF bookkeeping): append a row to [`packs/log.md`](./packs/log.md), then run `node core/scripts/compile-changelog.js`.
- [ ] **9. Add a row to the pack gallery** in [`README.md`](./README.md) — label it `scaffolded` (manifest + scaffold only) vs `full` (skills + overlays shipped).
- [ ] **10. Run the full gate** before opening the PR:

      ```sh
      pnpm parity && pnpm typecheck && pnpm lint && pnpm test
      ```

---

## Adding a Skill — Two-Tier Review (blueprint §10.3)

Skills are reviewed infrastructure, not freeform notes. Two tiers:

| Tier | Applies to | Review |
|---|---|---|
| **Tier 1 — standard** | Pack skills and ordinary additions | **Auto-merge eligible** once the PR has (a) a `skills-manifest.yaml` entry, (b) the 3-tier structure (`SKILL.md` + `instructions.md` + `resources/`), (c) green CI incl. the minimal-example vitest, and (d) a `packs/log.md` row. |
| **Tier 2 — foundation** | Skills referenced by always-on/static rules, skill-loader core behavior, `loop-author`/`skills-author`-class governance skills | **Two approvals required** (owner review per `CODEOWNERS`); token budget impact must be stated in the PR description. |

Skill checklist for every tier:

- [ ] `SKILL.md` frontmatter: `name`, `description` (when-to-use trigger), `type: skill`, ISO-8601 `timestamp`.
- [ ] Procedural detail in `instructions.md`; reference material in `resources/` — keep `SKILL.md` a thin manifest (progressive disclosure, blueprint §6.2).
- [ ] Register it: `node core/scripts/generate-skills-manifest.js`, then confirm `node core/scripts/validate-manifest-budgets.js --strict` passes (token budget).
- [ ] No duplicated content with existing skills (§6.6 anti-duplication mandate) — extend the pack's existing skill instead of forking one.

---

## Changing Harness Files

1. Branch → edit → the gates above must pass (`pnpm parity` covers duplication, junctions, budgets, loop specs, OKF frontmatter, link integrity, index freshness, changelog compilation, backlog signatures, ownership coverage).
2. Self-review with the checklist in `core/static-rules/governance.md` (why + evidence + regenerated indexes).
3. Open a PR — `CODEOWNERS` routes harness paths to their owners; CI (`parity-check`, `evals-in-ci`, `validate-packs`) must be green.

## Reporting Bugs

Open the report via the `/bug-report` workflow or add a file under [`docs/bugs/`](./docs/bugs/README.md) (`open-bugs.md` is the permanent ledger — never delete it).
