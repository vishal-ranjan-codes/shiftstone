/**
 * Seed-governance settings + pack hook behavior (WS-B):
 * - `composition.commandcode` fragments merge over the generic settings base
 *   without overwriting local overrides (order-preserving for flagship
 *   byte-parity).
 * - The rr8 post-init hook resolves {{SUPABASE_TYPES_CMD}} from the variables
 *   map instead of printing the literal placeholder.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { main } from '../../init.js';
import { LAB_ONLY_SCRIPTS, isLabOnlyScript, writeCommandCodeSettings } from '../../init/seed-governance.js';
import { REPO_ROOT, TEMPLATE_ROOT, makeWorkspace } from './workspace-fixture.js';

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

describe('lab-only script strip list (LOCK-B1 / AC-U1-02)', () => {
  it('enumerates every lab-maintenance script and matches sync:engine variants', () => {
    for (const key of [
      'parity',
      'manifest',
      'validate:budgets',
      'validate:integrity',
      'validate:junctions',
      'validate:parity',
      'validate:manifest',
      'validate:contracts',
      'validate:plans',
      'validate:lenses',
      'validate:reports',
      'validate:anti-gaming',
      'validate:learning',
      'validate:decisions',
      'compile:decisions',
      'sync:bible:proposal',
      'validate:protected',
      'validate:release',
      'trials',
      'validate:telemetry',
      'validate:workspace',
    ]) {
      expect(LAB_ONLY_SCRIPTS, `strip list must enumerate ${key}`).toContain(key);
      expect(isLabOnlyScript(key), `${key} must be lab-only`).toBe(true);
    }
    expect(isLabOnlyScript('sync:engine')).toBe(true);
    expect(isLabOnlyScript('sync:engine:check')).toBe(true);
  });

  it('never flags application or engine-namespace scripts as lab-only', () => {
    for (const key of ['dev', 'build', 'test', 'typecheck', 'lint', 'postinstall', 'test:engine', 'typecheck:engine', 'lint:engine']) {
      expect(isLabOnlyScript(key), `${key} must survive the strip`).toBe(false);
    }
  });
});

describe('writeWorkspaceFiles merge semantics (LOCK-B2 / AC-U1-01..04)', () => {
  it('merges pack rootScripts into an existing root package.json instead of skipping it', async () => {
    const root = await makeWorkspace();
    // Simulate the shipped child surface plus user-owned fields: lab scripts,
    // engine-namespace scripts, a colliding `test` key, dependencies, engines.
    const shipped = JSON.parse(
      readFileSync(path.join(TEMPLATE_ROOT, 'package.json'), 'utf8'),
    );
    const preExisting = {
      ...shipped,
      description: 'user description survives',
      engines: { node: '>=22' },
      dependencies: { 'left-pad': '^1.3.0' },
      scripts: {
        ...shipped.scripts,
        'test:engine': 'pnpm -C .shiftstone test',
        'typecheck:engine': 'pnpm -C .shiftstone typecheck',
        'lint:engine': 'pnpm -C .shiftstone lint',
        'sync:engine': 'node .shiftstone/scripts/sync-engine.js',
        'my:custom': 'node scripts/custom.js',
      },
    };
    writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(preExisting, null, 2)}\n`, 'utf8');

    const code = await main([`--root=${root}`, '--name=MergeApp', '--layout=monorepo', '-y']);
    expect(code).toBe(0);

    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

    // Project renamed from the interview answer (LOCK-B2)
    expect(pkg.name).toBe('mergeapp-workspace');

    // Pack rootScripts win per-key — all ten flagship keys resolve to apps/web (AC-U1-04)
    for (const key of ['dev', 'build', 'start', 'typecheck', 'lint', 'test', 'test:ui', 'test:e2e', 'deploy', 'supabase:types']) {
      expect(pkg.scripts[key], `rootScripts.${key} must come from the pack`).toBe(`pnpm -C apps/web ${key}`);
    }

    // Every lab-only script is stripped, sync:engine variants included (AC-U1-02)
    for (const key of [...LAB_ONLY_SCRIPTS, 'sync:engine']) {
      expect(pkg.scripts[key], `${key} must be stripped`).toBeUndefined();
    }

    // Engine namespace and user-owned fields survive (AC-U1-01/02)
    expect(pkg.scripts['test:engine']).toBe('pnpm -C .shiftstone test');
    expect(pkg.scripts['typecheck:engine']).toBe('pnpm -C .shiftstone typecheck');
    expect(pkg.scripts['lint:engine']).toBe('pnpm -C .shiftstone lint');
    expect(pkg.scripts['my:custom']).toBe('node scripts/custom.js');
    expect(pkg.scripts.postinstall).toContain('setup-ide-junctions');
    expect(pkg.dependencies).toEqual({ 'left-pad': '^1.3.0' });
    expect(pkg.engines).toEqual({ node: '>=22' });
    expect(pkg.description).toBe('user description survives');
    expect(pkg.version).toBe(shipped.version);

    // pnpm.onlyBuiltDependencies added from the manifest declaration
    expect(pkg.pnpm.onlyBuiltDependencies).toEqual(['esbuild', 'workerd']);
  }, 120_000);
});

describe('root workspace & TypeScript configs (LOCK-B6 / AC-U3-01..03)', () => {
  it('ships parseable pnpm-workspace.yaml and solution-style tsconfig.json in the child', () => {
    const workspaceYaml = readFileSync(path.join(TEMPLATE_ROOT, 'pnpm-workspace.yaml'), 'utf8');
    const parsed = parseYaml(workspaceYaml) as { packages: string[] };
    expect(parsed.packages).toEqual(['apps/*', 'packages/*']);

    const tsconfig = JSON.parse(readFileSync(path.join(TEMPLATE_ROOT, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.files).toEqual([]);
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noEmit).toBe(true);
    const refs = tsconfig.references.map((r: { path: string }) => r.path);
    expect(refs).toContain('./apps/web');
    expect(refs).toContain('./.shiftstone');
  });

  it('generates a root tsconfig for non-pnpm packaging when absent, and never touches an existing one', async () => {
    // Case 1: absent → generated with the pack's effective app path
    const bare = await makeWorkspace();
    expect(existsSync(path.join(bare, 'tsconfig.json'))).toBe(false);
    const code = await main([`--root=${bare}`, '--archetype=fastapi-pg', '--name=PyApp', '--layout=monorepo', '-y']);
    expect(code).toBe(0);
    const generated = JSON.parse(readFileSync(path.join(bare, 'tsconfig.json'), 'utf8'));
    expect(generated.compilerOptions.strict).toBe(true);
    expect(generated.compilerOptions.noEmit).toBe(true);
    expect(generated.files).toEqual([]);
    expect(generated.references.map((r: { path: string }) => r.path)).toContain('./apps/api');

    // Case 2: existing user tsconfig → left untouched
    const withUserConfig = await makeWorkspace();
    const sentinel = { compilerOptions: { strict: false }, include: ['user/**/*'] };
    writeFileSync(path.join(withUserConfig, 'tsconfig.json'), JSON.stringify(sentinel), 'utf8');
    const code2 = await main([`--root=${withUserConfig}`, '--archetype=fastapi-pg', '--name=PyApp', '--layout=monorepo', '-y']);
    expect(code2).toBe(0);
    expect(JSON.parse(readFileSync(path.join(withUserConfig, 'tsconfig.json'), 'utf8'))).toEqual(sentinel);
  }, 240_000);
});
