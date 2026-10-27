#!/usr/bin/env node
/**
 * Two-Tier Skill Completeness & Reference Validator (UG-13, UG-34 / Phase 3 Unit U14)
 *
 * Validates all workspace skills (30 first-party ss-* core skills + 1 external find-skills + 34 pack skills):
 *
 * Tier A — Strict Mode for 30 ss-* Core Skills:
 *   1. SKILL.md <= 180 lines, instructions.md <= 450 lines
 *   2. Valid YAML frontmatter: name starts with ss- matching folder, description present
 *   3. Mandatory sections in instructions.md:
 *      - ## Iron Law(s)
 *      - ## Red Flags & Rationalization Defense (or Anti-Rationalization)
 *      - ## Verification Ladder
 *      - ## Terminal States
 *   4. Zero broken resources/ links
 *   5. Zero unrooted IDE artifact instructions (no <name>.md artifact or <appDataDir>/brain/)
 *
 * Tier B — Compatibility Mode for 35 external/pack skills:
 *   1. Basic frontmatter (name, description)
 *   2. Resolving relative links
 *
 * Exit code 0 on pass; exit code 1 with explicit violation report on failure.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { getActivePacks } from './agent-preflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const MAX_SKILL_MD_LINES = 180;
const MAX_INSTRUCTIONS_MD_LINES = 450;

const FORBIDDEN_ARTIFACT_PATTERNS = [
  /(?:write|create|output|save|export|emit|store|put)\s+(?:to\s+|in\s+)?(?:<appDataDir>\/brain|\.gemini\/antigravity\/brain)/i,
  /(?:write|create|output|save|export|emit)\s+(?:as\s+|to\s+)?(?:a\s+|an\s+)?(?:native\s+)?(?:IDE\s+)?brain\s+artifact/i,
  /(?:write|create|output|save|export|emit)\s+(?:an?\s+)?implementation_plan\.md\s+artifact/i,
  /(?:write|create|output|save|export|emit)\s+(?:an?\s+)?task\.md\s+artifact/i,
  /<appDataDir>\/brain\/<conversation-id>/i,
];

/** Parse frontmatter from markdown */
export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { present: false, data: {} };
  try {
    return { present: true, data: parseYaml(match[1]) || {} };
  } catch (err) {
    return { present: true, data: {}, error: err.message };
  }
}

/** Check relative links in markdown */
export function findBrokenLinks(dir, filePath, content) {
  const broken = [];
  // Match markdown links [text](path)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const target = match[2].trim().split('#')[0].split('?')[0];
    if (!target) continue;
    // Skip external http, mailto, etc.
    if (/^[a-z]+:/i.test(target)) continue;

    const resolved = path.resolve(dir, target);
    if (!existsSync(resolved)) {
      broken.push({
        linkText: match[1],
        target,
        resolved: path.relative(ROOT, resolved).replace(/\\/g, '/'),
      });
    }
  }
  return broken;
}

