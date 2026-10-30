/**
 * Autonomous Bible Restructuring & Topology Engine (REQ-INIT-06 / LOCK-INIT-06 / Phase 3 Unit U7)
 *
 * Dynamically determines and manages the Development Bible (docs/bible/) taxonomy
 * based on product archetype, domain, and architecture requirements.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Standard 8 core chapters for Full-Stack SaaS */
export const CORE_SAAS_CHAPTERS = [
  {
    name: 'architecture',
    title: 'Architecture Overview',
    files: ['index.md', 'topology.md', 'system-context.md', 'operational-envelope.md'],
  },
  {
    name: 'setup-and-workflow',
    title: 'Setup & Development Workflow',
    files: ['index.md', 'local-environment.md', 'dev-workflow.md'],
  },
  {
    name: 'database',
    title: 'Database & Data Access',
    files: ['index.md', 'schema-reference.md', 'rls-policies.md', 'migrations.md'],
  },
  {
    name: 'auth-and-rbac',
    title: 'Authentication & Access Control',
    files: ['index.md', 'identity-providers.md', 'permissions-matrix.md', 'route-guards.md'],
  },
  {
    name: 'core-systems',
    title: 'Core Domain Systems & Invariants',
    files: ['index.md', 'domain-invariants.md', 'state-machines.md', 'error-taxonomy.md'],
  },
  {
    name: 'integrations',
    title: 'Third-Party Integrations & Services',
    files: ['index.md', 'third-party-services.md', 'webhooks.md'],
  },
  {
    name: 'frontend',
    title: 'Frontend & UI Systems',
    files: ['index.md', 'design-tokens.md', 'route-hierarchy.md', 'component-standards.md'],
  },
  {
    name: 'api-contracts',
    title: 'API & Route Contracts',
    files: ['index.md', 'route-actions.md', 'route-loaders.md'],
  },
];

/** Universal foundational product chapters (v3.0) */
export const PRODUCT_CHAPTERS = [
  {
    name: 'product-and-vision',
    slug: '00-product-and-vision',
    number: '00',
    title: 'Product Vision & Strategy',
    files: [
      'index.md',
      'vision-and-mission.md',
      'target-audience.md',
      'product-philosophy.md',
      'business-model.md',
      'market-landscape.md',
    ],
  },
  {
    name: 'PRD',
    slug: 'PRD',
    number: 'PRD',
    title: 'Product Requirements Documents (PRD)',
    files: [
      'index.md',
      'ecosystem-prd.md',
      'phase-1-foundation-prd.md',
    ],
  },
];

/** Specialized chapter blueprints */
export const SPECIALIZED_CHAPTERS = {
  'commerce-and-catalog': {
    name: 'commerce-and-catalog',
    title: 'Product Catalog, Pricing & Inventory',
    files: ['index.md', 'catalog-schemas.md', 'pricing-engine.md', 'inventory-tracking.md'],
  },
  'orders-and-fulfillment': {
    name: 'orders-and-fulfillment',
    title: 'Orders, Checkout & Fulfillment',
    files: ['index.md', 'order-state-machine.md', 'checkout-flow.md', 'fulfillment-webhooks.md'],
  },
  'team-workspaces': {
    name: 'team-workspaces',
    title: 'Team Workspaces & Member Management',
    files: ['index.md', 'workspace-hierarchy.md', 'invitations-and-onboarding.md'],
  },
  'audit-and-compliance': {
    name: 'audit-and-compliance',
    title: 'Audit Logging & Regulatory Compliance',
    files: ['index.md', 'audit-logging.md', 'compliance-controls.md'],
  },
  'sdk-and-client-libraries': {
    name: 'sdk-and-client-libraries',
    title: 'Client SDKs & Integration Libraries',
    files: ['index.md', 'sdk-architecture.md', 'client-codegen.md'],
  },
  'api-governance': {
    name: 'api-governance',
    title: 'API Versioning & Rate Governance',
    files: ['index.md', 'versioning-policy.md', 'rate-limit-quotas.md'],
  },
  'fleet-orchestration': {
    name: 'fleet-orchestration',
    title: 'Fleet Orchestration & Node Management',
    files: ['index.md', 'fleet-registry.md', 'heartbeat-monitoring.md'],
  },
  'site-telemetry': {
    name: 'site-telemetry',
    title: 'Site Telemetry & Health Streaming',
    files: ['index.md', 'telemetry-pipeline.md', 'health-checks.md'],
  },
  'plugin-architecture': {
    name: 'plugin-architecture',
    title: 'Plugin Architecture & Extensions',
    files: ['index.md', 'plugin-lifecycle.md', 'hook-system.md'],
  },
  'cli-commands-and-flags': {
    name: 'cli-commands-and-flags',
    title: 'CLI Commands & Flag Specifications',
    files: ['index.md', 'command-reference.md', 'flags-and-arguments.md'],
  },
  'compliance-and-ledger': {
    name: 'compliance-and-ledger',
    title: 'Compliance, Ledger & Regulatory Invariants',
    files: ['index.md', 'ledger-model.md', 'regulatory-controls.md'],
  },
  'audit-and-security': {
    name: 'audit-and-security',
    title: 'Audit Logging & Threat Model',
    files: ['index.md', 'audit-logging.md', 'threat-model.md'],
  },
  'vector-storage-and-embeddings': {
    name: 'vector-storage-and-embeddings',
    title: 'Vector Storage & Embedding Pipelines',
    files: ['index.md', 'vector-index-schemas.md', 'similarity-search.md'],
  },
  'evals-and-prompt-chains': {
    name: 'evals-and-prompt-chains',
    title: 'Evals & Prompt Orchestration',
    files: ['index.md', 'eval-benchmarks.md', 'prompt-orchestration.md'],
  },
};

