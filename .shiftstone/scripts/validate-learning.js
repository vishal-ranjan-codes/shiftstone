#!/usr/bin/env node
/**
 * Curated Learning Registry & Overlap Validator (UG-20 / Phase 5 Unit U20)
 *
 * Enforces:
 *   1. All learning records in docs/reports/learning/ adhere to learning-record/v1 schema.
 *   2. File naming parity: LR-YYYYMMDD-XXX.json matches learningId.
 *   3. All paths in evidencePaths[] exist on disk (MISSING_EVIDENCE_PATH).
 *   4. Jaccard token similarity deduplication: any two active records with
 *      similarity >= 0.70 are blocked (DUPLICATE_LEARNING_RECORD).
 *   5. When status === "promoted", promotedByProposalId is required and must match SYNC-YYYYMMDD-XXX.
 *
 * Supports --self-test flag. Exit code 0 on pass; exit code 1 on defect.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const LEARNING_ID_PATTERN = /^LR-[0-9]{8}-[0-9]{3}$/;
export const PROPOSAL_ID_PATTERN = /^SYNC-[0-9]{8}-[0-9]{3}$/;
export const VALID_CATEGORIES = new Set([
  'architecture',
  'security',
  'performance',
  'testing',
  'harness',
  'pack-domain',
]);
export const VALID_STATUSES = new Set(['candidate', 'validated', 'promoted', 'rejected']);
export const OVERLAP_THRESHOLD = 0.7;

/**
 * Tokenize text into a Set of lowercase alphanumeric terms (length >= 2).
 */
export function tokenizeText(text) {
  if (!text || typeof text !== 'string') return new Set();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  return new Set(tokens);
}

/**
 * Compute Jaccard similarity coefficient between two Sets.
 */
export function computeJaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 1000) / 1000;
}

/**
 * Extract tokens for overlap analysis from a record (summary + rootCause + lesson).
 */
export function extractRecordTokens(record) {
  const combined = [record.summary ?? '', record.rootCause ?? '', record.lesson ?? ''].join(' ');
  return tokenizeText(combined);
}

/**
 * Validates a single learning record object.
 */
