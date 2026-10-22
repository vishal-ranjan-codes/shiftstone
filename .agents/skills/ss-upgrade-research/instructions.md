# ss-upgrade-research — Research Migration & Standardization Guide

Procedure for migrating legacy flat research folders into the modern ShiftStone 7-file structure (`00-BRIEF.md` through `06-SOURCES.md`).

---

## Iron Law

1. **Zero Content Discard:** Never discard historical research findings, comparison data, or source links during migration. Redistribute every relevant section into the 7-file template.
2. **Actionable Recommendation Invariant:** `04-CONCLUSION.md` must clearly state a concrete, actionable recommendation. Never leave conclusion empty or vague.
3. **Receipt Table Invariant:** `06-SOURCES.md` must preserve all original reference links in the structured search receipts table.
4. **Physical Disk Output Only:** Output files directly to `docs/research/<area>/<slug>/`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"The old README had no recommendation, so I won't write one."* | **Forbidden.** Synthesize a recommendation from the findings or flag for human review. |
| *"I'll leave the old README.md alongside the new files."* | **Forbidden.** Delete or archive the old unnumbered README once migration is complete to prevent duplication. |
| *"I don't need to run the research validator on migrated files."* | **Forbidden.** `node core/scripts/validate-research.js` is required to ensure migration compliance. |

---

## Content Redistribution Map

| Old Section / Content | Target File |
|---|---|
| Title + context + decision question | `00-BRIEF.md` |
| Overview / summary paragraphs | `01-SUMMARY.md` |
| Deep findings, architecture, APIs | `02-FINDINGS.md` |
| Comparison table / trade-offs | `03-COMPARISON.md` |
| Final recommendation & next steps | `04-CONCLUSION.md` |
| Code samples & implementation | `05-IMPLEMENTATION.md` |
| Source URLs & citations | `06-SOURCES.md` |

---

## Step-by-Step Migration Protocol

1. **Audit Source Folder:**
   - Read all existing files in the target directory.
   - Extract the core decision question and recommendations.

2. **Populate 7 Files:**
   - Generate `00-BRIEF.md` through `06-SOURCES.md` using the content map.
   - Verify that `00-BRIEF.md` defines the decision question and `04-CONCLUSION.md` defines the recommendation.
   - Populate `06-SOURCES.md` with source table.

3. **Validate & Clean Up:**
   - Remove legacy flat files once content is verified.
   - Update `docs/research/README.md`.
   - Run validator:
     ```bash
     node core/scripts/validate-research.js --dir docs/research/<area>/<slug>
     ```

---

## Verification Ladder

- **L1 (Syntax):** All 7 files exist with valid frontmatter.
- **L2 (Completeness):** `node core/scripts/validate-research.js` passes with 0 violations.
- **L3 (Content Parity):** Disjoint check confirms zero lost technical data from legacy folder.
- **L4 (Index Updated):** Master research index points to migrated files.
- **L5 (Git Diff):** Diff confirms clean migration without dangling files.

---

## Terminal States

- `success`: Legacy research successfully migrated into 7-file dossier and validated.
- `blocked`: Legacy folder corrupted or unreadable.
- `escalated`: Disputed recommendation requiring original author consultation.
