import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkProtectedAction,
  validateApproval,
  classifyProtectedAction,
  isHumanApprover,
  loadProtectedActionsPolicy,
} from '../validate-protected-actions.js';
import {
  evaluateProtectedActionToolUse,
  evaluatePreflightToolUse,
  preToolUseProtectedActionHook,
} from '../../harness/hooks/pre-tool-use.ts';
import {
  StateMachine,
  transitionToBlocked,
  isBlocked,
  isEscalated,
} from '../../harness/loop-runner/state-machine.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('Unit U24 & U25: Protected Action Approvals & Enforcement Gate (UG-23, UG-24)', () => {
  const policy = loadProtectedActionsPolicy(path.join(ROOT, '.shiftstone', 'governance', 'protected-actions-policy.yaml'));
  const testNow = new Date('2026-10-21T12:00:00.000Z');

  it('TS-U25-01 (L2): halts unapproved ALTER POLICY and wrangler deploy in terminal state "blocked"', () => {
    // 1. ALTER POLICY on migrations
    const rlsCheck = checkProtectedAction({
      root: ROOT,
      policy,
      targetPath: 'supabase/migrations/20261021_secure_tenants.sql',
      content: 'ALTER POLICY "tenant_isolation" ON "tenants" USING (tenant_id = auth.uid());',
      approvals: [],
      now: testNow,
    });

    expect(rlsCheck.ok).toBe(false);
    expect(rlsCheck.terminalState).toBe('blocked');
    expect(rlsCheck.code).toBe('PROTECTED_ACTION_BLOCKED');
    expect(rlsCheck.actionClass).toBe('rls-policy-mutation');

    // 2. wrangler deploy command
    const deployCheck = checkProtectedAction({
      root: ROOT,
      policy,
      command: 'wrangler deploy --env production',
      approvals: [],
      now: testNow,
    });

    expect(deployCheck.ok).toBe(false);
    expect(deployCheck.terminalState).toBe('blocked');
    expect(deployCheck.code).toBe('PROTECTED_ACTION_BLOCKED');
    expect(deployCheck.actionClass).toBe('production-deploy');
  });

  it('TS-U25-02 (L2): rejects expired approvals and agent-authored approvals', () => {
    const baseApproval = {
      schemaVersion: 'protected-action-approval/v1',
      approvalId: 'APR-20261021-001',
      actionClass: 'rls-policy-mutation',
      scopePaths: ['supabase/migrations/*'],
      gitTreeHash: 'workspace-head',
      approver: 'security-lead@shiftstone.dev',
      approvedAt: '2026-10-21T08:00:00.000Z',
      expiresAt: '2026-10-21T11:00:00.000Z', // Expired relative to testNow (12:00)
      justification: 'RLS policy update approval',
      status: 'active',
    };

    // 1. Expired approval
    const expiredVal = validateApproval(baseApproval, { now: testNow });
    expect(expiredVal.ok).toBe(false);
    expect(expiredVal.violations.some((v) => v.code === 'APPROVAL_EXPIRED')).toBe(true);

    // 2. Agent-authored approval (claude-maker)
    const agentApproval = {
      ...baseApproval,
      expiresAt: '2026-10-22T08:00:00.000Z',
      approver: 'claude-maker',
    };
    const agentVal = validateApproval(agentApproval, { now: testNow });
    expect(agentVal.ok).toBe(false);
    expect(agentVal.violations.some((v) => v.code === 'AGENT_APPROVER_FORBIDDEN')).toBe(true);

    // 3. Human identity helper check
    expect(isHumanApprover('claude-maker')).toBe(false);
    expect(isHumanApprover('agent-3')).toBe(false);
    expect(isHumanApprover('gpt-4o-reviewer')).toBe(false);
    expect(isHumanApprover('senior-architect@shiftstone.dev')).toBe(true);
  });

  it('allows protected action when valid human approval covers exact scope', () => {
    const validApproval = {
      schemaVersion: 'protected-action-approval/v1',
      approvalId: 'APR-20261021-042',
      actionClass: 'rls-policy-mutation',
      scopePaths: ['supabase/migrations/20261021_secure_tenants.sql'],
      gitTreeHash: 'workspace-head',
      approver: 'security-officer@shiftstone.dev',
      approvedAt: '2026-10-21T10:00:00.000Z',
      expiresAt: '2026-10-22T10:00:00.000Z',
      justification: 'Tenancy isolation audit approved',
      status: 'active',
    };

    const check = checkProtectedAction({
      root: ROOT,
      policy,
      targetPath: 'supabase/migrations/20261021_secure_tenants.sql',
      content: 'ALTER POLICY "tenant_isolation" ON "tenants" USING (true);',
      approvals: [validApproval],
      now: testNow,
    });

    expect(check.ok).toBe(true);
    expect(check.actionClass).toBe('rls-policy-mutation');
    expect(check.approvalId).toBe('APR-20261021-042');
  });

  it('rejects protected action when approval scope does not cover target path', () => {
    const mismatchApproval = {
      schemaVersion: 'protected-action-approval/v1',
      approvalId: 'APR-20261021-050',
      actionClass: 'rls-policy-mutation',
      scopePaths: ['supabase/migrations/20261020_other.sql'],
      gitTreeHash: 'workspace-head',
      approver: 'lead-dev@shiftstone.dev',
      approvedAt: '2026-10-21T10:00:00.000Z',
      expiresAt: '2026-10-22T10:00:00.000Z',
      justification: 'Other migration approved',
      status: 'active',
    };

    const check = checkProtectedAction({
      root: ROOT,
      policy,
      targetPath: 'supabase/migrations/20261021_secure_tenants.sql',
      content: 'ALTER POLICY "tenant_isolation" ON "tenants" USING (true);',
      approvals: [mismatchApproval],
      now: testNow,
    });

    expect(check.ok).toBe(false);
    expect(check.terminalState).toBe('blocked');
    expect(check.code).toBe('PROTECTED_ACTION_BLOCKED');
  });

  it('wires into pre-tool-use hook and blocks unapproved tool invocations with PROTECTED_ACTION_BLOCKED', () => {
    const payload = {
      tool: 'edit_file',
      command: 'supabase db reset',
      files: [{ path: 'supabase/migrations/001.sql', content: 'DROP TABLE users;' }],
    };

    const decision = evaluateProtectedActionToolUse(payload, { root: ROOT });
    expect(decision.allowed).toBe(false);
    expect(decision.findings).toContain('PROTECTED_ACTION_BLOCKED');
    expect(decision.reason).toContain('PROTECTED_ACTION_BLOCKED');

    const hookDecision = preToolUseProtectedActionHook.run(payload);
    expect(hookDecision.allowed).toBe(false);
    expect(hookDecision.findings).toContain('PROTECTED_ACTION_BLOCKED');
  });

  it('state-machine helper transitions deterministically to terminal state "blocked"', () => {
    const sm = new StateMachine({
      success: 'verified and done',
      no_op: 'nothing to do',
      blocked: 'human authorization or prerequisite missing',
      stalled: 'no progress',
      exhausted: 'turn/cost budget reached',
    });

    sm.transition('triggered');
    sm.transition('precheck');
    sm.transition('execute');

    expect(sm.current).toBe('execute');
    expect(isBlocked(sm.current)).toBe(false);

    const exit = transitionToBlocked(sm, {
      actionClass: 'production-deploy',
      reason: 'PROTECTED_ACTION_BLOCKED: wrangler deploy requires human sign-off',
    });

    expect(sm.current).toBe('blocked');
    expect(isBlocked(sm.current)).toBe(true);
    expect(exit.state).toBe('blocked');
    expect(exit.reason).toContain('PROTECTED_ACTION_BLOCKED');

    // Escalated vs Blocked semantic distinction
    expect(isEscalated({ status: 'ESCALATED' })).toBe(true);
    expect(isEscalated({ status: 'BLOCKED' })).toBe(false);
  });

  it('TS-U25-05: verifies docs/bible/** is NOT a protected action, allowing standard TDD documentation updates', () => {
    const bibleCheck = checkProtectedAction({
      root: ROOT,
      policy,
      targetPath: 'docs/bible/07-frontend/design-tokens.md',
      content: '# Design Tokens Specification',
      approvals: [],
      now: testNow,
    });

    expect(bibleCheck.ok).toBe(true);
    expect(classifyProtectedAction({ targetPath: 'docs/bible/07-frontend/design-tokens.md', policy })).toBeNull();
  });
});
