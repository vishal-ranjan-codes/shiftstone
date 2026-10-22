/**
 * Reference hook (amendment B6): the secret scanner — blocks hardcoded
 * secrets at pre-tool-call, post-file-edit and pre-commit. Critical =
 * non-bypassable, runs on the inner gear too (L1 deterministic guardrail).
 *
 * The scanner is pure: it inspects only the text it is given (payload
 * content / command / mutations / file contents), so it is unit-testable and
 * never touches the filesystem itself.
 */

import type { Hook, HookDecision, HookPayload } from './types.ts';

export interface SecretPattern {
  name: string;
  re: RegExp;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitHub fine-grained PAT', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: 'OpenAI-style API key', re: /\bsk-[A-Za-z0-9-]{32,}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9-]{16,}\b/ },
  {
    name: 'hardcoded credential assignment',
    re: /\b(?:password|passwd|secret|api[_-]?key|auth[_-]?token|access[_-]?token)\b\s*[:=]\s*["']([^"'\s]{8,})["']/i,
  },
];

/** Obvious placeholders are not secrets (docs, samples, config templates). */
const PLACEHOLDER = /(example|placeholder|changeme|change-?me|xxx+|your-|<|\$\{|\*\*\*|dummy|fake|sample)/i;

export interface ScanResult {
  findings: string[];
}

export function scanText(text: string): ScanResult {
  const findings: string[] = [];
  for (const pattern of SECRET_PATTERNS) {
    const match = pattern.re.exec(text);
    if (!match) continue;
    const value = match[1] ?? match[0];
    if (PLACEHOLDER.test(value)) continue;
    findings.push(`${pattern.name}: ${match[0].slice(0, 60)}${match[0].length > 60 ? '…' : ''}`);
  }
  return { findings };
}

function textsOf(payload: HookPayload): { label: string; text: string }[] {
  const texts: { label: string; text: string }[] = [];
  if (payload.content) texts.push({ label: 'content', text: payload.content });
  if (payload.command) texts.push({ label: 'command', text: payload.command });
  for (const mutation of payload.mutations ?? []) texts.push({ label: 'mutation', text: mutation });
  for (const file of payload.files ?? []) {
    if (file.content) texts.push({ label: file.path, text: file.content });
  }
  return texts;
}

export const secretScannerHook: Hook = {
  name: 'secret-scanner',
  points: ['pre-tool-call', 'post-file-edit', 'pre-commit'],
  critical: true, // non-bypassable, even on the inner gear (B6)
  run(payload: HookPayload): HookDecision {
    const findings: string[] = [];
    for (const { label, text } of textsOf(payload)) {
      for (const finding of scanText(text).findings) {
        findings.push(`${label}: ${finding}`);
      }
    }
    if (findings.length > 0) {
      return {
        allowed: false,
        reason: `hardcoded secret detected — ${findings.length} finding(s); use an environment variable or secret manager`,
        findings,
      };
    }
    return { allowed: true };
  },
};
