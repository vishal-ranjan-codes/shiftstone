---
type: chapter-topic
title: "Domain Invariants & Business Logic"
chapter: "05-core-systems"
file: "domain-invariants.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Hard business rules, atomic transactional RPC functions, and tenant boundary constraints."
---

# Core Systems — Domain Invariants & Business Logic

## 1. Domain Invariants

1. **Owner Isolation**: Every resource record must reference an active, valid `user_id` or `tenant_id`. Orphaned records are prohibited.
2. **Immutable Audit Timestamps**: `created_at` timestamps are set strictly by PostgreSQL (`DEFAULT NOW()`) and are immutable.
3. **Atomic State Mutations**: Multi-table updates or sensitive state transitions must execute within atomic database transactions via PostgreSQL RPC functions or stored procedures.

---

## 2. Transactional RPC Functions

For multi-step or atomic operations (e.g. creating organizations, transferring credits, deleting accounts):
- Implement a PostgreSQL function with `SECURITY DEFINER`.
- Set an explicit `SET search_path = public`.
- Call the function from the route action:
  ```typescript
  const { data, error } = await supabase.rpc("api_atomic_operation", {
    p_user_id: user.id,
    p_param: input.param,
  });
  ```
