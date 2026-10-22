# Level 5 Protected Action Approvals Registry

This directory stores schema-validated human approval artifacts (`APR-YYYYMMDD-XXX.json`) required to authorize Level 5 protected actions.

## Overview

In accordance with Paper 2 Chapter 4 (Two-Gear Boundary) and Paper 3 Chapter 2 (Level 5 Human Gate & Terminal States), autonomous AI agents and automated loops are deterministically halted in terminal state **`blocked`** whenever they attempt an action governed by `core/governance/protected-actions-policy.yaml` without an active, scope-bound human approval.

## Governed Action Classes

1. **`db-migration-destructive`**: Destructive database changes (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `supabase db reset`).
2. **`rls-policy-mutation`**: Altering or dropping Row Level Security policies (`ALTER POLICY`, `DROP POLICY`, `DISABLE ROW LEVEL SECURITY`).
3. **`auth-secret-rotation`**: Modifying production environment secrets or setting live secret tokens (`wrangler secret put`, `supabase secrets set`).
4. **`ssot-bible-mutation`**: Direct modifications to `docs/bible/**` outside an approved `/sync-bible` proposal.
5. **`production-deploy`**: Publishing live software or running production deployment commands (`wrangler deploy`, `supabase db push`, `pnpm deploy`).
6. **`core-governance-override`**: Overriding core governance rules, schema definitions, or dropping existing test suites.

## File Format & Schema

Approval files adhere to `core/governance/schemas/protected-action-approval.schema.json` (`protected-action-approval/v1`).

```json
{
  "schemaVersion": "protected-action-approval/v1",
  "approvalId": "APR-20261021-001",
  "actionClass": "db-migration-destructive",
  "scopePaths": [
    "supabase/migrations/20261021120000_drop_deprecated_users_table.sql"
  ],
  "gitTreeHash": "workspace-head",
  "approver": "lead-architect@shiftstone.dev",
  "approvedAt": "2026-10-21T12:00:00.000Z",
  "expiresAt": "2026-10-22T12:00:00.000Z",
  "justification": "Deprecated legacy table migration signed off after data archiving complete.",
  "status": "active"
}
```

## Anti-Collusion Rules

1. **Human Approver Required**: Approvals signed by AI agents (e.g. matching `claude`, `agent`, `gpt`, `bot`, `assistant`) are mechanically rejected with exit code 1.
2. **Expiration Enforcement**: Approvals where `expiresAt < now` are immediately rejected.
3. **Scope Binding**: The approval must cover the exact file paths or command being executed.
4. **Terminal State**: Missing or invalid approvals transition execution immediately to `"blocked"`, never `"escalated"` or `"error"`.
