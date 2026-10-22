---
activation: on-demand
---

# {{PROJECT_NAME}} — AI Code Review Checklist (loaded by `/review`)

The checklist is tuned to the three failure classes AI-authored code fails on
most (Osmani 03/06). Every finding MUST be reported under one of these
categories, with `file:line`, a severity (`blocker|major|minor`) and a concrete
fix direction. A review without per-category findings did not happen.

## 1. Hallucinated dependencies

- A package is imported that is absent from `package.json` / the lockfile.
- An import references a module, export, or file path that does not exist.
- An API, config key, or CLI flag is used that is not in the bible, docs, or
  upstream documentation (invented library methods like `someLib.foo()` are the classic case).
- A dependency is added where a stdlib/language feature already covers it.

## 2. Inadequate error handling

- An awaited call that can fail has no handling (network, fs, DB, subprocess).
- Errors are swallowed: empty `catch`, `catch {}` with no rethrow/log, or a
  generic `return null` that hides the failure from the caller.
- Boundary input is trusted: request bodies, query params, webhook payloads,
  env vars — no Zod/schema validation at the entry point.
- Failure paths skip cleanup: no rollback of partial writes, no release of
  locks/handles, no retry/backoff where the operation is idempotent.

## 3. Subtle correctness

- Off-by-one, wrong boundary operator, inverted conditions, unreachable branches.
- Async hazards: unawaited promises, shared mutable state across turns,
  stale closures, race between concurrent writers.
- Tests weakened to go green: skipped tests, loosened assertions, mocked-away
  the very thing under test (spec gaming — refusal-level).
- Behavior changed without a test/eval change (red-before violation, B4).
- A verified path silently regressed: docs/bible contract vs. code mismatch.

## Reporting contract

| Field | Requirement |
|---|---|
| Category | One of the 3 above (findings grouped under headings) |
| Location | `file:line` (or diff hunk) |
| Severity | `blocker` = merge must stop · `major` = fix before human review · `minor` = note |
| Evidence | The exact line/snippet or command output that proves the finding |
