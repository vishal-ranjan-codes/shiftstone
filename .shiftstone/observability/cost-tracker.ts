/**
 * Cost tracker — appends one JSONL row per run to .loops/<name>/runs.jsonl.
 *
 * Headline metric (paper): cost per accepted change = spend / verified &
 * merged changes. When accepted_changes is 0 the CAC is reported as null —
 * a loop that burns budget without producing accepted work is visibly broken.
 */

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AnyTerminalState, LoopState } from '../harness/loop-runner/types.ts';

export interface CostRow {
  timestamp: string;
  loop: string;
  run_id: string;
  terminal_state: AnyTerminalState;
  reason: string;
  attempts: number;
  tokens: number;
  dollars_usd: number;
  accepted_changes: number;
  cost_per_accepted_change_usd: number | null;
  /** Pack archetype attribution for the per-archetype CAC breakdown (task 5.2). */
  archetype?: string;
}

export interface CostRecordEntry {
  terminal_state: AnyTerminalState;
  reason: string;
  state: LoopState;
  archetype?: string;
}

export interface CostTrackerOpts {
  root?: string;
  loopsDir?: string;
}

export class CostTracker {
  loopName: string;
  file: string;
  root: string;
  private enabledCache?: boolean;

  constructor(loopName: string, opts?: CostTrackerOpts) {
    const root = opts?.root ?? process.cwd();
    const loopsDir = opts?.loopsDir ?? path.join(root, '.loops');
    this.loopName = loopName;
    this.root = root;
    this.file = path.join(loopsDir, loopName, 'runs.jsonl');
  }

  /**
   * Risk mitigation (blueprint §9.3): opt out via
   * `{"cost-tracker": {"enabled": false}}` in .shiftstone/context/cost-tracker.json.
   * Absent/unreadable config ⇒ enabled (tracking is the default).
   */
  async enabled(): Promise<boolean> {
    if (this.enabledCache !== undefined) return this.enabledCache;
    try {
      const raw = JSON.parse(await readFile(path.join(this.root, '.shiftstone', 'context', 'cost-tracker.json'), 'utf8'));
      const scoped = raw?.['cost-tracker'];
      const flag = scoped && typeof scoped === 'object' ? scoped['enabled'] : raw?.['enabled'];
      this.enabledCache = flag !== false;
    } catch {
      this.enabledCache = true;
    }
    return this.enabledCache;
  }

  row(entry: CostRecordEntry): CostRow {
    const { state } = entry;
    const accepted = state.accepted_changes;
    return {
      timestamp: new Date().toISOString(),
      loop: this.loopName,
      run_id: state.run_id,
      terminal_state: entry.terminal_state,
      reason: entry.reason,
      attempts: state.attempt,
      tokens: state.tokens_used,
      dollars_usd: state.dollars_used,
      accepted_changes: accepted,
      cost_per_accepted_change_usd:
        accepted > 0 && state.dollars_used > 0
          ? Number((state.dollars_used / accepted).toFixed(4))
          : null,
      archetype: entry.archetype,
    };
  }

  async record(entry: CostRecordEntry): Promise<CostRow> {
    const row = this.row(entry);
    if (await this.enabled()) {
      await mkdir(path.dirname(this.file), { recursive: true });
      await appendFile(this.file, `${JSON.stringify(row)}\n`, 'utf8');
    }
    return row;
  }
}
