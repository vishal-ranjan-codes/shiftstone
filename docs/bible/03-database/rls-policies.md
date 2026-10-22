---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
---
# 03 — Row-Level Security (RLS) Policies

This chapter is the SSOT for **database-enforced access control**: which roles may read/modify which rows, and how that is expressed in the database itself rather than (only) in application code.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/03-database/rls-policies.md` at init.

## Core Security Policies

For each table with row-level access control, document every policy: target role, operation (select/insert/update/delete), and the predicate that scopes rows to the requesting user or tenant. Include the policy SQL.

## Policy Performance Rules

1. Every policy predicate should be sargable — anchor it to an indexed column (tenant/owner key), not a function call over every row.
2. Prefer a single policy per operation with a complete predicate over overlapping partial policies.
3. Test policies with an authenticated-role query, not only as an admin — admin bypasses are how leaks ship.
