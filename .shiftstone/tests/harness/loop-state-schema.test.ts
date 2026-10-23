import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { validateAgainstSchema } from '../../init/schema-validate.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

async function loadJson(rel: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, rel), 'utf8'));
}

describe('.loops state schema (task 5.5)', () => {
  it('the _template/state.json validates against docs/loops/.schema.json', async () => {
    const schema = (await loadJson('docs/loops/.schema.json')) as Record<string, unknown>;
    const template = await loadJson('docs/loops/_template/state.json');
    expect(validateAgainstSchema(template, schema)).toEqual([]);
  });

  it('a fully populated state (trajectory, terminal) validates', async () => {
    const schema = (await loadJson('docs/loops/.schema.json')) as Record<string, unknown>;
    const full = {
      ...(await loadJson('docs/loops/_template/state.json') as Record<string, unknown>),
      enumerated: ['item-a'],
      output_hash: 'abc123',
      terminal: 'success',
      trajectory: [
        { turn: 1, claimed_checks: ['typecheck'], executed_checks: ['typecheck'], passed: true },
      ],
    };
    expect(validateAgainstSchema(full, schema)).toEqual([]);
  });

  it('rejects malformed states: missing fields, bad terminal, unknown property', async () => {
    const schema = (await loadJson('docs/loops/.schema.json')) as Record<string, unknown>;
    const template = (await loadJson('docs/loops/_template/state.json')) as Record<string, unknown>;

    const missing = { ...template };
    delete missing['red_green'];
    expect(validateAgainstSchema(missing, schema).join('\n')).toContain('missing required property "red_green"');

    const badTerminal = { ...template, terminal: 'kinda-success' };
    expect(validateAgainstSchema(badTerminal, schema).join('\n')).toContain('must be one of');

    const unknown = { ...template, typo_field: 1 };
    expect(validateAgainstSchema(unknown, schema).join('\n')).toContain('unknown property "typo_field"');

    const badRedGreen = { ...template, red_green: { required: true, proven: false, baseline: 'blue', current: 'unknown' } };
    expect(validateAgainstSchema(badRedGreen, schema).join('\n')).toContain('must be one of');
  });

  it('rejects a loop name that does not match the -loop pattern', async () => {
    const schema = (await loadJson('docs/loops/.schema.json')) as Record<string, unknown>;
    const template = (await loadJson('docs/loops/_template/state.json')) as Record<string, unknown>;
    const bad = { ...template, loop: 'myworkflow' };
    expect(validateAgainstSchema(bad, schema).join('\n')).toContain('does not match');
  });

  it('runtime state files written by the harness validate (when present)', async () => {
    const schema = (await loadJson('docs/loops/.schema.json')) as Record<string, unknown>;
    const loopsDir = path.join(REPO_ROOT, '.loops');
    let entries: string[] = [];
    try {
      entries = (await readdir(loopsDir, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      // fresh clone — .loops/ is gitignored, nothing to validate
    }
    const problems: string[] = [];
    for (const loop of entries) {
      let raw: string;
      try {
        raw = await readFile(path.join(loopsDir, loop, 'state.json'), 'utf8');
      } catch {
        continue; // loop dir exists but never persisted a state
      }
      const errors = validateAgainstSchema(JSON.parse(raw), schema);
      for (const error of errors) problems.push(`.loops/${loop}/state.json: ${error}`);
    }
    expect(problems).toEqual([]);
  });
});
