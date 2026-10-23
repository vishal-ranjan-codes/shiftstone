import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  Scheduler,
  actuateTrigger,
  cronMatches,
  nextFireTime,
  parseCron,
  watchEventSource,
} from '../../harness/loop-runner/triggers/index.ts';
import { makeSpec } from '../helpers.ts';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(25);
  }
  return predicate();
}

describe('A9 — cron parsing', () => {
  it('parses steps, lists and ranges', () => {
    expect([...parseCron('*/15 * * * *').minutes]).toEqual([0, 15, 30, 45]);
    expect([...parseCron('0 9,18 * * *').hours]).toEqual([9, 18]);
    expect([...parseCron('0 0 1-3 * *').daysOfMonth]).toEqual([1, 2, 3]);
  });

  it('rejects malformed expressions', () => {
    expect(() => parseCron('not a cron')).toThrow(/cron/);
    expect(() => parseCron('* * *')).toThrow(/expected 5 fields/);
    expect(() => parseCron('60 * * * *')).toThrow(/out of range/);
    expect(() => parseCron('*/0 * * * *')).toThrow(/invalid step/);
  });

  it('computes the next fire time at minute granularity', () => {
    const from = new Date(2026, 2, 10, 10, 7, 30);
    expect(nextFireTime('*/15 * * * *', from)).toEqual(new Date(2026, 2, 10, 10, 15, 0));
    expect(nextFireTime('0 0 * * *', new Date(2026, 2, 10, 12, 0, 0))).toEqual(
      new Date(2026, 2, 11, 0, 0, 0),
    );
  });

  it('day-of-month and day-of-week combine with OR semantics when both restricted', () => {
    const expr = parseCron('0 9 13 * 5'); // 09:00 on the 13th OR on Fridays
    const friday = new Date(2026, 9, 16, 9, 0, 0); // 2026-10-16 is a Friday
    const fridayThe13th = new Date(2026, 9, 13, 9, 0, 0); // Tuesday the 13th
    const neither = new Date(2026, 9, 14, 9, 0, 0);
    expect(cronMatches(expr, friday)).toBe(true);
    expect(cronMatches(expr, fridayThe13th)).toBe(true);
    expect(cronMatches(expr, neither)).toBe(false);
    expect(cronMatches(expr, new Date(2026, 9, 16, 10, 0, 0))).toBe(false); // wrong hour
  });
});

describe('A9 — Scheduler fires scheduled loops', () => {
  it('ticks only when due and reschedules after firing', async () => {
    let nowMs = new Date(2026, 2, 10, 10, 0, 0).getTime();
    let fired = 0;
    const scheduler = new Scheduler('*/5 * * * *', () => {
      fired += 1;
    }, { now: () => nowMs });

    const first = scheduler.schedule(new Date(nowMs));
    expect(first).toEqual(new Date(2026, 2, 10, 10, 5, 0));

    expect(await scheduler.tick(nowMs)).toBe(false); // not due yet
    expect(fired).toBe(0);

    nowMs = new Date(2026, 2, 10, 10, 5, 0).getTime();
    expect(await scheduler.tick(nowMs)).toBe(true);
    expect(fired).toBe(1);
    expect(scheduler.nextFire).toEqual(new Date(2026, 2, 10, 10, 10, 0));

    expect(await scheduler.tick(nowMs)).toBe(false); // same minute, not due again
    expect(fired).toBe(1);
  });

  it('start() computes the next fire and stop() halts the timer', () => {
    const scheduler = new Scheduler('* * * * *', () => undefined);
    scheduler.start();
    expect(scheduler.nextFire).not.toBeNull();
    scheduler.stop();
  });

  it('bad cron fails at construction, not at fire time', () => {
    expect(() => new Scheduler('nope', () => undefined)).toThrow(/cron/);
  });
});

describe('A9 — event adapter (file-watch)', () => {
  it('fires when the watched directory changes, and stops after unwatch', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'watch-'));
    let fired = 0;
    const unwatch = watchEventSource(dir, () => {
      fired += 1;
    }, { debounceMs: 30 });

    await writeFile(path.join(dir, 'a.txt'), 'first', 'utf8');
    expect(await waitFor(() => fired >= 1, 5_000)).toBe(true);

    unwatch();
    await sleep(150);
    await writeFile(path.join(dir, 'b.txt'), 'second', 'utf8');
    await sleep(300);
    expect(fired).toBe(1);
  });
});

describe('A9 — actuateTrigger routes by spec.trigger.type', () => {
  it('manual triggers return an inert handle (caller runs the loop)', () => {
    const spec = makeSpec({ name: 'manual-loop', trigger: { type: 'manual' } });
    const handle = actuateTrigger(spec, () => undefined);
    expect(() => handle.stop()).not.toThrow();
  });

  it('scheduled triggers start a cron scheduler with a computed next fire', () => {
    const spec = makeSpec({ name: 'cron-loop', trigger: { type: 'scheduled', cron: '*/5 * * * *' } });
    const handle = actuateTrigger(spec, () => undefined);
    handle.stop();

    const noCron = makeSpec({ name: 'bad-cron-loop', trigger: { type: 'scheduled' } });
    expect(() => actuateTrigger(noCron, () => undefined)).toThrow(/no trigger.cron/);
  });

  it('event triggers watch the declared event_source', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'event-'));
    let fired = 0;
    const spec = makeSpec({
      name: 'event-loop',
      trigger: { type: 'event', event_source: dir },
    });
    const handle = actuateTrigger(spec, () => {
      fired += 1;
    }, { debounceMs: 30 });
    await writeFile(path.join(dir, 'changed.txt'), 'x', 'utf8');
    expect(await waitFor(() => fired >= 1, 5_000)).toBe(true);
    handle.stop();

    const noSource = makeSpec({ name: 'bad-event-loop', trigger: { type: 'event' } });
    expect(() => actuateTrigger(noSource, () => undefined)).toThrow(/event_source/);
  });
});
