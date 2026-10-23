#!/usr/bin/env node
/**
 * Loop CLI launcher — runs the TypeScript CLI through Node's native type
 * stripping (no build step).
 *
 *   node .shiftstone/harness/cli.js run <loop-id>
 *   node .shiftstone/harness/cli.js validate <loop-id>
 *   node .shiftstone/harness/cli.js status <loop-id>
 */

const mod = await import('./loop-runner/cli.ts');
const code = await mod.main(process.argv.slice(2));
process.exitCode = code;
// schedule/watch stay alive on a pending promise; exit only for finite commands
if (code !== undefined && !Number.isNaN(code)) {
  setTimeout(() => process.exit(code), 0);
}
