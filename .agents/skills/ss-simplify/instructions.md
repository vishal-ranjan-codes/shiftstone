# ss-simplify — Behavior-Preserving Refactoring Guide

Procedure for reviewing active diffs, reducing unnecessary complexity, and removing dead code without changing runtime behavior.

---

## Iron Law

1. **Green-to-Green Invariant:** The test suite MUST be 100% green BEFORE simplification begins, and MUST remain 100% green AFTER simplification completes. Never simplify broken code.
2. **Zero Behavior Change:** Refactoring MUST be strictly behavior-preserving. Never add new features, change public API signatures, modify database schemas, or alter error response shapes.
3. **Rollback on Regression:** If a simplification attempt breaks tests or typechecks, revert the change immediately. Do not debug new complexity introduced by refactoring.
4. **Physical Disk Edits Only:** Apply refactorings directly to files on disk. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"While simplifying, I'll add this small helpful feature."* | **Forbidden.** Scope creep. Simplification removes code and clarifies structure; it never adds new capabilities. |
| *"The tests failed, but I can fix the test to match the cleaner code."* | **Forbidden (Anti-Gaming).** Tests define the behavior contract. Changing tests to make a refactoring pass is metric gaming. |
| *"I'll rewrite the whole module architecture."* | **Forbidden.** Simplification operates on active diffs with small, targeted, atomic refactoring steps. |

---

## Simplification Protocol

### Phase 1: Pre-Check (Green Baseline)
1. Run the test and typecheck suites:
   ```bash
   pnpm -C .shiftstone test && pnpm typecheck
   ```
2. Verify all checks pass cleanly. If any check fails, halt: fix bugs first using `/ss-diagnose`.

### Phase 2: Active Diff Audit
Inspect the staged and unstaged diffs:
- **Redundant abstractions:** Eliminate one-use wrapper functions, premature helpers, or unnecessary layers of indirection.
- **Dead / Unused code:** Remove commented-out blocks, unused imports, uncalled private helpers.
- **Cognitive complexity:** Flatten deeply nested conditionals (use early returns / guard clauses).
- **Naming clarity:** Replace ambiguous variable names (`data`, `res`, `temp`) with descriptive domain terms.

### Phase 3: Post-Check (Green Gate)
1. Re-run test and typecheck suites.
2. Verify diff is smaller or significantly more readable.
3. Commit cleanly if green, or `git checkout` if regressed.

---

## Verification Ladder

- **L1 (Syntax & Types):** Typechecker passes with zero errors.
- **L2 (Unit Tests):** All existing test suites pass cleanly with identical assertion counts.
- **L3 (Diff Verification):** `git diff` confirms zero changes to public contracts or exported types.
- **L4 (Code Review):** Disjoint check verifies code readability improved.
- **L5 (Git Commit):** Atomic refactoring commit created.

---

## Terminal States

- `success`: Code simplified, complexity reduced, test suite remains 100% green.
- `no_op`: Active diff is already minimal, clean, and optimal.
- `blocked`: Pre-existing test failures prevent safe refactoring baseline.
- `cancelled`: Attempted refactoring rolled back due to test regression.
