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

describe('Unit U2 — Source-Bound Handoff Schema (plan-handoff/v1) & Fixtures (REQ-02)', () => {
  it('TS-U2-01 (L1): plan-handoff-v1.schema.json compiles under Draft 2020-12 with closed objects and valid $defs', async () => {
    const schema = await readJson('governance/schemas/plan-handoff-v1.schema.json');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.properties.schema.const).toBe('plan-handoff/v1');

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

    const ajv = createAjv();
    const validate = ajv.compile(schema);
    expect(validate).toBeDefined();
  });

  it('TS-U2-02 (L1): handoff-valid.json passes schema validation cleanly', async () => {
    const schema = await readJson('governance/schemas/plan-handoff-v1.schema.json');
    const validHandoff = await readJson('tests/fixtures/planning/handoff-valid.json');

    const ajv = createAjv();
    const validate = ajv.compile(schema);
    const valid = validate(validHandoff);

    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);

    // Verify AC-U2-02 required top-level attributes
    expect(validHandoff.schema).toBe('plan-handoff/v1');
    expect(validHandoff.attempt).toBeGreaterThanOrEqual(1);
    expect(['checkpoint', 'interrupted', 'close']).toContain(validHandoff.event);
    expect(['planned', 'in-progress', 'implemented']).toContain(validHandoff.implementation);
    expect(['pending', 'success', 'no-op', 'blocked', 'stalled', 'exhausted']).toContain(validHandoff.terminalState);

    // Verify AC-U2-03 snapshot invariants
    expect(validHandoff.entrySnapshot).toBeDefined();
    expect(validHandoff.exitSnapshot).toBeDefined();
    for (const snap of [validHandoff.entrySnapshot, validHandoff.exitSnapshot]) {
      expect(snap.scopeDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(snap.environmentDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(Array.isArray(snap.files)).toBe(true);
    }
  });

  it('TS-U2-02 / AC-U2-05: check result conditional rules in schema', async () => {
    const schema = await readJson('governance/schemas/plan-handoff-v1.schema.json');
    const rules = schema.$defs.CheckResult.allOf;

    // Rule 0: not-run requires null exitCode, null observedAt, null digests, maxItems 0 evidenceRefs
    expect(rules[0].then.properties.evidenceRefs.maxItems).toBe(0);
    for (const key of ['observedAt', 'sourceDigest', 'environmentDigest', 'exitCode']) {
      expect(rules[0].then.properties[key].type).toBe('null');
    }

    // Rule 1: passed requires evidenceRefs minItems 1, exitCode 0 or null
    expect(rules[1].then.properties.evidenceRefs.minItems).toBe(1);
    expect(rules[1].then.properties.exitCode.enum).toEqual([0, null]);

    // Rule 2: failed requires exitCode != 0 or null
    expect(rules[2].then.properties.exitCode.anyOf[0].not.const).toBe(0);

    // Rule 3: blocked/skipped requires exitCode null
    expect(rules[3].then.properties.exitCode.type).toBe('null');
  });

  it('TS-U2-03 (L2): handoff-pending.json validates with mixed check results, nullables, and preservation records', async () => {
    const schema = await readJson('governance/schemas/plan-handoff-v1.schema.json');
    const pendingHandoff = await readJson('tests/fixtures/planning/handoff-pending.json');

    const ajv = createAjv();
    const validate = ajv.compile(schema);
    const valid = validate(pendingHandoff);

    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);

    expect(pendingHandoff.event).toBe('interrupted');
    expect(pendingHandoff.terminalState).toBe('blocked');

    // Asserts all 5 distinct check results are exercised
    const checkResults = new Set(pendingHandoff.checks.map((c: any) => c.result));
    expect(checkResults).toEqual(new Set(['passed', 'blocked', 'not-run', 'failed', 'skipped']));

    // Verify unrun check nullability
    const unrun = pendingHandoff.checks.find((c: any) => c.result === 'not-run');
    expect(unrun).toBeDefined();
    for (const key of ['observedAt', 'sourceDigest', 'environmentDigest', 'exitCode']) {
      expect(unrun[key]).toBeNull();
    }
    expect(unrun.evidenceRefs).toEqual([]);

    // AC-U2-04: Verify preservation records
    expect(pendingHandoff.preservation.length).toBeGreaterThan(0);
    const unrelated = pendingHandoff.preservation.find((p: any) => p.origin === 'unknown');
    expect(unrelated).toBeDefined();
    expect(unrelated.action).toBe('preserve');
    expect(unrelated.entrySha256).toBeNull();
    expect(unrelated.exitSha256).toBeNull();
  });

  it('TS-U2-03 (L2): rejects mutational check corruption against schema contract', async () => {
    const schema = await readJson('governance/schemas/plan-handoff-v1.schema.json');
    const validHandoff = await readJson('tests/fixtures/planning/handoff-valid.json');
    const pendingHandoff = await readJson('tests/fixtures/planning/handoff-pending.json');

    const ajv = createAjv();
    const validate = ajv.compile(schema);

    const assertMutationFails = (base: any, mutate: (draft: any) => void) => {
      const draft = structuredClone(base);
      mutate(draft);
      const ok = validate(draft);
      expect(ok, `Mutation should have failed validation: ${JSON.stringify(draft.checks?.[0])}`).toBe(false);
      expect(validate.errors?.length).toBeGreaterThan(0);
    };

    // Mutation 1: passed check with empty evidenceRefs
    assertMutationFails(validHandoff, (d) => {
      d.checks[0].evidenceRefs = [];
    });

    // Mutation 2: passed check with exitCode: 1
    assertMutationFails(validHandoff, (d) => {
      d.checks[0].exitCode = 1;
    });

    // Mutation 3: not-run check with observed timestamp
    assertMutationFails(pendingHandoff, (d) => {
      const check = d.checks.find((c: any) => c.result === 'not-run');
      check.observedAt = '2026-10-23T00:00:00Z';
    });

    // Mutation 4: failed check with exitCode: 0
    assertMutationFails(pendingHandoff, (d) => {
      const check = d.checks.find((c: any) => c.result === 'failed');
      check.exitCode = 0;
    });

    // Mutation 5: blocked check with nonzero exitCode
    assertMutationFails(pendingHandoff, (d) => {
      const check = d.checks.find((c: any) => c.result === 'blocked');
      check.exitCode = 2;
    });
  });
});
