# ss-bookkeeping — Catalog Maintenance & Cross-Reference Guide

Catalog manager procedure for maintaining knowledge bundles across `docs/`, `packs/`, and `.agents/skills/`. Operates as the chief editor for the inner gear of repository documentation hygiene.

---

## Iron Law

1. **Zero Content Drift:** Never alter prose claims, business requirements, or architectural decisions during a bookkeeping pass. Bookkeeping owns structure, links, indexes, and logs; content edits require `/ss-sync-bible` or `/ss-plan`.
2. **Deterministic Detectors First:** Never edit catalog files by guesswork. Run the automated detector scripts first and repair only flagged defects.
3. **Physical Disk Output Only:** All updates must be written directly to the appropriate files on disk. Never emit temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I can rephrase this architecture claim to sound cleaner."* | **Forbidden.** Bookkeeping must not alter document meaning. Flag semantic issues for human review. |
| *"I'll hand-edit the ToC in README.md."* | **Forbidden.** Indexes and ToCs are machine-generated (`core/governance/index.js`). Hand-edits get wiped on next run. |
| *"I don't need to update log.md for small fixes."* | **Forbidden.** Every knowledge bundle touched must record an append-only row in its `log.md`. |

---

## Procedure: One-Pass Catalog Repair

1. **Run Detectors:**
   ```bash
   node core/governance/index.js --check
   node core/governance/bible/index.js --check
   node core/scripts/check-link-integrity.js
   node core/scripts/validate-okf-frontmatter.js
   ```

2. **Sequential One-Pass Resolution:**
   - Stale/missing `index.md`: run `node core/governance/index.js`.
   - Stale Bible ToC: run `node core/governance/bible/index.js`.
   - Broken relative link: retarget to the canonical file in `index.md`; if missing, flag for human.
   - Missing OKF frontmatter: run `node core/scripts/validate-okf-frontmatter.js --fix`.
   - Changed skills: run `node core/scripts/generate-skills-manifest.js`.

3. **Append Bundle Records:**
   - Append rows to `log.md` in affected bundles (`docs/log.md`, `packs/log.md`, `.agents/skills/log.md`).
   - Run `node core/scripts/compile-changelog.js`.

---

## Verification Ladder

- **L1 (Syntax):** `node core/scripts/validate-okf-frontmatter.js` passes cleanly.
- **L2 (Link Integrity):** `node core/scripts/check-link-integrity.js` reports 0 broken links.
- **L3 (Index Freshness):** `node core/governance/index.js --check` confirms all indexes fresh.
- **L4 (Changelog Parity):** `node core/scripts/compile-changelog.js` completes with 0 errors.
- **L5 (Human Review):** Human checks git diff of catalog changes.

---

## Terminal States

- `success`: All detectors pass cleanly with zero remaining broken links or stale indexes.
- `blocked`: Broken reference cannot be resolved without a human architectural decision.
- `escalated`: Conflicting cross-references detected across active Bible chapters.
