import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { sealStage, validateStage } from '../../governance/stage-seal.ts';

const VALID_CONTEXT = [
  '---',
  'type: ICM Stage',
  'timestamp: 2026-10-12T00:00:00Z',
  'stage: 02-design',
  'status: open',
  '---',
  '',
  '# 02-design — CONTEXT',
  '',
  '## Inputs',
  '- Layer 3 (Reference): ../../../../../_config/conventions.md',
  '',
  '## Process',
  '1. write the design',
  '',
  '## Outputs',
  '- spec.md -> output/spec.md',
  '',
].join('\n');

const VALID_OUTPUT = [
  '---',
  'type: stage-output',
  'timestamp: 2026-10-12T01:00:00Z',
  'inputs:',
  '  - ../../../../../_config/conventions.md',
  '---',
  '',
  '# Spec',
  '',
].join('\n');

async function makeStage(context: string, outputs: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'seal-'));
  await writeFile(path.join(dir, 'CONTEXT.md'), context, 'utf8');
  if (Object.keys(outputs).length > 0) {
    await mkdir(path.join(dir, 'output'), { recursive: true });
    for (const [name, content] of Object.entries(outputs)) {
      await writeFile(path.join(dir, 'output', name), content, 'utf8');
    }
  }
  return dir;
}

describe('C8 — stage seal validation', () => {
  it('refuses to seal when an output lacks OKF frontmatter', async () => {
    const dir = await makeStage(VALID_CONTEXT, { 'spec.md': '# Spec with no frontmatter\n' });
    const report = await validateStage(dir);
    expect(report.sealed).toBe(false);
    expect(report.problems.some((p) => p.problem.includes('missing OKF frontmatter'))).toBe(true);

    const sealed = await sealStage(dir);
    expect(sealed.sealed).toBe(false);
    const context = await readFile(path.join(dir, 'CONTEXT.md'), 'utf8');
    expect(context).toContain('status: open'); // NOT sealed
  });

  it('refuses outputs missing type, ISO timestamp or inputs', async () => {
    const noType = '---\ntimestamp: 2026-10-12T01:00:00Z\ninputs: []\n---\n# x\n';
    const badTime = '---\ntype: stage-output\ntimestamp: 2026-10-12\ninputs: []\n---\n# x\n';
    const noInputs = '---\ntype: stage-output\ntimestamp: 2026-10-12T01:00:00Z\n---\n# x\n';
    const dir = await makeStage(VALID_CONTEXT, {
      'a.md': noType,
      'b.md': badTime,
      'c.md': noInputs,
    });
    const report = await validateStage(dir);
    expect(report.sealed).toBe(false);
    const problems = report.problems.map((p) => p.problem).join('\n');
    expect(problems).toContain('frontmatter missing "type"');
    expect(problems).toContain('ISO-8601');
    expect(problems).toContain('missing "inputs"');
  });

  it('requires the three CONTEXT.md sections', async () => {
    const dir = await makeStage('# Stage\n\n## Process\n1. x\n', { 'a.md': VALID_OUTPUT });
    const report = await validateStage(dir);
    expect(report.problems.map((p) => p.problem).join('\n')).toContain('## Inputs');
    expect(report.problems.map((p) => p.problem).join('\n')).toContain('## Outputs');
  });

  it('refuses a stage with no outputs at all', async () => {
    const dir = await makeStage(VALID_CONTEXT, {});
    const report = await validateStage(dir);
    expect(report.sealed).toBe(false);
    expect(report.problems.some((p) => p.problem.includes('nothing to seal'))).toBe(true);
  });

  it('refuses when CONTEXT.md is missing', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'seal-'));
    const report = await validateStage(dir);
    expect(report.sealed).toBe(false);
    expect(report.problems[0].problem).toContain('stage contract missing');
  });

  it('seals a compliant stage and stamps status + sealed_at', async () => {
    const dir = await makeStage(VALID_CONTEXT, { 'spec.md': VALID_OUTPUT });
    const before = await validateStage(dir);
    expect(before.sealed).toBe(true);
    expect(before.outputs).toEqual([path.join('output', 'spec.md')]);

    const sealed = await sealStage(dir);
    expect(sealed.sealed).toBe(true);
    const context = await readFile(path.join(dir, 'CONTEXT.md'), 'utf8');
    expect(context).toContain('status: sealed');
    expect(context).toMatch(/sealed_at: \d{4}-\d{2}-\d{2}T/);

    const after = await validateStage(dir);
    expect(after.sealed).toBe(true);
  });
});