/**
 * Format chapter number with leading zero (e.g. 1 -> "01", 10 -> "10")
 */
export function formatChapterNum(num) {
  return String(num).padStart(2, '0');
}

/**
 * Evaluates the optimal Bible taxonomy given interview context / project data.
 *
 * @param {Record<string, any>} projectContext
 * @returns {object} Evaluated taxonomy descriptor
 */
export function evaluateTaxonomy(projectContext = {}) {
  const typeStr = (
    projectContext.productType ||
    projectContext.product_type ||
    projectContext.type ||
    projectContext.archetype ||
    projectContext.domain ||
    ''
  ).toLowerCase();

  const isCliOrDevTool =
    typeStr.includes('cli') ||
    typeStr.includes('devtool') ||
    typeStr.includes('tool') ||
    projectContext.isCli === true ||
    projectContext.isDevTool === true;

  const isFintech =
    typeStr.includes('fintech') ||
    typeStr.includes('banking') ||
    typeStr.includes('compliance') ||
    typeStr.includes('ledger') ||
    (Array.isArray(projectContext.features) &&
      projectContext.features.some((f) => ['fintech', 'compliance', 'ledger'].includes(f.toLowerCase())));

  const isAiAgentOrRag =
    typeStr.includes('agent') ||
    typeStr.includes('rag') ||
    typeStr.includes('ai') ||
    typeStr.includes('llm') ||
    (Array.isArray(projectContext.features) &&
      projectContext.features.some((f) => ['ai', 'agent', 'rag', 'vector'].includes(f.toLowerCase())));

  const isEcommerceOrMarketplace =
    typeStr.includes('marketplace') ||
    typeStr.includes('ecommerce') ||
    typeStr.includes('e-commerce') ||
    typeStr.includes('store') ||
    typeStr.includes('shop') ||
    (Array.isArray(projectContext.features) &&
      projectContext.features.some((f) => ['marketplace', 'ecommerce', 'store', 'shop'].includes(f.toLowerCase())));

  const isTeamSaas =
    typeStr.includes('team') ||
    typeStr.includes('workspace') ||
    typeStr.includes('collaboration') ||
    typeStr.includes('b2b') ||
    (Array.isArray(projectContext.features) &&
      projectContext.features.some((f) => ['team', 'workspaces', 'collaboration'].includes(f.toLowerCase())));

  const isDevPlatform =
    typeStr.includes('platform') ||
    typeStr.includes('sdk') ||
    typeStr.includes('developer_platform') ||
    (Array.isArray(projectContext.features) &&
      projectContext.features.some((f) => ['sdk', 'platform', 'api_gateway'].includes(f.toLowerCase())));

  const isFleet =
    typeStr.includes('fleet') ||
    typeStr.includes('iot') ||
    typeStr.includes('multi-site') ||
    (Array.isArray(projectContext.features) &&
      projectContext.features.some((f) => ['fleet', 'iot', 'telemetry'].includes(f.toLowerCase())));

  let rawList = [];
  const changes = {
    added: [],
    removed: [],
    transformed: [],
  };
  let resolvedProductType = 'fullstack_saas';
  let rationale = 'Standard Full-Stack SaaS taxonomy covering 8 core architectural pillars.';

  if (isCliOrDevTool) {
    resolvedProductType = 'cli_devtool';
    rationale =
      'CLI / Developer Tool taxonomy: pruned frontend chapter, added plugin architecture, and transformed API contracts to CLI commands & flags.';
    changes.removed.push('07-frontend');
    changes.transformed.push({ from: '08-api-contracts', to: 'cli-commands-and-flags' });
    changes.added.push('plugin-architecture');

    rawList = [
      CORE_SAAS_CHAPTERS[0], // architecture
      CORE_SAAS_CHAPTERS[1], // setup-and-workflow
      CORE_SAAS_CHAPTERS[2], // database
      SPECIALIZED_CHAPTERS['plugin-architecture'],
      CORE_SAAS_CHAPTERS[3], // auth-and-rbac
      CORE_SAAS_CHAPTERS[4], // core-systems
      CORE_SAAS_CHAPTERS[5], // integrations
      SPECIALIZED_CHAPTERS['cli-commands-and-flags'],
    ];
  } else if (isFintech) {
    resolvedProductType = 'fintech_compliance';
    rationale =
      'Fintech & Compliance taxonomy: retained 8 core chapters and injected compliance-and-ledger and audit-and-security.';
    changes.added.push('compliance-and-ledger', 'audit-and-security');

    rawList = [
      ...CORE_SAAS_CHAPTERS,
      SPECIALIZED_CHAPTERS['compliance-and-ledger'],
      SPECIALIZED_CHAPTERS['audit-and-security'],
    ];
  } else if (isAiAgentOrRag) {
    resolvedProductType = 'ai_agent_rag';
    rationale =
      'AI Agent & RAG taxonomy: injected vector-storage-and-embeddings and evals-and-prompt-chains after core systems.';
    changes.added.push('vector-storage-and-embeddings', 'evals-and-prompt-chains');

    rawList = [
      CORE_SAAS_CHAPTERS[0], // 01 architecture
      CORE_SAAS_CHAPTERS[1], // 02 setup-and-workflow
      CORE_SAAS_CHAPTERS[2], // 03 database
      CORE_SAAS_CHAPTERS[3], // 04 auth-and-rbac
      CORE_SAAS_CHAPTERS[4], // 05 core-systems
      SPECIALIZED_CHAPTERS['vector-storage-and-embeddings'],
      SPECIALIZED_CHAPTERS['evals-and-prompt-chains'],
      CORE_SAAS_CHAPTERS[5], // integrations
      CORE_SAAS_CHAPTERS[6], // frontend
      CORE_SAAS_CHAPTERS[7], // api-contracts
    ];
  } else if (isEcommerceOrMarketplace) {
    resolvedProductType = 'ecommerce_marketplace';
    rationale =
      'E-Commerce & Marketplace taxonomy: injected commerce-and-catalog and orders-and-fulfillment.';
    changes.added.push('commerce-and-catalog', 'orders-and-fulfillment');

    rawList = [
      CORE_SAAS_CHAPTERS[0],
      CORE_SAAS_CHAPTERS[1],
      CORE_SAAS_CHAPTERS[2],
      CORE_SAAS_CHAPTERS[3],
      CORE_SAAS_CHAPTERS[4],
      SPECIALIZED_CHAPTERS['commerce-and-catalog'],
      SPECIALIZED_CHAPTERS['orders-and-fulfillment'],
      CORE_SAAS_CHAPTERS[5],
      CORE_SAAS_CHAPTERS[6],
      CORE_SAAS_CHAPTERS[7],
    ];
  } else if (isTeamSaas) {
    resolvedProductType = 'team_saas';
    rationale =
      'Collaborative Team SaaS taxonomy: injected team-workspaces domain chapter.';
    changes.added.push('team-workspaces');

    rawList = [
      CORE_SAAS_CHAPTERS[0],
      CORE_SAAS_CHAPTERS[1],
      CORE_SAAS_CHAPTERS[2],
      CORE_SAAS_CHAPTERS[3],
      CORE_SAAS_CHAPTERS[4],
      SPECIALIZED_CHAPTERS['team-workspaces'],
      CORE_SAAS_CHAPTERS[5],
      CORE_SAAS_CHAPTERS[6],
      CORE_SAAS_CHAPTERS[7],
    ];
  } else if (isDevPlatform) {
    resolvedProductType = 'developer_platform';
    rationale =
      'Developer Platform / SDK taxonomy: injected sdk-and-client-libraries and api-governance.';
    changes.added.push('sdk-and-client-libraries', 'api-governance');

    rawList = [
      CORE_SAAS_CHAPTERS[0],
      CORE_SAAS_CHAPTERS[1],
      CORE_SAAS_CHAPTERS[2],
      CORE_SAAS_CHAPTERS[3],
      CORE_SAAS_CHAPTERS[4],
      SPECIALIZED_CHAPTERS['sdk-and-client-libraries'],
      SPECIALIZED_CHAPTERS['api-governance'],
      CORE_SAAS_CHAPTERS[5],
      CORE_SAAS_CHAPTERS[6],
      CORE_SAAS_CHAPTERS[7],
    ];
  } else if (isFleet) {
    resolvedProductType = 'fleet_orchestration';
    rationale =
      'Fleet & Multi-Site taxonomy: injected fleet-orchestration and site-telemetry.';
    changes.added.push('fleet-orchestration', 'site-telemetry');

    rawList = [
      CORE_SAAS_CHAPTERS[0],
      CORE_SAAS_CHAPTERS[1],
      CORE_SAAS_CHAPTERS[2],
      CORE_SAAS_CHAPTERS[3],
      CORE_SAAS_CHAPTERS[4],
      SPECIALIZED_CHAPTERS['fleet-orchestration'],
      SPECIALIZED_CHAPTERS['site-telemetry'],
      CORE_SAAS_CHAPTERS[5],
      CORE_SAAS_CHAPTERS[6],
      CORE_SAAS_CHAPTERS[7],
    ];
  } else {
    rawList = [...CORE_SAAS_CHAPTERS];
  }

  // Renumber technical chapters sequentially starting at 01
  const technicalChapters = rawList.map((chap, idx) => {
    const num = formatChapterNum(idx + 1);
    const slug = `${num}-${chap.name}`;
    return {
      number: num,
      slug,
      name: chap.name,
      title: chap.title,
      files: [...chap.files],
    };
  });

  // Prepend universal product chapters across all project archetypes
  const chapters = [...PRODUCT_CHAPTERS, ...technicalChapters];

  return {
    productType: resolvedProductType,
    hasFrontend: chapters.some((c) => c.name === 'frontend'),
    chapters,
    chapterSlugs: chapters.map((c) => c.slug),
    changes,
    rationale,
  };
}

