# ss-brainstorm — Socratic Ideation & Exploration Guide

Structured brainstorming workflow for exploring requirements, architectural approaches, and trade-offs before writing plans or code.

---

## Iron Law

1. **Zero Code During Ideation:** NEVER write implementation code, schemas, or tests during brainstorming. Exploration is purely conceptual and architectural.
2. **One Question Per Turn:** Always ask exactly one question at a time. Never overwhelm the user with multi-part questionnaires. Default to host `ask_question` tool where available.
3. **Mandatory 2–3 Approach Matrix:** Always present 2 to 3 distinct, viable architectural approaches with concrete trade-offs (pros, cons, complexity, maintenance). Never present a single take-it-or-leave-it option.
4. **Handoff to `/ss-plan`:** Brainstorming concludes by producing a concise design brief and handing off directly to `/ss-plan`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"The solution is obvious, so I can start coding right away."* | **Forbidden.** Brainstorming exists to uncover edge cases, non-goals, and simpler alternatives before investing in implementation. |
| *"I'll dump 5 questions at once to save turns."* | **Forbidden.** One question per turn ensures deep reflection and prevents cognitive fatigue. |
| *"I only have one good approach."* | **Forbidden.** Every problem has trade-offs (e.g. monolithic vs modular, client vs server, sync vs async). Present at least 2 distinct paths. |

---

## Brainstorming Lifecycle

### Step 1: Clarify Problem & Goals
- Ask the core problem question: "What is the primary user pain point or system bottleneck we are solving?"
- Elicit:
  - **Goals:** What must work for this to succeed?
  - **Non-Goals:** What are we deliberately NOT doing in this iteration?
  - **Constraints:** Budget, performance, dependencies, security.

### Step 2: Explore 2–3 Architectural Approaches
Synthesize 2–3 distinct designs and compare them in a markdown table:
```markdown
| Dimension | Approach A: [Name] | Approach B: [Name] | Approach C: [Name] |
|---|---|---|---|
| Architecture | ... | ... | ... |
| Pros | ... | ... | ... |
| Cons / Risks | ... | ... | ... |
| Effort / Complexity | Low | Medium | High |
```

### Step 3: Align on Approach & Synthesize Brief
- Use `ask_question` to let the user select their preferred approach.
- Synthesize the agreed direction into a concise Design Brief.
- Hand off to `/ss-plan` (`docs/plans/<feature-slug>/`).

---

## Verification Ladder

- **L1 (Syntax):** Valid markdown formatting and clean frontmatter.
- **L2 (Scope Check):** Confirm 0 code files were created or modified during ideation.
- **L3 (Trade-off Verification):** Confirm 2–3 approaches were compared with explicit trade-offs.
- **L4 (Handoff Parity):** Confirm Design Brief provides clear inputs for `/ss-plan`.
- **L5 (User Agreement):** User explicitly confirms chosen direction.

---

## Terminal States

- `success`: Brainstorming complete, approach selected, handoff to `/ss-plan`.
- `blocked`: Missing fundamental technical requirements or unresolved security blocker.
- `escalated`: Disagreement on architectural scope requiring team lead alignment.
