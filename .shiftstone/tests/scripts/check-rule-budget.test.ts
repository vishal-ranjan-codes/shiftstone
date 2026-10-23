import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, '.shiftstone', 'scripts', 'check-rule-budget.js');

describe('check-rule-budget (task 3.10 / B9 — the /lesson budget gate)', () => {
  it('reports the same line math as the parity gate and exits 0 in warn mode', async () => {
    const { report } = await import('../../scripts/check-rule-budget.js');
    const result = report(REPO_ROOT);

    expect(result.cap).toBe(200);
    expect(result.total).toBeGreaterThan(0);
    expect(['ok', 'warn', 'over']).toContain(result.level);
    if (result.total > result.cap) expect(result.level).toBe('over');
    else if (result.total >= result.cap * 0.9) expect(result.level).toBe('warn');
    else expect(result.level).toBe('ok');

    const res = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', timeout: 30_000 });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(`static budget: ${result.total}/${result.cap} lines`);
    if (result.level !== 'ok') expect(res.stdout + res.stderr).toContain('WARN');
  }, 30_000);

  it('warns when the static context is near or over the cap', async () => {
    const { report } = await import('../../scripts/check-rule-budget.js');
    // The shipped workspace sits at/above the 90% warning band — /lesson must
    // refuse to append until something is merged (this is the B9 pressure valve).
    const result = report(REPO_ROOT);
    if (result.ratio >= 0.9) {
      expect(result.level).not.toBe('ok');
    }
  });

  it('--strict exits 1 only when over the cap', async () => {
    const { report } = await import('../../scripts/check-rule-budget.js');
    const result = report(REPO_ROOT);
    const res = spawnSync(process.execPath, [SCRIPT, '--strict'], { encoding: 'utf8', timeout: 30_000 });
    expect(res.status).toBe(result.level === 'over' ? 1 : 0);
  }, 30_000);
});
