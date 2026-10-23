#!/usr/bin/env node
/**
 * Level 5 Protected Action Approvals & Enforcement Gate (UG-23, UG-24 / Phase 6 Units U24, U25)
 *
 * Enforces:
 *   1. Approval artifacts in .shiftstone/governance/approvals/ conform to protected-action-approval/v1.
 *   2. Approvals are strictly signed by humans (anti-collusion: rejects AI agent IDs).
 *   3. Expired approvals (expiresAt < now) and consumed/revoked approvals cannot authorize actions.
 *   4. Actions matching .shiftstone/governance/protected-actions-policy.yaml without an active,
 *      scope-bound approval halt immediately in terminal state "blocked" (never "escalated").
 *
 * Supports --self-test flag. Exit code 0 on pass; exit code 1 on defect.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const APPROVAL_ID_PATTERN = /^APR-[0-9]{8}-[0-9]{3}$/;
export const GIT_HASH_PATTERN = /(^[0-9a-f]{40}$|^workspace-head$)/;

export const ACTION_CLASSES = [
  'db-migration-destructive',
  'rls-policy-mutation',
  'auth-secret-rotation',
  'ssot-bible-mutation',
  'production-deploy',
  'core-governance-override',
];

export const VALID_STATUSES = new Set(['active', 'consumed', 'expired', 'revoked']);

export const KNOWN_AGENT_PATTERNS = [
  /\bclaude\b/i,
  /\bagent\b/i,
  /\bgpt\b/i,
  /\bai-maker\b/i,
  /\bbot\b/i,
  /\bassistant\b/i,
  /\bautogen\b/i,
  /\bcopilot\b/i,
];

/**
 * Check if approver string represents a valid human identity.
 * Rejects known AI agent markers (anti-collusion rule).
 */
export function isHumanApprover(approver) {
  if (!approver || typeof approver !== 'string' || approver.trim().length < 2) {
    return false;
  }
  const clean = approver.trim();
  for (const pat of KNOWN_AGENT_PATTERNS) {
    if (pat.test(clean)) return false;
  }
  return true;
}

/**
 * Simple glob matcher supporting *, **, and prefix/exact matching.
 */
