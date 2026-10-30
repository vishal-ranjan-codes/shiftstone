# PRD Suite Templates Specification

The PRD collection lives in `docs/bible/PRD/`.

---

## 1. ecosystem-prd.md Template

```markdown
---
type: prd-ecosystem
title: "Full-System Ecosystem PRD"
chapter: "PRD"
status: approved
---

# Ecosystem PRD: {{PROJECT_NAME}}

## 1. Executive Summary & Vision
A cohesive platform solving core operational friction for target users.

## 2. Core Personas & Problem Space
- Primary Operator: Daily workflow executor needing fast, zero-lag task completion.
- Administrator: Manager requiring compliance visibility, seat management, and audit trails.

## 3. Four Product Pillars
1. High-Assurance Reliability: Sub-second edge response times with offline-first resilience.
2. Zero-Trust Security: Cryptographic signature verification across all API and webhook boundaries.
3. Intuitive Ergonomics: Modern keyboard-first interface adhering to accessible design tokens.
4. Seamless Data Portability: Full data ownership with standard export schemas.

## 4. Anti-Goals
- We do NOT build non-essential bespoke analytics when standard telemetry suffices.
- We do NOT support legacy unauthenticated API access.
- We do NOT lock user data behind proprietary binary export formats.
```

---

## 2. phase-1-foundation-prd.md Template

```markdown
---
type: prd-phase
title: "Phase 1: Foundation & Core Workflows PRD"
chapter: "PRD"
status: active
---

# Phase 1 Foundation PRD: {{PROJECT_NAME}}

## 1. Phase Objective
Establish the minimal viable operational slice: multitenant authentication, baseline data models, core actions, and responsive layout.

## 2. In-Scope Functional Deliverables
- User registration, login, and tenant workspace creation.
- Core entity CRUD operations with row-level security.
- System health checks and telemetry instrumentation.

## 3. Acceptance Criteria & SLAs
- API response time p95 < 250ms on edge worker routes.
- 100% test pass rate across unit and e2e integration suites.
```
