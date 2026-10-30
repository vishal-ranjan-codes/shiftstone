import { describe, expect, it } from 'vitest';
import { synthesizeWorkerContext } from '../../../harness/loop-runner/context-synthesizer.js';
import { EphemeralWorkerSpawner } from '../../../harness/loop-runner/worker-spawner.js';

describe('Unit U5 — Ephemeral Worker Context Synthesizer & Subagent Spawner (REQ-05)', () => {
  it('TS-U5-01 (L1): Context synthesizer test validates prompt token size remains under 4,500 tokens across test suites', () => {
    const context = synthesizeWorkerContext({
      suite: 'docs/plans/agent-orchestration-and-ephemeral-workers',
      phaseId: 'P1',
      mode: 'implement',
      readTargets: [
        '.shiftstone/governance/schemas/orchestration-config-v1.schema.json',
        '.shiftstone/harness/worktree/git-worktree-engine.ts',
        '.shiftstone/tests/scripts/plan/orchestration-schema.test.ts',
      ],
      acceptanceCriteria: ['AC-U1-01', 'AC-U1-02'],
      testScenarios: ['TS-U1-01', 'TS-U1-02'],
    });

    expect(context.prompt).toBeDefined();
    expect(context.prompt).toContain('Implementer Subagent Prompt');
    expect(context.prompt).toContain('AC-U1-01');
    expect(context.tokenEstimate).toBeLessThanOrEqual(4500);
    expect(context.tokenEstimate).toBeGreaterThan(0);
  });

  it('TS-U5-02 (L1): Subagent invocation payload test confirms required environment parameters and paths are properly populated', () => {
    const spawner = new EphemeralWorkerSpawner({
      suite: 'docs/plans/agent-orchestration-and-ephemeral-workers',
    });

    const invocationSpec = spawner.createInvocationSpec({
      phaseId: 'P1',
      mode: 'implement',
      readTargets: ['.shiftstone/harness/worktree/git-worktree-engine.ts'],
      acceptanceCriteria: ['AC-U2-01'],
      testScenarios: ['TS-U2-01'],
    });

    expect(invocationSpec.TypeName).toBe('self');
    expect(invocationSpec.Role).toBe('Ephemeral Worker [P1]');
    expect(invocationSpec.Prompt).toBeDefined();
    expect(invocationSpec.Prompt).toContain('docs/plans/agent-orchestration-and-ephemeral-workers');
    expect(invocationSpec.Prompt).toContain('P1');
    expect(invocationSpec.Workspace).toBe('inherit');
  });
});
