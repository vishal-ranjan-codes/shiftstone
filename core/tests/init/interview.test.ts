/**
 * Phase 4 — task 4.7 verification: the interactive interview path works.
 * Drives `interview()` with a scripted stdin and asserts the answers it
 * returns (archetype selection, layout, package manager, starter clone).
 */

import { PassThrough, Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { interview } from '../../init/interview.js';
import { listPackNames } from '../../init/pack-loader.js';
import { REPO_ROOT } from './workspace-fixture.js';

/** Index (1-based) of the flagship pack in the alphabetical pack list. */
function flagshipChoice(): string {
  const packNames = listPackNames(REPO_ROOT);
  return `${packNames.indexOf('rr8-supabase-cf') + 1}\n`;
}

/** Pushes one answer line every 20ms so readline consumes them per question. */
async function* scriptedAnswers(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    yield line;
  }
}

function sink(): { stream: PassThrough; text: () => string } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  return { stream, text: () => Buffer.concat(chunks).toString('utf8') };
}

describe('4.7 — interactive interview', () => {
  it('collects archetype + scoping answers in order', async () => {
    const output = sink();
    // packs/ is listed alphabetically; the flagship's position shifts as packs
    // are added, so resolve it instead of hard-coding a choice number.
    const input = Readable.from(scriptedAnswers([flagshipChoice(), 'InterviewApp\n', '1\n', '1\n', 'octo\n', 'n\n', 'stripe\n']));

    const answers = await interview({ root: REPO_ROOT, input, output: output.stream });

    expect(answers.archetypes).toBe('rr8-supabase-cf');
    expect(answers.projectName).toBe('InterviewApp');
    expect(answers.layout).toBe('monorepo');
    expect(answers.packageManager).toBe('pnpm');
    expect(answers.ghUser).toBe('octo');
    expect(answers.cloneStarter).toBe(false);
    expect(answers.skills).toBe('stripe');
    expect(output.text()).toContain('Enter choice');
    expect(output.text()).toContain('Project Name');
    expect(output.text()).toContain('clone the official starter');
  }, 15_000);

  it('falls back to defaults on empty answers', async () => {
    const output = sink();
    const input = Readable.from(scriptedAnswers(['\n', '\n', '\n', '\n', '\n', 'n\n', '\n']));

    const answers = await interview({ root: REPO_ROOT, input, output: output.stream });

    expect(answers.archetypes).toBe('rr8-supabase-cf'); // default choice
    expect(answers.projectName).toBe('MySaaSApp');
    expect(answers.layout).toBe('monorepo');
    expect(answers.packageManager).toBe('pnpm');
    expect(answers.ghUser).toBeNull();
    expect(answers.skills).toBeNull();
  }, 15_000);
});
