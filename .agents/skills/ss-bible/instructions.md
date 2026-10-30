# Instructions for ss-bible — Development Bible & PRD Authoring Engine

This skill guides the synthesis, evolution, and verification of the Development Bible (`docs/bible/`), establishing concrete product requirements and technical architecture with zero placeholders.

---

## 1. Modular Subfolder Standard

Every Development Bible chapter must adhere strictly to the modular chapter subfolder standard:
- **Location:** `docs/bible/<chapter-folder>/` (e.g. `PRD/`, `00-product-and-vision/`, `01-architecture/`, `03-database/`).
- **Map of Content (`index.md`):** Frontmatter with `type: index`, chapter overview, and links to all topic documents.
- **Topic Documents:** $\ge 2$ discrete files per chapter. Each topic file is bounded by $\le 400$ lines / $\le 4,500$ tokens to ensure bounded agent context intake.
- **Monolithic Files Forbidden:** Single monolithic markdown files exceeding 400 lines are strictly prohibited.

---

## 2. Step-by-Step Procedure

### Step 1: Synthesize PRD Suite (`docs/bible/PRD/`)
1. Review raw requirements, problem space, or user-supplied PRD text.
2. Author `docs/bible/PRD/index.md` linking the PRD collection.
3. Author `docs/bible/PRD/ecosystem-prd.md` based on [resources/prd-templates.md](./resources/prd-templates.md):
   - Problem Statement & Founding Thesis.
   - 4 Architectural Pillars.
   - User Personas & Core User Journeys.
   - Non-Functional SLAs & Anti-Goals.
4. Author `docs/bible/PRD/phase-1-foundation-prd.md` with bounded scope for Phase 1 delivery.

### Step 2: Author Product Vision Chapters (`docs/bible/00-product-and-vision/`)
1. Use templates from [resources/product-vision-templates.md](./resources/product-vision-templates.md).
2. Author:
   - `vision-and-mission.md`: 3-year trajectory and trigger moments.
   - `target-audience.md`: Operator and administrative customer personas with critical friction points.
   - `product-philosophy.md`: Non-negotiable operating covenants (privacy, data portability, simplicity).
   - `business-model.md`: Unit economics, billing tiers, seat allocation, and monetization strategy.
   - `market-landscape.md`: Category alternatives and competitive differentiation.

### Step 3: Author Technical Subsystem Chapters (`docs/bible/01-*` through `08-*`)
1. Use templates from [resources/technical-chapter-templates.md](./resources/technical-chapter-templates.md).
2. Document concrete schemas, RLS policies, domain invariants, and API contracts.
3. Replace generic prose with copy-paste runnable SQL DDL and TypeScript definitions.

### Step 4: Ingest Research Dossiers into Integrations
1. Scan `docs/research/` for completed dossiers.
2. Run `exportResearchConduit` or extract code and webhook verification logic from `05-IMPLEMENTATION.md`.
3. Materialize into `docs/bible/06-integrations/third-party-services.md` and `webhooks.md`.

### Step 5: Execute Substantive Quality Gate
1. Run `node .shiftstone/init/validate-bible-synthesis.js docs/bible --starter-template <path>`.
2. Ensure 0 violations for `BOILERPLATE_UNTOUCHED`, `INSUFFICIENT_SUBSTANTIVE_DEPTH`, and `RAW_TEMPLATE_TOKEN`.

---

## Iron Laws

1. **Zero Placeholder Guarantee:** Raw `{{...}}` tokens, `TODO` comments, and `"describe your X here"` boilerplate strings are strictly banned from committed Bible files.
2. **Substantive Depth Floor:** Every authored topic file must have at least 30 substantive non-blank lines and 300 words.
3. **No Monolithic Chapters:** No topic markdown file may exceed 400 lines. Split into focused sub-documents when approaching the limit.
4. **Mandatory PRD Traceability:** Technical chapters must trace functional decisions back to `docs/bible/PRD/`.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll leave {{TODO}} placeholders for the user to fill in later."* | **Forbidden.** Synthesize concrete architecture based on interview facts and industry standards. Placeholders break downstream scaffolding. |
| *"A brief 15-line chapter is enough for an overview."* | **Forbidden.** Substantive validation rejects files under 30 lines. Provide real domain models, invariants, and edge cases. |
| *"The PRD can just live in chat or an IDE artifact."* | **Forbidden.** PRD is part of the Development Bible SSOT in `docs/bible/PRD/`. |

---

## Verification Ladder

1. **L1 (Syntax & Links):** All links between `index.md` and topic files resolve cleanly on disk.
2. **L2 (Depth & Substantive Gate):** `node .shiftstone/init/validate-bible-synthesis.js docs/bible` exits code 0 with zero warnings.
3. **L3 (Research Parity):** All integrated external services in `06-integrations` have corresponding research dossiers in `docs/research/`.
4. **L4 (Bible Changelog):** Changes logged in `docs/bible/log.md` and compiled via `compile-changelog.js`.

---

## Terminal States

- **`success`:** Modular Bible authored, PRD suite complete, all topic chapters $\ge 30$ lines, and `validate-bible-synthesis.js` exits 0.
- **`remediate`:** Placeholder tokens or shallow line floors detected; expand domain depth and re-verify.
- **`blocked`:** Core domain requirements contradictory or missing essential project scope.
