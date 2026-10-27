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

/**
 * Canonical reference projection oracle for the planning lifecycle truth table.
 * Evaluates inputs against four orthogonal axes: implementation, verification, review, acceptance.
 */
function referenceProjection(input: any) {
  const attempted = input.checks.some((check: any) => !['missing', 'not-run'].includes(check.result));
  const required = input.checks.filter((check: any) => check.required);
  const verification = !attempted
    ? 'not-run'
    : required.some((check: any) => check.result === 'failed')
      ? 'failed'
      : !input.definitionFresh || required.some((check: any) => check.result !== 'passed' || !check.fresh)
        ? 'pending'
        : 'passed';

  const mapped: Record<string, string> = {
    APPROVED: 'approved',
    pass: 'approved',
    REJECTED: 'rejected',
    fail: 'rejected',
    blocked: 'blocked',
  };

  const review = input.reviewVerdict === null
    ? input.reviewRequested
      ? 'pending'
      : 'not-requested'
    : !input.definitionFresh || !input.reviewFresh || !input.disjoint || !input.distinctActor
      ? 'pending'
      : mapped[input.reviewVerdict];

  const gatesPass = input.implementation === 'implemented'
    && verification === 'passed'
    && (!input.requiredReview || review === 'approved')
    && (!input.humanApprovalRequired || input.humanApprovalValid)
    && !input.blockingIssue;

  const acceptance = gatesPass ? 'complete' : 'open';
  const entryReady = gatesPass && (
    input.dependency.requires === 'complete'
    || (input.dependency.requires === 'implementation-verified' && Boolean(input.dependency.reason?.trim()))
  );

  return {
    verification,
    review,
    acceptance,
    entryReady,
    remediationAllowed: input.mode === 'remediate',
  };
}

describe('Unit U3 — Derived Runtime State Schema (plan-state/v1) & Transition Rules (REQ-03)', () => {
  it('TS-U3-01 (L1): plan-state-v1.schema.json complies with Draft 2020-12 and enforces four orthogonal axes', async () => {
    const schema = await readJson('governance/schemas/plan-state-v1.schema.json');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.properties.schema.const).toBe('plan-state/v1');

    const def = schema.$defs.PhaseState;
    // AC-U3-03: Four orthogonal status axes
    expect(def.properties.implementation.enum).toEqual(['planned', 'in-progress', 'implemented']);
    expect(def.properties.verification.enum).toEqual(['not-run', 'pending', 'failed', 'passed']);
    expect(def.properties.review.enum).toEqual(['not-requested', 'pending', 'blocked', 'rejected', 'approved']);
    expect(def.properties.acceptance.enum).toEqual(['open', 'complete']);

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

  it('TS-U3-02 (L1): state-valid.json passes schema validation cleanly', async () => {
    const schema = await readJson('governance/schemas/plan-state-v1.schema.json');
    const validState = await readJson('tests/fixtures/planning/state-valid.json');

    const ajv = createAjv();
    const validate = ajv.compile(schema);
    const valid = validate(validState);

    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);

    // AC-U3-02: Required top-level attributes
    expect(validState.schema).toBe('plan-state/v1');
    expect(validState.revision).toBeGreaterThanOrEqual(0);
    expect(validState.definitionSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Array.isArray(validState.phases)).toBe(true);
    expect(validState.phases.length).toBeGreaterThan(0);
  });

  it('TS-U3-02 / AC-U3-04: enforces conditional phase state constraints and rejects mutational corruption', async () => {
    const schema = await readJson('governance/schemas/plan-state-v1.schema.json');
    const validState = await readJson('tests/fixtures/planning/state-valid.json');

    const ajv = createAjv();
    const validate = ajv.compile(schema);

    const assertMutationFails = (mutate: (draft: any) => void) => {
      const draft = structuredClone(validState);
      mutate(draft);
      const ok = validate(draft);
      expect(ok, `State mutation should have failed validation`).toBe(false);
      expect(validate.errors?.length).toBeGreaterThan(0);
    };

    // Phase 0 has verification: "pending", review: "blocked". Acceptance cannot be complete.
    assertMutationFails((d) => {
      d.phases[0].acceptance = 'complete';
    });

    // Phase 1 has selectedHandoffRef: null. Implementation cannot be implemented.
    assertMutationFails((d) => {
      d.phases[1].implementation = 'implemented';
    });

    // Phase 1 has selectedHandoffRef: null. Verification cannot be passed.
    assertMutationFails((d) => {
      d.phases[1].verification = 'passed';
    });

    // Phase 1 has selectedHandoffRef: null. Acceptance cannot be complete.
    assertMutationFails((d) => {
      d.phases[1].acceptance = 'complete';
    });
  });

  it('TS-U3-03 (L2): readiness-cases.json truth table covers 30 discrete edge states matching reference projection', async () => {
    const readinessCases: Array<{ name: string; input: any; expected: any }> = await readJson('tests/fixtures/planning/readiness-cases.json');

    expect(readinessCases.length).toBe(30);

    // Required 8 core scenarios explicitly checked
    const scenarioNames = new Set(readinessCases.map((s) => s.name));
    for (const requiredName of [
      'all-required-fresh-and-approved', // Clean pass
      'required-failure',                 // Failed test
      'accordion-browser-pending',        // Blocked review / missing visual proof
      'rejected-review',                  // Rejected review
      'same-head-stale-source',           // Stale source
      'stale-definition',                 // Stale definition
      'optional-failure-visible',         // Optional test failure
      'blocking-issue',                   // Blocking issue
    ]) {
      expect(scenarioNames.has(requiredName), `Missing required scenario: ${requiredName}`).toBe(true);
    }

    for (const scenario of readinessCases) {
      const actual = referenceProjection(scenario.input);
      expect(actual, `Failed projection for scenario: ${scenario.name}`).toEqual(scenario.expected);

      // Invariants
      if (scenario.expected.acceptance === 'complete') {
        expect(scenario.input.implementation).toBe('implemented');
      }
      if (scenario.input.mode === 'remediate') {
        expect(scenario.expected.entryReady).toBe(false);
      }
    }
  });
});