/** Validate a single skill directory */
export function validateSkill(skillDir, options = {}) {
  const root = options.root || ROOT;
  const dirName = path.basename(skillDir);
  const isCoreSsSkill = dirName.startsWith('ss-');
  const violations = [];
  const relDir = path.relative(root, skillDir).replace(/\\/g, '/');

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const instrMdPath = path.join(skillDir, 'instructions.md');

  // 1. Check SKILL.md
  if (!existsSync(skillMdPath)) {
    violations.push({
      code: 'MISSING_SKILL_MD',
      file: `${relDir}/SKILL.md`,
      message: 'SKILL.md is missing',
    });
    return { ok: false, skillName: dirName, isCoreSsSkill, violations };
  }

  const skillMdContent = readFileSync(skillMdPath, 'utf8');
  const skillMdLines = skillMdContent.split(/\r?\n/).length;

  if (isCoreSsSkill && skillMdLines > MAX_SKILL_MD_LINES) {
    violations.push({
      code: 'SKILL_MD_LINE_BUDGET_EXCEEDED',
      file: `${relDir}/SKILL.md`,
      message: `SKILL.md has ${skillMdLines} lines (max: ${MAX_SKILL_MD_LINES})`,
    });
  }

  const fm = parseFrontmatter(skillMdContent);
  if (!fm.present || !fm.data) {
    violations.push({
      code: 'INVALID_FRONTMATTER',
      file: `${relDir}/SKILL.md`,
      message: 'Missing or malformed YAML frontmatter in SKILL.md',
    });
  } else {
    if (!fm.data.name) {
      violations.push({
        code: 'MISSING_NAME',
        file: `${relDir}/SKILL.md`,
        message: 'Frontmatter missing "name" field',
      });
    } else if (fm.data.name !== dirName) {
      violations.push({
        code: 'NAME_MISMATCH',
        file: `${relDir}/SKILL.md`,
        message: `Frontmatter name "${fm.data.name}" does not match directory "${dirName}"`,
      });
    }

    if (!fm.data.description || typeof fm.data.description !== 'string' || fm.data.description.trim().length === 0) {
      violations.push({
        code: 'MISSING_DESCRIPTION',
        file: `${relDir}/SKILL.md`,
        message: 'Frontmatter missing or empty "description" field',
      });
    }
  }

  // Check links in SKILL.md
  const skillMdBrokenLinks = findBrokenLinks(skillDir, skillMdPath, skillMdContent);
  for (const b of skillMdBrokenLinks) {
    violations.push({
      code: 'BROKEN_LINK',
      file: `${relDir}/SKILL.md`,
      message: `Broken link to "${b.target}" (resolved: ${b.resolved})`,
    });
  }

  // 2. Strict Mode for ss-* Core Skills
  if (isCoreSsSkill) {
    if (!existsSync(instrMdPath)) {
      violations.push({
        code: 'MISSING_INSTRUCTIONS_MD',
        file: `${relDir}/instructions.md`,
        message: 'First-party ss-* skill must have an instructions.md file',
      });
    } else {
      const instrContent = readFileSync(instrMdPath, 'utf8');
      const instrLines = instrContent.split(/\r?\n/).length;

      if (instrLines > MAX_INSTRUCTIONS_MD_LINES) {
        violations.push({
          code: 'INSTRUCTIONS_MD_LINE_BUDGET_EXCEEDED',
          file: `${relDir}/instructions.md`,
          message: `instructions.md has ${instrLines} lines (max: ${MAX_INSTRUCTIONS_MD_LINES})`,
        });
      }

      // Check Iron Law
      const hasIronLaw = /^##\s+Iron\s+Laws?/im.test(instrContent);
      if (!hasIronLaw) {
        violations.push({
          code: 'MISSING_IRON_LAW',
          file: `${relDir}/instructions.md`,
          message: 'instructions.md missing mandatory "## Iron Law" section',
        });
      }

      // Check Anti-Rationalization / Red Flags
      const hasRedFlags =
        /^##\s+.*(Red\s+Flags|Anti-Rationalization|Rationalization)/im.test(instrContent);
      if (!hasRedFlags) {
        violations.push({
          code: 'MISSING_RED_FLAGS_TABLE',
          file: `${relDir}/instructions.md`,
          message: 'instructions.md missing mandatory "## Red Flags & Rationalization Defense" section',
        });
      }

      // Check Verification Ladder
      const hasVerifLadder = /^##\s+Verification\s+Ladder/im.test(instrContent);
      if (!hasVerifLadder) {
        violations.push({
          code: 'MISSING_VERIFICATION_LADDER',
          file: `${relDir}/instructions.md`,
          message: 'instructions.md missing mandatory "## Verification Ladder" section',
        });
      }

      // Check Terminal States
      const hasTerminalStates = /^##\s+Terminal\s+States/im.test(instrContent);
      if (!hasTerminalStates) {
        violations.push({
          code: 'MISSING_TERMINAL_STATES',
          file: `${relDir}/instructions.md`,
          message: 'instructions.md missing mandatory "## Terminal States" section',
        });
      }

      // Check forbidden IDE artifacts
      for (const pattern of FORBIDDEN_ARTIFACT_PATTERNS) {
        if (pattern.test(instrContent) || pattern.test(skillMdContent)) {
          violations.push({
            code: 'FORBIDDEN_IDE_ARTIFACT_INSTRUCTION',
            file: `${relDir}/instructions.md`,
            message: `Contains forbidden native IDE brain artifact instruction matching ${pattern}`,
          });
          break;
        }
      }

      // Check broken links in instructions.md
      const instrBrokenLinks = findBrokenLinks(skillDir, instrMdPath, instrContent);
      for (const b of instrBrokenLinks) {
        violations.push({
          code: 'BROKEN_LINK',
          file: `${relDir}/instructions.md`,
          message: `Broken link to "${b.target}" (resolved: ${b.resolved})`,
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    skillName: dirName,
    isCoreSsSkill,
    violations,
  };
}

/** Collect all skills across workspace */
export function collectAllSkills(root = ROOT) {
  const skills = [];
  const seen = new Set();

  // 1. Core skills in .agents/skills/
  const agentsSkillsDir = path.join(root, '.agents', 'skills');
  if (existsSync(agentsSkillsDir)) {
    const entries = readdirSync(agentsSkillsDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.isSymbolicLink()) {
        const full = path.join(agentsSkillsDir, e.name);
        skills.push({ name: e.name, dir: full, source: 'core' });
        seen.add(e.name);
      }
    }
  }

  // 2. Active pack skills in .shiftstone/packs/<pack>/skills/
  for (const pack of getActivePacks(root)) {
    const packSkillsDir = path.join(root, '.shiftstone', 'packs', pack, 'skills');
    if (existsSync(packSkillsDir)) {
      const entries = readdirSync(packSkillsDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && !seen.has(e.name)) {
          const full = path.join(packSkillsDir, e.name);
          skills.push({ name: e.name, dir: full, source: `pack:${pack}` });
          seen.add(e.name);
        }
      }
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/** Validate all skills across workspace */
export function validateAllSkills(options = {}) {
  const root = options.root || ROOT;
  const allSkills = collectAllSkills(root);
  const results = [];
  const violations = [];
  let ssCount = 0;
  let packExternalCount = 0;

  for (const skill of allSkills) {
    if (skill.name.startsWith('ss-')) ssCount += 1;
    else packExternalCount += 1;

    const res = validateSkill(skill.dir, { root });
    results.push(res);
    if (!res.ok) {
      violations.push(...res.violations);
    }
  }

  // Minimum required counts per Phase 5 Unit U14 (AC-U14-01 / REQ-INIT-13)
  if (ssCount < 31) {
    violations.push({
      code: 'INSUFFICIENT_SS_SKILLS',
      file: '.agents/skills/',
      message: `Expected at least 31 ss-* core skills, found ${ssCount}`,
    });
  }
  if (allSkills.length < 66) {
    violations.push({
      code: 'INSUFFICIENT_TOTAL_SKILLS',
      file: '.agents/skills/',
      message: `Expected at least 66 total workspace skills, found ${allSkills.length}`,
    });
  }

  return {
    ok: violations.length === 0,
    totalSkills: allSkills.length,
    ssSkillsCount: ssCount,
    packExternalCount,
    results,
    violations,
  };
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const res = validateAllSkills({ root: ROOT });

  console.log('=== ShiftStone Two-Tier Skill Completeness Report (UG-13, UG-34) ===');
  console.log(`  Total Skills Checked:      ${res.totalSkills}`);
  console.log(`  First-Party ss-* (Strict): ${res.ssSkillsCount}`);
  console.log(`  External / Pack (Compat):  ${res.packExternalCount}`);

  if (!res.ok) {
    console.error(`\nFAIL — ${res.violations.length} skill violation(s) found:`);
    for (const v of res.violations) {
      console.error(`  - [${v.code}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log('\nok — All workspace skills pass two-tier completeness checks cleanly.');
  process.exit(0);
}
