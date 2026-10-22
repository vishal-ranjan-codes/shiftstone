import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  validateStageContractContent,
  validateStageContractFile,
  validateStageContracts,
} from '../validate-stage-contracts.js';
import { StageDagRunner } from '../../harness/loop-runner/dag.ts';

describe('Unit U7: validate-stage-contracts (UG-07, UG-09)', () => {
  it('passes cleanly on core/governance/stage-contract-template.md', () => {
    const res = validateStageContracts({ templateCheck: true });
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
    expect(res.contractsChecked).toBe(1);
  });

  it('TS-U7-01 (L2): fails with SUPERSEDED_INPUT_BLOCKED when an input file has status: superseded', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'stage-contract-superseded-'));
    try {
      const docsDir = path.join(tmp, 'docs', 'decisions');
      mkdirSync(docsDir, { recursive: true });

      // Create a decision file with status: superseded
      const decisionPath = path.join(docsDir, 'DEC-001-test.md');
      writeFileSync(
        decisionPath,
        `---
type: decision
status: superseded
supersededBy: DEC-002-test.md
---
# Old Decision
`,
      );

      // Create CONTEXT.md referencing the superseded decision
      const stageDir = path.join(tmp, 'docs', 'plans', 'my-plan', 'stage-01');
      mkdirSync(stageDir, { recursive: true });
      const contextPath = path.join(stageDir, 'CONTEXT.md');

      const content = `---
schemaVersion: stage-contract/v1
type: stage-contract
stageId: STAGE-01
planId: my-plan
title: First Stage
status: planned
undeclaredInputPolicy: amend-and-reload
inputs:
  - path: docs/decisions/DEC-001-test.md
    role: decision
    requiredStatus: accepted
outputs:
  - path: docs/output.md
    artifactType: doc
verificationLevels:
  - L1
exitCriteria:
  - id: EC-01
    level: L1
    command: npm test
    expected: exit 0
---

# Stage 01 - CONTEXT

## Human Effort
Band: AUTOMATED
`;

      writeFileSync(contextPath, content);

      const res = validateStageContractFile(contextPath, { root: tmp });
      expect(res.ok).toBe(false);
      const v = res.violations.find((x) => x.code === 'SUPERSEDED_INPUT_BLOCKED');
      expect(v).toBeDefined();
      expect(v?.inputStatus).toBe('superseded');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('TS-U7-02 (L2): placeholder detection rejects "TODO: add tests later" and "TBD"', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'stage-contract-placeholder-'));
    try {
      mkdirSync(path.join(tmp, 'docs'), { recursive: true });
      const sampleInput = path.join(tmp, 'docs', 'spec.md');
      writeFileSync(sampleInput, '---\nstatus: active\n---\n# Spec\n');

      const contextPath = path.join(tmp, 'CONTEXT.md');
      const content = `---
schemaVersion: stage-contract/v1
type: stage-contract
stageId: STAGE-01
planId: my-plan
title: Stage with Placeholders
status: planned
undeclaredInputPolicy: amend-and-reload
inputs:
  - path: docs/spec.md
    role: ssot-bible
    requiredStatus: active
outputs:
  - path: docs/output.md
    artifactType: doc
verificationLevels:
  - L1
exitCriteria:
  - id: EC-01
    level: L1
    command: npm test
    expected: exit 0
---

# Stage CONTEXT
TODO: add tests later
`;
      writeFileSync(contextPath, content);

      const res = validateStageContractFile(contextPath, { root: tmp });
      expect(res.ok).toBe(false);
      const v = res.violations.find((x) => x.code === 'PLACEHOLDER_DETECTED');
      expect(v).toBeDefined();
      expect(v?.placeholder).toBe('TODO');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('fails with ABSOLUTE_PATH_DETECTED when machine-absolute paths are present', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'stage-contract-abs-path-'));
    try {
      const contextPath = path.join(tmp, 'CONTEXT.md');
      const content = `---
schemaVersion: stage-contract/v1
type: stage-contract
stageId: STAGE-01
planId: my-plan
title: Absolute Path Stage
status: planned
undeclaredInputPolicy: amend-and-reload
inputs:
  - path: C:\\Users\\Administrator\\Desktop\\file.txt
    role: ssot-bible
    requiredStatus: active
outputs:
  - path: docs/output.md
    artifactType: doc
verificationLevels:
  - L1
exitCriteria:
  - id: EC-01
    level: L1
    command: npm test
    expected: exit 0
---
# Content
`;
      writeFileSync(contextPath, content);

      const res = validateStageContractFile(contextPath, { root: tmp });
      expect(res.ok).toBe(false);
      expect(res.violations.some((x) => x.code === 'ABSOLUTE_PATH_DETECTED')).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('fails with MISSING_INPUT_PATH when an input does not exist on disk', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'stage-contract-missing-input-'));
    try {
      const contextPath = path.join(tmp, 'CONTEXT.md');
      const content = `---
schemaVersion: stage-contract/v1
type: stage-contract
stageId: STAGE-01
planId: my-plan
title: Missing Input Stage
status: planned
undeclaredInputPolicy: amend-and-reload
inputs:
  - path: non/existent/input.md
    role: ssot-bible
    requiredStatus: active
outputs:
  - path: docs/output.md
    artifactType: doc
verificationLevels:
  - L1
exitCriteria:
  - id: EC-01
    level: L1
    command: npm test
    expected: exit 0
---
# Content
`;
      writeFileSync(contextPath, content);

      const res = validateStageContractFile(contextPath, { root: tmp });
      expect(res.ok).toBe(false);
      expect(res.violations.some((x) => x.code === 'MISSING_INPUT_PATH')).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('StageDagRunner halts as blocked and refuses to execute stage with invalid contract', async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'stage-dag-test-'));
    try {
      const contextPath = path.join(tmp, 'CONTEXT.md');
      // Invalid contract: missing input
      const content = `---
schemaVersion: stage-contract/v1
type: stage-contract
stageId: STAGE-01
planId: my-plan
title: DAG Stage
status: planned
undeclaredInputPolicy: amend-and-reload
inputs:
  - path: missing.md
    role: ssot-bible
    requiredStatus: active
outputs:
  - path: output.md
    artifactType: doc
verificationLevels:
  - L1
exitCriteria:
  - id: EC-01
    level: L1
    command: npm test
    expected: exit 0
---
# DAG Test
`;
      writeFileSync(contextPath, content);

      let executed = false;
      const runner = new StageDagRunner({ root: tmp });
      const summary = await runner.executeDag([
        {
          id: 'STAGE-01',
          contractPath: contextPath,
          execute: () => {
            executed = true;
          },
        },
      ]);

      expect(executed).toBe(false);
      expect(summary.terminalState).toBe('blocked');
      expect(summary.results['STAGE-01'].terminalState).toBe('blocked');
      expect(summary.results['STAGE-01'].executed).toBe(false);
      expect(summary.results['STAGE-01'].reason).toContain('MISSING_INPUT_PATH');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
