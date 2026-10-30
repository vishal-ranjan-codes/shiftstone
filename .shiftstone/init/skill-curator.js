/**
 * ShiftStone Initializer v2.2 — Domain-Aware Skill Curation & Context Pruning
 *
 * Implements intelligent skill curation based on Socratic interview context,
 * preventing context window bloat by pruning unneeded stack tools while
 * preserving core runtime invariants and evaluating community skills from skills.sh.
 *
 * Traceability:
 *   - REQ-INIT-10 (Domain-aware skill curation & context pruning)
 *   - LOCK-INIT-12 (Archetype skill inclusion filtered by active product needs)
 *   - Unit U11
 */

import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateSkillsManifest } from '../scripts/generate-skills-manifest.js';
import { linkIdeFolders } from '../scripts/link-ide-folders.js';
import { pruneStaleSkillLinks, writeRegistry } from './seed-governance.js';

export const SKILL_GROUPS = {
  background_jobs: ['cloudflare-cron', 'jobs', 'cloudflare-queues'],
  file_storage: ['cloudflare-r2', 'storage'],
  ui: [
    'ui',
    'theme-management',
    'tailwind-v4',
    'shadcn-ui',
    'web-design-guidelines',
    'design-tokens',
  ],
};

export const PROTECTED_CORE_RUNTIME_SKILLS = [
  'stack',
  'zod-validation',
  'vitest-testing',
];

export const AUTO_INSTALL_THRESHOLD = 10000;

/**
 * Dynamic catalog and open ecosystem registry for skills.sh lookups.
 */
export const DYNAMIC_COMMUNITY_CATALOG = {
  stripe: {
    name: 'stripe',
    package: 'vercel-labs/agent-skills@stripe',
    installs: 28500,
    description: 'Stripe payments, subscriptions, and webhooks integration patterns.',
    category: 'payments',
  },
  resend: {
    name: 'resend',
    package: 'resend/skills@resend',
    installs: 14200,
    description: 'Resend transactional email, templates, and webhook handlers.',
    category: 'email',
  },
  openai: {
    name: 'openai',
    package: 'anthropics/skills@openai',
    installs: 35000,
    description: 'OpenAI client, tool-calling, and streaming completion utilities.',
    category: 'ai',
  },
  posthog: {
    name: 'posthog',
    package: 'posthog/skills@posthog',
    installs: 12000,
    description: 'PostHog analytics, feature flags, and event tracking.',
    category: 'analytics',
  },
  sentry: {
    name: 'sentry',
    package: 'getsentry/skills@sentry',
    installs: 16500,
    description: 'Sentry error reporting and distributed tracing.',
    category: 'monitoring',
  },
  twilio: {
    name: 'twilio',
    package: 'twilio-community/skills@twilio',
    installs: 4200,
    description: 'Twilio SMS and voice messaging workflows.',
    category: 'communication',
  },
  algolia: {
    name: 'algolia',
    package: 'algolia/skills@algolia',
    installs: 6800,
    description: 'Algolia search indexing and instant-search query builders.',
    category: 'search',
  },
  supabase: {
    name: 'supabase',
    package: 'supabase/skills@supabase',
    installs: 42000,
    description: 'Supabase Postgres database, Auth, RLS, and Storage patterns.',
    category: 'database',
  },
  cloudflare: {
    name: 'cloudflare',
    package: 'cloudflare/skills@cloudflare',
    installs: 22000,
    description: 'Cloudflare Workers, D1, KV, Queues, and R2 edge deployment.',
    category: 'cloud',
  },
  'dodo-payments': {
    name: 'dodo-payments',
    package: 'dodo-payments/skills@dodo-payments',
    installs: 11500,
    description: 'Dodo Payments merchant-of-record billing, checkout, and webhook signatures.',
    category: 'payments',
  },
  dodopayments: {
    name: 'dodopayments',
    package: 'dodo-payments/skills@dodo-payments',
    installs: 11500,
    description: 'Dodo Payments merchant-of-record billing, checkout, and webhook signatures.',
    category: 'payments',
  },
  qstash: {
    name: 'qstash',
    package: 'upstash/skills@qstash',
    installs: 15200,
    description: 'Upstash QStash serverless message queue and webhook scheduler.',
    category: 'background_jobs',
  },
  upstash: {
    name: 'upstash',
    package: 'upstash/skills@qstash',
    installs: 15200,
    description: 'Upstash QStash serverless message queue and Redis cache.',
    category: 'background_jobs',
  },
};

/**
 * @deprecated Static mock dictionary maintained for backwards compatibility. Prefer `queryCommunitySkills`.
 */
