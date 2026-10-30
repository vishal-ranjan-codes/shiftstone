# Technical Chapter Templates Specification

Technical chapters live in `docs/bible/01-*` through `08-*`.

---

## 1. schema-reference.md Template (`docs/bible/03-database/`)

```markdown
---
type: chapter-topic
title: "Database Schema Reference"
chapter: "03-database"
file: "schema-reference.md"
---

# Database Schema Reference

## PostgreSQL Table Definitions & Row Level Security
All primary tables define UUID v4 primary keys and enforce foreign key referential integrity. Row Level Security policies isolate data by tenant ID.

```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
```
```

---

## 2. third-party-services.md Template (`docs/bible/06-integrations/`)

```markdown
---
type: chapter-topic
title: "Third-Party Services"
chapter: "06-integrations"
file: "third-party-services.md"
---

# Third-Party Integrations & External SDKs

## Evaluated Providers & Research Lineage
External service selections are grounded in research dossiers located under `docs/research/`.
Client wrappers implement exponential backoff with full jitter to protect against transient upstream failures.
```

---

## 3. webhooks.md Template (`docs/bible/06-integrations/`)

```markdown
---
type: chapter-topic
title: "Webhook Architecture"
chapter: "06-integrations"
file: "webhooks.md"
---

# Inbound Webhook Architecture & Signature Verification

## Cryptographic Authentication Invariants
All inbound webhook requests must verify HMAC-SHA256 signatures over timestamped payloads using Web Crypto `crypto.subtle`.
Signatures deviating by more than 300 seconds from the current epoch are rejected to prevent replay attacks.
```
