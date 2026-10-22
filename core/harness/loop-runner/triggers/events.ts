/**
 * A9 — event trigger adapter: file-watch (and, by convention, git-hook and
 * webhook receivers which shell out to `cli.js trigger <loop-id>`).
 *
 * Fires the loop when the watched file or directory changes. Debounced so a
 * burst of writes produces a single firing.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface WatchOpts {
  debounceMs?: number;
}

export type Unwatch = () => void;

export function watchEventSource(
  source: string,
  onFire: () => void | Promise<void>,
  opts?: WatchOpts,
): Unwatch {
  const target = path.resolve(source);
  const debounceMs = opts?.debounceMs ?? 250;
  let pending: ReturnType<typeof debounceTimer> | null = null;

  function debounceTimer(): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      pending = null;
      void onFire();
    }, debounceMs);
  }

  const watcher = fs.watch(target, { recursive: false }, () => {
    if (pending) clearTimeout(pending);
    pending = debounceTimer();
  });

  return () => {
    if (pending) clearTimeout(pending);
    watcher.close();
  };
}
