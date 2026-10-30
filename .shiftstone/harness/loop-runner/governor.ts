import fs from 'node:fs';
import path from 'node:path';
import { StageDagRunner, type DagStageNode } from './dag.js';
import { OrchestrationBrakes } from '../brakes/orchestration-brakes.js';
import type {
  GovernorPhaseResult,
  GovernorRunSummary,
  GovernorStatus,
  PlanGovernorManifest,
  PlanGovernorPhase,
  TerminalState,
} from './types.js';

export type PhaseDispatcher = (
  phaseId: string,
  context: { mode: 'implement' | 'remediate'; suite?: string }
) => Promise<{
  phaseId: string;
  exitCode: number;
  status: 'success' | 'blocked' | 'stalled';
  error?: string;
  diffHash?: string;
}>;

export interface PlanGovernorOptions {
  suite?: string;
  root?: string;
  manifest?: PlanGovernorManifest;
  dispatcher?: PhaseDispatcher;
  brakes?: OrchestrationBrakes;
  maxRetries?: number;
}

export class PlanGovernor {
  readonly suite: string;
  readonly root: string;
  readonly manifest: PlanGovernorManifest;
  readonly dispatcher: PhaseDispatcher;
  readonly brakes: OrchestrationBrakes;

  constructor(options: PlanGovernorOptions = {}) {
    this.suite = options.suite || '';
    this.root = path.resolve(options.root || process.cwd());
    this.brakes = options.brakes || new OrchestrationBrakes({ maxRetries: options.maxRetries ?? 3 });

    if (options.manifest) {
      this.manifest = options.manifest;
    } else if (this.suite) {
      const manifestPath = path.resolve(this.root, this.suite, 'plan-manifest.json');
      if (fs.existsSync(manifestPath)) {
        this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } else {
        throw new Error(`Plan manifest not found at ${manifestPath}`);
      }
    } else {
      throw new Error('PlanGovernor requires either an explicit manifest or a valid suite path');
    }

    this.dispatcher = options.dispatcher || (async (phaseId) => ({
      phaseId,
      exitCode: 0,
      status: 'success',
    }));
  }

  resolvePhasesDAG(): PlanGovernorPhase[] {
    const nodes: DagStageNode[] = this.manifest.phases.map((p) => {
      const rawDeps = p.dependsOn || [];
      const dependsOn = rawDeps.map((d) => (typeof d === 'string' ? d : d.phaseId));
      return {
        id: p.phaseId,
        dependsOn,
      };
    });

    const dagRunner = new StageDagRunner({ root: this.root });
    const sortedNodes = dagRunner.sortStages(nodes);

    const phaseMap = new Map<string, PlanGovernorPhase>();
    for (const phase of this.manifest.phases) {
      phaseMap.set(phase.phaseId, phase);
    }

    return sortedNodes.map((n) => phaseMap.get(n.id)!);
  }

  async run(): Promise<GovernorRunSummary> {
    const sortedPhases = this.resolvePhasesDAG();
    const executedOrder: string[] = [];
    const phaseResults: Record<string, GovernorPhaseResult> = {};

    let governorStatus: GovernorStatus = 'running';
    let terminalState: TerminalState = 'success';

    for (const phase of sortedPhases) {
      const phaseId = phase.phaseId;
      executedOrder.push(phaseId);

      let mode: 'implement' | 'remediate' = 'implement';
      let phaseCompleted = false;

      while (!phaseCompleted) {
        const dispatchResult = await this.dispatcher(phaseId, {
          mode,
          suite: this.suite,
        });

        if (dispatchResult.exitCode === 0 && dispatchResult.status === 'success') {
          phaseResults[phaseId] = {
            phaseId,
            status: 'success',
            exitCode: 0,
          };
          phaseCompleted = true;
        } else if (dispatchResult.status === 'blocked') {
          // AC-U4-03: Immediate halt on unrecoverable blocker
          governorStatus = 'blocked';
          terminalState = 'blocked';
          phaseResults[phaseId] = {
            phaseId,
            status: 'blocked',
            exitCode: dispatchResult.exitCode,
            error: dispatchResult.error || `Phase ${phaseId} execution blocked`,
          };
          return {
            status: governorStatus,
            terminalState,
            executedOrder,
            phaseResults,
          };
        } else {
          // Failure handling via OrchestrationBrakes
          const brakeRes = this.brakes.recordAttempt(phaseId, {
            exitCode: dispatchResult.exitCode,
            diffHash: dispatchResult.diffHash,
          });

          if (brakeRes.shouldRetry && brakeRes.nextMode) {
            mode = brakeRes.nextMode;
          } else {
            // Cannot retry: halted
            governorStatus = 'blocked';
            terminalState = 'blocked';
            phaseResults[phaseId] = {
              phaseId,
              status: 'blocked',
              exitCode: dispatchResult.exitCode,
              error: brakeRes.error || dispatchResult.error || `Phase ${phaseId} execution failed`,
              attempts: brakeRes.diagnostics?.attempts,
            };
            return {
              status: governorStatus,
              terminalState,
              executedOrder,
              phaseResults,
            };
          }
        }
      }
    }

    governorStatus = 'completed';
    terminalState = 'success';

    return {
      status: governorStatus,
      terminalState,
      executedOrder,
      phaseResults,
    };
  }
}
