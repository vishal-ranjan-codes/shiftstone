/**
 * Phase 4 — task 4.7: variable substitution.
 * Core placeholder formulas, pack-declared variables with type validation,
 * and the precision substitution walker.
 */

import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeArchetypes } from '../../init/compose.js';
import {
  buildVariables,
  coreVariables,
  resolvePlaceholders,
  substituteInTree,
  validateVariables,
} from '../../init/variables.js';
import { REPO_ROOT } from './workspace-fixture.js';

describe('core placeholder formulas (pre-refactor parity)', () => {
  it('monorepo keeps the pre-refactor values', () => {
    const vars = coreVariables({
      projectName: 'AcmeSaaS',
      layout: 'monorepo',
      packageManager: 'pnpm',
      appPath: 'apps/web',
      packaging: 'pnpm',
    });
    expect(vars['{{PROJECT_NAME}}']).toBe('AcmeSaaS');
    expect(vars['{{PROJECT_NAME_LOWER}}']).toBe('acmesaas');
    expect(vars['{{MONOREPO_OR_SINGLE}}']).toBe('pnpm monorepo (apps/web)');
    expect(vars['{{NPM_PACKAGE_NAME}}']).toBe('@acmesaas/web');
    expect(vars['{{APP_NAME_NPM}}']).toBe('@acmesaas/web');
    expect(vars['{{APP_PATH}}']).toBe('apps/web');
    expect(vars['{{BIBLE_PATH}}']).toBe('docs/bible');
  });

  it('single layout resolves differently', () => {
    const vars = coreVariables({
      projectName: 'AcmeSaaS',
      layout: 'single',
      appPath: '.',
      packaging: 'pnpm',
    });
    expect(vars['{{MONOREPO_OR_SINGLE}}']).toBe('Standard single application');
    expect(vars['{{NPM_PACKAGE_NAME}}']).toBe('acmesaas');
  });
});

describe('pack-declared variables (blueprint §5.4 key change 3)', () => {
  it('rr8 declares identity + supabase command, resolved recursively', () => {
    const composition = composeArchetypes({}, { root: REPO_ROOT });
    const { map, errors } = buildVariables({
      answers: { projectName: 'AcmeSaaS', layout: 'monorepo', packageManager: 'pnpm' },
      composition,
    });
    expect(errors).toEqual([]);
    expect(map['{{PRODUCT_IDENTITY}}']).toBe(
      'a full-stack React Router 8 + Supabase + Cloudflare application',
    );
    expect(map['{{STACK_IDENTITY}}']).toContain('pnpm monorepo (apps/web)');
    expect(map['{{SUPABASE_TYPES_CMD}}']).toBe('pnpm --filter @acmesaas/web supabase:types');
    for (const value of Object.values(map)) expect(value).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
  });

  it('type validation rejects bad enum/path/string values', () => {
    const declarations = [
      { name: '{{MODE}}', type: 'enum', enum: ['fast', 'slow'] },
      { name: '{{REL}}', type: 'path' },
      { name: '{{TEXT}}', type: 'string' },
      { name: '{{NODEFAULT}}', type: 'string' },
    ];
    expect(
      validateVariables(
        { '{{MODE}}': 'turbo', '{{REL}}': '../up', '{{TEXT}}': '   ', '{{NODEFAULT}}': 'x' },
        declarations,
      ).join('\n'),
    ).toContain('must be one of "fast", "slow"');
    expect(
      validateVariables({ '{{MODE}}': 'fast', '{{REL}}': '/abs', '{{TEXT}}': 'ok', '{{NODEFAULT}}': 'x' }, declarations).join('\n'),
    ).toContain('must be a relative path');
    expect(
      validateVariables({ '{{MODE}}': 'fast', '{{REL}}': 'a/b', '{{TEXT}}': 'ok' }, declarations).join('\n'),
    ).toContain('{{NODEFAULT}} has no value and no default');
  });

  it('nested defaults resolve through other placeholders', () => {
    const resolved = resolvePlaceholders({
      '{{A}}': 'x',
      '{{B}}': 'value-{{A}}',
      '{{C}}': '{{B}}!',
    });
    expect(resolved['{{C}}']).toBe('value-x!');
  });
});

describe('substitution walker', () => {
  function fixture() {
    const root = mkdtempSync(path.join(tmpdir(), 'init-vars-'));
    mkdirSync(path.join(root, 'docs'), { recursive: true });
    mkdirSync(path.join(root, 'packs', 'p', 'skills', 's'), { recursive: true });
    mkdirSync(path.join(root, 'apps', 'web'), { recursive: true });
    writeFileSync(path.join(root, 'docs', 'a.md'), 'Name={{PROJECT_NAME}} app={{APP_PATH}}\n', 'utf8');
    writeFileSync(path.join(root, 'docs', 'b.md'), 'unknown={{SOMETHING_ELSE}}\n', 'utf8');
    writeFileSync(path.join(root, 'docs', 'c.json'), '{"n":"{{PROJECT_NAME}}"}\n', 'utf8');
    writeFileSync(path.join(root, 'packs', 'p', 'skills', 's', 'SKILL.md'), '{{PROJECT_NAME}}\n', 'utf8');
    writeFileSync(path.join(root, 'apps', 'web', 'skip.md'), '{{PROJECT_NAME}}\n', 'utf8');
    symlinkSync(path.join(root, 'packs', 'p', 'skills', 's'), path.join(root, 'docs', 'linkdir'), 'junction');
    return root;
  }

  it('replaces known keys only, skips app dirs, packs and symlinks', () => {
    const root = fixture();
    const { changed } = substituteInTree(root, { '{{PROJECT_NAME}}': 'Acme', '{{APP_PATH}}': 'apps/web' }, {
      skipDirs: new Set(['node_modules', '.git', 'packs', 'apps']),
    });
    expect(changed.sort()).toEqual(['docs/a.md', 'docs/c.json']);
    const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
    expect(read('docs/a.md')).toBe('Name=Acme app=apps/web\n');
    expect(read('docs/b.md')).toBe('unknown={{SOMETHING_ELSE}}\n');
    expect(read('apps/web/skip.md')).toBe('{{PROJECT_NAME}}\n');
    expect(read('packs/p/skills/s/SKILL.md')).toBe('{{PROJECT_NAME}}\n');
  });
});
