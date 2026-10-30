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
  return ajv;
}

describe('Unit U1 — Orchestration & Concurrency Schema Extensions (REQ-01)', () => {
  it('TS-U1-01 (L1): Vitest schema compilation asserts orchestration-config-v1.schema.json parses cleanly without unresolved references', async () => {
    const schema = await readJson('governance/schemas/orchestration-config-v1.schema.json');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.title).toBeDefined();
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);

    // Assert required properties
    expect(schema.required).toContain('executionMode');

    // Ajv 2020 compilation succeeds cleanly
    const ajv = createAjv();
    const validate = ajv.compile(schema);
    expect(validate).toBeDefined();
    expect(typeof validate).toBe('function');
  });

  it('TS-U1-02 (L1): Schema test asserts manifest-orchestration.json passes validation while malformed modes or negative token ceilings fail', async () => {
    const schema = await readJson('governance/schemas/orchestration-config-v1.schema.json');
    const fixture = await readJson('tests/fixtures/planning/manifest-orchestration.json');

    const ajv = createAjv();
    const validate = ajv.compile(schema);

    // 1. Fixture passes validation
    const valid = validate(fixture);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);

    // 2. Malformed executionMode fails
    const badMode = { ...fixture, executionMode: 'unsupported-mode' };
    expect(validate(badMode)).toBe(false);

    // 3. Negative workerIntakeMaxTokens fails
    const negativeTokens = { ...fixture, workerIntakeMaxTokens: -500 };
    expect(validate(negativeTokens)).toBe(false);

    // 4. Zero or negative stagnationRetries fails
    const zeroRetries = { ...fixture, stagnationRetries: 0 };
    expect(validate(zeroRetries)).toBe(false);

    // 5. Additional undeclared properties fail
    const extraProps = { ...fixture, unknownProp: 'illegal' };
    expect(validate(extraProps)).toBe(false);
  });
});