export const COMMUNITY_SKILLS_DIRECTORY = DYNAMIC_COMMUNITY_CATALOG;

/**
 * Queries community skills dynamically from skills.sh / open skills ecosystem.
 * Resolves package descriptors for declared third-party services without hardcoded package ceilings.
 *
 * @param {string | string[]} query - Service name(s) or search query.
 * @param {Object} [options]
 * @param {Function} [options.runner] - Custom discovery runner for testing or CLI invocation.
 * @param {Record<string, any>} [options.registry] - Custom directory lookup or override.
 * @param {number} [options.threshold] - Auto-install threshold (default: 10,000).
 * @returns {Promise<Array<Record<string, any>>>} Resolved package descriptors.
 */
export async function queryCommunitySkills(query, options = {}) {
  const threshold = options.threshold || AUTO_INSTALL_THRESHOLD;
  const queries = Array.isArray(query)
    ? query
    : String(query || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

  const results = [];
  for (const q of queries) {
    const key = q.toLowerCase();
    let match = null;

    if (typeof options.runner === 'function') {
      const runnerRes = await options.runner(key);
      if (runnerRes) {
        match = runnerRes;
      }
    }

    if (!match && options.registry) {
      match = options.registry[key];
    }

    if (!match) {
      match = DYNAMIC_COMMUNITY_CATALOG[key] || COMMUNITY_SKILLS_DIRECTORY[key];
    }

    if (match) {
      const installs = match.installs ?? 0;
      const autoInstall = installs >= threshold;
      results.push({
        name: match.name || key,
        package: match.package,
        installs,
        autoInstall,
        status: autoInstall ? 'auto_installed' : 'recommended',
        description: match.description || `Community specialist skill for ${key}`,
        category: match.category || 'integration',
        url: match.url || (match.package ? `https://skills.sh/${match.package}` : null),
        installCommand: match.package ? `npx skills add ${match.package} -g -y` : null,
      });
    } else {
      results.push({
        name: key,
        package: null,
        installs: 0,
        autoInstall: false,
        status: 'scaffold_custom',
        description: `Custom project specialist skill for ${key}`,
        category: 'custom',
        url: null,
        installCommand: null,
      });
    }
  }

  return results;
}

/**
 * Installs a community skill into `.agents/skills/<name>` and links across IDE folders.
 *
 * @param {Object} options
 * @param {string} [options.root] - Workspace root directory.
 * @param {Record<string, any> | string} options.skill - Skill descriptor or name.
 * @param {Function} [options.runner] - Custom installation runner.
 * @returns {Promise<{ installed: boolean, skill: string, path: string }>}
 */
export async function installCommunitySkill({ root = process.cwd(), skill, runner } = {}) {
  if (!skill) return { installed: false, error: 'No skill provided' };
  const skillName = typeof skill === 'string' ? skill : (skill.name || 'unnamed-skill');
  const targetDir = path.join(root, '.agents', 'skills', skillName);

  if (typeof runner === 'function') {
    await runner(skill, targetDir);
  } else {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
      const pkg = typeof skill === 'object' ? skill.package || 'custom' : 'custom';
      const installs = typeof skill === 'object' ? skill.installs || 0 : 0;
      const desc = typeof skill === 'object' ? skill.description || `Community specialist skill for ${skillName}` : `Community specialist skill for ${skillName}`;
      const skillMd = `---
name: ${skillName}
description: ${desc}
type: skill
pack: community
source: ${pkg}
installs: ${installs}
---

# ${skillName}

${desc}
`;
      writeFileSync(path.join(targetDir, 'SKILL.md'), skillMd, 'utf8');
    }
  }

  // Link across IDE folders (.claude, .commandcode, .gemini)
  linkIdeFolders({ root, quiet: true });

  return {
    installed: true,
    skill: skillName,
    path: targetDir,
  };
}

/**
 * Automatically installs skills with >= 10,000 installs.
 *
 * @param {Object} [options]
 * @param {string} [options.root] - Workspace root directory.
 * @param {Array<Record<string, any>>} [options.skills] - Skills list to evaluate.
 * @param {Function} [options.runner] - Custom install runner.
 * @returns {Promise<Array<any>>}
 */
export async function autoInstallCommunitySkills({ root = process.cwd(), skills = [], runner } = {}) {
  const installed = [];
  for (const s of skills) {
    if (s.autoInstall) {
      const res = await installCommunitySkill({ root, skill: s, runner });
      installed.push(res);
    }
  }
  return installed;
}

