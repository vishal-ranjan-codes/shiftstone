---
name: ss-bible
description: Development Bible & PRD authoring engine — synthesizes modular technical chapters, ecosystem and phase PRDs, product vision, and ingests research dossiers with zero placeholders.
pack: core
tier: manual-load
type: skill
timestamp: 2026-10-30T00:00:00.000Z
version: 3.0.0
---

# ss-bible — Development Bible & PRD Authoring Engine

34th first-party core skill of the ShiftStone framework. Governs the authoritative authoring, restructuring, and substantive validation of the Development Bible (`docs/bible/`), including ecosystem PRDs, phase PRDs, product vision documents, and research-backed technical subsystem chapters.

- **Invocation:** `/ss-bible`
- **Procedural Knowledge:** [instructions.md](./instructions.md)
- **PRD Suite Templates:** [resources/prd-templates.md](./resources/prd-templates.md)
- **Product Vision Templates:** [resources/product-vision-templates.md](./resources/product-vision-templates.md)
- **Technical Chapter Templates:** [resources/technical-chapter-templates.md](./resources/technical-chapter-templates.md)

---

## Capabilities & Output Artifacts

1. **Modular Subfolder Restructuring:** Enforces that every Bible chapter lives in a dedicated subfolder with an `index.md` Map of Content and discrete topic files ($\le 400$ lines each), banning monolithic documents.
2. **Product Requirements Suite (`docs/bible/PRD/`):** Authors and maintains `ecosystem-prd.md` (high-level vision, pillars, SLAs, Anti-Goals) and derives executable phased PRDs (`phase-1-foundation-prd.md`).
3. **Product Vision & Strategy (`docs/bible/00-product-and-vision/`):** Generates substantive documents for vision & mission, target customer personas, operating philosophy, monetization models, and market landscape.
4. **Research Ingestion Conduit:** Directly pipes runnable TypeScript code, webhook HMAC verification logic, and typed environment variables from `docs/research/*/05-IMPLEMENTATION.md` into `docs/bible/06-integrations/`.
5. **Substantive Depth Quality Gate:** Verifies 100% of authored topic files satisfy the $\ge 30$ line / $\ge 300$ word floors with zero template boilerplate via `validate-bible-synthesis.js`.