/**
 * Appends DEC-017: Adaptive Product Documentation Topology to docs/bible/DECISIONS.md
 * and optionally creates docs/decisions/DEC-017-adaptive-product-documentation-topology.md
 *
 * @param {string} root Workspace root
 * @param {object} options
 * @returns {boolean} Whether decision was recorded
 */
export function recordTopologyDecision(root, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString();
  const dateStr = timestamp.slice(0, 10);
  const taxonomy = options.taxonomy || evaluateTaxonomy(options.context || {});
  const rationale = options.rationale || taxonomy.rationale;

  const decisionContent = `
### DEC-017: Adaptive Product Documentation Topology
- **Status:** accepted
- **Pack:** core
- **Date:** ${dateStr}
- **Timestamp:** ${timestamp}
- **Context:** Socratic product discovery identified the ${taxonomy.productType} product archetype, requiring dynamic restructuring of the Development Bible taxonomy.
- **Decision:** Restructure \`docs/bible/\` into modular subfolders tailored to the product archetype (${taxonomy.chapters.length} chapters). ${rationale}
- **Consequences:** Documentation remains compact ($\le 4,500$ tokens per file), high-cohesion, and perfectly aligned with active product domains. Single-file monolithic chapters are eradicated.
`;

  const decisionsPath = path.join(root, 'docs', 'bible', 'DECISIONS.md');
  if (existsSync(decisionsPath)) {
    const existing = readFileSync(decisionsPath, 'utf8');
    if (!existing.includes('Adaptive Product Documentation Topology')) {
      const updated = existing.trimEnd() + '\n\n' + decisionContent.trim() + '\n';
      writeFileSync(decisionsPath, updated, 'utf8');
    }
  }

  // Also write to docs/decisions/ if the directory exists
  const decisionsDir = path.join(root, 'docs', 'decisions');
  if (existsSync(decisionsDir)) {
    const adrFile = path.join(decisionsDir, 'DEC-017-adaptive-product-documentation-topology.md');
    const adrContent = `---
type: decision
decisionId: DEC-017
title: Adaptive Product Documentation Topology
status: accepted
pack: core
timestamp: ${timestamp}
---

# DEC-017: Adaptive Product Documentation Topology

## Context
Socratic product discovery identified the ${taxonomy.productType} product archetype. The legacy practice of rigid monolithic chapters resulted in documentation drift and context overflow during AI pairing.

## Decision
Autonomously restructure \`docs/bible/\` into ${taxonomy.chapters.length} modular chapter subfolders:
${taxonomy.chapters.map((c) => `- \`${c.slug}/\`: ${c.title}`).join('\n')}