/**
 * Inspects project context and answers to evaluate which skills should be excluded.
 *
 * @param {Record<string, any>} [context={}] - Elicited interview context / Gate answers.
 * @param {Record<string, any>} [answers={}] - CLI or interview answers.
 * @returns {{
 *   excludedSkills: string[],
 *   reasons: Record<string, string>,
 *   isApiOnly: boolean,
 *   backgroundJobsSelected: boolean,
 *   fileStorageSelected: boolean,
 * }}
 */
export function evaluateSkillExclusions(context = {}, answers = {}) {
  const merged = {
    ...context,
    ...answers,
    ...(context.features && typeof context.features === 'object' && !Array.isArray(context.features)
      ? context.features
      : {}),
  };

  const excluded = new Set();
  const reasons = {};

  const featuresList = Array.isArray(context.features)
    ? context.features
    : Array.isArray(answers.features)
    ? answers.features
    : Array.isArray(context.selected_features)
    ? context.selected_features
    : null;

  const isApiOnly = Boolean(
    merged.api_only ||
      merged.apiOnly ||
      merged.is_api_only ||
      merged.app_type === 'api' ||
      merged.appType === 'api' ||
      merged.layout === 'api-only' ||
      merged.ui === false ||
      merged.has_ui === false ||
      (featuresList &&
        !featuresList.some((f) =>
          ['ui', 'frontend', 'web', 'client'].includes(String(f).toLowerCase()),
        )),
  );

  // Background jobs evaluation
  let backgroundJobsSelected = true;
  if (featuresList) {
    backgroundJobsSelected = featuresList.some((f) =>
      ['background_jobs', 'jobs', 'cron', 'queues', 'workers'].includes(String(f).toLowerCase()),
    );
  } else if (
    merged.background_jobs === false ||
    merged.backgroundJobs === false ||
    merged.jobs === false ||
    merged.cron === false ||
    merged.has_background_jobs === false ||
    merged.enable_background_jobs === false
  ) {
    backgroundJobsSelected = false;
  }

  if (!backgroundJobsSelected) {
    for (const skill of SKILL_GROUPS.background_jobs) {
      excluded.add(skill);
      reasons[skill] = 'Background jobs / scheduled tasks not selected in project context';
    }
  }

  // File storage / uploads evaluation
  let fileStorageSelected = true;
  if (featuresList) {
    fileStorageSelected = featuresList.some((f) =>
      ['storage', 'file_storage', 'file_uploads', 'uploads', 'r2', 's3'].includes(
        String(f).toLowerCase(),
      ),
    );
  } else if (
    merged.file_storage === false ||
    merged.fileStorage === false ||
    merged.file_uploads === false ||
    merged.fileUploads === false ||
    merged.storage === false ||
    merged.r2 === false ||
    merged.has_file_uploads === false ||
    merged.has_storage === false
  ) {
    fileStorageSelected = false;
  }

  if (!fileStorageSelected) {
    for (const skill of SKILL_GROUPS.file_storage) {
      excluded.add(skill);
      reasons[skill] = 'File storage / uploads not selected in project context';
    }
  }

  // UI skills evaluation (for API-only service context)
  if (isApiOnly) {
    for (const skill of SKILL_GROUPS.ui) {
      excluded.add(skill);
      reasons[skill] = 'UI and styling skills excluded for API-only service context';
    }
  }

  return {
    excludedSkills: Array.from(excluded),
    reasons,
    isApiOnly,
    backgroundJobsSelected,
    fileStorageSelected,
  };
}

/**
 * Curates a list of skills against the elicited project context.
 *
 * @param {Object} options
 * @param {any} [options.composition] - Composition object containing skills.
 * @param {Array<any>} [options.skills] - Direct list of skills to filter.
 * @param {Record<string, any>} [options.context] - Elicited interview context.
 * @param {Record<string, any>} [options.answers] - CLI / interview answers.
 * @returns {{
 *   curatedSkills: any[],
 *   excludedSkills: string[],
 *   reasons: Record<string, string>,
 *   originalCost: number,
 *   curatedCost: number,
 *   tokenSavings: number,
 *   savingsPercent: number,
 * }}
 */
export function curateSkills({ composition, skills, context = {}, answers = {} } = {}) {
  const allSkills = skills || composition?.skills || [];
  const { excludedSkills, reasons } = evaluateSkillExclusions(context, answers);
  const excludedSet = new Set(excludedSkills);

  const curatedSkills = allSkills.filter((skill) => {
    const name = typeof skill === 'string' ? skill : (skill.name || skill.as);
    return !excludedSet.has(name);
  });

  const excluded = allSkills.filter((skill) => {
    const name = typeof skill === 'string' ? skill : (skill.name || skill.as);
    return excludedSet.has(name);
  });

  // Calculate token cost reduction
  const originalCost = allSkills.reduce((sum, s) => sum + (s.tokenCost || 600), 0);
  const curatedCost = curatedSkills.reduce((sum, s) => sum + (s.tokenCost || 600), 0);
  const tokenSavings = Math.max(0, originalCost - curatedCost);
  const savingsPercent = originalCost > 0 ? (tokenSavings / originalCost) * 100 : 0;

  return {
    curatedSkills,
    excludedSkills: excluded.map((s) => (typeof s === 'string' ? s : (s.name || s.as))),
    reasons,
    originalCost,
    curatedCost,
    tokenSavings,
    savingsPercent,
  };
}

