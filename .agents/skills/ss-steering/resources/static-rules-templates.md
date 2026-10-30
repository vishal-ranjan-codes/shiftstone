# Static Rules Templates Specification

Static rules live in `.shiftstone/static-rules/*.md`. Each rule is bounded by $\le 120$ lines and $\le 6,144$ bytes. Cumulative always-on context must not exceed 12,288 bytes.

---

## 1. product.md Template

```markdown
---
type: static-rule
activation: always
priority: 1
---

# Product Vision, Invariants & Anti-Goals

## Product Philosophy
- User data privacy and portability are non-negotiable.
- Simplicity takes precedence over feature sprawl.

## Anti-Goals
- Never build unrequested complex abstractions.
- Never integrate unverified external dependencies without docs/research/ dossiers.
```

---

## 2. security.md Template

```markdown
---
type: static-rule
activation: always
priority: 2
---

# Security & Data Boundary Invariants

## Zero-Trust Boundary
- All external API inputs and webhook dispatches must undergo cryptographic signature verification.
- Secret keys and credentials must NEVER be committed to version control or printed to logs.
- Row-Level Security (RLS) is mandatory on all multitenant PostgreSQL tables.
```

---

## 3. verification.md Template

```markdown
---
type: static-rule
activation: always
priority: 3
---

# Verification Ladder & Quality Gates

## Red-First TDD Invariant
- Automated test scenarios must be observed failing before writing production code.
- Verification commands must run cleanly with exit code 0 prior to phase completion.
```

---

## 4. global.md & governance.md Templates

```markdown
---
type: static-rule
activation: always
priority: 0
---

# Global Operation & Governance Dispatch

## Mode Rules
- Respect active operational mode and bounded reading targets.
- CAS concurrency locking protects immutable transaction state.
```
