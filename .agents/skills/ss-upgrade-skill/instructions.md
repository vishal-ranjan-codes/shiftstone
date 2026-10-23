# ss-upgrade-skill — Skill Hardening & 3-Tier Refactoring Guide

Procedure for evaluating, refactoring, and hardening external or legacy skills to meet the ShiftStone quality standard.

---

## Iron Law

1. **Zero Behavioral Loss:** Upgrading a skill must never discard valid domain instructions, code examples, or troubleshooting tips present in the original skill.
2. **Strict Line Ceilings:** `SKILL.md <= 180 lines`, `instructions.md <= 450 lines`. Extract bulky reference data to `resources/<topic>.md`.
3. **8-Pillar Anti-Bypass Guardrails:** The upgraded skill MUST contain Iron Laws, an Anti-Rationalization table, a Verification Ladder, and Terminal States.
4. **Physical Disk Output Only:** Write directly to `.agents/skills/<skill-name>/` or `packs/<pack>/skills/<skill-name>/`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"The upstream community skill has 800 lines in SKILL.md, it's fine as-is."* | **Forbidden.** 800 lines blows out context budgets. Refactor into `SKILL.md` (summary) + `instructions.md` + `resources/`. |
| *"I don't need to test link resolution."* | **Forbidden.** `validate-skills-completeness.js` fails on any broken relative link. |
| *"I can skip regenerating the manifest."* | **Forbidden.** Manifest generator calculates accurate token costs and updates the AGENTS.md Skill INDEX. |

---

## Step-by-Step Hardening Procedure

1. **Initial Audit:**
   - Run `node .shiftstone/scripts/validate-skills-completeness.js` against the target skill.
   - Note line count overruns, missing frontmatter, missing mandatory sections, or broken links.

2. **Refactor to 3 Tiers:**
   - Condense `SKILL.md` to ≤ 180 lines (frontmatter + brief overview + table of contents).
   - Move procedural rules into `instructions.md` (≤ 450 lines).
   - Move reference tables, templates, and specs into `resources/`.

3. **Inject 8-Pillar Anti-Bypass Guardrails:**
   - Synthesize domain-specific `## Iron Law` (unbreakable domain invariants).
   - Build `## Red Flags & Rationalization Defense` table (identifying rationalizations AI agents make to bypass rules).
   - Define `## Verification Ladder` (L1 deterministic test to L5 sign-off).
   - Define `## Terminal States` (`success`, `blocked`, `escalated`, `stalled`).

4. **Verify & Re-index:**
   ```bash
   node .shiftstone/scripts/generate-skills-manifest.js
   node .shiftstone/scripts/validate-skills-completeness.js
   node .shiftstone/scripts/validate-context-budgets.js
   ```

---

## Verification Ladder

- **L1 (Syntax):** Valid YAML frontmatter and well-formed markdown.
- **L2 (Completeness):** `node .shiftstone/scripts/validate-skills-completeness.js` exits 0.
- **L3 (Budget Gate):** `node .shiftstone/scripts/validate-context-budgets.js` exits 0.
- **L4 (Checker Review):** Disjoint check confirms zero lost technical knowledge from original.
- **L5 (Git Clean):** Staged diff confirms clean, formatted files.

---

## Terminal States

- `success`: Target skill successfully hardened and compliant with all quality gates.
- `blocked`: Upstream skill is corrupt or incompatible with monorepo architecture.
- `escalated`: Disputed domain invariants requiring human resolution.
