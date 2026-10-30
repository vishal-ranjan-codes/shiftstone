/**
 * Domain ADR Generator (ShiftStone v3.0)
 *
 * Consumes interview domain choices and creates genuine physical OKF ADR files in docs/decisions/,
 * then compiles them into the master ledger in docs/bible/DECISIONS.md.
 *
 * Traceability:
 *   - REQ-INIT3-07 (Domain ADR Generation & Auto-Compiled Decisions Ledger)
 *   - LOCK-INIT3-11 (Canonical ADR Storage & Auto-Compilation)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateDecisionsLedger } from '../scripts/compile-decisions.js';

/**
 * Generates foundational domain architecture and third-party integration ADRs in docs/decisions/
 * and compiles them into docs/bible/DECISIONS.md.
 *
 * @param {Record<string, any>} context - Elicited product context
 * @param {string} [root=process.cwd()] - Workspace root
 * @returns {Array<{ id: string, file: string, path: string }>} Array of generated ADR descriptors
 */
export function generateDomainDecisions(context = {}, root = process.cwd()) {
  const decisionsDir = path.join(root, 'docs', 'decisions');
  const bibleDir = path.join(root, 'docs', 'bible');

  mkdirSync(decisionsDir, { recursive: true });
  mkdirSync(bibleDir, { recursive: true });

  const projectName = context.projectName || 'NexusApp';
  const timestamp = context.timestamp || new Date().toISOString();
  const entities = Array.isArray(context.entities) && context.entities.length > 0
    ? context.entities
    : ['User', 'Workspace', 'Resource'];

  const generated = [];

  // 1. DEC-010: Foundational Domain Architecture
  const dec010File = 'DEC-010-foundational-domain-architecture.md';
  const dec010Path = path.join(decisionsDir, dec010File);
  const dec010Content = `---
type: decision
decisionId: DEC-010
title: Foundational Domain Architecture & Tenancy Invariants
status: accepted
pack: core
timestamp: ${timestamp}
---

# DEC-010: Foundational Domain Architecture & Tenancy Invariants

## Context
${projectName} requires clear domain entity definitions, tenant boundaries, and non-negotiable business rules to prevent architectural drift during development.

## Decision
Establish the primary domain entity models and tenancy architecture:
${entities.map((e) => `- **${e}:** Core domain resource with strict tenant isolation and lifecycle state tracking.`).join('\n')}

Tenancy is enforced at the database layer via PostgreSQL Row-Level Security (RLS) scoping queries by user or workspace credentials.

## Consequences
- Every domain query and mutation must respect tenant scoping boundaries.
- Cross-tenant data leakage is structurally impossible at the database level.
- Unbreakable business invariants are enforced before write operations commit.
`;
  writeFileSync(dec010Path, dec010Content, 'utf8');
  generated.push({ id: 'DEC-010', file: dec010File, path: dec010Path });

  // 2. DEC-018: Payment Service Integration (if applicable)
  const paymentService = context.paymentService || (
    context.integrations?.find?.((s) => ['stripe', 'dodo', 'lemon'].some((p) => String(s).toLowerCase().includes(p)))
  );
  if (paymentService) {
    const serviceSlug = String(paymentService).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const serviceTitle = serviceSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const dec018File = `DEC-018-${serviceSlug}-payment-integration.md`;
    const dec018Path = path.join(decisionsDir, dec018File);
    const dec018Content = `---
type: decision
decisionId: DEC-018
title: ${serviceTitle} Payment Integration & Gateway Architecture
status: accepted
pack: core
timestamp: ${timestamp}
---

# DEC-018: ${serviceTitle} Payment Integration & Gateway Architecture

## Context
${projectName} requires billing checkout, subscription handling, and webhook processing for financial events.

## Decision
Adopt ${serviceTitle} as the primary billing and payment processing provider.
- Webhooks verify cryptographic signatures (HMAC SHA-256) before processing.
- Checkout sessions run hosted or component-embedded to minimize PCI-DSS compliance scope.
- State transitions update local database records idempotently using checkout session identifiers.

## Consequences
- Billing logic is decoupled from core product workflows.
- Webhook endpoints enforce replay protection and dead-letter queue recovery.
`;
    writeFileSync(dec018Path, dec018Content, 'utf8');
    generated.push({ id: 'DEC-018', file: dec018File, path: dec018Path });
  }

  // 3. DEC-019: Cron & Background Processing (if applicable)
  const cronService = context.cronService || (
    context.integrations?.find?.((s) => ['cron', 'qstash', 'queue', 'upstash'].some((c) => String(s).toLowerCase().includes(c)))
  );
  if (cronService) {
    const serviceSlug = String(cronService).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const serviceTitle = serviceSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const dec019File = `DEC-019-${serviceSlug}-background-jobs.md`;
    const dec019Path = path.join(decisionsDir, dec019File);
    const dec019Content = `---
type: decision
decisionId: DEC-019
title: ${serviceTitle} Background Job & Cron Orchestration
status: accepted
pack: core
timestamp: ${timestamp}
---

# DEC-019: ${serviceTitle} Background Job & Cron Orchestration

## Context
Scheduled maintenance, asynchronous notifications, and recurring billing cycles require reliable background job execution.

## Decision
Adopt ${serviceTitle} for distributed job scheduling and background queue processing.
- All scheduled jobs are idempotent and safe for repeated execution.
- Requests to worker endpoints verify signature tokens or secret bearer headers.

## Consequences
- Serverless worker isolates remain unblocked by long-running background tasks.
- Cron failures emit structured telemetry without crashing application routes.
`;
    writeFileSync(dec019Path, dec019Content, 'utf8');
    generated.push({ id: 'DEC-019', file: dec019File, path: dec019Path });
  }

  // Automatically compile all decisions into docs/bible/DECISIONS.md
  const { content } = generateDecisionsLedger(root);
  const ledgerPath = path.join(bibleDir, 'DECISIONS.md');
  writeFileSync(ledgerPath, content, 'utf8');

  return generated;
}
