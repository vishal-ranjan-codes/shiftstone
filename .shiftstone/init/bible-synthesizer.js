/**
 * Bible Synthesizer Engine (ShiftStone v3.0)
 * Synthesizes rich, production-grade PRD, product vision, and technical documentation.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Normalizes user-supplied or pasted PRD text into standardized ecosystem and foundation PRD documents.
 *
 * @param {string} rawPrd - User-supplied PRD or brainstorming text.
 * @param {Record<string, any>} [context] - Product metadata (projectName, productType, etc.)
 * @returns {{ ecosystemPrd: string, foundationPrd: string }}
 */
export function normalizePastedPrd(rawPrd = '', context = {}) {
  const projectName = context.projectName || 'Product';
  const timestamp = context.timestamp || new Date().toISOString();

  const ecosystemPrd = `---
type: prd
title: "${projectName} Ecosystem PRD — System Architecture & Core Requirements"
timestamp: ${timestamp}
status: approved
---

# ${projectName} — Ecosystem PRD

## 1. Problem Statement & System Overview
${rawPrd.trim() || `${projectName} provides a unified, production-grade platform addressing core user pain points.`}

## 2. 4-Pillar System Architecture
1. **Frontend & Interactive UI:** Responsive web application, accessibility standards, and semantic token design.
2. **Edge Compute & Route Handling:** Sub-millisecond routing, authenticated server loaders, and validated mutations.
3. **Database & Tenancy Isolation:** Relational PostgreSQL modeling with strict Row-Level Security (RLS) data boundaries.
4. **Background Jobs & Integrations:** Reliable webhook handling, resilient third-party service connections, and telemetry.

## 3. Core Invariants & Quality Attributes
- **Edge Latency:** P95 response times under 200ms.
- **Data Protection:** Multi-tenant isolation enforced at the database level via PostgreSQL RLS.
- **Verification Gate:** Red-First TDD verification on all domain logic and state transitions.

## 4. Core User Journeys
Detailed step-by-step actor flows through onboarding, primary workflows, and account administration.

## 5. Anti-Goals & Out of Scope
Explicitly bound scope for the core platform to eliminate feature creep.
`;

  const foundationPrd = `---
type: prd-phase
title: "Phase 1 Foundation PRD — Core Scope & Acceptance Criteria"
phase: P1
timestamp: ${timestamp}
status: approved
---

# ${projectName} — Phase 1 Foundation PRD

## 1. Scope & Foundation Workflows
Initial functional MVP scope implementing primary user flows, authentication guards, and core data models for ${projectName}.

## 2. Functional Scope & Workflows
- Elicited user workflows and domain interactions established during discovery intake.
- Foundation data models and relational entities.

## 3. Acceptance Criteria
- **AC-F1-01:** Users can complete primary onboarding and create initial domain resources.
- **AC-F1-02:** Strict tenant authorization prevents unauthorized access across user workspaces.
- **AC-F1-03:** Automated verification tests validate end-to-end data integrity.

## 4. Technical Dependencies & Upstream Contracts
Maps to database migrations, route contracts, and initial user stories in \`docs/backlog/\`.
`;

  return { ecosystemPrd, foundationPrd };
}

/**
 * Synthesizes production-grade markdown files for 00-product-and-vision and PRD chapters.
 *
 * @param {Record<string, any>} context - Elicited interview and product context.
 * @param {string} [root=process.cwd()] - Workspace root directory.
 * @returns {{ writtenFiles: string[], prdFiles: string[], productFiles: string[] }}
 */
