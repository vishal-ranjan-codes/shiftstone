#!/usr/bin/env node
/**
 * Stage Contract Validator, Anti-Placeholder & Superseded-Input Blocker (UG-07, UG-09 / Phase 2 Unit U7)
 *
 * Verifies:
 *   1. CONTEXT.md stage contracts adhere strictly to stage-contract.schema.json (stage-contract/v1)
 *   2. Every inputs[].path resolves to an existing file on disk (MISSING_INPUT_PATH)
 *   3. No input file has status: superseded | deprecated | rejected | withdrawn (SUPERSEDED_INPUT_BLOCKED)
 *   4. No lazy placeholders (TBD, TODO, implement later, similar to Unit) exist (PLACEHOLDER_DETECTED)
 *   5. No machine-absolute paths (C:\, /Users/) appear in file references (ABSOLUTE_PATH_DETECTED)
 *   6. undeclaredInputPolicy === "amend-and-reload"
 *
 * Exit code 0 on clean pass; exit code 1 on defect.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const PLACEHOLDER_PATTERNS = [
  { pattern: /\bTODO\b/i, name: 'TODO' },
  { pattern: /\bTBD\b/i, name: 'TBD' },
  { pattern: /implement\s+later/i, name: 'implement later' },
  { pattern: /similar\s+to\s+unit/i, name: 'similar to Unit' },
];

const ABSOLUTE_PATH_PATTERNS = [
  /[a-zA-Z]:[\\\/]/,
  /(?:^|["'\s(])\/(?:Users|home|root)\//,
];

const BLOCKED_STATUSES = new Set(['superseded', 'deprecated', 'rejected', 'withdrawn']);

const STAGE_ID_PATTERN = /^STAGE-[0-9]{2}(-[a-z0-9-]+)?$/;
const EXIT_CRITERIA_ID_PATTERN = /^EC-[0-9]{2}$/;
const VALID_ROLES = new Set(['ssot-bible', 'decision', 'research', 'prior-stage-output', 'skill', 'schema']);
const VALID_REQUIRED_STATUSES = new Set(['active', 'accepted', 'completed']);
const VALID_ARTIFACT_TYPES = new Set(['code', 'schema', 'test', 'doc', 'report', 'migration']);
const VALID_VERIFICATION_LEVELS = new Set(['L1', 'L1.5', 'L2', 'L3', 'L4', 'L5']);
const VALID_STATUSES = new Set(['planned', 'in-progress', 'completed', 'blocked', 'superseded']);

export function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return parseYaml(match[1]);
  } catch (err) {
    throw new Error(`YAML frontmatter parse error: ${err.message}`);
  }
}

export function validateStageContractContent(content, filePath, options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const violations = [];
  const relPath = path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath;

  // 1. Anti-Placeholder Detection
  for (const { pattern, name } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(content)) {
      violations.push({
        code: 'PLACEHOLDER_DETECTED',
        file: relPath,
        placeholder: name,
        message: `Contract contains lazy placeholder '${name}' in ${relPath}`,
      });
    }
  }

  // 2. Machine-Absolute Path Detection
  for (const pattern of ABSOLUTE_PATH_PATTERNS) {
    if (pattern.test(content)) {
      violations.push({
        code: 'ABSOLUTE_PATH_DETECTED',
        file: relPath,
        message: `Contract contains machine-absolute path reference in ${relPath}`,
      });
      break;
    }
  }

  // 3. Frontmatter & Schema Validation
  let frontmatter;
  try {
    frontmatter = extractFrontmatter(content);
  } catch (err) {
    violations.push({
      code: 'INVALID_STAGE_CONTRACT_YAML',
      file: relPath,
      message: err.message,
    });
    return { ok: false, violations };
  }

  if (!frontmatter) {
    violations.push({
      code: 'MISSING_STAGE_CONTRACT_FRONTMATTER',
      file: relPath,
      message: `No YAML frontmatter found in stage contract ${relPath}`,
    });
    return { ok: false, violations };
  }

  // Schema properties
  if (frontmatter.schemaVersion !== 'stage-contract/v1') {
    violations.push({
      code: 'INVALID_SCHEMA_VERSION',
      file: relPath,
      message: `schemaVersion must be 'stage-contract/v1' (got '${frontmatter.schemaVersion}')`,
    });
  }

  if (frontmatter.type !== 'stage-contract') {
    violations.push({
      code: 'INVALID_STAGE_TYPE',
      file: relPath,
      message: `type must be 'stage-contract' (got '${frontmatter.type}')`,
    });
  }

  if (!frontmatter.stageId || !STAGE_ID_PATTERN.test(frontmatter.stageId)) {
    violations.push({
      code: 'INVALID_STAGE_ID',
      file: relPath,
      message: `stageId must match pattern ^STAGE-[0-9]{2}(-[a-z0-9-]+)?$ (got '${frontmatter.stageId}')`,
    });
  }

  if (!frontmatter.planId || typeof frontmatter.planId !== 'string' || frontmatter.planId.length < 3) {
    violations.push({
      code: 'INVALID_PLAN_ID',
      file: relPath,
      message: `planId must be a string with length >= 3`,
    });
  }

  if (!frontmatter.title || typeof frontmatter.title !== 'string' || frontmatter.title.length < 5) {
    violations.push({
      code: 'INVALID_TITLE',
      file: relPath,
      message: `title must be a string with length >= 5`,
    });
  }

  if (!frontmatter.status || !VALID_STATUSES.has(frontmatter.status)) {
    violations.push({
      code: 'INVALID_STATUS',
      file: relPath,
      message: `status must be one of planned, in-progress, completed, blocked, superseded`,
    });
  }

  if (frontmatter.undeclaredInputPolicy !== 'amend-and-reload') {
    violations.push({
      code: 'UNDECLARED_INPUT_POLICY_INVALID',
      file: relPath,
      message: `undeclaredInputPolicy must be 'amend-and-reload' (got '${frontmatter.undeclaredInputPolicy}')`,
    });
  }

  // 4. Inputs Validation
  if (!Array.isArray(frontmatter.inputs) || frontmatter.inputs.length === 0) {
    violations.push({
      code: 'EMPTY_INPUTS',
      file: relPath,
      message: `inputs must be a non-empty array`,
    });
  } else {
    for (let i = 0; i < frontmatter.inputs.length; i++) {
      const inp = frontmatter.inputs[i];
      if (!inp || typeof inp !== 'object') {
        violations.push({
          code: 'INVALID_INPUT_ENTRY',
          file: relPath,
          message: `inputs[${i}] must be an object`,
        });
        continue;
      }

      if (!inp.path || typeof inp.path !== 'string') {
        violations.push({
          code: 'INVALID_INPUT_PATH',
          file: relPath,
          message: `inputs[${i}].path is required and must be a string`,
        });
        continue;
      }

      if (!inp.role || !VALID_ROLES.has(inp.role)) {
        violations.push({
          code: 'INVALID_INPUT_ROLE',
          file: relPath,
          message: `inputs[${i}].role '${inp.role}' must be one of ${Array.from(VALID_ROLES).join(', ')}`,
        });
      }

      if (!inp.requiredStatus || !VALID_REQUIRED_STATUSES.has(inp.requiredStatus)) {
        violations.push({
          code: 'INVALID_INPUT_REQUIRED_STATUS',
          file: relPath,
          message: `inputs[${i}].requiredStatus '${inp.requiredStatus}' must be one of ${Array.from(VALID_REQUIRED_STATUSES).join(', ')}`,
        });
      }

      // Check input on disk
      const inputAbs = path.isAbsolute(inp.path) ? inp.path : path.join(root, inp.path);
      if (!existsSync(inputAbs)) {
        violations.push({
          code: 'MISSING_INPUT_PATH',
          file: relPath,
          inputPath: inp.path,
          message: `Declared input path '${inp.path}' does not exist on disk`,
        });
      } else {
        // Check input's frontmatter status
        try {
          const inputContent = readFileSync(inputAbs, 'utf8');
          const inputFm = extractFrontmatter(inputContent);
          if (inputFm && inputFm.status) {
            const inputStatus = String(inputFm.status).toLowerCase();
            if (BLOCKED_STATUSES.has(inputStatus)) {
              violations.push({
                code: 'SUPERSEDED_INPUT_BLOCKED',
                file: relPath,
                inputPath: inp.path,
                inputStatus,
                message: `Input '${inp.path}' has status '${inputStatus}' which is blocked from consumption`,
              });
            }
          }
        } catch {
          // If input file is binary or unreadable as utf8, ignore frontmatter parse error
        }
      }
    }
  }

  // 5. Outputs Validation
  if (!Array.isArray(frontmatter.outputs) || frontmatter.outputs.length === 0) {
    violations.push({
      code: 'EMPTY_OUTPUTS',
      file: relPath,
      message: `outputs must be a non-empty array`,
    });
  } else {
    for (let i = 0; i < frontmatter.outputs.length; i++) {
      const out = frontmatter.outputs[i];
      if (!out || typeof out !== 'object') {
        violations.push({
          code: 'INVALID_OUTPUT_ENTRY',
          file: relPath,
          message: `outputs[${i}] must be an object`,
        });
        continue;
      }
      if (!out.path || typeof out.path !== 'string') {
        violations.push({
          code: 'INVALID_OUTPUT_PATH',
          file: relPath,
          message: `outputs[${i}].path is required and must be a string`,
        });
      }
      if (!out.artifactType || !VALID_ARTIFACT_TYPES.has(out.artifactType)) {
        violations.push({
          code: 'INVALID_OUTPUT_ARTIFACT_TYPE',
          file: relPath,
          message: `outputs[${i}].artifactType '${out.artifactType}' must be one of ${Array.from(VALID_ARTIFACT_TYPES).join(', ')}`,
        });
      }
    }
  }

  // 6. Verification Levels
  if (!Array.isArray(frontmatter.verificationLevels) || frontmatter.verificationLevels.length === 0) {
    violations.push({
      code: 'EMPTY_VERIFICATION_LEVELS',
      file: relPath,
      message: `verificationLevels must be a non-empty array`,
    });
  } else {
    for (const lvl of frontmatter.verificationLevels) {
      if (!VALID_VERIFICATION_LEVELS.has(lvl)) {
        violations.push({
          code: 'INVALID_VERIFICATION_LEVEL',
          file: relPath,
          level: lvl,
          message: `verificationLevel '${lvl}' is not a valid level (${Array.from(VALID_VERIFICATION_LEVELS).join(', ')})`,
        });
      }
    }
  }

  // 7. Exit Criteria
  if (!Array.isArray(frontmatter.exitCriteria) || frontmatter.exitCriteria.length === 0) {
    violations.push({
      code: 'EMPTY_EXIT_CRITERIA',
      file: relPath,
      message: `exitCriteria must be a non-empty array`,
    });
  } else {
    for (let i = 0; i < frontmatter.exitCriteria.length; i++) {
      const ec = frontmatter.exitCriteria[i];
      if (!ec || typeof ec !== 'object') {
        violations.push({
          code: 'INVALID_EXIT_CRITERIA_ENTRY',
          file: relPath,
          message: `exitCriteria[${i}] must be an object`,
        });
        continue;
      }
      if (!ec.id || !EXIT_CRITERIA_ID_PATTERN.test(ec.id)) {
        violations.push({
          code: 'INVALID_EXIT_CRITERIA_ID',
          file: relPath,
          message: `exitCriteria[${i}].id must match ^EC-[0-9]{2}$ (got '${ec.id}')`,
        });
      }
      if (!ec.level || !VALID_VERIFICATION_LEVELS.has(ec.level)) {
        violations.push({
          code: 'INVALID_EXIT_CRITERIA_LEVEL',
          file: relPath,
          message: `exitCriteria[${i}].level '${ec.level}' must be a valid level`,
        });
      }
      if (!ec.command || typeof ec.command !== 'string' || ec.command.length < 2) {
        violations.push({
          code: 'INVALID_EXIT_CRITERIA_COMMAND',
          file: relPath,
          message: `exitCriteria[${i}].command is required and must have length >= 2`,
        });
      }
      if (!ec.expected || typeof ec.expected !== 'string' || ec.expected.length < 2) {
        violations.push({
          code: 'INVALID_EXIT_CRITERIA_EXPECTED',
          file: relPath,
          message: `exitCriteria[${i}].expected is required and must have length >= 2`,
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    frontmatter,
  };
}

export function validateStageContractFile(filePath, options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  if (!existsSync(absPath)) {
    return {
      ok: false,
      violations: [{
        code: 'MISSING_CONTRACT_FILE',
        file: filePath,
        message: `Stage contract file does not exist: ${filePath}`,
      }],
    };
  }

  const content = readFileSync(absPath, 'utf8');
  return validateStageContractContent(content, absPath, options);
}

function findContextMdFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  function walk(current) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === 'CONTEXT.md') {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

export function validateStageContracts(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const violations = [];
  let contractsChecked = 0;

  const templateOnly = Boolean(options.templateCheck);

  if (templateOnly || options.checkTemplate !== false) {
    const templatePath = path.join(root, 'core', 'governance', 'stage-contract-template.md');
    if (existsSync(templatePath)) {
      contractsChecked++;
      const res = validateStageContractFile(templatePath, { root });
      violations.push(...res.violations);
    }
  }

  if (!templateOnly) {
    // Scan docs/plans for CONTEXT.md
    const plansDir = path.join(root, 'docs', 'plans');
    const contextFiles = findContextMdFiles(plansDir);
    for (const cPath of contextFiles) {
      contractsChecked++;
      const res = validateStageContractFile(cPath, { root });
      violations.push(...res.violations);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    contractsChecked,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let rootArg = ROOT;
  const rootIdx = process.argv.indexOf('--root');
  if (rootIdx !== -1 && process.argv[rootIdx + 1]) {
    rootArg = process.argv[rootIdx + 1];
  }

  const isTemplateCheck = process.argv.includes('--template-check');
  const fileArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--') && (rootIdx === -1 || arg !== process.argv[rootIdx + 1]));

  let result;
  if (fileArgs.length > 0) {
    const violations = [];
    let checked = 0;
    for (const f of fileArgs) {
      checked++;
      const r = validateStageContractFile(f, { root: rootArg });
      violations.push(...r.violations);
    }
    result = { ok: violations.length === 0, violations, contractsChecked: checked };
  } else {
    result = validateStageContracts({ root: rootArg, templateCheck: isTemplateCheck });
  }

  console.log('=== ICM Stage Contract Validation Report (UG-07, UG-09) ===');
  console.log(`  Contracts Checked: ${result.contractsChecked}`);
  console.log(`  Status:            ${result.ok ? 'valid' : 'invalid'}`);

  if (!result.ok) {
    console.error(`\nFAIL — ${result.violations.length} stage contract violation(s) detected:`);
    for (const v of result.violations) {
      console.error(`  [${v.code}] ${v.message}`);
    }
    process.exit(1);
  }

  console.log('\nok — All stage contracts satisfy stage-contract/v1, input hygiene, and anti-placeholder laws.');
  process.exit(0);
}
