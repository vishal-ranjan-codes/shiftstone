/**
 * Trigger router (A9): spec.trigger.type decides how the loop is actuated.
 *   manual    — caller runs it directly (CLI `run`)
 *   scheduled — cron scheduler (CLI `schedule`)
 *   event     — file-watch adapter (CLI `watch`); git-hooks and webhooks
 *               shell out to `cli.js trigger <loop-id>`
 */

import path from 'node:path';
import type { LoopSpecification } from '../types.ts';
import { Scheduler, type SchedulerOpts } from './scheduler.ts';
import { watchEventSource, type Unwatch } from './events.ts';

export { Scheduler, nextFireTime, parseCron, cronMatches } from './scheduler.ts';
export { watchEventSource } from './events.ts';

export interface ActuationHandle {
  stop: () => void;
}

export function actuateTrigger(
  spec: LoopSpecification,
  run: () => void | Promise<void>,
  opts?: {
    root?: string;
    scheduler?: Omit<SchedulerOpts, 'now'>;
    debounceMs?: number;
  },
): ActuationHandle {
  const root = opts?.root ?? process.cwd();
  switch (spec.trigger.type) {
    case 'scheduled': {
      const cron = spec.trigger.cron;
      if (!cron) throw new Error(`loop ${spec.name}: trigger.type=scheduled but no trigger.cron`);
      const scheduler = new Scheduler(cron, run, opts?.scheduler);
      scheduler.start();
      return { stop: () => scheduler.stop() };
    }
    case 'event': {
      const source = spec.trigger.event_source;
      if (!source) throw new Error(`loop ${spec.name}: trigger.type=event but no trigger.event_source`);
      const unwatch: Unwatch = watchEventSource(path.resolve(root, source), run, {
        debounceMs: opts?.debounceMs,
      });
      return { stop: unwatch };
    }
    case 'manual':
      return { stop: () => undefined };
  }
}
