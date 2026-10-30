import path from 'node:path';
import { synthesizeWorkerContext } from './context-synthesizer.js';
import type { SubagentInvocationSpec } from './types.js';

export interface EphemeralWorkerSpawnerOptions {
  suite: string;
  root?: string;
  defaultModel?: string;
}

export interface WorkerSpecOptions {
  phaseId: string;
  mode?: 'implement' | 'remediate';
  readTargets?: string[];
  acceptanceCriteria?: string[];
  testScenarios?: string[];
  model?: string;
  maxTokens?: number;
}

export class EphemeralWorkerSpawner {
  readonly suite: string;
  readonly root: string;
  readonly defaultModel: string;

  constructor(options: EphemeralWorkerSpawnerOptions) {
    this.suite = options.suite;
    this.root = path.resolve(options.root || process.cwd());
    this.defaultModel = options.defaultModel || 'inherit';
  }

  createInvocationSpec(options: WorkerSpecOptions): SubagentInvocationSpec {
    const synthesized = synthesizeWorkerContext({
      suite: this.suite,
      phaseId: options.phaseId,
      mode: options.mode || 'implement',
      readTargets: options.readTargets || [],
      acceptanceCriteria: options.acceptanceCriteria || [],
      testScenarios: options.testScenarios || [],
      maxTokens: options.maxTokens,
    });

    return {
      TypeName: 'self',
      Role: `Ephemeral Worker [${options.phaseId}]`,
      Prompt: synthesized.prompt,
      Workspace: 'inherit',
      Model: options.model || this.defaultModel,
    };
  }
}
