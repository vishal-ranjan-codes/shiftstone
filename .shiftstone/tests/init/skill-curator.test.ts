/**
 * Unit Tests for Unit U11: Domain-Aware Skill Curation & Context Pruning
 *
 * Traceability:
 *   - REQ-INIT-10 (Domain-Aware Skill Curation & Context Pruning)
 *   - LOCK-INIT-12 (Domain-Aware Skill Curation)
 *   - Unit U11 (AC-U11-01, AC-U11-02, AC-U11-03, TS-U11-01, TS-U11-02)
 */

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { composeArchetypes } from '../../init/compose.js';
import {
  COMMUNITY_SKILLS_DIRECTORY,
  curateSkills,
  evaluateCommunitySkills,
  evaluateSkillExclusions,
  applySkillCuration,
} from '../../init/skill-curator.js';
import { makeWorkspace } from './workspace-fixture.js';

describe('Unit U11 — Domain-Aware Skill Curation (REQ-INIT-10, LOCK-INIT-12)', () => {
  it('AC-U11-01: excludes cloudflare-cron and jobs when background jobs are disabled', () => {
    const context = {
      background_jobs: false,
      file_uploads: true,
    };
    const evaluation = evaluateSkillExclusions(context);

    expect(evaluation.backgroundJobsSelected).toBe(false);
    expect(evaluation.fileStorageSelected).toBe(true);
    expect(evaluation.excludedSkills).toContain('cloudflare-cron');
    expect(evaluation.excludedSkills).toContain('jobs');
    expect(evaluation.excludedSkills).toContain('cloudflare-queues');
    expect(evaluation.excludedSkills).not.toContain('storage');
    expect(evaluation.excludedSkills).not.toContain('cloudflare-r2');
  });

  it('AC-U11-01: excludes cloudflare-r2 and storage when file uploads are disabled', () => {
    const context = {
      background_jobs: true,
      file_uploads: false,
    };
    const evaluation = evaluateSkillExclusions(context);

    expect(evaluation.fileStorageSelected).toBe(false);
    expect(evaluation.backgroundJobsSelected).toBe(true);
    expect(evaluation.excludedSkills).toContain('cloudflare-r2');
    expect(evaluation.excludedSkills).toContain('storage');
    expect(evaluation.excludedSkills).not.toContain('cloudflare-cron');
    expect(evaluation.excludedSkills).not.toContain('jobs');
  });

  it('AC-U11-01: always retains core runtime skills for standard web context', () => {
    const composition = composeArchetypes({ archetype: 'rr8-supabase-cf' });
    const context = {
      background_jobs: false,
      file_uploads: false,
    };
    const result = curateSkills({
      composition,
      context,
    });

    const curatedNames = result.curatedSkills.map((s) => s.as || s.name);

    // Retained core runtime skills
    expect(curatedNames).toContain('stack');
    expect(curatedNames).toContain('ui');
    expect(curatedNames).toContain('theme-management');
    expect(curatedNames).toContain('zod-validation');
    expect(curatedNames).toContain('vitest-testing');

    // Excluded non-core unselected skills
    expect(curatedNames).not.toContain('cloudflare-cron');
    expect(curatedNames).not.toContain('jobs');
    expect(curatedNames).not.toContain('storage');
    expect(curatedNames).not.toContain('cloudflare-r2');

    // Token savings verified
    expect(result.tokenSavings).toBeGreaterThan(0);
    expect(result.savingsPercent).toBeGreaterThan(10);
  });

  it('AC-U11-02: evaluates community skills from skills.sh with >=10k auto-install and <10k recommendation', () => {
    const integrations = ['stripe', 'resend', 'twilio', 'algolia', 'custom-service'];
    const result = evaluateCommunitySkills(integrations);

    // Stripe has 28,500 installs >= 10,000 -> autoInstall true
    const stripe = result.skills.find((s) => s.name === 'stripe');
    expect(stripe).toBeDefined();
    expect(stripe?.autoInstall).toBe(true);
    expect(stripe?.status).toBe('auto_installed');
    expect(stripe?.package).toBe('vercel-labs/agent-skills@stripe');

    // Resend has 14,200 installs >= 10,000 -> autoInstall true
    const resend = result.skills.find((s) => s.name === 'resend');
    expect(resend).toBeDefined();
    expect(resend?.autoInstall).toBe(true);
    expect(resend?.status).toBe('auto_installed');

    // Twilio has 4,200 installs < 10,000 -> recommendation only
    const twilio = result.skills.find((s) => s.name === 'twilio');
    expect(twilio).toBeDefined();
    expect(twilio?.autoInstall).toBe(false);
    expect(twilio?.status).toBe('recommended');

    // Algolia has 6,800 installs < 10,000 -> recommendation only
    const algolia = result.skills.find((s) => s.name === 'algolia');
    expect(algolia).toBeDefined();
    expect(algolia?.autoInstall).toBe(false);
    expect(algolia?.status).toBe('recommended');

    // Unrecognized integration -> scaffold custom
    const custom = result.skills.find((s) => s.name === 'custom-service');
    expect(custom).toBeDefined();
    expect(custom?.status).toBe('scaffold_custom');

    expect(result.autoInstalled.length).toBe(2);
    expect(result.recommended.length).toBe(2);
    expect(result.custom.length).toBe(1);
  });

  it('TS-U11-01 (L1): simulates an API-only service context and asserts storage and UI skills are excluded from curated manifest', async () => {
    const root = await makeWorkspace();
    const composition = composeArchetypes({ archetype: 'rr8-supabase-cf' }, { root });

    const context = {
      app_type: 'api',
      api_only: true,
      file_uploads: false,
      background_jobs: false,
    };

    const curation = applySkillCuration({
      root,
      composition,
      context,
      quiet: true,
    });

    const manifestPath = path.join(root, '.shiftstone', 'context', 'skills-manifest.yaml');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = parseYaml(readFileSync(manifestPath, 'utf8'));
    const manifestSkillNames = manifest.spec.skills.map((s: any) => s.name);

    // Assert UI skills excluded
    expect(manifestSkillNames).not.toContain('ui');
    expect(manifestSkillNames).not.toContain('tailwind-v4');
    expect(manifestSkillNames).not.toContain('shadcn-ui');
    expect(manifestSkillNames).not.toContain('theme-management');
    expect(manifestSkillNames).not.toContain('web-design-guidelines');
    expect(manifestSkillNames).not.toContain('design-tokens');

    // Assert storage skills excluded
    expect(manifestSkillNames).not.toContain('storage');
    expect(manifestSkillNames).not.toContain('cloudflare-r2');

    // Assert background jobs excluded
    expect(manifestSkillNames).not.toContain('cloudflare-cron');
    expect(manifestSkillNames).not.toContain('jobs');

    // Assert core backend skills retained
    expect(manifestSkillNames).toContain('stack');
    expect(manifestSkillNames).toContain('supabase-postgres');
    expect(manifestSkillNames).toContain('supabase-auth');
    expect(manifestSkillNames).toContain('zod-validation');
    expect(manifestSkillNames).toContain('vitest-testing');

    // Assert context savings >= 15%
    expect(curation.savingsPercent).toBeGreaterThanOrEqual(15);
  });

  it('TS-U11-02 (L2): asserts skills-manifest.yaml reflects only active curated skills without dangling junctions', async () => {
    const root = await makeWorkspace();
    const composition = composeArchetypes({ archetype: 'rr8-supabase-cf' }, { root });

    const context = {
      background_jobs: false,
      file_uploads: false,
    };

    applySkillCuration({
      root,
      composition,
      context,
      quiet: true,
    });

    const manifestPath = path.join(root, '.shiftstone', 'context', 'skills-manifest.yaml');
    const manifest = parseYaml(readFileSync(manifestPath, 'utf8'));
    const manifestSkillNames = manifest.spec.skills.map((s: any) => s.name);

    // Verify manifest only contains curated skills
    expect(manifestSkillNames).not.toContain('cloudflare-cron');
    expect(manifestSkillNames).not.toContain('jobs');
    expect(manifestSkillNames).not.toContain('cloudflare-r2');
    expect(manifestSkillNames).not.toContain('storage');

    // Check .agents/skills/ directory
    const skillsDir = path.join(root, '.agents', 'skills');
    const entries = readdirSync(skillsDir);

    // Excluded skills must NOT exist as symlinks in .agents/skills
    expect(entries).not.toContain('cloudflare-cron');
    expect(entries).not.toContain('jobs');
    expect(entries).not.toContain('cloudflare-r2');
    expect(entries).not.toContain('storage');

    // Active skills must exist and be valid symlinks or real directories
    expect(entries).toContain('stack');
    expect(entries).toContain('ui');

    for (const name of entries) {
      const fullPath = path.join(skillsDir, name);
      // Ensure no dangling symlink
      expect(existsSync(fullPath)).toBe(true);
    }

    // Verify AGENTS.md Index reflects curated list
    const agentsMd = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('<!-- SKILL-INDEX:BEGIN -->');
    expect(agentsMd).not.toContain('- cloudflare-cron');
    expect(agentsMd).not.toContain('- jobs');
    expect(agentsMd).not.toContain('- cloudflare-r2');
    expect(agentsMd).not.toContain('- storage');
    expect(agentsMd).toContain('stack');
  });
});
