import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';

const SHIFTSTONE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

async function readJson<T = any>(rel: string): Promise<T> {
  const content = await readFile(path.join(SHIFTSTONE_ROOT, rel), 'utf8');
  return JSON.parse(content);
}

function createAjv(): Ajv2020 {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  ajv.addFormat('date-time', (value: string) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === value.slice(0, 19);
  });
  return ajv;
}

describe('Unit U1 — Static Phase Manifest Schema (plan-manifest/v1) & Fixtures (REQ-01)', () => {
  it('TS-U1-01 (L1): plan-manifest-v1.schema.json complies with JSON Schema Draft 2020-12 and resolves all local defs', async () => {
    const schema = await readJson('governance/schemas/plan-manifest-v1.schema.json');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.properties.schema.const).toBe('plan-manifest/v1');

    // Traverse schema asserting closed objects and local $defs resolution
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object') {
        expect(node.additionalProperties).toBe(false);
        expect(Array.isArray(node.required)).toBe(true);
        for (const key of node.required) {
          expect(Object.hasOwn(node.properties, key)).toBe(true);
        }
      }
      if (node.$ref) {
        expect(node.$ref).toMatch(/^#\/\$defs\//);
        const refName = node.$ref.split('/').at(-1);
        expect(schema.$defs[refName]).toBeDefined();
      }
      for (const value of Object.values(node)) {
        visit(value);
      }
    };
    visit(schema);

    // Ajv 2020 compilation succeeds
    const ajv = createAjv();
    const validate = ajv.compile(schema);
    expect(validate).toBeDefined();
  });

  it('TS-U1-01 / AC-U1-01: verifies RepoPath, ID, and timestamp constraints', async () => {
    const schema = await readJson('governance/schemas/plan-manifest-v1.schema.json');
    const defs = schema.$defs;

    const repoPattern = new RegExp(defs.RepoPath.pattern, 'u');
    for (const validPath of [
      '.',
      'docs/schemas/plan-state-v1.schema.json',
      'docs/bible/08. Development Guidelines/index.md',
    ]) {
      expect(repoPattern.test(validPath)).toBe(true);
    }
    for (const invalidPath of [
      '',
      '..',
      '../docs',
      'docs/..',
      'docs/../secret',
      './docs',
      '/etc/passwd',
      'C:/docs',
      'C:docs',
      '\\server\\share',
      '//server/share',
      'https://host/path',
      'docs//file',
      'docs/',
      'docs/./file',
      'docs\\file',
      'docs/file\n',
      'docs/file?query',
      'docs/file#fragment',
    ]) {
      expect(repoPattern.test(invalidPath)).toBe(false);
    }

    const testPatterns: [string, string, string][] = [
      ['UnitId', 'U12a', 'U0'],
      ['PhaseId', 'P2b', 'P01'],
      ['AcceptanceId', 'acc-contracts', 'contracts'],
      ['AcceptanceId', 'AC-U1-01', 'contracts'],
      ['Slug', 'browser-check', 'Browser Check'],
      ['SHA256', 'a'.repeat(64), 'A'.repeat(64)],
      ['Timestamp', '2026-10-23T00:00:00Z', '2026-10-23T05:30:00+05:30'],
    ];

    for (const [name, good, bad] of testPatterns) {
      const pattern = new RegExp(defs[name].pattern);
      expect(pattern.test(good)).toBe(true);
      expect(pattern.test(bad)).toBe(false);
    }

    expect(defs.Phase.properties.unitIds.maxItems).toBe(8);
    expect(defs.Phase.properties.unitIds.uniqueItems).toBe(true);
    expect(defs.Dependency.properties.requires.default).toBe('complete');
    expect(defs.Dependency.required).toContain('reason');
  });

  it('TS-U1-02 (L1): manifest-valid.json passes schema validation cleanly', async () => {
    const schema = await readJson('governance/schemas/plan-manifest-v1.schema.json');
    const validManifest = await readJson('tests/fixtures/planning/manifest-valid.json');

    const ajv = createAjv();
    const validate = ajv.compile(schema);
    const valid = validate(validManifest);

    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
  });

  it('TS-U1-02 / AC-U1-04: verifies automated vs manual branches and manual-only levels 4/5', async () => {
    const schema = await readJson('governance/schemas/plan-manifest-v1.schema.json');
    const branches = schema.$defs.Check.allOf;

    // Automated runner vs procedure branch
    expect(branches[0].then.required).toEqual(['runner']);
    expect(branches[0].then.not.required).toEqual(['procedure']);
    expect(branches[0].else.required).toEqual(['procedure']);
    expect(branches[0].else.not.required).toEqual(['runner']);

    // Levels 4 and 5 must be manual
    expect(branches[1].if.properties.level.enum).toEqual([4, 5]);
    expect(branches[1].then.properties.kind.const).toBe('manual');
  });

  it('TS-U1-03 (L2): manifest-invalid.json test corpus fails validation across all negative cases', async () => {
    const schema = await readJson('governance/schemas/plan-manifest-v1.schema.json');
    const invalidCases: Array<{ name: string; value: any }> = await readJson('tests/fixtures/planning/manifest-invalid.json');

    const ajv = createAjv();
    const validate = ajv.compile(schema);

    expect(invalidCases.map((c) => c.name)).toEqual([
      'unknown-root-field',
      'unknown-nested-field',
      'invalid-unit-id',
      'invalid-phase-id',
      'missing-narrow-dependency-reason',
      'ambiguous-runner-and-procedure',
      'automated-review-gate',
      'traversal-path',
    ]);

    for (const item of invalidCases) {
      const valid = validate(item.value);
      expect(valid, `Case "${item.name}" should have failed validation`).toBe(false);
      expect(validate.errors?.length).toBeGreaterThan(0);
    }
  });

  it('TS-U1-03 (L2): rejects mutational corruption (unitIds > 8, missing recovery, empty phases)', async () => {
    const schema = await readJson('governance/schemas/plan-manifest-v1.schema.json');
    const validManifest = await readJson('tests/fixtures/planning/manifest-valid.json');

    const ajv = createAjv();
    const validate = ajv.compile(schema);

    // Mutation 1: unitIds > 8
    const overCapacity = structuredClone(validManifest);
    overCapacity.phases[0].unitIds = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9'];
    expect(validate(overCapacity)).toBe(false);

    // Mutation 2: missing recovery
    const noRecovery = structuredClone(validManifest);
    delete noRecovery.phases[0].recovery;
    expect(validate(noRecovery)).toBe(false);

    // Mutation 3: empty phases
    const emptyPhases = structuredClone(validManifest);
    emptyPhases.phases = [];
    expect(validate(emptyPhases)).toBe(false);

    // Mutation 4: level 4 automated
    const automatedL4 = structuredClone(validManifest);
    automatedL4.phases[0].checks[0].level = 4;
    automatedL4.phases[0].checks[0].kind = 'automated';
    expect(validate(automatedL4)).toBe(false);
  });
});
