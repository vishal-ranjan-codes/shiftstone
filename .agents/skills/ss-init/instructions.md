# ss-init — Advanced Workspace Initializer & Product Architecting Guide

Procedural guide for initializing fresh workspaces into fully articulated, production-ready applications.

---

## Iron Law

1. **One Question Per Turn:** Never dump multiple questions simultaneously during requirements discovery. Always ask one question at a time using `ask_question`.
2. **Deep Bible Synthesis:** Never leave `docs/bible/` with unpopulated template placeholders. Synthesize domain schemas, RLS policies, invariants, and route contracts from the discovery gates before completing initialization.
3. **Mechanical Separation:** Scaffolding operations (pack validation, starter cloning, git boundaries) are executed deterministically by `node .shiftstone/init.js`. Product architecture, brand naming, and Bible synthesis are executed by the skill.
4. **Physical Disk Output Only:** Output all configuration, schemas, decisions, and documentation directly to repo files. Never emit temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll skip the Socratic interview and just use generic defaults."* | **Forbidden.** Without domain elicitation, `docs/bible/` remains generic and subsequent AI turns hallucinate business logic. |
| *"I'll ask all 5 discovery gates at once to speed up initialization."* | **Forbidden.** One question per turn is mandatory for thoughtful product modeling. |
| *"The user has no name in mind, so I'll generate a quick placeholder like MySaaS."* | **Forbidden (Placek Rule).** Dispatch Gate 4.5 (`/ss-brand-naming`) to explore vetted, collision-free brand names. |

---

## The 6-Phase Initialization Lifecycle

### Phase 1: Socratic Elicitation Ladder (Gates 1–4.5)
- Follow [resources/interview-rubric.md](./resources/interview-rubric.md):
  - **Gate 1:** Problem space, value proposition, goals & anti-goals.
  - **Gate 2:** Actors, user personas & RBAC hierarchy.
  - **Gate 3:** Domain entity modeling & business invariants.
  - **Gate 4:** Tenant isolation, security & compliance posture.
  - **Gate 4.5 (Brand Naming):** If user undecided, invoke `/ss-brand-naming` to select a vetted brand name.

### Phase 2: Autonomous Pre-Scaffold Research (Conditional)
- Trigger research pass (`docs/research/`) if third-party services (Stripe, Resend, Twilio) or custom archetypes are selected. Skip for standard flagship boilerplate.

### Phase 3: Dynamic Skill Discovery
- Use `find-skills` to discover community skills from `skills.sh`. Auto-install skills with $\ge 10,000$ installs; present lower-install skills as optional recommendations.

### Phase 4: Mechanical Engine Execution
- Run `node .shiftstone/init.js` with parameters gathered from Phase 1:
  ```bash
  node .shiftstone/init.js --name="<ProjectName>" --gh-user="<ghUser>" --skills="<skills>" --layout="monorepo" --pm="pnpm" -y
  ```

### Phase 5: Deep Bible & Backlog Synthesis
- Populate `docs/bible/`:
  - `03-database/schema-reference.md`: Tables, columns, and foreign keys.
  - `03-database/rls-policies.md`: Row-level security matrix.
  - `04-auth-and-rbac/auth-overview.md`: Session guards and RBAC roles.
  - `05-core-systems/core-domain-rules.md`: Invariants identified in Gate 3.
  - `08-api-contracts/route-contracts.md`: Primary routes, loaders, actions.
  - `docs/decisions/DEC-010-domain-architecture.md`: Foundational architecture ADR.
  - `docs/bible/CHANGELOG.md`: Initial entry.
- Populate `docs/backlog/`:
  - Structure Phase 1 (Foundation) and Phase 2 (Core Features) with actionable user stories.

### Phase 6: Verification Ladder & Completion Receipt
- Run `node .shiftstone/scripts/validate-manifest.js` and `pnpm parity`.
- Emit `.workspace-init-receipt.json`.

---

## Verification Ladder

- **L1 (Syntax):** Valid markdown formatting, valid YAML frontmatter across all created files.
- **L2 (CLI Scaffolding):** `node .shiftstone/init.js` completes with exit code 0.
- **L3 (Bible Parity):** All 8 Bible chapters populated without placeholder strings.
- **L4 (Workspace Integrity):** `node .shiftstone/scripts/validate-manifest.js` passes cleanly.
- **L5 (Human Sign-off):** Founder/developer confirms workspace structure and is ready for `/ss-plan`.

---

## Terminal States

- `success`: Workspace initialized, Bible populated, backlog generated, receipt emitted.
- `blocked`: Git remote conflict, missing package manager, or starter clone network failure.
- `escalated`: Disputed multi-tenant security architecture requiring human architectural decision.
