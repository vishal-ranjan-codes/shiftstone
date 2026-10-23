/**
 * Pre-Tool-Use Hook: Agent Pre-Flight Receipt & Level 5 Protected Action Enforcement (UG-12, UG-24 / Units U11, U25)
 *
 * Intercepts tool calls attempting file mutations or command executions:
 *   1. Level 5 Protected Actions Gate (UG-24): Unapproved destructive migrations, RLS policy changes,
 *      secret changes, direct SSOT edits, or production deploys halt immediately as PROTECTED_ACTION_BLOCKED.
 *   2. Pre-Flight Receipt Enforcement (UG-12): When ENFORCE_PREFLIGHT_RECEIPT=true (or options.enforce === true),
 *      verifies .agent-preflight-receipt.json exists, is unexpired, and covers the target file path.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReceipt } from '../../scripts/agent-preflight.js';
import { checkProtectedAction } from '../../scripts/validate-protected-actions.js';
import type { Hook, HookDecision, HookPayload } from './types.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const GOVERNED_MUTATION_TOOLS = new Set([
  'write_file',
  'edit_file',
  'create_file',
  'replace_file',
  'write',
  'edit',
  'delete_file',
  'file_writer',
]);

export const GOVERNED_PATH_PREFIXES = [
  'app/',
  'apps/',
  'packs/',
  '.shiftstone/',
  'supabase/',
  'workers/',
  'src/',
];

/** Check if a relative path is governed by pre-flight requirements */
export function isGovernedPath(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  return GOVERNED_PATH_PREFIXES.some((prefix) => norm.startsWith(prefix));
}

/** Extract target file paths from hook payload */
export function extractTargetPaths(payload: HookPayload): string[] {
  const targets: string[] = [];

  // 1. Check files array
  for (const f of payload.files ?? []) {
    if (f.path) targets.push(f.path);
  }

  // 2. Check mutations array
  for (const m of payload.mutations ?? []) {
    if (typeof m === 'string') targets.push(m);
  }

  // 3. Check tool + command / payload content if formatted as path
  if (payload.tool && GOVERNED_MUTATION_TOOLS.has(payload.tool)) {
    if (payload.command) {
      targets.push(payload.command);
    }
  }

  return [...new Set(targets)];
}

export interface ProtectedActionHookOpts {
  root?: string;
  approvalsDir?: string;
  policyPath?: string;
}

/**
 * Evaluate whether a tool call attempts an unapproved Level 5 protected action.
 * Halts with PROTECTED_ACTION_BLOCKED if an approval is required but missing or expired.
 */
export function evaluateProtectedActionToolUse(
  payload: HookPayload,
  opts: ProtectedActionHookOpts = {},
): HookDecision {
  const root = opts.root ?? ROOT;

  // 1. Check payload command if present
  if (payload.command) {
    const check = checkProtectedAction({
      root,
      command: payload.command,
      approvalsDir: opts.approvalsDir,
      policyPath: opts.policyPath,
    });
    if (!check.ok) {
      return {
        allowed: false,
        reason: check.reason,
        findings: ['PROTECTED_ACTION_BLOCKED', check.actionClass ?? 'UNKNOWN'],
      };
    }
  }

  // 2. Check payload files and mutations
  const targetPaths = extractTargetPaths(payload);
  const filesMap = new Map((payload.files ?? []).map((f) => [f.path, f.content]));

  for (const target of targetPaths) {
    const content = filesMap.get(target);
    const check = checkProtectedAction({
      root,
      targetPath: target,
      command: payload.command,
      content,
      approvalsDir: opts.approvalsDir,
      policyPath: opts.policyPath,
    });
    if (!check.ok) {
      return {
        allowed: false,
        reason: check.reason,
        findings: ['PROTECTED_ACTION_BLOCKED', check.actionClass ?? 'UNKNOWN'],
      };
    }
  }

  return { allowed: true };
}

export interface PreflightHookOpts extends ProtectedActionHookOpts {
  enforce?: boolean;
}

export function evaluatePreflightToolUse(
  payload: HookPayload,
  opts: PreflightHookOpts = {},
): HookDecision {
  const root = opts.root ?? ROOT;

  // Level 5 Protected Actions Gate takes precedence over Level 2 pre-flight receipt
  const protectedDecision = evaluateProtectedActionToolUse(payload, opts);
  if (!protectedDecision.allowed) {
    return protectedDecision;
  }

  const isEnforced =
    opts.enforce ??
    (process.env.ENFORCE_PREFLIGHT_RECEIPT === 'true' ||
      process.env.NODE_ENV === 'test-enforced' ||
      Boolean(payload.loop));

  if (!isEnforced) {
    return { allowed: true };
  }

  const isMutationTool = payload.tool ? GOVERNED_MUTATION_TOOLS.has(payload.tool) : false;
  const targetPaths = extractTargetPaths(payload);

  if (!isMutationTool && targetPaths.length === 0) {
    return { allowed: true };
  }

  // Check each governed target path
  for (const target of targetPaths) {
    if (!isGovernedPath(target)) {
      continue;
    }

    const check = checkReceipt(target, root);
    if (!check.ok) {
      const remediation = `Run: node .shiftstone/scripts/agent-preflight.js --target "${target}" --verify-cmd "<verification-command>"`;
      return {
        allowed: false,
        reason: `PREFLIGHT_RECEIPT_REQUIRED [${check.code}]: ${check.message}. ${remediation}`,
        findings: ['PREFLIGHT_RECEIPT_REQUIRED', check.code ?? 'UNKNOWN'],
      };
    }
  }

  return { allowed: true };
}

export const preToolUseProtectedActionHook: Hook = {
  name: 'pre-tool-use-protected-action',
  points: ['pre-tool-call'],
  critical: true,
  run(payload: HookPayload): HookDecision {
    return evaluateProtectedActionToolUse(payload);
  },
};

export const preToolUsePreflightHook: Hook = {
  name: 'pre-tool-use-preflight',
  points: ['pre-tool-call'],
  critical: false,
  run(payload: HookPayload): HookDecision {
    return evaluatePreflightToolUse(payload);
  },
};
