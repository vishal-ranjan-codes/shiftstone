# ss-refresh-research — Research Freshness & Re-evaluation Guide

Procedure for auditing, updating, and re-validating stale technology research dossiers in `docs/research/`.

---

## Iron Law

1. **Selective Updating Only:** Update ONLY stale sections (pricing, API flags, version numbers). Never rewrite or discard sections that remain accurate.
2. **Mandatory Live Search Receipts:** Any updated factual claim MUST be grounded in live web search receipts ($\ge 3$ queries logged in `06-SOURCES.md` before updating conclusions).
3. **Timestamp Integrity:** Always update `Last Updated` date in `00-BRIEF.md` and add inline update callouts (`> 🔄 Updated [YYYY-MM-DD]: [what changed]`).
4. **Physical Disk Edits Only:** Apply changes directly to files in `docs/research/<area>/<slug>/`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll rewrite the entire research document from scratch."* | **Forbidden.** Rewriting clean sections wastes tokens and risks losing historical context. Only update what drifted. |
| *"Pricing probably hasn't changed, so I'll keep the old numbers."* | **Forbidden.** Pricing data has a 30-day freshness window. Verify live before sealing. |
| *"I can update the conclusion without recording search receipts in 06-SOURCES.md."* | **Forbidden.** All updated conclusions must cite fresh search receipts. |

---

## Freshness Windows & Refresh Procedure

### Freshness SLA
- **Pricing & Quota data:** 30 days (High Priority)
- **Model releases & API features:** 60–90 days (High Priority)
- **Architecture & System design:** 180 days (Medium Priority)
- **Foundational concepts:** 365 days (Low Priority)

### Step 1: Stale Content Audit
1. Read `00-BRIEF.md` `Last Updated` timestamp.
2. Check `02-FINDINGS.md` and `03-COMPARISON.md` for expired pricing or deprecated APIs.
3. Check `04-CONCLUSION.md` to see if recommendation holds.

### Step 2: Targeted Re-Search & Source Logging
1. Execute targeted `search_web` queries on drifted sections.
2. Append fresh entries to `06-SOURCES.md` Live Search Receipt Table.

### Step 3: Update Dossier
1. Add inline update callouts: `> 🔄 Updated [YYYY-MM-DD]: [what changed]`.
2. If recommendation changed, update `04-CONCLUSION.md` with explicit rationale.
3. Update `Last Updated` in `00-BRIEF.md` and `docs/research/README.md`.
4. Validate dossier:
   ```bash
   node .shiftstone/scripts/validate-research.js --dir docs/research/<area>/<slug>
   ```

---

## Verification Ladder

- **L1 (Syntax):** Valid markdown and frontmatter across all 7 files.
- **L2 (Search Receipts):** Fresh search receipts logged in `06-SOURCES.md`.
- **L3 (Script Check):** `node .shiftstone/scripts/validate-research.js` passes cleanly.
- **L4 (Checker Review):** Disjoint check verifies only drifted sections were altered.
- **L5 (Index Updated):** Master research index reflects refreshed timestamp.

---

## Terminal States

- `success`: Stale research refreshed, receipts logged, and re-validated.
- `no_op`: Research is within freshness windows and remains 100% accurate.
- `blocked`: Tooling failure preventing live search verification.
