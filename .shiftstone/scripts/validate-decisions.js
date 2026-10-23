#!/usr/bin/env node
/**
 * Architecture Decision Record (ADR) & Open-Question Validator (UG-21 / LOCK-02 / Phase 5 Unit U22)
 *
 * Enforces:
 *   1. Every file in docs/decisions/DEC-*.md carries valid OKF frontmatter:
 *      type: "decision", decisionId: DEC-XXX, title, status, pack, timestamp.
 *   2. File naming parity: DEC-XXX-<slug>.md matches decisionId.
 *   3. When status === "superseded", supersededBy: DEC-XXX is mandatory and
 *      the target decision file must exist on disk (MISSING_SUPERSEDED_BY / MISSING_SUPERSEDED_TARGET).
 *   4. Every file in docs/open-questions/OQ-*.md carries valid OKF frontmatter:
 *      type: "open-question", questionId: OQ-XXX, title, status, timestamp.
 *   5. When open question status === "decided", resolvedBy: DEC-XXX is mandatory and
 *      the target decision must exist on disk (MISSING_RESOLVED_BY / MISSING_RESOLVED_TARGET).
 *   6. Unique IDs across all decisions and open questions.
 *
 * Supports --self-test flag. Exit code 0 on pass; exit code 1 on defect.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const DECISION_ID_PATTERN = /^DEC-[0-9]{3,}$/;
export const QUESTION_ID_PATTERN = /^OQ-[0-9]{3,}$/;
export const VALID_DECISION_STATUSES = new Set(['proposed', 'accepted', 'superseded', 'deprecated', 'rejected']);
export const VALID_QUESTION_STATUSES = new Set(['open', 'under-review', 'decided', 'parked', 'withdrawn']);

/**
 * Extracts YAML frontmatter from markdown text.
 */
export function extractFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) return { hasFrontmatter: false, data: null };
  try {
    const data = parseYaml(match[1]);
    return { hasFrontmatter: true, data: data ?? null };
  } catch (err) {
    return { hasFrontmatter: true, data: null, parseError: err.message };
  }
}

/**
 * Validates a single decision data object.
 */
export function validateDecisionData(data, filePath, existingDecisionIds = new Set(), options = {}) {
  const violations = [];
  const root = options.root ? path.resolve(options.root) : ROOT;

  if (!data || typeof data !== 'object') {
    violations.push({
      code: 'INVALID_FRONTMATTER',
      file: filePath,
      message: 'Decision file must contain valid YAML frontmatter',
    });
    return violations;
  }

  // type
  if (data.type !== 'decision') {
    violations.push({
      code: 'INVALID_TYPE',
      file: filePath,
      message: `type must be 'decision', got '${data.type}'`,
    });
  }

  // decisionId
  if (!data.decisionId || typeof data.decisionId !== 'string' || !DECISION_ID_PATTERN.test(data.decisionId)) {
    violations.push({
      code: 'INVALID_DECISION_ID',
      file: filePath,
      message: `decisionId must match pattern ^DEC-[0-9]{3,}$, got '${data.decisionId}'`,
    });
  } else {
    // Check filename prefix
    const base = path.basename(filePath);
    if (!base.startsWith(`${data.decisionId}-`) && base !== `${data.decisionId}.md`) {
      violations.push({
        code: 'FILENAME_ID_MISMATCH',
        file: filePath,
        message: `Filename '${base}' does not start with '${data.decisionId}-'`,
      });
    }
  }

  // title
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    violations.push({
      code: 'INVALID_TITLE',
      file: filePath,
      message: 'title is required and must be a non-empty string',
    });
  }

  // status
  if (!data.status || !VALID_DECISION_STATUSES.has(data.status)) {
    violations.push({
      code: 'INVALID_STATUS',
      file: filePath,
      message: `status must be one of [${[...VALID_DECISION_STATUSES].join(', ')}], got '${data.status}'`,
    });
  }

  // pack
  if (!data.pack || typeof data.pack !== 'string') {
    violations.push({
      code: 'INVALID_PACK',
      file: filePath,
      message: 'pack is required and must be a non-empty string',
    });
  }

  // timestamp
  if (!data.timestamp || typeof data.timestamp !== 'string') {
    violations.push({
      code: 'INVALID_TIMESTAMP',
      file: filePath,
      message: 'timestamp is required and must be an ISO string',
    });
  }

  // supersededBy check
  if (data.status === 'superseded') {
    if (!data.supersededBy || typeof data.supersededBy !== 'string') {
      violations.push({
        code: 'MISSING_SUPERSEDED_BY',
        file: filePath,
        message: `Decision with status 'superseded' requires 'supersededBy: DEC-XXX'`,
      });
    } else if (!DECISION_ID_PATTERN.test(data.supersededBy)) {
      violations.push({
        code: 'INVALID_SUPERSEDED_BY',
        file: filePath,
        message: `supersededBy must match ^DEC-[0-9]{3,}$, got '${data.supersededBy}'`,
      });
    } else if (existingDecisionIds.size > 0 && !existingDecisionIds.has(data.supersededBy)) {
      violations.push({
        code: 'MISSING_SUPERSEDED_TARGET',
        file: filePath,
        target: data.supersededBy,
        message: `Target decision '${data.supersededBy}' referenced in supersededBy does not exist on disk`,
      });
    }
  }

  return violations;
}

