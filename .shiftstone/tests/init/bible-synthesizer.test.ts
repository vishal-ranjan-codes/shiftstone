import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { validateBibleSynthesis } from '../../init/validate-bible-synthesis.js';
import { validateModularBibleStructure } from '../../init/bible-modular-structure.js';

describe('Phase 3 Cumulative — Bible Synthesizer & Modular Structure Integration', () => {
  const rootBibleDir = path.resolve(__dirname, '../../../docs/bible');
  const packOverlaysDir = path.resolve(__dirname, '../../packs/rr8-supabase-cf/bible-overlays');

  it('asserts zero {{...}} placeholders survive in active docs/bible files', () => {
    const report = validateBibleSynthesis(rootBibleDir);
    expect(report.ok).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  it('asserts zero {{...}} placeholders survive in pack bible overlays', () => {
    const report = validateBibleSynthesis(packOverlaysDir);
    expect(report.ok).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  it('asserts pack bible overlays strictly satisfy the modular chapter subfolder standard', () => {
    const struct = validateModularBibleStructure(packOverlaysDir);
    expect(struct.ok).toBe(true);
    expect(struct.violations).toHaveLength(0);
    expect(struct.chapterCount).toBe(8);
  });
});
