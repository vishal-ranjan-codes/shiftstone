import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkAcyclicDAG,
  validatePlanUnits,
  validateSinglePlanUnit,
} from '../validate-plan-units.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('Unit U8: validate-plan-units (UG-08, UG-10)', () => {
  it('TS-U8-01 (L1): validates all 31 units and 34 requirements across the master plan suite', () => {
    const res = validatePlanUnits({ root: ROOT });
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
    if (res.unitsCount > 0) {
      expect(res.unitsCount).toBe(31);
      expect(res.coveredRequirements.length).toBe(34);
      expect(res.coveredRequirements).toContain('UG-01');
      expect(res.coveredRequirements).toContain('UG-34');
    }
  });

  it('validates .shiftstone/governance/plan-unit-template.json cleanly', () => {
    const templatePath = path.join(ROOT, '.shiftstone', 'governance', 'plan-unit-template.json');
    const template = JSON.parse(readFileSync(templatePath, 'utf8'));
    const violations = validateSinglePlanUnit(template);
    expect(violations).toHaveLength(0);
  });

  it('TS-U8-02 (L2): detects cyclic dependencies (U1 -> U2 -> U1)', () => {
    const cyclicUnits = [
      {
        schemaVersion: 'plan-unit/v1',
        unitId: 'U1',
        phaseId: 'phase-1',
        title: 'Unit One',
        layer: 'core',
        status: 'planned',
        dependsOn: ['U2'],
        requirementIds: ['UG-01'],
        targetFiles: ['file1.ts'],
        acceptanceCriteria: [{ id: 'AC-U1-01', requirementId: 'UG-01', criterion: 'Valid criterion text here' }],
        testScenarios: [{ scenarioId: 'TS-U1-01', level: 'L1', description: 'valid test scenario description' }],
        verificationCommand: 'npm test',
        confidenceScore: 0.9,
      },
      {
        schemaVersion: 'plan-unit/v1',
        unitId: 'U2',
        phaseId: 'phase-1',
        title: 'Unit Two',
        layer: 'core',
        status: 'planned',
        dependsOn: ['U1'],
        requirementIds: ['UG-02'],
        targetFiles: ['file2.ts'],
        acceptanceCriteria: [{ id: 'AC-U2-01', requirementId: 'UG-02', criterion: 'Valid criterion text here' }],
        testScenarios: [{ scenarioId: 'TS-U2-01', level: 'L1', description: 'valid test scenario description' }],
        verificationCommand: 'npm test',
        confidenceScore: 0.9,
      },
    ];

    const dagViolations = checkAcyclicDAG(cyclicUnits);
    expect(dagViolations.some((v) => v.code === 'CYCLIC_DEPENDENCY_DETECTED')).toBe(true);
  });

  it('TS-U8-02 (L2): detects unmapped requirementIds in acceptance criteria', () => {
    const unmappedUnit = {
      schemaVersion: 'plan-unit/v1',
      unitId: 'U99',
      phaseId: 'phase-1',
      title: 'Unit with unmapped requirement',
      layer: 'core',
      status: 'planned',
      dependsOn: [],
      requirementIds: ['UG-01', 'UG-02'],
      targetFiles: ['file.ts'],
      acceptanceCriteria: [
        { id: 'AC-U99-01', requirementId: 'UG-01', criterion: 'Criterion only covers UG-01' },
      ],
      testScenarios: [
        { scenarioId: 'TS-U99-01', level: 'L1', description: 'Valid test scenario description' },
      ],
      verificationCommand: 'npm test',
      confidenceScore: 0.95,
    };

    const violations = validateSinglePlanUnit(unmappedUnit);
    expect(violations.some((v) => v.code === 'UNMAPPED_REQUIREMENT_ID' && v.requirementId === 'UG-02')).toBe(true);
  });

  it('detects duplicate unitId across the suite', () => {
    const duplicateUnits = [
      {
        unitId: 'U1',
        dependsOn: [],
      },
      {
        unitId: 'U1',
        dependsOn: [],
      },
    ];

    const dagViolations = checkAcyclicDAG(duplicateUnits);
    expect(dagViolations.some((v) => v.code === 'DUPLICATE_UNIT_ID')).toBe(true);
  });

  it('rejects confidenceScore < 0.8', () => {
    const lowConfUnit = {
      schemaVersion: 'plan-unit/v1',
      unitId: 'U98',
      phaseId: 'phase-1',
      title: 'Low Confidence Unit',
      layer: 'core',
      status: 'planned',
      dependsOn: [],
      requirementIds: ['UG-01'],
      targetFiles: ['file.ts'],
      acceptanceCriteria: [{ id: 'AC-U98-01', requirementId: 'UG-01', criterion: 'Valid criterion text' }],
      testScenarios: [{ scenarioId: 'TS-U98-01', level: 'L1', description: 'Valid scenario' }],
      verificationCommand: 'npm test',
      confidenceScore: 0.75,
    };

    const violations = validateSinglePlanUnit(lowConfUnit);
    expect(violations.some((v) => v.code === 'INVALID_CONFIDENCE_SCORE')).toBe(true);
  });
});