/**
 * Validates a single open-question data object.
 */
export function validateQuestionData(data, filePath, existingDecisionIds = new Set()) {
  const violations = [];

  if (!data || typeof data !== 'object') {
    violations.push({
      code: 'INVALID_FRONTMATTER',
      file: filePath,
      message: 'Open-question file must contain valid YAML frontmatter',
    });
    return violations;
  }

  if (data.type !== 'open-question') {
    violations.push({
      code: 'INVALID_TYPE',
      file: filePath,
      message: `type must be 'open-question', got '${data.type}'`,
    });
  }

  if (!data.questionId || typeof data.questionId !== 'string' || !QUESTION_ID_PATTERN.test(data.questionId)) {
    violations.push({
      code: 'INVALID_QUESTION_ID',
      file: filePath,
      message: `questionId must match pattern ^OQ-[0-9]{3,}$, got '${data.questionId}'`,
    });
  } else {
    const base = path.basename(filePath);
    if (!base.startsWith(`${data.questionId}-`) && base !== `${data.questionId}.md`) {
      violations.push({
        code: 'FILENAME_ID_MISMATCH',
        file: filePath,
        message: `Filename '${base}' does not start with '${data.questionId}-'`,
      });
    }
  }

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    violations.push({
      code: 'INVALID_TITLE',
      file: filePath,
      message: 'title is required and must be a non-empty string',
    });
  }

  if (!data.status || !VALID_QUESTION_STATUSES.has(data.status)) {
    violations.push({
      code: 'INVALID_STATUS',
      file: filePath,
      message: `status must be one of [${[...VALID_QUESTION_STATUSES].join(', ')}], got '${data.status}'`,
    });
  }

  if (data.status === 'decided') {
    if (!data.resolvedBy || typeof data.resolvedBy !== 'string') {
      violations.push({
        code: 'MISSING_RESOLVED_BY',
        file: filePath,
        message: `Open question with status 'decided' requires 'resolvedBy: DEC-XXX'`,
      });
    } else if (!DECISION_ID_PATTERN.test(data.resolvedBy)) {
      violations.push({
        code: 'INVALID_RESOLVED_BY',
        file: filePath,
        message: `resolvedBy must match ^DEC-[0-9]{3,}$, got '${data.resolvedBy}'`,
      });
    } else if (existingDecisionIds.size > 0 && !existingDecisionIds.has(data.resolvedBy)) {
      violations.push({
        code: 'MISSING_RESOLVED_TARGET',
        file: filePath,
        target: data.resolvedBy,
        message: `Target decision '${data.resolvedBy}' referenced in resolvedBy does not exist on disk`,
      });
    }
  }

  return violations;
}

/**
 * Validates all decisions in docs/decisions/ and open questions in docs/open-questions/.
 */
export function validateDecisions(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const decisionsDir = path.join(root, 'docs', 'decisions');
  const questionsDir = path.join(root, 'docs', 'open-questions');

  const violations = [];
  const decisionIds = new Set();
  const questionIds = new Set();
  const decisionEntries = [];
  const questionEntries = [];

  // 1. Scan and collect decisions
  if (!existsSync(decisionsDir)) {
    violations.push({
      code: 'MISSING_DECISIONS_DIR',
      file: 'docs/decisions',
      message: 'Directory docs/decisions does not exist on disk',
    });
  } else {
    const files = readdirSync(decisionsDir)
      .filter((f) => f.startsWith('DEC-') && f.endsWith('.md'))
      .map((f) => path.join(decisionsDir, f));

    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      const { hasFrontmatter, data, parseError } = extractFrontmatter(content);
      if (!hasFrontmatter || parseError) {
        violations.push({
          code: 'INVALID_FRONTMATTER',
          file: f,
          message: parseError || 'Missing YAML frontmatter delimiters (---)',
        });
      } else {
        if (data?.decisionId) {
          if (decisionIds.has(data.decisionId)) {
            violations.push({
              code: 'DUPLICATE_DECISION_ID',
              file: f,
              message: `Duplicate decisionId '${data.decisionId}' detected`,
            });
          }
          decisionIds.add(data.decisionId);
        }
        decisionEntries.push({ data, file: f });
      }
    }
  }

  // 2. Scan and collect open questions
  if (existsSync(questionsDir)) {
    const files = readdirSync(questionsDir)
      .filter((f) => f.startsWith('OQ-') && f.endsWith('.md'))
      .map((f) => path.join(questionsDir, f));

    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      const { hasFrontmatter, data, parseError } = extractFrontmatter(content);
      if (!hasFrontmatter || parseError) {
        violations.push({
          code: 'INVALID_FRONTMATTER',
          file: f,
          message: parseError || 'Missing YAML frontmatter delimiters (---)',
        });
      } else {
        if (data?.questionId) {
          if (questionIds.has(data.questionId)) {
            violations.push({
              code: 'DUPLICATE_QUESTION_ID',
              file: f,
              message: `Duplicate questionId '${data.questionId}' detected`,
            });
          }
          questionIds.add(data.questionId);
        }
        questionEntries.push({ data, file: f });
      }
    }
  }

  // 3. Validate each decision data
  for (const entry of decisionEntries) {
    const errs = validateDecisionData(entry.data, entry.file, decisionIds, options);
    violations.push(...errs);
  }

  // 4. Validate each open question data
  for (const entry of questionEntries) {
    const errs = validateQuestionData(entry.data, entry.file, decisionIds);
    violations.push(...errs);
  }

  return {
    ok: violations.length === 0,
    totalDecisions: decisionEntries.length,
    totalOpenQuestions: questionEntries.length,
    violations,
  };
}

