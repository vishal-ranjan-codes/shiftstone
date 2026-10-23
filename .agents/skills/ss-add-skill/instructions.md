# ss-add-skill — 3-Tier Skill Authoring & Registration Guide

Procedure for authoring a new specialist skill in the ShiftStone AI-Native Workspace.

---

## Iron Law

1. **Strict 3-Tier Architecture:** Every skill is a directory containing `SKILL.md` (Tier 1 manifest), `instructions.md` (Tier 2 procedural), and optional `resources/` (Tier 3 deep reference). Never author a single flat markdown skill.
2. **Line Budget Ceilings:** `SKILL.md <= 180 lines`, `instructions.md <= 450 lines`. If instructions grow larger, split deep domain knowledge into `resources/<topic>.md`.
3. **8-Pillar Anti-Bypass Guardrails:** Every first-party `ss-*` skill MUST contain:
   - `## Iron Law` (or `## Iron Laws`)
   - `## Red Flags & Rationalization Defense`
   - `## Verification Ladder` (L1–L5)
   - `## Terminal States`
4. **Physical Disk Output Only:** Output skills directly to `.agents/skills/<name>/` or `packs/<pack>/skills/<name>/`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"A single SKILL.md file is enough for a small skill."* | **Forbidden.** Without the 3-tier separation, progressive disclosure fails and context token budgets explode. |
| *"I don't need an Iron Law for a utility skill."* | **Forbidden.** All first-party skills are strictly gated by `validate-skills-completeness.js`. |
| *"I can register the skill later."* | **Forbidden.** Run `node .shiftstone/scripts/generate-skills-manifest.js` immediately so the skill is index-routable. |

---

## Authoring Procedure

1. **Determine Ownership & Tier:**
   - First-party tech-agnostic core skill $\rightarrow$ `.agents/skills/ss-<name>/` (`pack: core`, `tier: manual-load`).
   - Stack-specific pack skill $\rightarrow$ `packs/<pack>/skills/<name>/` (`pack: <pack>`, `tier: path-scoped` or `manual-load`).

2. **Author Tier 1 Manifest (`SKILL.md`):**
   - Frontmatter: `name`, `description` (actionable situation trigger), `pack`, `tier`.
   - Body: Summary and pointers to `instructions.md` and resources.

3. **Author Tier 2 Procedural Guide (`instructions.md`):**
   - Incorporate Iron Laws, Anti-Rationalization table, step-by-step procedure, Verification Ladder, and Terminal States.

4. **Author Tier 3 Reference Files (`resources/`):**
   - Place long checklists, prompt templates, or API specs in `resources/`.

5. **Register & Validate:**
   ```bash
   node .shiftstone/scripts/generate-skills-manifest.js
   node .shiftstone/scripts/validate-skills-completeness.js
   node .shiftstone/scripts/validate-context-budgets.js
   ```

---

## Verification Ladder

- **L1 (Syntax):** Valid YAML frontmatter and well-formed markdown.
- **L2 (Completeness):** `node .shiftstone/scripts/validate-skills-completeness.js` passes with 0 violations.
- **L3 (Budget Gate):** `node .shiftstone/scripts/validate-context-budgets.js` passes line ceilings.
- **L4 (Manifest Parity):** Skill is indexed in `.shiftstone/context/skills-manifest.yaml`.
- **L5 (Interactive Test):** Invoke the skill in a test turn and verify prompt routing.

---

## Terminal States

- `success`: Skill created, registered in manifest, and passed completeness validation.
- `blocked`: Naming collision with an existing skill or core namespace.
- `escalated`: Scope ambiguity between core and pack ownership.
