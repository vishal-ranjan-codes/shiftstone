# docs/backlog/

| Field | Declaration |
|---|---|
| **Purpose** | Loop-driven task tickets: one phase folder per roadmap phase, numbered sub-phase `.md` files holding checklisted tasks. Closure is verification-gated — `[x]` requires a `/ss-verify` Checker signature (≥ 0.8), enforced by `.shiftstone/scripts/check-backlog-signoff.js --strict`. |
| **When populated** | Continuously during development — seeded with phase skeletons at init, extended by `/ss-new-feature` planning and `/ss-backlog-sync`. |
| **File types** | Phase folders (`Phase N - …/`) with numbered task `.md` files, plus `MOC.md` (roadmap summary + active-phase pointer), `HOW-TO-USE.md` (closure rules), `index.md`. |
| **Owner** | AI agent maintains status and links; humans approve closures (outer gear). |
| **Lifecycle** | Created → `[/]` in progress → `[x]` only after `/ss-verify` sign-off → retained as the development record (never deleted). |

**Anti-pattern guardrail:** implementation plans → `docs/plans/`; bug logs → `docs/bugs/`; reports → `docs/reports/`. See the registry in blueprint §10.15.
