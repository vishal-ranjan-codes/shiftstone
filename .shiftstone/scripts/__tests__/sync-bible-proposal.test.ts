import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applySyncProposal,
  buildProposalContent,
  generateSyncProposal,
  runSyncBibleProposalSelfTest,
} from '../sync-bible-proposal.js';

describe('Unit U23: sync-bible-proposal (UG-22)', () => {
  const testRoot = path.resolve('.shiftstone', 'scripts', '__tests__', 'fixtures', 'sync-proposal-test');
  const learningDir = path.join(testRoot, 'docs', 'reports', 'learning');
  const syncReportsDir = path.join(testRoot, 'docs', 'reports', 'sync');
  const bibleDir = path.join(testRoot, 'docs', 'bible');

  beforeEach(() => {
    mkdirSync(learningDir, { recursive: true });
    mkdirSync(syncReportsDir, { recursive: true });
    mkdirSync(bibleDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('TS-U23-01 (L2): self-test passes cleanly', () => {
    const res = runSyncBibleProposalSelfTest();
    expect(res.ok).toBe(true);
    expect(res.results.every((r) => r.pass)).toBe(true);
  });

  it('TS-U23-01 (L2): dry-run generates proposal without mutating docs/bible or creating disk files', () => {
    const record = {
      schemaVersion: 'learning-record/v1',
      learningId: 'LR-20261021-010',
      timestamp: '2026-10-21T12:00:00.000Z',
      status: 'validated',
      category: 'architecture',
      pack: 'rr8-supabase-cf',
      summary: 'Edge workers require strict nodejs_compat flags for buffer manipulation',
      rootCause: 'Direct use of global Buffer failed without compatibility flag in wrangler config',
      lesson: 'Always ensure nodejs_compat is set in wrangler configuration when utilizing standard buffers',
      evidencePaths: ['package.json'],
      promotionTargets: ['docs/bible/01-ARCHITECTURE.md'],
    };

    writeFileSync(
      path.join(learningDir, 'LR-20261021-010.json'),
      JSON.stringify(record, null, 2),
      'utf8'
    );

    const res = generateSyncProposal({ root: testRoot, dryRun: true });
    expect(res.ok).toBe(true);
    expect(res.dryRun).toBe(true);
    expect(res.proposal?.content).toContain('SYNC-');
    expect(res.proposal?.content).toContain('LR-20261021-010');
    expect(res.proposal?.content).toContain('docs/bible/01-ARCHITECTURE.md');

    // Verify no proposal was written to disk
    const targetProposalPath = path.join(syncReportsDir, `${res.proposalId}.md`);
    expect(() => readFileSync(targetProposalPath, 'utf8')).toThrow();
  });

  it('generates proposal file on disk and applies it with approval', () => {
    const record = {
      schemaVersion: 'learning-record/v1',
      learningId: 'LR-20261021-011',
      timestamp: '2026-10-21T12:00:00.000Z',
      status: 'validated',
      category: 'security',
      pack: 'rr8-supabase-cf',
      summary: 'RLS policies must wrap auth.uid() in subqueries to avoid per-row execution',
      rootCause: 'Unwrapped auth.uid() function calls prevent query plan reuse',
      lesson: 'Wrap auth.uid() in (select auth.uid()) for optimal policy execution',
      evidencePaths: ['package.json'],
      promotionTargets: ['docs/bible/03-SECURITY.md'],
    };

    const recordFile = path.join(learningDir, 'LR-20261021-011.json');
    writeFileSync(recordFile, JSON.stringify(record, null, 2), 'utf8');

    // 1. Generate proposal on disk
    const genRes = generateSyncProposal({ root: testRoot, dryRun: false });
    expect(genRes.ok).toBe(true);
    const proposalId = genRes.proposalId;
    const proposalFile = path.join(syncReportsDir, `${proposalId}.md`);
    const writtenContent = readFileSync(proposalFile, 'utf8');
    expect(writtenContent).toContain(`proposalId: ${proposalId}`);
    expect(writtenContent).toContain('status: proposed');

    // 2. Applying without approval fails
    const failRes = applySyncProposal(proposalId, '', { root: testRoot });
    expect(failRes.ok).toBe(false);
    expect(failRes.code).toBe('MISSING_APPROVAL');

    // 3. Applying with approval succeeds
    const applyRes = applySyncProposal(proposalId, 'APR-20261021-001', { root: testRoot });
    expect(applyRes.ok).toBe(true);
    expect(applyRes.promotedRecordCount).toBe(1);

    // 4. Learning record is updated to status: promoted with promotedByProposalId
    const updatedRecord = JSON.parse(readFileSync(recordFile, 'utf8'));
    expect(updatedRecord.status).toBe('promoted');
    expect(updatedRecord.promotedByProposalId).toBe(proposalId);

    // 5. Proposal file is updated to status: applied
    const updatedProposal = readFileSync(proposalFile, 'utf8');
    expect(updatedProposal).toContain('status: applied');
    expect(updatedProposal).toContain('approvalId: APR-20261021-001');

    // 6. Applying already applied proposal fails
    const reapplyRes = applySyncProposal(proposalId, 'APR-20261021-001', { root: testRoot });
    expect(reapplyRes.ok).toBe(false);
    expect(reapplyRes.code).toBe('PROPOSAL_ALREADY_APPLIED');
  });
});
