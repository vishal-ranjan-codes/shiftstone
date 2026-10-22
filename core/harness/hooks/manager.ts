/**
 * Hook manager (amendment B6) — registers hooks per lifecycle point and fires
 * them deterministically. Critical hooks (secret scanner) are non-bypassable:
 * a disable request for them is ignored and surfaced as a warning. Hooks are
 * pure and local; the phase budget is <50ms per point (overruns warn, never block).
 */

import type { FireOpts, Hook, HookDecision, HookPayload, HookPoint, HookRunResult } from './types.ts';

/** Phase risk table: hooks must stay under 50ms per point. */
export const HOOK_BUDGET_MS = 50;

export class HookManager {
  hooks: Hook[] = [];
  /** Warnings from construction/registration time (e.g. ignored disables). */
  warnings: string[] = [];

  register(hook: Hook): this {
    if (this.hooks.some((h) => h.name === hook.name)) {
      throw new Error(`hook already registered: ${hook.name}`);
    }
    this.hooks.push(hook);
    return this;
  }

  async fire(point: HookPoint, payload: HookPayload, opts?: FireOpts): Promise<HookRunResult> {
    const started = Date.now();
    const warnings: string[] = [];
    const applicable = this.hooks.filter((hook) => hook.points.includes(point));

    const decisions: { hook: Hook; decision: HookDecision }[] = [];
    for (const hook of applicable) {
      if (opts?.disable?.includes(hook.name)) {
        if (hook.critical) {
          warnings.push(`hook "${hook.name}" is critical — disable request ignored (B6)`);
        } else {
          continue;
        }
      }
      decisions.push({ hook, decision: await hook.run(payload) });
    }

    const refusal = decisions.find(({ decision }) => !decision.allowed);
    const duration = Date.now() - started;
    if (duration > HOOK_BUDGET_MS) {
      warnings.push(`hooks at "${point}" took ${duration}ms — over the ${HOOK_BUDGET_MS}ms budget`);
    }

    if (refusal) {
      return {
        allowed: false,
        blocked_by: refusal.hook.name,
        reason: refusal.decision.reason ?? `hook "${refusal.hook.name}" refused the ${point} action`,
        findings: refusal.decision.findings,
        duration_ms: duration,
        warnings,
      };
    }
    return { allowed: true, duration_ms: duration, warnings };
  }
}
