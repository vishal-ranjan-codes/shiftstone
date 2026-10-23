/**
 * Stage DAG Engine with Schema-Enforced ICM Stage Contract Interception (UG-07, UG-09 / Phase 2 Unit U7)
 *
 * Invokes stage contract validation before executing any DAG stage.
 * Halts as 'blocked' if any input is superseded, missing, or fails contract invariants.
 */

import path from 'node:path';
import { validateStageContractFile, type StageValidationResult } from '../../scripts/validate-stage-contracts.ts';
import type { TerminalState } from './types.ts';

export interface DagStageNode {
  id: string;
  contractPath?: string;
  dependsOn?: string[];
  execute?: () => Promise<void> | void;
}

export interface DagStageResult {
  stageId: string;
  terminalState: TerminalState;
  executed: boolean;
  error?: string;
  reason?: string;
  validation?: StageValidationResult;
}

export interface DagExecutionSummary {
  terminalState: TerminalState;
  results: Record<string, DagStageResult>;
  order: string[];
}

export interface DagRunnerOptions {
  root?: string;
}

export class StageDagRunner {
  private readonly root: string;

  constructor(options: DagRunnerOptions = {}) {
    this.root = options.root ? path.resolve(options.root) : process.cwd();
  }

  /**
   * Topologically orders stages based on dependsOn references.
   * Throws an error if a cycle or missing dependency is detected.
   */
  public sortStages(stages: DagStageNode[]): DagStageNode[] {
    const stageMap = new Map<string, DagStageNode>();
    for (const s of stages) {
      if (stageMap.has(s.id)) {
        throw new Error(`Duplicate stage ID in DAG: ${s.id}`);
      }
      stageMap.set(s.id, s);
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: DagStageNode[] = [];

    const visit = (id: string, pathStack: string[]) => {
      if (visiting.has(id)) {
        throw new Error(`Cycle detected in stage DAG: ${[...pathStack, id].join(' -> ')}`);
      }
      if (visited.has(id)) return;

      const node = stageMap.get(id);
      if (!node) {
        throw new Error(`Unknown stage dependency: '${id}'`);
      }

      visiting.add(id);
      for (const depId of node.dependsOn || []) {
        visit(depId, [...pathStack, id]);
      }
      visiting.delete(id);
      visited.add(id);
      sorted.push(node);
    };

    for (const node of stages) {
      if (!visited.has(node.id)) {
        visit(node.id, []);
      }
    }

    return sorted;
  }

  /**
   * Executes stages in topological order, enforcing stage-contract pre-flight validation.
   */
  public async executeDag(stages: DagStageNode[]): Promise<DagExecutionSummary> {
    const sorted = this.sortStages(stages);
    const results: Record<string, DagStageResult> = {};
    const order: string[] = [];

    for (const stage of sorted) {
      order.push(stage.id);

      // Check if any upstream dependency failed or was blocked
      const upstreamBlocked = (stage.dependsOn || []).find(
        (depId) => results[depId] && results[depId].terminalState !== 'success',
      );

      if (upstreamBlocked) {
        results[stage.id] = {
          stageId: stage.id,
          terminalState: 'blocked',
          executed: false,
          reason: `Upstream dependency '${upstreamBlocked}' terminated with '${results[upstreamBlocked].terminalState}'`,
        };
        continue;
      }

      // Pre-execution Stage Contract Gate (UG-09)
      if (stage.contractPath) {
        const contractAbs = path.isAbsolute(stage.contractPath)
          ? stage.contractPath
          : path.join(this.root, stage.contractPath);

        const validation = validateStageContractFile(contractAbs, { root: this.root });
        if (!validation.ok) {
          const violationCodes = validation.violations.map((v: any) => v.code).join(', ');
          const violationMsgs = validation.violations.map((v: any) => `[${v.code}] ${v.message}`).join('; ');

          results[stage.id] = {
            stageId: stage.id,
            terminalState: 'blocked',
            executed: false,
            reason: `Stage contract validation failed (${violationCodes}): ${violationMsgs}`,
            validation,
          };
          continue;
        }
      }

      // Execute stage
      try {
        if (stage.execute) {
          await stage.execute();
        }
        results[stage.id] = {
          stageId: stage.id,
          terminalState: 'success',
          executed: true,
        };
      } catch (err) {
        results[stage.id] = {
          stageId: stage.id,
          terminalState: 'blocked',
          executed: false,
          error: err instanceof Error ? err.message : String(err),
          reason: `Stage execution threw an unhandled error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // Determine overall terminal state
    const anyBlocked = Object.values(results).some((r) => r.terminalState === 'blocked');
    const allSuccess = Object.values(results).every((r) => r.terminalState === 'success');

    const terminalState: TerminalState = anyBlocked ? 'blocked' : allSuccess ? 'success' : 'stalled';

    return {
      terminalState,
      results,
      order,
    };
  }
}