export function matchGlob(str, pattern) {
  if (!str || !pattern) return false;
  const s = str.replace(/\\/g, '/').replace(/^\.\//, '');
  const p = pattern.replace(/\\/g, '/').replace(/^\.\//, '');

  if (p === '*' || p === '**') return true;
  if (p === s) return true;

  // Convert glob pattern to RegExp
  // Escape regex special chars except *
  let regexStr = '^';
  let i = 0;
  while (i < p.length) {
    if (p[i] === '*' && p[i + 1] === '*') {
      if (p[i + 2] === '/') {
        regexStr += '(?:.+/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
    } else if (p[i] === '*') {
      regexStr += '[^/]*';
      i += 1;
    } else if ('+?.()|[]{}^$\\'.includes(p[i])) {
      regexStr += '\\' + p[i];
      i += 1;
    } else {
      regexStr += p[i];
      i += 1;
    }
  }
  regexStr += '$';

  try {
    const regex = new RegExp(regexStr);
    return regex.test(s);
  } catch {
    return s.startsWith(p.replace(/\*.*$/, ''));
  }
}

/**
 * Load and parse .shiftstone/governance/protected-actions-policy.yaml.
 */
export function loadProtectedActionsPolicy(policyPath = path.join(ROOT, '.shiftstone', 'governance', 'protected-actions-policy.yaml')) {
  if (!existsSync(policyPath)) {
    throw new Error(`Protected actions policy file missing: ${policyPath}`);
  }
  const raw = readFileSync(policyPath, 'utf8');
  return parseYaml(raw);
}

/**
 * Classify whether a target path, command, or content triggers a protected actionClass.
 * Returns triggered actionClass and rule description, or null if uninhibited.
 */
export function classifyProtectedAction(options = {}) {
  const { targetPath, command, content, policy } = options;
  const activePolicy = policy ?? loadProtectedActionsPolicy();
  const rules = activePolicy.rules ?? [];

  const normPath = targetPath ? targetPath.replace(/\\/g, '/').replace(/^\.\//, '') : null;
  const normCmd = command ? command.trim() : null;

  for (const rule of rules) {
    // 1. Check filePatterns
    if (normPath && Array.isArray(rule.filePatterns)) {
      for (const pat of rule.filePatterns) {
        if (matchGlob(normPath, pat)) {
          // If sqlPatterns also specified on file mutation, verify content or sql trigger
          if (Array.isArray(rule.sqlPatterns) && rule.sqlPatterns.length > 0) {
            const textToScan = [content ?? '', normCmd ?? ''].join(' ');
            if (textToScan.trim()) {
              for (const sqlPat of rule.sqlPatterns) {
                const regex = new RegExp(sqlPat.replace(/^\(\?i\)/, ''), 'i');
                if (regex.test(textToScan)) {
                  return {
                    actionClass: rule.actionClass,
                    description: rule.description,
                    trigger: `SQL pattern '${sqlPat}' in '${normPath}'`,
                  };
                }
              }
            }
          } else {
            return {
              actionClass: rule.actionClass,
              description: rule.description,
              trigger: `File pattern '${pat}' matched '${normPath}'`,
            };
          }
        }
      }
    }

    // 2. Check commands
    if (normCmd && Array.isArray(rule.commands)) {
      for (const cmdPattern of rule.commands) {
        if (normCmd === cmdPattern || normCmd.startsWith(cmdPattern + ' ')) {
          return {
            actionClass: rule.actionClass,
            description: rule.description,
            trigger: `Command '${normCmd}' matched protected command '${cmdPattern}'`,
          };
        }
      }
    }

    // 3. Check standalone sqlPatterns against content or command
    if (Array.isArray(rule.sqlPatterns)) {
      const textToScan = [content ?? '', normCmd ?? ''].join(' ');
      if (textToScan.trim()) {
        for (const sqlPat of rule.sqlPatterns) {
          const regex = new RegExp(sqlPat.replace(/^\(\?i\)/, ''), 'i');
          if (regex.test(textToScan)) {
            return {
              actionClass: rule.actionClass,
              description: rule.description,
              trigger: `SQL pattern '${sqlPat}' matched content/command`,
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Validates a single protected action approval record.
 */
export function validateApproval(record, options = {}) {
  const violations = [];

  if (!record || typeof record !== 'object') {
    return {
      ok: false,
      violations: [{ code: 'INVALID_RECORD', message: 'Approval must be a JSON object' }],
    };
  }

  // schemaVersion
  if (record.schemaVersion !== 'protected-action-approval/v1') {
    violations.push({
      code: 'INVALID_SCHEMA_VERSION',
      message: `schemaVersion must be 'protected-action-approval/v1', got '${record.schemaVersion}'`,
    });
  }

  // approvalId
  if (!record.approvalId || typeof record.approvalId !== 'string' || !APPROVAL_ID_PATTERN.test(record.approvalId)) {
    violations.push({
      code: 'INVALID_APPROVAL_ID',
      message: `approvalId must match pattern ^APR-[0-9]{8}-[0-9]{3}$, got '${record.approvalId}'`,
    });
  }

  // actionClass
  if (!record.actionClass || !ACTION_CLASSES.includes(record.actionClass)) {
    violations.push({
      code: 'INVALID_ACTION_CLASS',
      message: `actionClass must be one of [${ACTION_CLASSES.join(', ')}], got '${record.actionClass}'`,
    });
  }

  // scopePaths
  if (!Array.isArray(record.scopePaths) || record.scopePaths.length === 0) {
    violations.push({
      code: 'INVALID_SCOPE_PATHS',
      message: 'scopePaths must be a non-empty array of strings',
    });
  } else {
    for (const sp of record.scopePaths) {
      if (typeof sp !== 'string' || sp.trim().length === 0) {
        violations.push({
          code: 'INVALID_SCOPE_PATH_ITEM',
          message: 'Each item in scopePaths must be a non-empty string',
        });
      }
    }
  }

  // gitTreeHash
  if (!record.gitTreeHash || typeof record.gitTreeHash !== 'string' || !GIT_HASH_PATTERN.test(record.gitTreeHash)) {
    violations.push({
      code: 'INVALID_GIT_TREE_HASH',
      message: "gitTreeHash must be a 40-character SHA or 'workspace-head'",
    });
  }

  // approver & anti-collusion
  if (!record.approver || typeof record.approver !== 'string') {
    violations.push({
      code: 'MISSING_APPROVER',
      message: 'approver is required and must be a string',
    });
  } else if (!isHumanApprover(record.approver)) {
    violations.push({
      code: 'AGENT_APPROVER_FORBIDDEN',
      message: `approver must be a verified human identity; AI agent identifiers are forbidden: '${record.approver}'`,
    });
  }

  // approvedAt
  if (!record.approvedAt || isNaN(Date.parse(record.approvedAt))) {
    violations.push({
      code: 'INVALID_APPROVED_AT',
      message: `approvedAt must be a valid ISO-8601 timestamp, got '${record.approvedAt}'`,
    });
  }

  // expiresAt
  if (!record.expiresAt || isNaN(Date.parse(record.expiresAt))) {
    violations.push({
      code: 'INVALID_EXPIRES_AT',
      message: `expiresAt must be a valid ISO-8601 timestamp, got '${record.expiresAt}'`,
    });
  } else if (options.checkExpiration !== false) {
    const now = options.now ? new Date(options.now) : new Date();
    if (new Date(record.expiresAt) <= now) {
      violations.push({
        code: 'APPROVAL_EXPIRED',
        message: `Approval expired at ${record.expiresAt} (current time: ${now.toISOString()})`,
      });
    }
  }

  // justification
  if (!record.justification || typeof record.justification !== 'string' || record.justification.trim().length < 5) {
    violations.push({
      code: 'INVALID_JUSTIFICATION',
      message: 'justification must be at least 5 characters long',
    });
  }

  // status
  if (!record.status || !VALID_STATUSES.has(record.status)) {
    violations.push({
      code: 'INVALID_STATUS',
      message: `status must be one of [${[...VALID_STATUSES].join(', ')}], got '${record.status}'`,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

/**
 * Check if an approval's scopePaths cover a given targetPath or command.
 */
export function scopeCovers(scopePaths, targetPath, command) {
  if (!Array.isArray(scopePaths)) return false;
  for (const sp of scopePaths) {
    if (sp === '*' || sp === '**') return true;
    if (targetPath && matchGlob(targetPath, sp)) return true;
    if (command && (command === sp || command.startsWith(sp + ' '))) return true;
  }
  return false;
}

/**
 * Load all active approval files from approvalsDir.
 */
export function loadApprovals(approvalsDir) {
  if (!existsSync(approvalsDir)) return [];
  const files = readdirSync(approvalsDir).filter((f) => f.endsWith('.json') && f.startsWith('APR-'));
  const approvals = [];
  for (const file of files) {
    try {
      const full = path.join(approvalsDir, file);
      const parsed = JSON.parse(readFileSync(full, 'utf8'));
      approvals.push({ file, fullPath: full, data: parsed });
    } catch {
      // skip corrupted or invalid json in loader
    }
  }
  return approvals;
}

/**
 * Core enforcement check: evaluates if an action is protected, and if so,
 * whether a valid active human approval exists.
 *
 * Halts with terminalState: "blocked" if unapproved.
 */
export function checkProtectedAction(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const approvalsDir = options.approvalsDir ?? path.join(root, '.shiftstone', 'governance', 'approvals');
  const policyPath = options.policyPath ?? path.join(root, '.shiftstone', 'governance', 'protected-actions-policy.yaml');

  let policy;
  try {
    policy = options.policy ?? loadProtectedActionsPolicy(policyPath);
  } catch (err) {
    return {
      ok: false,
      terminalState: 'blocked',
      code: 'POLICY_ERROR',
      reason: `Failed to load protected actions policy: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const classification = classifyProtectedAction({
    targetPath: options.targetPath,
    command: options.command,
    content: options.content,
    policy,
  });

  if (!classification) {
    return { ok: true, actionClass: null };
  }

  const { actionClass, trigger, description } = classification;

  // Search approvals directory for active valid approval covering this action
  const approvals = options.approvals ?? loadApprovals(approvalsDir);
  const now = options.now ? new Date(options.now) : new Date();

  for (const app of approvals) {
    const record = app.data ?? app;
    const validation = validateApproval(record, { now, checkExpiration: true });
    if (!validation.ok) continue;
    if (record.status !== 'active') continue;
    if (record.actionClass !== actionClass) continue;

    if (scopeCovers(record.scopePaths, options.targetPath, options.command)) {
      return {
        ok: true,
        actionClass,
        approvalId: record.approvalId,
        approval: record,
      };
    }
  }

  return {
    ok: false,
    terminalState: 'blocked',
    code: 'PROTECTED_ACTION_BLOCKED',
    actionClass,
    reason: `PROTECTED_ACTION_BLOCKED: Action '${actionClass}' triggered by ${trigger} requires Level 5 human approval in .shiftstone/governance/approvals/APR-*.json (${description})`,
  };
}

/**
 * Self-test suite.
 */
export function runSelfTest(root = ROOT) {
  const testNow = new Date('2026-10-21T12:00:00.000Z');

  // 1. Policy exists and loads
  const policy = loadProtectedActionsPolicy(path.join(root, '.shiftstone', 'governance', 'protected-actions-policy.yaml'));
  if (!policy || !Array.isArray(policy.rules) || policy.rules.length < 5) {
    throw new Error('Self-test failed: protected-actions-policy.yaml invalid or incomplete');
  }

  // 2. Classify unapproved destructive SQL
  const destructiveCheck = checkProtectedAction({
    root,
    targetPath: 'supabase/migrations/20261021_drop.sql',
    content: 'DROP TABLE users CASCADE;',
    approvals: [],
  });
  if (destructiveCheck.ok || destructiveCheck.terminalState !== 'blocked' || destructiveCheck.actionClass !== 'db-migration-destructive') {
    throw new Error(`Self-test failed: destructive SQL should halt as 'blocked', got ${JSON.stringify(destructiveCheck)}`);
  }

  // 3. Classify unapproved production deploy command
  const deployCheck = checkProtectedAction({
    root,
    command: 'wrangler deploy',
    approvals: [],
  });
  if (deployCheck.ok || deployCheck.terminalState !== 'blocked' || deployCheck.actionClass !== 'production-deploy') {
    throw new Error(`Self-test failed: wrangler deploy should halt as 'blocked', got ${JSON.stringify(deployCheck)}`);
  }

  // 4. Valid human approval allows action
  const validApproval = {
    schemaVersion: 'protected-action-approval/v1',
    approvalId: 'APR-20261021-001',
    actionClass: 'production-deploy',
    scopePaths: ['wrangler deploy', 'app/**'],
    gitTreeHash: 'workspace-head',
    approver: 'lead-dev@shiftstone.dev',
    approvedAt: '2026-10-21T10:00:00.000Z',
    expiresAt: '2026-10-22T10:00:00.000Z',
    justification: 'Production release sign-off',
    status: 'active',
  };

  const approvedCheck = checkProtectedAction({
    root,
    command: 'wrangler deploy',
    approvals: [validApproval],
    now: testNow,
  });
  if (!approvedCheck.ok || approvedCheck.approvalId !== 'APR-20261021-001') {
    throw new Error(`Self-test failed: valid approval should allow action, got ${JSON.stringify(approvedCheck)}`);
  }

  // 5. Expired approval rejected
  const expiredApproval = {
    ...validApproval,
    expiresAt: '2026-10-20T10:00:00.000Z',
  };
  const expiredVal = validateApproval(expiredApproval, { now: testNow });
  if (expiredVal.ok || !expiredVal.violations.some((v) => v.code === 'APPROVAL_EXPIRED')) {
    throw new Error('Self-test failed: expired approval must fail validation with APPROVAL_EXPIRED');
  }

  // 6. Agent approver rejected
  const agentApproval = {
    ...validApproval,
    approver: 'claude-maker-agent',
  };
  const agentVal = validateApproval(agentApproval, { now: testNow });
  if (agentVal.ok || !agentVal.violations.some((v) => v.code === 'AGENT_APPROVER_FORBIDDEN')) {
    throw new Error('Self-test failed: agent approver must fail validation with AGENT_APPROVER_FORBIDDEN');
  }

  // 7. Non-protected action passes cleanly
  const nonProtected = checkProtectedAction({
    root,
    targetPath: 'docs/reports/analysis.md',
    command: 'pnpm test',
    approvals: [],
  });
  if (!nonProtected.ok || nonProtected.actionClass !== null) {
    throw new Error(`Self-test failed: non-protected action should pass, got ${JSON.stringify(nonProtected)}`);
  }

  return true;
}

// CLI Execution
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const selfTest = args.includes('--self-test');

  if (selfTest) {
    try {
      runSelfTest();
      console.log('PASS: validate-protected-actions --self-test completed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('FAIL: validate-protected-actions --self-test failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }

  // Default mode: validate all approvals in .shiftstone/governance/approvals/
  const approvalsDir = path.join(ROOT, '.shiftstone', 'governance', 'approvals');
  const approvals = loadApprovals(approvalsDir);
  let hasErrors = false;

  console.log(`=== Protected Action Approvals Report ===`);
  console.log(`Found ${approvals.length} approval record(s) in ${approvalsDir}`);

  for (const app of approvals) {
    const val = validateApproval(app.data);
    if (!val.ok) {
      hasErrors = true;
      console.error(`FAIL: ${app.file}`);
      for (const v of val.violations) {
        console.error(`  [${v.code}] ${v.message}`);
      }
    } else {
      console.log(`ok: ${app.file} (${app.data.actionClass} - ${app.data.status})`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }
  console.log('ok — All approval records pass validation.');
  process.exit(0);
}
