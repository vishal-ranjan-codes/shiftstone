# ss-import-research — Research Ingestion & Standardization Guide

Procedure for parsing, restructuring, and ingesting raw notes, web clips, or external technical reports into `docs/research/<area>/<slug>/`.

---

## Iron Law

1. **Read Before Create:** Read all source materials completely before creating directories. Never create duplicate research topics.
2. **7-File Completeness:** Ingested research MUST populate the full 7-file structure (`00-BRIEF.md` through `06-SOURCES.md`). Partial or fragmented imports are forbidden.
3. **Verified Sources Invariant:** `06-SOURCES.md` must retain and verify source URLs with retrieval dates.
4. **Physical Disk Output Only:** Output files directly to `docs/research/<area>/<slug>/`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"The external notes are short, so 1 or 2 files is enough."* | **Forbidden.** Without the standard 7-file structure, automated tooling and `validate-research.js` fail. |
| *"I'll skip user confirmation of the destination folder."* | **Forbidden.** Getting confirmation prevents polluting the research tree with misfiled topics. |
| *"The source notes had TBD placeholders, so I left them."* | **Forbidden.** Unresolved placeholders fail validation. Research or delete incomplete claims. |

---

## Ingestion Procedure

### Phase 1: Source Analysis
1. Read all provided input files.
2. Check `docs/research/README.md` to see if a related topic exists. Update rather than duplicate.
3. Determine destination: `docs/research/<topic-area>/<slug>/`.
4. Confirm plan and destination with the user before writing files.

### Phase 2: Content Distribution
1. Author `00-BRIEF.md` capturing research question and constraints.
2. Distribute content across:
   - `01-SUMMARY.md` — executive summary.
   - `02-FINDINGS.md` — architecture, performance, APIs.
   - `03-COMPARISON.md` — scoring matrix and trade-offs.
   - `05-IMPLEMENTATION.md` — concrete code examples.
   - `06-SOURCES.md` — live search receipts and source URLs.
3. Author `04-CONCLUSION.md` with explicit recommendation.

### Phase 3: Indexing & Validation
1. Update `docs/research/README.md`.
2. Validate:
   ```bash
   node core/scripts/validate-research.js --dir docs/research/<area>/<slug>
   ```

---

## Verification Ladder

- **L1 (Syntax):** All 7 files present with valid markdown syntax.
- **L2 (Completeness):** `node core/scripts/validate-research.js` exits 0.
- **L3 (Index Freshness):** Topic indexed in `docs/research/README.md`.
- **L4 (Checker Review):** Disjoint check confirms zero lost technical data from source.
- **L5 (User Handoff):** Link to newly imported research provided to user.

---

## Terminal States

- `success`: External research successfully ingested, structured, and validated.
- `blocked`: Unreadable or corrupt input files preventing coherent extraction.
- `escalated`: Conflicting conclusions between imported research and active Bible ADRs.
