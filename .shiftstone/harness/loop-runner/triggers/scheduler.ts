/**
 * A9 — cron scheduler: fires a scheduled loop at its trigger.cron interval.
 *
 * Supports the standard 5-field cron grammar: minute hour day-of-month
 * month day-of-week, each field one of "*", "n", "a-b", step syntax
 * "star/n", and comma lists "a,b,c".
 * Day-of-month and day-of-week combine with standard OR semantics when both
 * are restricted.
 */

export interface SchedulerOpts {
  now?: () => number;
  checkIntervalMs?: number;
  onError?: (err: unknown) => void;
}

function parseField(field: string, min: number, max: number, label: string): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length === 0) throw new Error(`cron: empty ${label} part`);
    const rangeMatch = /^(\*|\d+|\d+-\d+)(?:\/(\d+))?$/.exec(trimmed);
    if (!rangeMatch) throw new Error(`cron: invalid ${label} field "${field}"`);
    const [, base, stepStr] = rangeMatch;
    const step = stepStr ? Number(stepStr) : 1;
    if (step < 1) throw new Error(`cron: invalid step in ${label} field "${field}"`);
    let lo = min;
    let hi = max;
    if (base !== '*') {
      if (base.includes('-')) {
        const [a, b] = base.split('-').map(Number);
        lo = a;
        hi = b;
      } else {
        lo = Number(base);
        hi = stepStr ? max : Number(base);
      }
    }
    if (lo < min || hi > max || lo > hi) {
      throw new Error(`cron: ${label} field "${field}" out of range ${min}-${max}`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return values;
}

export interface CronExpr {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
  domRestricted: boolean;
  dowRestricted: boolean;
}

export function parseCron(expr: string): CronExpr {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`cron: expected 5 fields, got ${fields.length} in "${expr}"`);
  }
  const [minF, hourF, domF, monthF, dowF] = fields;
  return {
    minutes: parseField(minF, 0, 59, 'minute'),
    hours: parseField(hourF, 0, 23, 'hour'),
    daysOfMonth: parseField(domF, 1, 31, 'day-of-month'),
    months: parseField(monthF, 1, 12, 'month'),
    daysOfWeek: parseField(dowF, 0, 7, 'day-of-week'),
    domRestricted: domF !== '*',
    dowRestricted: dowF !== '*',
  };
}

export function cronMatches(expr: CronExpr, date: Date): boolean {
  const dow = date.getDay() === 0 ? 7 : date.getDay(); // normalize Sunday to 7
  const minuteOk = expr.minutes.has(date.getMinutes());
  const hourOk = expr.hours.has(date.getHours());
  const monthOk = expr.months.has(date.getMonth() + 1);
  const domOk = expr.daysOfMonth.has(date.getDate());
  const dowOk = expr.daysOfWeek.has(dow) || (dow === 7 && expr.daysOfWeek.has(0));
  let dayOk: boolean;
  if (expr.domRestricted && expr.dowRestricted) {
    dayOk = domOk || dowOk;
  } else {
    dayOk = domOk && dowOk;
  }
  return minuteOk && hourOk && monthOk && dayOk;
}

/** Next fire strictly after `from`, at minute granularity. */
export function nextFireTime(expr: string | CronExpr, from: Date = new Date()): Date {
  const parsed = typeof expr === 'string' ? parseCron(expr) : expr;
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  const limit = from.getTime() + 366 * 24 * 60 * 60 * 1000;
  while (cursor.getTime() <= limit) {
    if (cronMatches(parsed, cursor)) return new Date(cursor.getTime());
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  throw new Error('cron: no fire time within a year');
}

export class Scheduler {
  expr: string;
  runFn: () => void | Promise<void>;
  opts: SchedulerOpts;
  nextFire: Date | null;
  private timer: ReturnType<typeof setTimeout> | null;
  private running: boolean;
  private firing: boolean;

  constructor(expr: string, runFn: () => void | Promise<void>, opts?: SchedulerOpts) {
    this.expr = expr;
    this.runFn = runFn;
    this.opts = opts ?? {};
    this.nextFire = null;
    this.timer = null;
    this.running = false;
    this.firing = false;
    // validate eagerly — bad cron fails at schedule time, not at fire time
    parseCron(expr);
  }

  private nowMs(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  /** Recompute the next fire time from `from` (default: now). */
  schedule(from?: Date): Date {
    const base = from ?? new Date(this.nowMs());
    this.nextFire = nextFireTime(this.expr, base);
    return this.nextFire;
  }

  /** Fire if due. Returns true when the run function was invoked. */
  async tick(nowMs?: number): Promise<boolean> {
    const now = nowMs ?? this.nowMs();
    if (!this.nextFire) this.schedule(new Date(now));
    if (this.nextFire!.getTime() > now) return false;
    if (this.firing) return false;
    this.firing = true;
    try {
      await this.runFn();
    } catch (err) {
      this.opts.onError?.(err);
    } finally {
      this.firing = false;
      this.schedule(new Date(now));
    }
    return true;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule();
    const interval = this.opts.checkIntervalMs ?? 1_000;
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