${rationale}

## Consequences
- Every chapter subfolder contains an \`index.md\` (Map of Content) and $\ge 2$ discrete, topic-bounded markdown files.
- No markdown file exceeds 400 lines or 4,500 tokens.
- Path-scoped drift rules (\`bible-rules.md\`) map application files directly to modular Bible files.
`;
    writeFileSync(adrFile, adrContent, 'utf8');
  }

  return true;
}

/**
 * Updates docs/bible/README.md ToC and docs/bible/index.md to reflect active chapters.
 *
 * @param {string} root Workspace root
 */
export async function updateBibleToc(root) {
  const bibleDir = path.join(root, 'docs', 'bible');
  if (!existsSync(bibleDir)) return;

  const readmePath = path.join(bibleDir, 'README.md');
  if (existsSync(readmePath)) {
    // Collect active chapters from disk
    const dirs = readdirSync(bibleDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && (/^\d\d-/.test(e.name) || e.name === 'PRD'))
      .map((e) => e.name)
      .sort((a, b) => {
        if (a === '00-product-and-vision') return -1;
        if (b === '00-product-and-vision') return 1;
        if (a === 'PRD') return -1;
        if (b === 'PRD') return 1;
        return a.localeCompare(b);
      });

    const rows = [
      { section: 'Start Here', description: 'This index and system orientation', file: 'README.md' },
      {
        section: 'MODE',
        description: 'Engagement-mode declaration: vibe / structured / agentic per environment',
        file: 'MODE.md',
      },
      { section: 'ADRs', description: 'All Architecture Decision Records (DEC-XXX)', file: 'DECISIONS.md' },
      { section: 'Changelog', description: 'Complete history of all shipped modifications', file: 'CHANGELOG.md' },
      { section: 'Log', description: 'Append-only change record; compiled into the changelog by /sync-bible', file: 'log.md' },
    ];

    for (const dirName of dirs) {
      const chapterDir = path.join(bibleDir, dirName);
      const files = readdirSync(chapterDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => e.name)
        .sort();
      const primary = files.find((f) => f !== 'index.md') || 'index.md';
      rows.push({
        section: dirName.replace(/^\d\d-/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        description: `Architecture and specifications for ${dirName}`,
        file: `${dirName}/${primary}`,
      });
    }

    const tocLines = [
      '## Table of Contents',
      '',
      '| Section | Description | File |',
      '|---|---|---|',
      ...rows.map((r) => `| **${r.section}** | ${r.description} | \`${r.file}\` |`),
    ];

    const existing = readFileSync(readmePath, 'utf8');
    const lines = existing.replace(/\r\n/g, '\n').split('\n');
    const headingIdx = lines.findIndex((l) => l.trim() === '## Table of Contents');
    let nextContent;
    if (headingIdx === -1) {
      nextContent = existing.trimEnd() + '\n\n' + tocLines.join('\n') + '\n';
    } else {
      let i = headingIdx + 1;
      if (i < lines.length && lines[i].trim() === '') i += 1;
      while (i < lines.length && lines[i].trim().startsWith('|')) i += 1;
      nextContent = [...lines.slice(0, headingIdx), ...tocLines, ...lines.slice(i)].join('\n');
    }
    writeFileSync(readmePath, nextContent, 'utf8');
  }

  // Update docs/bible/index.md
  const indexMdPath = path.join(bibleDir, 'index.md');
  const dirs = readdirSync(bibleDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (/^\d\d-/.test(e.name) || e.name === 'PRD'))
    .map((e) => e.name)
    .sort((a, b) => {
      if (a === '00-product-and-vision') return -1;
      if (b === '00-product-and-vision') return 1;
      if (a === 'PRD') return -1;
      if (b === 'PRD') return 1;
      return a.localeCompare(b);
    });

  const indexContent = `---
type: index
timestamp: ${new Date().toISOString()}
---

# bible — Index

> Generated by \`node .shiftstone/governance/index.js\` — read an index first; never crawl a directory.

**Subdirectories**

${dirs.map((d) => `- [${d}/](./${d}/index.md)`).join('\n')}

**Files**

- [ShiftStone Engineering Hub — Changelog](./CHANGELOG.md)
- [Architecture Decision Records (ADRs)](./DECISIONS.md)
- [bible — Log](./log.md)
- [Engagement Mode Declaration (B10)](./MODE.md)
- [ShiftStone — Development Bible](./README.md)
`;
  writeFileSync(indexMdPath, indexContent, 'utf8');
}

/**
 * Autonomously restructures docs/bible/ to match the evaluated taxonomy.
 *
 * @param {string} root Workspace root
 * @param {object} [taxonomy] Evaluated taxonomy (or auto-evaluates from context)
 * @param {object} [options]
 * @returns {object} Result of restructuring
 */
export async function restructureBible(root, taxonomy, options = {}) {
  if (!taxonomy) {
    taxonomy = evaluateTaxonomy(options.context || {});
  }

  const bibleDir = path.join(root, 'docs', 'bible');
  mkdirSync(bibleDir, { recursive: true });

  const activeSlugs = new Set(taxonomy.chapters.map((c) => c.slug));

  // Prune dropped chapters (e.g. 07-frontend in CLI)
  if (existsSync(bibleDir)) {
    const existingDirs = readdirSync(bibleDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d\d-/.test(e.name))
      .map((e) => e.name);

    for (const dirName of existingDirs) {
      // If chapter was explicitly removed in taxonomy
      const isRemoved = taxonomy.changes.removed.some((rem) => dirName.includes(rem));
      if (isRemoved && !activeSlugs.has(dirName)) {
        rmSync(path.join(bibleDir, dirName), { recursive: true, force: true });
      }
    }
  }

  // Create chapters & modular files
  for (const chap of taxonomy.chapters) {
    const chapterDir = path.join(bibleDir, chap.slug);
    mkdirSync(chapterDir, { recursive: true });

    // Ensure index.md exists
    const indexFile = path.join(chapterDir, 'index.md');
    if (!existsSync(indexFile)) {
      const topicLinks = chap.files
        .filter((f) => f !== 'index.md')
        .map((f) => `- [${f.replace('.md', '').replace(/-/g, ' ')}](./${f})`)
        .join('\n');

      const indexMd = `---
type: index
title: "${chap.title} (Map of Content)"
chapter: "${chap.slug}"
timestamp: ${new Date().toISOString()}
---

# Chapter ${chap.number}: ${chap.title}

> Map of Content for ${chap.slug}. Read this index first before inspecting sub-topic files.

## Topic Documents

${topicLinks}
`;
      writeFileSync(indexFile, indexMd, 'utf8');
    }

    // Ensure topic files exist
    for (const file of chap.files) {
      if (file === 'index.md') continue;
      const filePath = path.join(chapterDir, file);
      if (!existsSync(filePath)) {
        const fileTitle = file.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const content = `---
type: chapter-topic
title: "${fileTitle}"
chapter: "${chap.slug}"
file: "${file}"
timestamp: ${new Date().toISOString()}
description: "Architecture and design specifications for ${fileTitle.toLowerCase()}."
---

# ${chap.title} — ${fileTitle}

## 1. Overview
Concrete architectural specifications, domain rules, and implementation standards for ${fileTitle.toLowerCase()}.

## 2. Technical Specifications
Specific domain models, interface contracts, and behavioral requirements for this subsystem.
`;
        writeFileSync(filePath, content, 'utf8');
      }
    }
  }

  // Log DEC-017 autonomously without halting for user confirmation
  recordTopologyDecision(root, { taxonomy, context: options.context, timestamp: options.timestamp });

  // Update README.md and index.md
  await updateBibleToc(root);

  return {
    success: true,
    taxonomy,
    chaptersCount: taxonomy.chapters.length,
  };
}
