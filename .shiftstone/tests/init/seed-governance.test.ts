/**
 * Seed-governance settings + pack hook behavior (WS-B):
 * - `composition.commandcode` fragments merge over the generic settings base
 *   without overwriting local overrides (order-preserving for flagship
 *   byte-parity).
 * - The rr8 post-init hook resolves {{SUPABASE_TYPES_CMD}} from the variables
 *   map instead of printing the literal placeholder.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { writeCommandCodeSettings } from '../../init/seed-governance.js';
import { REPO_ROOT } from './workspace-fixture.js';

const readSettings = (root: string) =>
  JSON.parse(readFileSync(path.join(root, '.commandcode', 'settings.json'), 'utf8'));

describe('settings fragment merge (composition.commandcode over the generic base)', () => {
  it('appends pack permission entries to the generic base, preserving order', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cc-settings-'));
    const composition = {
      archetypes: [
        {
          manifest: {
            composition: {
              commandcode: {
                permissions: {
                  ask: ['Shell(wrangler deploy:*)'],
                  deny: ['Read(prod-secrets/**)'],
                },
              },
            },
          },
        },
      ],
    };
    expect(writeCommandCodeSettings(root, { packageManager: 'pnpm' }, composition)).toBe(true);
    const settings = readSettings(root);
    expect(settings.permissions.ask).toEqual([
      'Shell(git push:*)',
      'Shell(git commit:*)',
      'Shell(wrangler deploy:*)',
    ]);
    expect(settings.permissions.deny).toEqual([
      'Read(.dev.vars)',
      'Read(.env*)',
      'Read(secrets/**)',
      'Read(prod-secrets/**)',
    ]);
    expect(settings.permissions.allow).toContain('Shell(pnpm *)');
  });

  it('writes the generic base without pack stack entries when no fragment is given', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cc-settings-'));
    expect(writeCommandCodeSettings(root, { packageManager: 'pnpm' }, { archetypes: [] })).toBe(true);
    const settings = readSettings(root);
    expect(settings.permissions.ask).toEqual(['Shell(git push:*)', 'Shell(git commit:*)']);
    expect(JSON.stringify(settings)).not.toMatch(/wrangler/i);
  });

  it('never overwrites an existing settings file (local overrides win)', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cc-settings-'));
    expect(writeCommandCodeSettings(root, { packageManager: 'pnpm' }, { archetypes: [] })).toBe(true);
    const file = path.join(root, '.commandcode', 'settings.json');
    const sentinel = '{ "local": "override" }\n';
    writeFileSync(file, sentinel, 'utf8');
    expect(writeCommandCodeSettings(root, { packageManager: 'pnpm' }, { archetypes: [] })).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(sentinel);
  });
});

describe('rr8 post-init hook (WS-A item 5)', () => {
  it('resolves {{SUPABASE_TYPES_CMD}} from the variables map — never prints the literal', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'post-init-'));
    const hookRel = existsSync(path.join(REPO_ROOT, '.shiftstone', 'packs', 'rr8-supabase-cf', 'post-init.js'))
      ? path.join(REPO_ROOT, '.shiftstone', 'packs', 'rr8-supabase-cf', 'post-init.js')
      : path.join(REPO_ROOT, 'packs', 'rr8-supabase-cf', 'post-init.js');
    const hookUrl = pathToFileURL(hookRel).href;
    const mod = (await import(hookUrl)) as { run: (ctx: unknown) => { typesDir: string } };
    const archetype = {
      name: 'rr8-supabase-cf',
      manifest: { spec: { defaultAppPath: 'apps/web' } },
    };
    const composition = { archetypes: [archetype] };

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    let result: { typesDir: string } | undefined;
    try {
      result = mod.run({
        root,
        composition,
        archetype,
        variables: { '{{SUPABASE_TYPES_CMD}}': 'pnpm --filter @app/web supabase:types' },
      });
    } finally {
      console.log = originalLog;
    }

    expect(result?.typesDir.replace(/\\/g, '/')).toBe('apps/web/app/types');
    const output = logs.join('\n');
    expect(output).toContain('pnpm --filter @app/web supabase:types');
    expect(output).not.toContain('{{SUPABASE_TYPES_CMD}}');
  });
});
