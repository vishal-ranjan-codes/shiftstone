# Master Initialization Brief & Stage Contract: Workspace Initialization

**Suite:** `workspace-initialization`  
**Generated At:** {{TIMESTAMP}}  
**Status:** `active`  
**Target Workspace:** `{{ROOT}}`

---

## 1. Executive Summary & Product Thesis

- **Product Name:** {{PROJECT_NAME}}
- **Product Thesis:** {{PRODUCT_THESIS}}
- **Core Value Proposition:** {{VALUE_PROPOSITION}}
- **Primary Archetype:** {{PRIMARY_ARCHETYPE}}
- **Secondary Archetype:** {{SECONDARY_ARCHETYPE}}

### Core Goals
{{CORE_GOALS}}

### Anti-Goals (Non-Negotiable Boundaries)
{{ANTI_GOALS}}

---

## 2. Actors, Personas & Role Permissions Matrix

### Target Personas
{{PERSONAS}}

### Role Permissions Matrix
| Role | Target Persona | Base Capabilities | Boundary Constraints |
|---|---|---|---|
| `owner` | Primary Account Holder | Full workspace provisioning, billing, member invites | Cannot delete workspace with active subscriptions |
| `admin` | Operations Lead | Entity management, member administration, configuration | Cannot transfer ownership or access owner billing keys |
| `member` | Authenticated Workspace User | Domain entity CRUD within assigned workspace scope | Strictly isolated via Row Level Security (RLS) |

---

## 3. Domain Entities & Business Invariants

### Core Data Entities
{{DATA_ENTITIES}}

### Business Invariants
{{BUSINESS_INVARIANTS}}

---

## 4. Brand Strategy, Design Tokens & Living Theme

- **Color Archetype:** {{BRAND_ARCHETYPE}}
- **Primary Color:** `{{COLOR_PRIMARY}}`
- **Dark Mode Accent:** `{{COLOR_PRIMARY_DARK}}`
- **Surface Light:** `{{COLOR_SURFACE_LIGHT}}`
- **Surface Dark:** `{{COLOR_SURFACE_DARK}}`
- **Heading Font:** `{{FONT_HEADING}}`
- **Body Font:** `{{FONT_BODY}}`
- **Code Font:** `{{FONT_CODE}}`

Living Brand Book Location: [`docs/brand/brand-book.html`](file:///docs/brand/brand-book.html)  
Design Tokens Specification: [`docs/brand/brand-tokens.json`](file:///docs/brand/brand-tokens.json)

---

## 5. Researched Integrations, SDK Signatures & Webhook Contracts

### Third-Party Services
{{RESEARCHED_SERVICES}}

### Required Environment Variables Ledger
{{ENV_KEYS_LEDGER}}

---

## 6. Target Application Scaffolding Paths

- **Application Directory:** `{{APP_PATH}}`
- **Application Stylesheet:** `{{APP_PATH}}/app/globals.css`
- **Database Migrations:** `{{APP_PATH}}/supabase/migrations/`
- **Generated Types:** `{{APP_PATH}}/app/types/database.types.ts`
- **Environment Example:** `{{APP_PATH}}/.env.example`
- **Package Manifest:** `{{APP_PATH}}/package.json`

---

## 7. Raw Ingested PRD Source Text

```markdown
{{RAW_PRD_TEXT}}
```
