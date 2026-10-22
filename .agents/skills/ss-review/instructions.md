# ss-review — AI First-Pass Code Review Guide

Procedure for auditing code changes against the three primary AI failure classes before human review.

---

## Iron Law

1. **Mandatory Category Grouping:** Findings MUST be grouped under the 3 checklist categories: Hallucinated Dependencies, Inadequate Error Handling, and Subtle Correctness. Never emit an unstructured stream of notes.
2. **Actionable Findings Only:** Every finding MUST specify `file:line`, severity (`blocker | major | minor`), and a concrete fix direction.
3. **Blockers Halt Progress:** Any `blocker` finding stops the merge/ship pipeline immediately (`verdict: changes_requested`).
4. **Physical Disk Output Only:** Output review reports to PR comments or `docs/reports/reviews/`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"The code looks good to me, so I'll write 'Looks good!' with no findings."* | **Forbidden.** "Looks good" with zero findings requires explicitly listing which files and lines were checked under all 3 categories. An empty note is not proof. |
| *"The missing package can be installed later."* | **Forbidden.** Importing an undeclared package is a `blocker` (Hallucinated Dependency). |
| *"Swallowing the error in catch {} is safe here."* | **Forbidden.** Swallowed errors hide catastrophic failures from callers and monitoring. |

---

## Review Pass Procedure

### Step 1: Assemble the Change Scope
- Collect the target diff (`git diff HEAD`, staged diff, or specified commit/branch).
- Verify whether behavior changed; if so, confirm a corresponding test diff exists.

### Step 2: Three-Category Checklist Pass
Consult [resources/review-checklist.md](./resources/review-checklist.md) and execute three distinct passes:
1. **Hallucinated Dependencies:**
   - Verify every imported symbol and package exists in `package.json` or the codebase.
   - Confirm no invented API methods or flags.
2. **Inadequate Error Handling:**
   - Trace all async calls that can reject.
   - Confirm boundary validation exists (Zod/schemas) for request bodies and env vars.
   - Verify failure paths clean up partial state and locks.
3. **Subtle Correctness:**
   - Check off-by-one errors, inverted boolean logic, unawaited promises.
   - Confirm tests were not weakened (`.skip`, `.only`, loosened assertions).

### Step 3: Emit Grouped Report
Emit findings using the standard structure:
```markdown
## Hallucinated dependencies
- [blocker] path/to/file.ts:24 — imports undeclared package `lib-foo`
## Inadequate error handling
- [major] path/to/file.ts:56 — database call unhandled in catch block
## Subtle correctness
- [minor] path/to/file.ts:89 — unawaited async call in loop
```

### Step 4: Emit Verdict
- **Changes Requested:** If any `blocker` finding exists.
- **Passes with Findings:** If only `major` or `minor` findings exist.
- **Approved:** Zero findings after full 3-category audit.

---

## Verification Ladder

- **L1 (Syntax):** Valid markdown formatting and link integrity.
- **L2 (Checklist Completeness):** All 3 categories evaluated and reported.
- **L3 (Evidence Precision):** Every finding has verified `file:line` pointer.
- **L4 (Checker Review):** Disjoint review using [resources/spec-reviewer-prompt.md](./resources/spec-reviewer-prompt.md).
- **L5 (Human Gate):** Human developer reviews categorized findings.

---

## Terminal States

- `success`: Review completed, findings categorized, verdict emitted.
- `blocked`: Incomplete diff or missing test evidence for behavioral mutation.
- `escalated`: Disputed architectural severity requiring senior engineer arbitration.
