import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAllResearch, validateResearchDossier } from '../validate-research.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('validate-research.js (UG-34 / Unit U12)', () => {
  it('passes on template dossier in template mode', () => {
    const templateDir = path.join(ROOT, 'docs', 'research', '_template');
    const res = validateResearchDossier(templateDir, { root: ROOT, isTemplate: true });
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('rejects a dossier missing required files or search receipts', () => {
    const fakeDir = path.join(ROOT, 'docs', 'research', 'ai-tools');
    const res = validateResearchDossier(fakeDir, { root: ROOT, isTemplate: false });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'MISSING_RESEARCH_FILE')).toBe(true);
  });

  it('passes validateAllResearch() across docs/research', () => {
    const res = validateAllResearch({ root: ROOT });
    expect(res.ok).toBe(true);
  });
});
