/**
 * Default hook wiring (amendment B6): the secret scanner registered at every
 * lifecycle point. LoopRunner uses this when no HookManager is injected, so
 * hooks fire on the inner gear without configuration.
 */

import { HookManager } from './manager.ts';
import { secretScannerHook } from './secret-scanner.ts';

export { HookManager, HOOK_BUDGET_MS } from './manager.ts';
export { secretScannerHook, scanText, SECRET_PATTERNS } from './secret-scanner.ts';
export {
  preToolUsePreflightHook,
  preToolUseProtectedActionHook,
  evaluatePreflightToolUse,
  evaluateProtectedActionToolUse,
  isGovernedPath,
  extractTargetPaths,
  type PreflightHookOpts,
  type ProtectedActionHookOpts,
} from './pre-tool-use.ts';
export type {
  FireOpts,
  Hook,
  HookDecision,
  HookPayload,
  HookPoint,
  HookRunResult,
} from './types.ts';
export { HOOK_POINTS } from './types.ts';

export function createDefaultHooks(): HookManager {
  return new HookManager().register(secretScannerHook);
}
