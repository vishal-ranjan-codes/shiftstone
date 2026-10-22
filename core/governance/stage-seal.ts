/**
 * Stage seal — OKF-compliant handoff artifacts (amendment C8).
 *
 * A stage folder (`<stage>/CONTEXT.md` + `<stage>/output/`) is a loop-level
 * checkpoint (blueprint §3 C1). Sealing validates:
 *   - CONTEXT.md exists with the three required sections (Inputs/Process/Outputs)
 *   - every declared output file carries OKF frontmatter (type, timestamp, inputs)
 * and stamps `status: sealed` into CONTEXT.md. A stage with any non-compliant
 * output is NEVER sealed.
 */

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface SealProblem {
  file: string;
  problem: string;
}

export interface SealReport {
  sealed: boolean;
  stageDir: string;
  outputs: string[];
  problems: SealProblem[];
}

const REQUIRED_SECTIONS = ['Inputs', 'Process', 'Outputs'];
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function parseFrontmatter(raw: string): { data: Record<string, unknown> | null; present: boolean } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return { data: null, present: false };
  try {
    const data = parseYaml(match[1]);
    return { data: (data ?? {}) as Record<string, unknown>, present: true };
  } catch {
    return { data: null, present: true };
  }
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(full);
    }
  };
  await walk(dir);
  return out;
}

export async function validateStage(stageDir: string): Promise<SealReport> {
  const abs = path.resolve(stageDir);
  const problems: SealProblem[] = [];
  const outputs: string[] = [];

  const contextPath = path.join(abs, 'CONTEXT.md');
  const contextInfo = await stat(contextPath).catch(() => null);
  if (contextInfo === null || !contextInfo.isFile()) {
    return {
      sealed: false,
      stageDir: abs,
      outputs,
      problems: [{ file: 'CONTEXT.md', problem: 'stage contract missing (copy core/governance/stage-contract-template.md)' }],
    };
  }
  const contextMd = await readFile(contextPath, 'utf8');
  for (const section of REQUIRED_SECTIONS) {
    if (!new RegExp(`^##\\s+${section}\\s*$`, 'm').test(contextMd)) {
      problems.push({ file: 'CONTEXT.md', problem: `missing required section "## ${section}"` });
    }
  }

  const outputDir = path.join(abs, 'output');
  const outputInfo = await stat(outputDir).catch(() => null);
  if (outputInfo === null || !outputInfo.isDirectory()) {
    problems.push({ file: 'output/', problem: 'stage has no output/ directory — nothing to seal' });
  } else {
    const files = await listFiles(outputDir);
    outputs.push(...files.map((f) => path.relative(abs, f)));
    if (files.length === 0) {
      problems.push({ file: 'output/', problem: 'stage has no outputs — nothing to seal' });
    }
    for (const file of files) {
      const rel = path.relative(abs, file);
      const text = await readFile(file, 'utf8');
      const { data, present } = parseFrontmatter(text);
      if (!present || data === null) {
        problems.push({ file: rel, problem: 'missing OKF frontmatter (type, timestamp, inputs)' });
        continue;
      }
      if (typeof data['type'] !== 'string' || data['type'].trim().length === 0) {
        problems.push({ file: rel, problem: 'frontmatter missing "type"' });
      }
      const timestamp = data['timestamp'];
      if (typeof timestamp !== 'string' || !ISO_TIMESTAMP.test(timestamp)) {
        problems.push({ file: rel, problem: 'frontmatter "timestamp" must be an ISO-8601 datetime' });
      }
      if (!('inputs' in data)) {
        problems.push({ file: rel, problem: 'frontmatter missing "inputs" (source citations for the handoff)' });
      }
    }
  }

  return { sealed: problems.length === 0, stageDir: abs, outputs, problems };
}

/** Validate, then stamp `status: sealed` only when the stage is clean. */
export async function sealStage(stageDir: string): Promise<SealReport> {
  const report = await validateStage(stageDir);
  if (!report.sealed) return report;

  const contextPath = path.join(report.stageDir, 'CONTEXT.md');
  const contextMd = await readFile(contextPath, 'utf8');
  const now = new Date().toISOString();
  let updated = contextMd;
  if (/^status:\s*\S+/m.test(updated)) {
    updated = updated.replace(/^status:\s*\S+.*$/m, 'status: sealed');
  } else {
    updated = updated.replace(/^(timestamp:\s*\S+)$/m, `$1\nstatus: sealed`);
  }
  if (/^sealed_at:\s*\S+/m.test(updated)) {
    updated = updated.replace(/^sealed_at:\s*\S+.*$/m, `sealed_at: ${now}`);
  } else {
    updated = updated.replace(/^(status:\s*sealed)$/m, `$1\nsealed_at: ${now}`);
  }
  await writeFile(contextPath, updated, 'utf8');
  return report;
}
