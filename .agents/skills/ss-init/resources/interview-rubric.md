# ss-init — 5-Gate Socratic Interview Rubric & Protocol

Structured interview rubric for eliciting product requirements, entity models, and architectural boundaries.

## Rules of Engagement
- **One Question Per Turn:** Always ask one focused question at a time using `ask_question`.
- **Turn-by-Turn Checkpointing:** After every user response, call `saveCheckpoint(root, { current_step, context_data })` to write `.workspace-init-state.json`.
- **Resumption Gate:** Check `hasActiveSession(root)` before starting Gate 1; offer 1-click continuation if an interrupted session is detected.
- **Decisions, Not Minutiae:** Solicit high-level architectural and domain choices. Let the framework and pack manifest determine low-level implementation details.
- **Thinking Partner:** Challenge fuzzy requirements, surface edge cases, and define non-goals early.

---

## Gate 0: Resumption Gate & Checkpoint Detection
- **Check:** `hasActiveSession(root)` from `.shiftstone/init/session-state.js`.
- **If Active:**
  - Render real-time progress card.
  - Present continuation modal (`(Recommended) Resume from where I left off`, `Review & modify previously completed answers`, `Discard checkpoint and restart initialization from scratch`).
  - If Resume: retain `context_data` and resume at the first incomplete gate.
  - If Discard: `purgeState(root)` and start at Gate 1.

---

## The 5 Gates

### Gate 1: Problem Space, Value Proposition & Anti-Goals
- **Question:** "What is the core problem this project solves, and what is the exact trigger moment that leads a user to use this application?"
- **Elicitation:**
  - Value proposition: Why this over existing alternatives?
  - Core Goals: Must-haves for V1.
  - Non-Goals: Explicitly out of scope for initial launch.
  - Anti-Goals: What would constitute a failure even if technically working?
- **Checkpoint:** Save Gate 1 response to `context_data`.

### Gate 2: Actors, Personas & RBAC Hierarchy
- **Question:** "Who are the distinct human and system actors interacting with the application, and how are permissions structured?"
- **Elicitation:**
  - Personas: Public visitor, authenticated user, organization admin, platform super-admin.
  - Tenancy model: Single-tenant accounts vs multi-tenant B2B organizations.
- **Checkpoint:** Save Gate 2 response to `context_data`.

### Gate 3: Domain Entity Modeling & Business Invariants
- **Question:** "What are the 3–5 primary domain entities, how are they related, and what immutable business invariants govern them?"
- **Elicitation:**
  - Entities: e.g. Workspace, Project, Document, Invoice.
  - Invariants: e.g. "An invoice cannot be deleted once finalized", "Documents belong strictly to one workspace".
- **Checkpoint:** Save Gate 3 response to `context_data`.

### Gate 4: Tenant Isolation, Security & Compliance Posture
- **Question:** "What is your tenant isolation and compliance posture (PostgreSQL RLS, GDPR deletion, audit logging)?"
- **Elicitation:**
  - Isolation strategy: Row-Level Security scoped by `organization_id` or `user_id`.
  - Regulatory: GDPR, HIPAA, SOC2 requirements.
- **Checkpoint:** Save Gate 4 response to `context_data`.

### Gate 4.5: Brand Naming Hook
- **Question:** "Have you decided on a project name, or would you like to explore category-defining brand name candidates?"
- **Branch:**
  - User has name $\rightarrow$ Lock name and advance to Gate 5.
  - User undecided $\rightarrow$ Dispatch `/ss-brand-naming` to present 4–6 Placek-vetted candidates with live collision checks.
- **Checkpoint:** Save Brand name to `context_data`.

### Gate 5: Stack Archetype, Packaging & Ecosystem
- **Question:** "Confirming stack configuration: Stack Archetype, Package Manager, and Third-Party Integrations (payments, email, AI)?"
- **Elicitation:**
  - Archetype confirmation (e.g. configured archetype pack).
  - Community skills auto-install threshold ($\ge 10,000$ installs).
- **Checkpoint:** Save stack choices to `context_data`.
