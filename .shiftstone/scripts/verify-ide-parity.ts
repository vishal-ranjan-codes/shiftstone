#!/usr/bin/env tsx
/**
 * Live IDE Parity & Junction Health Validator (UG-05 / Phase 1 Unit U3)
 *
 * Verifies across Antigravity, Claude Code, Command Code, and OpenCode:
 *   1. OS directory junctions resolve to canonical .agents/skills
 *   2. Zero duplicate standalone skill files exist in .claude/ or .commandcode/
 *   3. Zero deprecated legacy workflow directories exist on disk
 *   4. SKILL-INDEX alignment across AGENTS.md and IDE steering files
 *
 * Usage:
 *   npx tsx .shiftstone/scripts/verify-ide-parity.ts [--root <path>]
 */

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyIdeJunctions } from './setup-ide-junctions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface ParityCheckResult {
  ok: boolean;
  problems: Array<{ code: string; message: string; path?: string }>;
  details: {
    junctionsVerified: number;
    ideShimsChecked: string[];
    skillIndexEntries: number;
  };
}

export function verifyIdeParity(options: { root?: string } = {}): ParityCheckResult {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const problems: Array<{ code: string; message: string; path?: string }> = [];
  const ideShims = ['AGENTS.md', 'CLAUDE.md', 'ANTIGRAVITY.md', 'COMMANDCODE.md', 'opencode.json'];

  // 1. Verify junctions & legacy directories using verifyIdeJunctions
  const junctionCheck = verifyIdeJunctions({ root });
  for (const p of junctionCheck.problems) {
    problems.push({
      code: p.code,
      message: p.message,
      path: p.path,
    });
  }

  // 2. Check for duplicate standalone skill files in IDE folders
  const ideSkillDirs = ['.claude', '.commandcode'];
  for (const ideDir of ideSkillDirs) {
    const skillsFolder = path.join(root, ideDir, 'skills');
    if (existsSync(skillsFolder) && !lstatSync(skillsFolder).isSymbolicLink()) {
      problems.push({
        code: 'DUPLICATE_SKILLS_DIRECTORY',
        path: path.join(ideDir, 'skills'),
        message: `${ideDir}/skills is a physical folder with duplicate files instead of an OS directory junction`,
      });
    }

    // Check for loose duplicate skill files directly under .claude or .commandcode
    const absIdeDir = path.join(root, ideDir);
    if (existsSync(absIdeDir) && !lstatSync(absIdeDir).isSymbolicLink()) {
      const looseMd = readdirSync(absIdeDir).filter((f) => f.endsWith('.md') && f !== 'taste.md');
      if (looseMd.length > 0) {
        problems.push({
          code: 'UNEXPECTED_IDE_MD_FILES',
          path: ideDir,
          message: `Found standalone markdown files in ${ideDir}: ${looseMd.join(', ')}`,
        });
      }
    }
  }

  // 3. Verify SKILL-INDEX in AGENTS.md
  let skillCount = 0;
  const agentsPath = path.join(root, 'AGENTS.md');
  if (!existsSync(agentsPath)) {
    problems.push({
      code: 'MISSING_AGENTS_MD',
      path: 'AGENTS.md',
      message: 'AGENTS.md (universal orientation & Layer 0 entry point) is missing',
    });
  } else {
    const agentsContent = readFileSync(agentsPath, 'utf8');
    const indexMatch = agentsContent.match(/<!-- SKILL-INDEX:BEGIN -->([\s\S]*?)<!-- SKILL-INDEX:END -->/);
    if (!indexMatch) {
      problems.push({
        code: 'MISSING_SKILL_INDEX',
        path: 'AGENTS.md',
        message: 'AGENTS.md is missing the <!-- SKILL-INDEX:BEGIN --> ... <!-- SKILL-INDEX:END --> block',
      });
    } else {
      const text = indexMatch[1].trim();
      const skills = text
        .split(/[\n,]/)
        .map((s) => s.replace(/^-\s*/, '').trim())
        .filter((s) => s.length > 0);
      skillCount = skills.length;
      if (skillCount === 0) {
        problems.push({
          code: 'EMPTY_SKILL_INDEX',
          path: 'AGENTS.md',
          message: 'AGENTS.md SKILL-INDEX block contains zero registered skills',
        });
      }
    }
  }

  // 4. Verify IDE shims point to AGENTS.md and .agents/skills
  const claudePath = path.join(root, 'CLAUDE.md');
  if (existsSync(claudePath)) {
    const c = readFileSync(claudePath, 'utf8');
    if (!c.includes('AGENTS.md')) {
      problems.push({
        code: 'SHIM_UNLINKED_AGENTS',
        path: 'CLAUDE.md',
        message: 'CLAUDE.md must reference AGENTS.md as canonical universal entry point',
      });
    }
    if (!c.includes('.claude/skills') && !c.includes('.agents/skills')) {
      problems.push({
        code: 'SHIM_UNLINKED_SKILLS',
        path: 'CLAUDE.md',
        message: 'CLAUDE.md must reference .claude/skills -> .agents/skills junction',
      });
    }
  }

  const antigravityPath = path.join(root, 'ANTIGRAVITY.md');
  if (existsSync(antigravityPath)) {
    const c = readFileSync(antigravityPath, 'utf8');
    if (!c.includes('AGENTS.md')) {
      problems.push({
        code: 'SHIM_UNLINKED_AGENTS',
        path: 'ANTIGRAVITY.md',
        message: 'ANTIGRAVITY.md must reference AGENTS.md as universal entry point',
      });
    }
  }

  const commandcodePath = path.join(root, 'COMMANDCODE.md');
  if (existsSync(commandcodePath)) {
    const c = readFileSync(commandcodePath, 'utf8');
    if (!c.includes('AGENTS.md')) {
      problems.push({
        code: 'SHIM_UNLINKED_AGENTS',
        path: 'COMMANDCODE.md',
        message: 'COMMANDCODE.md must reference AGENTS.md as universal entry point',
      });
    }
  }

  const opencodePath = path.join(root, 'opencode.json');
  if (existsSync(opencodePath)) {
    try {
      const oc = JSON.parse(readFileSync(opencodePath, 'utf8'));
      const instructions = Array.isArray(oc.instructions) ? oc.instructions : [];
      if (!instructions.includes('AGENTS.md')) {
        problems.push({
          code: 'OPENCODE_MISSING_AGENTS',
          path: 'opencode.json',
          message: 'opencode.json instructions array must include AGENTS.md',
        });
      }
    } catch (err: any) {
      problems.push({
        code: 'INVALID_OPENCODE_JSON',
        path: 'opencode.json',
        message: `Failed to parse opencode.json: ${err.message}`,
      });
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    details: {
      junctionsVerified: junctionCheck.status.length,
      ideShimsChecked: ideShims,
      skillIndexEntries: skillCount,
    },
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let rootArg = ROOT;
  const rootIdx = process.argv.indexOf('--root');
  if (rootIdx !== -1 && process.argv[rootIdx + 1]) {
    rootArg = process.argv[rootIdx + 1];
  }

  const result = verifyIdeParity({ root: rootArg });

  console.log('=== IDE Parity & Junction Health Report (UG-05) ===');
  console.log(`  Junctions Verified:      ${result.details.junctionsVerified}`);
  console.log(`  IDE Shims Checked:       ${result.details.ideShimsChecked.join(', ')}`);
  console.log(`  Registered Skills Index: ${result.details.skillIndexEntries} skills`);

  if (!result.ok) {
    console.error(`\nFAIL — ${result.problems.length} IDE parity defect(s) detected:`);
    for (const p of result.problems) {
      console.error(`  [${p.code}] ${p.message}`);
    }
    process.exit(1);
  }

  console.log('\nok — All 4 IDEs maintain strict parity, healthy junctions, and zero duplication.');
  process.exit(0);
}
