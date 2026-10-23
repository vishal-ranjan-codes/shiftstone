# ss-research — Technology Research & Evidence Grounding Guide

Procedure for conducting technical research, grounding findings in live web search receipts, and authoring 7-file research dossiers in `docs/research/<topic-area>/<slug>/`.

---

## Iron Law

1. **Mandatory Live Web Search Receipts:** NEVER write research conclusions or recommendations without conducting at least 3 live `search_web` queries. Unverified model hallucinations are strictly forbidden.
2. **`06-SOURCES.md` Written Before `04-CONCLUSION.md`:** `06-SOURCES.md` (containing the verified Live Search Receipt Table: Query, Tool, URL, ISO Date, Key Finding) MUST be written BEFORE `04-CONCLUSION.md` is drafted.
3. **Zero Placeholder Invariant:** Research dossiers must not contain `TODO`, `TBD`, `FIXME`, or `example.com` placeholders.
4. **Physical Disk Output Only:** Output all research files directly to `docs/research/<topic-area>/<slug>/`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I know this library well, so I don't need to search the web."* | **Forbidden.** APIs and pricing evolve rapidly. Live search grounding with $\ge 3$ receipts is mandatory. |
| *"I'll draft the recommendation first and add the sources later."* | **Forbidden.** Drafting conclusions before sources introduces confirmation bias and unverified claims. Sources first. |
| *"I can put TBD in the comparison table."* | **Forbidden.** `validate-research.js` rejects dossiers with unresolved placeholders. |

---

## Dossier Authoring Procedure

### Phase 1: Scoping & Brief Authoring
1. Check `docs/research/README.md` to avoid duplicating existing research.
2. Create topic directory: `docs/research/<area>/<slug>/`.
3. Write `00-BRIEF.md`:
   - State explicit Research Question / Decision Contract: *"We are researching [topic] in order to decide [specific decision]."*
   - Define Scope, Audience, and active stack constraints.

### Phase 2: Live Web Search Grounding
1. Execute $\ge 3$ live `search_web` queries across official docs, GitHub issues, and benchmarks.
2. Draft `06-SOURCES.md` **first**:
   ```markdown
   ## 🔍 Live Web Search Receipts (Mandatory — Minimum 3 Live Queries)

   | Query | Tool | Verified URL | Retrieved ISO Date | Key Finding |
   |---|---|---|---|---|
   | `<query 1>` | `search_web` | `https://...` | `YYYY-MM-DD` | `...` |
   | `<query 2>` | `search_web` | `https://...` | `YYYY-MM-DD` | `...` |
   | `<query 3>` | `search_web` | `https://...` | `YYYY-MM-DD` | `...` |
   ```

### Phase 3: Synthesize Findings & Conclusion
1. Write `04-CONCLUSION.md` with explicit recommendation, trade-offs, and ADR linkage (`DEC-XXX`).
2. Write remaining files:
   - `01-SUMMARY.md` — plain-language executive summary.
   - `02-FINDINGS.md` — technical architecture, performance, security.
   - `03-COMPARISON.md` — scoring matrix comparing 2–3 options.
   - `05-IMPLEMENTATION.md` — working code patterns for the active pack stack.

### Phase 4: Master Indexing & Validation
1. Update `docs/research/README.md` table of contents.
2. Validate dossier:
   ```bash
   node .shiftstone/scripts/validate-research.js --dir docs/research/<area>/<slug>
   ```

---

## Verification Ladder

- **L1 (Syntax):** All 7 files exist (`00` through `06`) with valid frontmatter.
- **L2 (Search Receipts):** `06-SOURCES.md` contains $\ge 3$ verified live search receipts.
- **L3 (Script Check):** `node .shiftstone/scripts/validate-research.js` passes cleanly.
- **L4 (Checker Review):** Disjoint check verifies conclusion logically follows from findings.
- **L5 (ADR Linkage):** If adopted, corresponding decision recorded in `docs/decisions/`.

---

## Terminal States

- `success`: Research dossier completed, validated, and indexed.
- `blocked`: Web search tool unavailable to collect live receipts.
- `escalated`: Research inconclusive or requiring stakeholder product decision.
