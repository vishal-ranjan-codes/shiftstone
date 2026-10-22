# ss-new-cron-job — Scheduled Worker & Background Job Guide

Procedure for designing, implementing, configuring, and documenting scheduled cron jobs and background workers.

---

## Iron Law

1. **Stage Contract in `docs/plans/` Required:** Every cron job design MUST be written as a Tier 1 Stage Contract in `docs/plans/<job-slug>/CONTEXT.md`. Never output to temporary IDE brain artifacts.
2. **Idempotency & Concurrency Invariant:** Every scheduled job MUST be idempotent and concurrency-safe (using database advisory locks, lease tables, or platform atomic locks). Never assume single-worker execution.
3. **Human Approval Gate:** ⛔ STOP — Never deploy or register new cron schedules without explicit human approval on the Stage Contract.
4. **Mandatory Documentation Update:** Every scheduled job MUST be documented in `docs/bible/01-architecture/architecture-overview.md` with its cron schedule and purpose.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll output a cron_job_design.md artifact in chat."* | **Forbidden.** Brain/chat artifacts are ephemeral. Write the job contract to `docs/plans/<job-slug>/CONTEXT.md`. |
| *"The job runs once a day, so concurrency collisions won't happen."* | **Forbidden.** Serverless environments and distributed workers can trigger duplicate events. Concurrency locking is mandatory. |
| *"I don't need to document the cron expression."* | **Forbidden.** Undocumented schedules cause production confusion and zombie jobs. Update `docs/bible/01-architecture/`. |

---

## Job Lifecycle

### Phase 1: Design & Stage Contract
1. Consult `docs/bible/01-architecture/architecture-overview.md` for existing workers and schedules.
2. Author Tier 1 Stage Contract in `docs/plans/<job-slug>/CONTEXT.md`:
   - Job name (`snake_case`) and cron expression (e.g. `0 * * * *`).
   - Purpose and business trigger.
   - Idempotency strategy and concurrency locking mechanism.
   - Target worker handler location (`workers/**`).
3. **⛔ STOP — Obtain explicit human approval before implementing.**

### Phase 2: Implement & Register
4. Register the cron trigger in the runtime configuration (e.g. scheduler manifest or worker configuration).
5. Implement the job handler in the worker entry point, dispatching on schedule.
6. Use transaction-safe clients and advisory locks for database mutations.

### Phase 3: Verify & Document
7. Run typecheck and worker build:
   ```bash
   pnpm typecheck
   ```
8. Update `docs/bible/01-architecture/architecture-overview.md` with schedule table entry.
9. Append entry to `docs/bible/CHANGELOG.md`.

---

## Verification Ladder

- **L1 (Syntax):** Valid 5-field cron expression; worker handler compiles clean.
- **L2 (Unit Test):** Job handler unit test confirms idempotent execution.
- **L3 (Concurrency Lock):** Proof of advisory lock or atomic lease acquisition.
- **L4 (Bible Parity):** `docs/bible/01-architecture/` records new cron schedule.
- **L5 (Human Approval):** Human approves scheduler registration.

---

## Terminal States

- `success`: Cron job implemented, concurrency locked, registered, and documented.
- `blocked`: Concurrency locking strategy unavailable or cron syntax invalid.
- `escalated`: High-frequency schedule with cost/resource implications requiring approval.