export function validateLearningRecord(record, options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const violations = [];

  if (!record || typeof record !== 'object') {
    return {
      ok: false,
      violations: [{ code: 'INVALID_RECORD', message: 'Record must be a JSON object' }],
    };
  }

  // Schema version
  if (record.schemaVersion !== 'learning-record/v1') {
    violations.push({
      code: 'INVALID_SCHEMA_VERSION',
      message: `schemaVersion must be 'learning-record/v1', got '${record.schemaVersion}'`,
    });
  }

  // learningId
  if (!record.learningId || typeof record.learningId !== 'string' || !LEARNING_ID_PATTERN.test(record.learningId)) {
    violations.push({
      code: 'INVALID_LEARNING_ID',
      message: `learningId must match pattern ^LR-[0-9]{8}-[0-9]{3}$, got '${record.learningId}'`,
    });
  }

  // timestamp
  if (!record.timestamp || typeof record.timestamp !== 'string') {
    violations.push({
      code: 'INVALID_TIMESTAMP',
      message: 'timestamp is required and must be an ISO string',
    });
  }

  // status
  if (!record.status || !VALID_STATUSES.has(record.status)) {
    violations.push({
      code: 'INVALID_STATUS',
      message: `status must be one of [${[...VALID_STATUSES].join(', ')}], got '${record.status}'`,
    });
  }

  // category
  if (!record.category || !VALID_CATEGORIES.has(record.category)) {
    violations.push({
      code: 'INVALID_CATEGORY',
      message: `category must be one of [${[...VALID_CATEGORIES].join(', ')}], got '${record.category}'`,
    });
  }

  // pack
  if (!record.pack || typeof record.pack !== 'string' || record.pack.trim().length < 2) {
    violations.push({
      code: 'INVALID_PACK',
      message: 'pack must be a non-empty string (min 2 chars)',
    });
  }

  // summary, rootCause, lesson
  for (const field of ['summary', 'rootCause', 'lesson']) {
    if (!record[field] || typeof record[field] !== 'string' || record[field].trim().length < 5) {
      violations.push({
        code: `INVALID_${field.toUpperCase()}`,
        message: `${field} must be a non-empty string of at least 5 characters`,
      });
    }
  }

  // evidencePaths
  if (!Array.isArray(record.evidencePaths) || record.evidencePaths.length === 0) {
    violations.push({
      code: 'INVALID_EVIDENCE_PATHS',
      message: 'evidencePaths must be a non-empty array of file paths',
    });
  } else if (!options.skipDiskChecks) {
    for (const ep of record.evidencePaths) {
      if (typeof ep !== 'string' || ep.trim().length === 0) {
        violations.push({
          code: 'INVALID_EVIDENCE_PATH',
          message: `Empty or non-string evidence path in evidencePaths`,
        });
        continue;
      }
      const resolved = path.isAbsolute(ep) ? ep : path.resolve(root, ep);
      if (!existsSync(resolved)) {
        violations.push({
          code: 'MISSING_EVIDENCE_PATH',
          path: ep,
          message: `Declared evidencePath does not exist on disk: ${ep}`,
        });
      }
    }
  }

  // promotionTargets
  if (!Array.isArray(record.promotionTargets)) {
    violations.push({
      code: 'INVALID_PROMOTION_TARGETS',
      message: 'promotionTargets must be an array of target paths',
    });
  }

  // promoted status requirement
  if (record.status === 'promoted') {
    if (!record.promotedByProposalId || typeof record.promotedByProposalId !== 'string' || !PROPOSAL_ID_PATTERN.test(record.promotedByProposalId)) {
      violations.push({
        code: 'MISSING_PROPOSAL_ID',
        message: `Records with status 'promoted' require promotedByProposalId matching ^SYNC-[0-9]{8}-[0-9]{3}$`,
      });
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

/**
 * Validates a collection of learning records, checking schema, evidence paths, and Jaccard overlap.
 */
export function validateLearningRegistry(recordsWithMeta, options = {}) {
  const violations = [];
  const records = [];

  for (const item of recordsWithMeta) {
    const record = item.record;
    const filePath = item.filePath || item.file || 'unknown';

    // File name vs learningId parity
    if (filePath !== 'unknown') {
      const baseName = path.basename(filePath, '.json');
      if (record.learningId && baseName !== record.learningId) {
        violations.push({
          code: 'FILENAME_ID_MISMATCH',
          file: filePath,
          message: `Filename '${baseName}.json' does not match learningId '${record.learningId}'`,
        });
      }
    }

    const singleRes = validateLearningRecord(record, options);
    if (!singleRes.ok) {
      for (const v of singleRes.violations) {
        violations.push({ ...v, file: filePath });
      }
    } else {
      records.push({ record, filePath, tokens: extractRecordTokens(record) });
    }
  }

  // Jaccard similarity check between all non-rejected records
  const activeRecords = records.filter((r) => r.record.status !== 'rejected');
  for (let i = 0; i < activeRecords.length; i++) {
    for (let j = i + 1; j < activeRecords.length; j++) {
      const a = activeRecords[i];
      const b = activeRecords[j];
      const similarity = computeJaccardSimilarity(a.tokens, b.tokens);

      if (similarity >= OVERLAP_THRESHOLD) {
        violations.push({
          code: 'DUPLICATE_LEARNING_RECORD',
          fileA: a.filePath,
          fileB: b.filePath,
          idA: a.record.learningId,
          idB: b.record.learningId,
          similarity,
          message: `Records '${a.record.learningId}' and '${b.record.learningId}' share ${Math.round(similarity * 100)}% token similarity (>= ${Math.round(OVERLAP_THRESHOLD * 100)}% ceiling)`,
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    totalRecords: recordsWithMeta.length,
    activeRecords: activeRecords.length,
    violations,
  };
}

/**
 * Self-test suite verifying positive validation and negative rejections.
 */
export function runLearningSelfTest(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const results = [];

  const validRecord = {
    schemaVersion: 'learning-record/v1',
    learningId: 'LR-20261021-001',
    timestamp: '2026-10-21T12:00:00.000Z',
    status: 'validated',
    category: 'architecture',
    pack: 'rr8-supabase-cf',
    summary: 'Cloudflare Workers isolated execution requires avoiding Node fs modules in runtime code',
    rootCause: 'Attempted to use node fs directly inside worker request handler path instead of R2 storage',
    lesson: 'Use S3 R2 client or KV bindings for runtime worker persistence; isolate Node fs to build scripts',
    evidencePaths: ['package.json'],
    promotionTargets: ['docs/bible/04-STORAGE-ARCHITECTURE.md'],
  };

  // 1. Positive: valid record passes
  const posRes = validateLearningRecord(validRecord, { root });
  results.push({
    scenario: 'valid record passes cleanly',
    pass: posRes.ok && posRes.violations.length === 0,
  });

  // 2. Negative: missing evidence path rejected
  const missingEv = {
    ...validRecord,
    learningId: 'LR-20261021-002',
    evidencePaths: ['non-existent-file-xyz-12345.ts'],
  };
  const negEvRes = validateLearningRecord(missingEv, { root });
  results.push({
    scenario: 'missing evidence path rejected',
    pass: !negEvRes.ok && negEvRes.violations.some((v) => v.code === 'MISSING_EVIDENCE_PATH'),
  });

  // 3. Negative: promoted status without promotedByProposalId rejected
  const promotedNoProposal = {
    ...validRecord,
    learningId: 'LR-20261021-003',
    status: 'promoted',
  };
  const negPromotedRes = validateLearningRecord(promotedNoProposal, { root });
  results.push({
    scenario: 'promoted record without proposal ID rejected',
    pass: !negPromotedRes.ok && negPromotedRes.violations.some((v) => v.code === 'MISSING_PROPOSAL_ID'),
  });

  // 4. Negative: Jaccard overlap >= 0.70 rejected
  const duplicateRecord = {
    ...validRecord,
    learningId: 'LR-20261021-004',
    summary: 'Cloudflare Workers isolated execution requires avoiding Node fs modules in runtime code completely',
    rootCause: 'Attempted to use node fs directly inside worker request handler path instead of R2 storage',
    lesson: 'Use S3 R2 client or KV bindings for runtime worker persistence; isolate Node fs to build scripts always',
  };
  const dupRegistryRes = validateLearningRegistry(
    [
      { record: validRecord, filePath: 'LR-20261021-001.json' },
      { record: duplicateRecord, filePath: 'LR-20261021-004.json' },
    ],
    { root, skipDiskChecks: true }
  );
  results.push({
    scenario: 'Jaccard overlap >= 0.70 triggers DUPLICATE_LEARNING_RECORD',
    pass: !dupRegistryRes.ok && dupRegistryRes.violations.some((v) => v.code === 'DUPLICATE_LEARNING_RECORD'),
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
    console.log('Running validate-learning self-test...');
    const selfTest = runLearningSelfTest();
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

  const dirArg = args.find((a) => !a.startsWith('--')) || path.join(ROOT, 'docs', 'reports', 'learning');
  const targetDir = path.isAbsolute(dirArg) ? dirArg : path.resolve(ROOT, dirArg);

  if (!existsSync(targetDir)) {
    console.log(`No learning directory found at ${targetDir}. Nothing to validate.`);
    process.exit(0);
  }

  const files = readdirSync(targetDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(targetDir, f));

  if (files.length === 0) {
    console.log(`Validated 0 learning records in ${targetDir} (clean).`);
    process.exit(0);
  }

  const recordsWithMeta = [];
  for (const f of files) {
    try {
      const content = readFileSync(f, 'utf8');
      const parsed = JSON.parse(content);
      recordsWithMeta.push({ record: parsed, filePath: f });
    } catch (err) {
      console.error(`ERROR: Failed to parse ${f}: ${err.message}`);
      process.exit(1);
    }
  }

  const result = validateLearningRegistry(recordsWithMeta, { root: ROOT });
  if (!result.ok) {
    console.error(`FAIL: Found ${result.violations.length} violation(s) in learning registry:`);
    for (const v of result.violations) {
      console.error(`  - [${v.code}] ${v.message}`);
    }
    process.exit(1);
  }

  console.log(`PASS: Validated ${result.totalRecords} learning record(s) with zero violations.`);
  process.exit(0);
}
