/**
 * Shell command runner used by the verifier ladder and executors.
 * Commands run through the system shell with a hard timeout.
 */

import { spawn } from 'node:child_process';
import type { CommandRunner, ExecResult } from './types.ts';

export interface CommandRunnerOpts {
  cwd?: string;
  timeoutMs?: number;
}

export function createCommandRunner(opts?: CommandRunnerOpts): CommandRunner {
  const cwd = opts?.cwd ?? process.cwd();
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  return (command: string): Promise<ExecResult> =>
    new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      const child = spawn(command, { shell: true, cwd, env: process.env });
      const timer = setTimeout(() => {
        if (!settled) {
          child.kill();
        }
      }, timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr: `${stderr}\n${String(err)}`, exitCode: 127 });
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code === null ? 124 : code });
      });
    });
}
