/**
 * Lifecycle hook types (amendment B6) — deterministic guardrails at the
 * points the agent should never forget: before a tool call, after a file
 * edit, before a commit. L1-deterministic: they run on BOTH gears.
 */

export type HookPoint = 'pre-tool-call' | 'post-file-edit' | 'pre-commit';

export const HOOK_POINTS: HookPoint[] = ['pre-tool-call', 'post-file-edit', 'pre-commit'];

export interface HookFile {
  path: string;
  /** Optional inline content; hooks stay pure (no fs) and scan what they are given. */
  content?: string;
}

export interface HookPayload {
  loop?: string;
  turn?: number;
  /** pre-tool-call: which tool is about to run. */
  tool?: string;
  /** pre-tool-call: the command the tool will execute. */
  command?: string;
  /** post-file-edit: mutations declared by the turn. */
  mutations?: string[];
  /** pre-commit / post-file-edit: file contents to inspect. */
  files?: HookFile[];
  /** Generic text under inspection (diff hunk, snippet, ...). */
  content?: string;
}

export interface HookDecision {
  allowed: boolean;
  reason?: string;
  /** Machine-readable findings (e.g. secret pattern names). */
  findings?: string[];
}

export interface Hook {
  name: string;
  points: HookPoint[];
  /** Critical hooks cannot be disabled (secret scanner, B6). */
  critical?: boolean;
  run(payload: HookPayload): HookDecision | Promise<HookDecision>;
}

export interface HookRunResult {
  allowed: boolean;
  /** Name of the hook that refused (first refusal wins). */
  blocked_by?: string;
  reason?: string;
  findings?: string[];
  /** Total hook time for this point — budget is <50ms (phase risk table). */
  duration_ms: number;
  /** Set when the budget was exceeded or a disable request was ignored. */
  warnings: string[];
}

export interface FireOpts {
  /** Non-critical hooks whose names are skipped; critical hooks ignore this. */
  disable?: string[];
}