/**
 * Self-test suite verifying positive and negative validation behaviors.
 */
export function runDecisionsSelfTest(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const results = [];

  // 1. Positive: valid decision passes
  const validData = {
    type: 'decision',
    decisionId: 'DEC-100',
    title: 'Test Decision',
    status: 'accepted',
    pack: 'core',
    timestamp: '2026-10-21T00:00:00.000Z',
  };
  const posErrs = validateDecisionData(validData, 'docs/decisions/DEC-100-test.md', new Set(['DEC-100']));
  results.push({
    scenario: 'valid decision frontmatter passes cleanly',
    pass: posErrs.length === 0,
  });

  // 2. Negative: superseded without supersededBy
  const supersededNoTarget = {
    ...validData,
    decisionId: 'DEC-101',
    status: 'superseded',
  };
  const noTargetErrs = validateDecisionData(supersededNoTarget, 'docs/decisions/DEC-101-test.md', new Set(['DEC-101']));
  results.push({
    scenario: 'superseded decision without supersededBy fails with MISSING_SUPERSEDED_BY',
    pass: noTargetErrs.some((e) => e.code === 'MISSING_SUPERSEDED_BY'),
  });

  // 3. Negative: superseded with non-existent target
  const supersededBadTarget = {
    ...validData,
    decisionId: 'DEC-102',
    status: 'superseded',
    supersededBy: 'DEC-999',
  };
  const badTargetErrs = validateDecisionData(
    supersededBadTarget,
    'docs/decisions/DEC-102-test.md',
    new Set(['DEC-100', 'DEC-102'])
  );
  results.push({
    scenario: 'superseded decision with non-existent target fails with MISSING_SUPERSEDED_TARGET',
    pass: badTargetErrs.some((e) => e.code === 'MISSING_SUPERSEDED_TARGET'),
  });

  // 4. Positive: open question resolvedBy valid target passes
  const decidedQuestion = {
    type: 'open-question',
    questionId: 'OQ-100',
    title: 'Test Question',
    status: 'decided',
    resolvedBy: 'DEC-100',
    timestamp: '2026-10-21T00:00:00.000Z',
  };
  const qErrs = validateQuestionData(decidedQuestion, 'docs/open-questions/OQ-100-test.md', new Set(['DEC-100']));
  results.push({
    scenario: 'decided open-question with valid resolvedBy passes cleanly',
    pass: qErrs.length === 0,
  });

  const allPassed = results.every((r) => r.pass);
  return {
    ok: allPassed,
    results,
  };
}

// CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);

  if (args.includes('--self-test')) {
    console.log('Running validate-decisions self-test...');
    const selfTest = runDecisionsSelfTest();
    for (const r of selfTest.results) {
      console.log(`  ${r.pass ? 'PASS' : 'FAIL'}: ${r.scenario}`);
    }
    if (!selfTest.ok) {
      console.error('Self-test failed!');
      process.exit(1);
    }
    console.log('Self-test passed cleanly.');
    process.exit(0);
  }

  const result = validateDecisions({ root: ROOT });
  if (!result.ok) {
    console.error(`FAIL: Found ${result.violations.length} violation(s) in decisions / open-questions:`);
    for (const v of result.violations) {
      console.error(`  - [${v.code}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log(`PASS: Validated ${result.totalDecisions} decision(s) and ${result.totalOpenQuestions} open question(s) with zero violations.`);
  process.exit(0);
}