export function synthesizeProductChapters(context = {}, root = process.cwd()) {
  const bibleDir = path.join(root, 'docs', 'bible');
  const prdDir = path.join(bibleDir, 'PRD');
  const visionDir = path.join(bibleDir, '00-product-and-vision');

  mkdirSync(prdDir, { recursive: true });
  mkdirSync(visionDir, { recursive: true });

  const projectName = context.projectName || 'NexusApp';
  const rawPrd = context.rawPrd || context.problemSpace || context.vision || '';
  const { ecosystemPrd, foundationPrd } = normalizePastedPrd(rawPrd, context);

  const prdFiles = [];
  const productFiles = [];
  const timestamp = new Date().toISOString();

  // 1. PRD/index.md
  const prdIndex = `---
type: index
title: "Product Requirements Documents (Map of Content)"
chapter: "PRD"
timestamp: ${timestamp}
---

# PRD: Product Requirements Documents

> Central repository for full-system and phased functional requirements for ${projectName}.

## Topic Documents

- [Ecosystem PRD](./ecosystem-prd.md)
- [Phase 1 Foundation PRD](./phase-1-foundation-prd.md)
`;
  writeFileSync(path.join(prdDir, 'index.md'), prdIndex, 'utf8');
  prdFiles.push(path.join(prdDir, 'index.md'));

  // 2. PRD/ecosystem-prd.md
  writeFileSync(path.join(prdDir, 'ecosystem-prd.md'), ecosystemPrd, 'utf8');
  prdFiles.push(path.join(prdDir, 'ecosystem-prd.md'));

  // 3. PRD/phase-1-foundation-prd.md
  writeFileSync(path.join(prdDir, 'phase-1-foundation-prd.md'), foundationPrd, 'utf8');
  prdFiles.push(path.join(prdDir, 'phase-1-foundation-prd.md'));

  // 4. 00-product-and-vision/index.md
  const visionIndex = `---
type: index
title: "Product Vision & Strategy (Map of Content)"
chapter: "00-product-and-vision"
timestamp: ${timestamp}
---

# Chapter 00: Product Vision & Strategy

> Founding thesis, market orientation, target personas, and operating philosophy for ${projectName}.

## Topic Documents

- [Vision and Mission](./vision-and-mission.md)
- [Target Audience](./target-audience.md)
- [Product Philosophy](./product-philosophy.md)
- [Business Model](./business-model.md)
- [Market Landscape](./market-landscape.md)
`;
  writeFileSync(path.join(visionDir, 'index.md'), visionIndex, 'utf8');
  productFiles.push(path.join(visionDir, 'index.md'));

  // 5. 00-product-and-vision/vision-and-mission.md
  const visionMission = `---
type: chapter-topic
title: "Vision & Mission"
chapter: "00-product-and-vision"
file: "vision-and-mission.md"
timestamp: ${timestamp}
description: "Founding thesis, North Star, trigger moment, and multi-year trajectory for ${projectName}."
---

# Product Vision & Strategy — Vision & Mission

## 1. The Founding Thesis
${projectName} was created to deliver an uncompromising, high-velocity experience for its users, solving fundamental bottlenecks in daily workflows.

## 2. The Trigger Moment
The exact moment a user reaches for ${projectName} is when existing solutions impose unacceptable friction, steep learning curves, or fragmented tooling.

## 3. The 3-Year Trajectory
From initial core MVP to an industry-standard ecosystem with extensible integrations and enterprise-grade reliability.
`;
  writeFileSync(path.join(visionDir, 'vision-and-mission.md'), visionMission, 'utf8');
  productFiles.push(path.join(visionDir, 'vision-and-mission.md'));

  // 6. 00-product-and-vision/target-audience.md
  const targetAudience = `---
type: chapter-topic
title: "Target Audience"
chapter: "00-product-and-vision"
file: "target-audience.md"
timestamp: ${timestamp}
description: "Customer personas, user segments, and pain-point mappings."
---

# Product Vision & Strategy — Target Audience

## 1. Primary User Personas
Detailed personas representing both core day-to-day operators and administrative stakeholders.

## 2. Critical Pain Points & Friction
Key challenges currently unaddressed by legacy alternatives, including workflow latency and data fragmentation.

## 3. Value Proposition
How ${projectName} directly transforms user productivity through tailored automation and modern interface ergonomics.
`;
  writeFileSync(path.join(visionDir, 'target-audience.md'), targetAudience, 'utf8');
  productFiles.push(path.join(visionDir, 'target-audience.md'));

  // 7. 00-product-and-vision/product-philosophy.md
  const productPhilosophy = `---
type: chapter-topic
title: "Product Philosophy"
chapter: "00-product-and-vision"
file: "product-philosophy.md"
timestamp: ${timestamp}
description: "Non-negotiable product covenants and user trust principles for ${projectName}."
---

# Product Vision & Strategy — Product Philosophy

## 1. Operating Covenants
- **Anti-Predatory Covenant:** For ${projectName}, user data is private, respected, and never monetized without consent.
- **Local Freedom & Portability:** Users of ${projectName} retain complete ownership of their data with standard export tools.

## 2. Product Simplicity Invariant
Every additional setting or screen in ${projectName} must justify its cognitive load against user workflow velocity.
`;
  writeFileSync(path.join(visionDir, 'product-philosophy.md'), productPhilosophy, 'utf8');
  productFiles.push(path.join(visionDir, 'product-philosophy.md'));

  // 8. 00-product-and-vision/business-model.md
  const businessModel = `---
type: chapter-topic
title: "Business Model"
chapter: "00-product-and-vision"
file: "business-model.md"
timestamp: ${timestamp}
description: "Monetization strategy, pricing tiers, and checkout integration for ${projectName}."
---

# Product Vision & Strategy — Business Model

## 1. Monetization Strategy
Transparent tier structure aligning ${projectName} value with customer success metrics.

## 2. Tier Specifications
- **Starter Tier:** Essential features for individuals and small teams.
- **Professional Tier:** Advanced collaboration, priority processing, and higher volume limits.
- **Enterprise Tier:** Dedicated support, custom SLAs, and advanced compliance audit logging for ${projectName}.
`;
  writeFileSync(path.join(visionDir, 'business-model.md'), businessModel, 'utf8');
  productFiles.push(path.join(visionDir, 'business-model.md'));

  // 9. 00-product-and-vision/market-landscape.md
  const marketLandscape = `---
type: chapter-topic
title: "Market Landscape"
chapter: "00-product-and-vision"
file: "market-landscape.md"
timestamp: ${timestamp}
description: "Competitive landscape, friction points, and strategic advantages for ${projectName}."
---

# Product Vision & Strategy — Market Landscape

## 1. Current Competitive Alternatives
Analysis of existing tools and incumbent products in this domain.

## 2. Strategic Differentiation
How ${projectName} achieves structural competitive advantages through edge runtime architecture, superior DX, and lower operational overhead.
`;
  writeFileSync(path.join(visionDir, 'market-landscape.md'), marketLandscape, 'utf8');
  productFiles.push(path.join(visionDir, 'market-landscape.md'));

  return {
    writtenFiles: [...prdFiles, ...productFiles],
    prdFiles,
    productFiles,
  };
}
