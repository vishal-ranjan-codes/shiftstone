import { describe, expect, it } from 'vitest';
import {
  computeJaccardSimilarity,
  extractRecordTokens,
  runLearningSelfTest,
  tokenizeText,
  validateLearningRecord,
  validateLearningRegistry,
} from '../validate-learning.js';

const VALID_RECORD = {
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

describe('Unit U20: validate-learning (UG-20)', () => {
  it('passes a well-formed learning record cleanly', () => {
    const res = validateLearningRecord(VALID_RECORD);
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('TS-U20-01 (L1): self-test passes cleanly', () => {
    const selfTest = runLearningSelfTest();
    expect(selfTest.ok).toBe(true);
    expect(selfTest.results.every((r) => r.pass)).toBe(true);
  });

  it('TS-U20-02 (L2): rejects non-existent evidencePath with MISSING_EVIDENCE_PATH', () => {
    const recordWithMissingPath = {
      ...VALID_RECORD,
      learningId: 'LR-20261021-002',
      evidencePaths: ['does/not/exist/file-123456.ts'],
    };
    const res = validateLearningRecord(recordWithMissingPath);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'MISSING_EVIDENCE_PATH')).toBe(true);
  });

  it('TS-U20-02 (L2): rejects duplicate learning records with >= 0.70 Jaccard overlap (DUPLICATE_LEARNING_RECORD)', () => {
    const nearDuplicate = {
      ...VALID_RECORD,
      learningId: 'LR-20261021-003',
      summary: 'Cloudflare Workers isolated execution requires avoiding Node fs modules in runtime code strictly',
      rootCause: 'Attempted to use node fs directly inside worker request handler path instead of R2 storage',
      lesson: 'Use S3 R2 client or KV bindings for runtime worker persistence; isolate Node fs to build scripts properly',
    };

    const tokensA = extractRecordTokens(VALID_RECORD);
    const tokensB = extractRecordTokens(nearDuplicate);
    const sim = computeJaccardSimilarity(tokensA, tokensB);
    expect(sim).toBeGreaterThanOrEqual(0.7);

    const registryRes = validateLearningRegistry(
      [
        { record: VALID_RECORD, filePath: 'LR-20261021-001.json' },
        { record: nearDuplicate, filePath: 'LR-20261021-003.json' },
      ],
      { skipDiskChecks: true }
    );

    expect(registryRes.ok).toBe(false);
    expect(registryRes.violations.some((v) => v.code === 'DUPLICATE_LEARNING_RECORD')).toBe(true);
  });

  it('allows distinct learning records with low overlap (< 0.70 Jaccard similarity)', () => {
    const distinctRecord = {
      schemaVersion: 'learning-record/v1',
      learningId: 'LR-20261021-004',
      timestamp: '2026-10-21T13:00:00.000Z',
      status: 'validated',
      category: 'security',
      pack: 'rr8-supabase-cf',
      summary: 'Supabase RLS policies must wrap auth.uid() in subqueries to avoid per-row re-evaluation',
      rootCause: 'Direct auth.uid() function invocation prevents query plan caching and degrades join performance',
      lesson: 'Always wrap auth.uid() with select parentheses: (select auth.uid()) in SQL security policies',
      evidencePaths: ['package.json'],
      promotionTargets: ['docs/bible/03-SECURITY-AND-AUTHENTICATION.md'],
    };

    const tokensA = extractRecordTokens(VALID_RECORD);
    const tokensB = extractRecordTokens(distinctRecord);
    const sim = computeJaccardSimilarity(tokensA, tokensB);
    expect(sim).toBeLessThan(0.7);

    const registryRes = validateLearningRegistry(
      [
        { record: VALID_RECORD, filePath: 'LR-20261021-001.json' },
        { record: distinctRecord, filePath: 'LR-20261021-004.json' },
      ],
      { skipDiskChecks: true }
    );

    expect(registryRes.ok).toBe(true);
    expect(registryRes.violations).toHaveLength(0);
  });

  it('requires promotedByProposalId when status === "promoted"', () => {
    const promotedWithoutProposal = {
      ...VALID_RECORD,
      learningId: 'LR-20261021-005',
      status: 'promoted',
    };
    const res = validateLearningRecord(promotedWithoutProposal, { skipDiskChecks: true });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'MISSING_PROPOSAL_ID')).toBe(true);

    const promotedWithProposal = {
      ...promotedWithoutProposal,
      promotedByProposalId: 'SYNC-20261021-001',
    };
    const resWithProposal = validateLearningRecord(promotedWithProposal, { skipDiskChecks: true });
    expect(resWithProposal.ok).toBe(true);
  });

  it('rejects filename mismatch with learningId', () => {
    const registryRes = validateLearningRegistry(
      [{ record: VALID_RECORD, filePath: 'LR-20261021-999.json' }],
      { skipDiskChecks: true }
    );
    expect(registryRes.ok).toBe(false);
    expect(registryRes.violations.some((v) => v.code === 'FILENAME_ID_MISMATCH')).toBe(true);
  });
});
