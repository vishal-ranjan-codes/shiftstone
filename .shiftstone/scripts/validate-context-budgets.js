#!/usr/bin/env node
/**
 * Context Budget Validator (UG-01, UG-02 / Phase 1 Unit U1)
 *
 * Enforces Layer 0/1 context efficiency across AI IDEs:
 *   - AGENTS.md <= 60 lines, <= 4,096 bytes
 *   - .shiftstone/static-rules/*.md <= 120 lines, <= 6,144 bytes each
 *   - .shiftstone/path-scoped-rules/*.md <= 120 lines, <= 6,144 bytes each
 *   - Cumulative always-on context (AGENTS.md + always-on static rules) <= 12,288 bytes (~3,000 tokens)
 *   - .agents/skills/<skill>/SKILL.md <= 180 lines
 *   - .agents/skills/<skill>/instructions.md <= 450 lines
 *
 * Exit code 0 on clean pass; exit code 1 with BUDGET_EXCEEDED on violation.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const CEILINGS = {
  AGENTS_MAX_LINES: 60,
  AGENTS_MAX_BYTES: 4096,
  RULE_MAX_LINES: 120,
  RULE_MAX_BYTES: 6144,
  ALWAYS_ON_MAX_BYTES: 12288, // 12 KB ~ 3,000 tokens
  SKILL_MANIFEST_MAX_LINES: 180,
  SKILL_INSTRUCTIONS_MAX_LINES: 450,
};

export function lineCount(content) {
  if (content.length === 0) return 0;
  return content.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length;
}

export function isAlwaysOn(content) {
  const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (!match) return true; // defaults to always-on if not specified
  const frontmatter = match[1];
  if (/activation:\s*on-demand/i.test(frontmatter)) return false;
  if (/activation:\s*always/i.test(frontmatter)) return true;
  return true;
}

export function validateContextBudgets(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const violations = [];
  const details = {
    agents: null,
    staticRules: [],
    pathScopedRules: [],
    skills: [],
    cumulativeAlwaysOnBytes: 0,
  };

  // 1. AGENTS.md
  const agentsPath = path.join(root, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    const raw = readFileSync(agentsPath, 'utf8');
    const lines = lineCount(raw);
    const bytes = statSync(agentsPath).size;
    details.agents = { path: 'AGENTS.md', lines, bytes };
    details.cumulativeAlwaysOnBytes += bytes;

    if (lines > CEILINGS.AGENTS_MAX_LINES) {
      violations.push({
        code: 'BUDGET_EXCEEDED',
        file: 'AGENTS.md',
        metric: 'lines',
        actual: lines,
        limit: CEILINGS.AGENTS_MAX_LINES,
        message: `AGENTS.md line count ${lines} exceeds ceiling ${CEILINGS.AGENTS_MAX_LINES}`,
      });
    }
    if (bytes > CEILINGS.AGENTS_MAX_BYTES) {
      violations.push({
        code: 'BUDGET_EXCEEDED',
        file: 'AGENTS.md',
        metric: 'bytes',
        actual: bytes,
        limit: CEILINGS.AGENTS_MAX_BYTES,
        message: `AGENTS.md size ${bytes} B exceeds ceiling ${CEILINGS.AGENTS_MAX_BYTES} B`,
      });
    }
  }

  // 2. .shiftstone/static-rules/*.md
  const staticRulesDir = path.join(root, '.shiftstone', 'static-rules');
  if (existsSync(staticRulesDir)) {
    const files = readdirSync(staticRulesDir).filter((f) => f.endsWith('.md')).sort();
    for (const f of files) {
      const filePath = path.join(staticRulesDir, f);
      const relPath = path.join('.shiftstone', 'static-rules', f).replace(/\\/g, '/');
      const raw = readFileSync(filePath, 'utf8');
      const lines = lineCount(raw);
      const bytes = statSync(filePath).size;
      const alwaysOn = isAlwaysOn(raw);

      if (alwaysOn) {
        details.cumulativeAlwaysOnBytes += bytes;
      }

      details.staticRules.push({ path: relPath, lines, bytes, alwaysOn });

      if (lines > CEILINGS.RULE_MAX_LINES) {
        violations.push({
          code: 'BUDGET_EXCEEDED',
          file: relPath,
          metric: 'lines',
          actual: lines,
          limit: CEILINGS.RULE_MAX_LINES,
          message: `${relPath} line count ${lines} exceeds ceiling ${CEILINGS.RULE_MAX_LINES}`,
        });
      }
      if (bytes > CEILINGS.RULE_MAX_BYTES) {
        violations.push({
          code: 'BUDGET_EXCEEDED',
          file: relPath,
          metric: 'bytes',
          actual: bytes,
          limit: CEILINGS.RULE_MAX_BYTES,
          message: `${relPath} size ${bytes} B exceeds ceiling ${CEILINGS.RULE_MAX_BYTES} B`,
        });
      }
    }
  }

  // 3. Cumulative always-on context budget
  if (details.cumulativeAlwaysOnBytes > CEILINGS.ALWAYS_ON_MAX_BYTES) {
    violations.push({
      code: 'BUDGET_EXCEEDED',
      file: 'cumulative-always-on',
      metric: 'bytes',
      actual: details.cumulativeAlwaysOnBytes,
      limit: CEILINGS.ALWAYS_ON_MAX_BYTES,
      message: `Cumulative always-on context size ${details.cumulativeAlwaysOnBytes} B exceeds ceiling ${CEILINGS.ALWAYS_ON_MAX_BYTES} B (~3,000 tokens)`,
    });
  }

  // 4. .shiftstone/path-scoped-rules/*.md
  const pathRulesDir = path.join(root, '.shiftstone', 'path-scoped-rules');
  if (existsSync(pathRulesDir)) {
    const files = readdirSync(pathRulesDir).filter((f) => f.endsWith('.md')).sort();
    for (const f of files) {
      const filePath = path.join(pathRulesDir, f);
      const relPath = path.join('.shiftstone', 'path-scoped-rules', f).replace(/\\/g, '/');
      const raw = readFileSync(filePath, 'utf8');
      const lines = lineCount(raw);
      const bytes = statSync(filePath).size;

      details.pathScopedRules.push({ path: relPath, lines, bytes });

      if (lines > CEILINGS.RULE_MAX_LINES) {
        violations.push({
          code: 'BUDGET_EXCEEDED',
          file: relPath,
          metric: 'lines',
          actual: lines,
          limit: CEILINGS.RULE_MAX_LINES,
          message: `${relPath} line count ${lines} exceeds ceiling ${CEILINGS.RULE_MAX_LINES}`,
        });
      }
      if (bytes > CEILINGS.RULE_MAX_BYTES) {
        violations.push({
          code: 'BUDGET_EXCEEDED',
          file: relPath,
          metric: 'bytes',
          actual: bytes,
          limit: CEILINGS.RULE_MAX_BYTES,
          message: `${relPath} size ${bytes} B exceeds ceiling ${CEILINGS.RULE_MAX_BYTES} B`,
        });
      }
    }
  }

  // 5. Skills budget (SKILL.md <= 180 lines, instructions.md <= 450 lines)
  const skillsRoots = [
    path.join(root, '.agents', 'skills'),
    existsSync(path.join(root, '.shiftstone', 'packs', 'rr8-supabase-cf', 'skills'))
      ? path.join(root, '.shiftstone', 'packs', 'rr8-supabase-cf', 'skills')
      : path.join(root, 'packs', 'rr8-supabase-cf', 'skills'),
  ];

  for (const sRoot of skillsRoots) {
    if (!existsSync(sRoot)) continue;
    const skillDirs = readdirSync(sRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const skillName of skillDirs) {
      const skillPath = path.join(sRoot, skillName);
      const skillManifest = path.join(skillPath, 'SKILL.md');
      const instructions = path.join(skillPath, 'instructions.md');

      if (existsSync(skillManifest)) {
        const raw = readFileSync(skillManifest, 'utf8');
        const lines = lineCount(raw);
        const relPath = path.relative(root, skillManifest).replace(/\\/g, '/');
        details.skills.push({ path: relPath, lines });
        if (lines > CEILINGS.SKILL_MANIFEST_MAX_LINES) {
          violations.push({
            code: 'BUDGET_EXCEEDED',
            file: relPath,
            metric: 'lines',
            actual: lines,
            limit: CEILINGS.SKILL_MANIFEST_MAX_LINES,
            message: `${relPath} line count ${lines} exceeds ceiling ${CEILINGS.SKILL_MANIFEST_MAX_LINES}`,
          });
        }
      }

      if (existsSync(instructions)) {
        const raw = readFileSync(instructions, 'utf8');
        const lines = lineCount(raw);
        const relPath = path.relative(root, instructions).replace(/\\/g, '/');
        details.skills.push({ path: relPath, lines });
        if (lines > CEILINGS.SKILL_INSTRUCTIONS_MAX_LINES) {
          violations.push({
            code: 'BUDGET_EXCEEDED',
            file: relPath,
            metric: 'lines',
            actual: lines,
            limit: CEILINGS.SKILL_INSTRUCTIONS_MAX_LINES,
            message: `${relPath} line count ${lines} exceeds ceiling ${CEILINGS.SKILL_INSTRUCTIONS_MAX_LINES}`,
          });
        }
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    details,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let rootArg = ROOT;
  const rootIdx = process.argv.indexOf('--root');
  if (rootIdx !== -1 && process.argv[rootIdx + 1]) {
    rootArg = process.argv[rootIdx + 1];
  }

  const result = validateContextBudgets({ root: rootArg });

  console.log('=== Context Budget Validation Report (UG-01, UG-02) ===');
  if (result.details.agents) {
    console.log(
      `  AGENTS.md:               ${result.details.agents.lines}/${CEILINGS.AGENTS_MAX_LINES} lines, ${result.details.agents.bytes}/${CEILINGS.AGENTS_MAX_BYTES} B`,
    );
  }
  console.log(
    `  Cumulative Always-On:    ${result.details.cumulativeAlwaysOnBytes}/${CEILINGS.ALWAYS_ON_MAX_BYTES} B (~${Math.round(result.details.cumulativeAlwaysOnBytes / 4)} tokens)`,
  );
  console.log(`  Static Rules Checked:    ${result.details.staticRules.length}`);
  console.log(`  Path Rules Checked:      ${result.details.pathScopedRules.length}`);
  console.log(`  Skill Files Checked:     ${result.details.skills.length}`);

  if (!result.ok) {
    console.error('\nFAIL — Context budget violations detected (BUDGET_EXCEEDED):');
    for (const v of result.violations) {
      console.error(`  [${v.code}] ${v.message}`);
    }
    process.exit(1);
  }

  console.log('\nok — All context budgets satisfy ShiftStone v2.1 ceilings.');
  process.exit(0);
}