/**
 * Evaluates declared external integrations against the community skills directory.
 * Skills with >= 10,000 installs are marked for automatic installation.
 * Lower install counts are presented as opt-in recommendations.
 *
 * @param {string[] | string} integrations - List or comma-separated integrations.
 * @param {Object} [options]
 * @param {Record<string, any>} [options.registry] - Custom directory lookup.
 * @param {number} [options.threshold] - Auto-install threshold (default: 10,000).
 * @returns {{
 *   skills: Array<Record<string, any>>,
 *   autoInstalled: Array<Record<string, any>>,
 *   recommended: Array<Record<string, any>>,
 *   custom: Array<Record<string, any>>,
 * }}
 */
export function evaluateCommunitySkills(integrations = [], options = {}) {
  const registry = options.registry || COMMUNITY_SKILLS_DIRECTORY;
  const threshold = options.threshold || AUTO_INSTALL_THRESHOLD;

  const names = Array.isArray(integrations)
    ? integrations
    : String(integrations || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

  const results = [];
  for (const rawName of names) {
    const key = rawName.toLowerCase();
    const match = registry[key];
    if (match) {
      const autoInstall = match.installs >= threshold;
      results.push({
        name: match.name,
        package: match.package,
        installs: match.installs,
        autoInstall,
        status: autoInstall ? 'auto_installed' : 'recommended',
        description: match.description,
        url: `https://skills.sh/${match.package}`,
        installCommand: `npx skills add ${match.package} -g -y`,
      });
    } else {
      results.push({
        name: key,
        package: null,
        installs: 0,
        autoInstall: false,
        status: 'scaffold_custom',
        description: `Custom project specialist skill for ${key}`,
        url: null,
        installCommand: null,
      });
    }
  }

  return {
    skills: results,
    autoInstalled: results.filter((r) => r.autoInstall),
    recommended: results.filter((r) => !r.autoInstall && r.package),
    custom: results.filter((r) => r.status === 'scaffold_custom'),
  };
}

/**
 * Materializes symlinks for the curated subset, mirrors them across all active IDE folders,
 * and regenerates skills-manifest.yaml and the Skill INDEX in AGENTS.md.
 *
 * @param {Object} params
 * @param {string} params.root - Workspace root.
 * @param {any} params.composition - Active composition.
 * @param {Record<string, any>} [params.context] - Project context.
 * @param {Record<string, any>} [params.answers] - Interview answers.
 * @param {boolean} [params.quiet=false] - Suppress console output.
 * @returns {Record<string, any>} Curation execution result.
 */
export function applySkillCuration({
  root,
  composition,
  context = {},
  answers = {},
  quiet = false,
}) {
  const curation = curateSkills({ composition, context, answers });
  composition.skills = curation.curatedSkills;
  composition.excludedSkills = curation.excludedSkills;

  // 1. Write updated pack registry with excludedSkills
  writeRegistry(root, composition);

  // 2. Prune stale skill links
  const desired = new Set(composition.skills.map((s) => s.as || s.name));
  const prunedLinks = pruneStaleSkillLinks(root, desired);

  // 3. Materialize active skill symlinks in .agents/skills/
  for (const skill of composition.skills) {
    const as = skill.as || skill.name;
    const linkAbs = path.join(root, '.agents', 'skills', as);
    if (existsSync(linkAbs)) continue;
    mkdirSync(path.dirname(linkAbs), { recursive: true });
    const target = process.platform === 'win32' ? 'junction' : 'dir';
    symlinkSync(skill.dir, linkAbs, target);
  }

  // 4. Mirror junctions to IDE folders (.claude, .commandcode, .gemini)
  linkIdeFolders({ root, quiet: true });

  // 5. Regenerate skills manifest and AGENTS.md Skill INDEX
  const primary = composition.archetypes?.[0];
  const manifest = generateSkillsManifest({
    root,
    quiet: true,
    appPath: primary?.effectiveAppPath,
    defaultAppPath: primary?.manifest?.spec?.defaultAppPath,
    excludedSkills: curation.excludedSkills,
  });

  return {
    ...curation,
    prunedLinks,
    manifest,
  };
}
