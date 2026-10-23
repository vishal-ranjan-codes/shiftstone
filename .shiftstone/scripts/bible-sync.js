#!/usr/bin/env node
/**
 * bible-sync-loop grounded check (L1) — 3-way diff: code vs bible vs decisions.
 *
 * Sources:
 *   code       docs/bible chapter directories on disk (the structure) and the
 *              workspace paths the bible references
 *   bible      docs/bible/README.md table of contents + chapter index.md files
 *   decisions  docs/bible/DECISIONS.md ADRs + packs/<pack>/decisions-seed.yaml ADRs
 *
 * Modes:
 *   --check      exit 0 only when all 3 sources agree; exit 1 on drift/missing
 *   --apply      exit 78 (EX_CONFIG) when the bible core files are missing
 *                ("escalate" → the loop's blocked terminal state); exit 0 when
 *                clean; exit 1 when drift still needs agent actuation
 *   --enumerate  print one line per target work item (missing file or drift);
 *                prints nothing and exits 0 when code, bible and decisions agree
 *   --report     print the 3-way diff as an update plan (JSON)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const BLOCKED_EXIT = 78;
const BIBLE = path.join(root, 'docs', 'bible');
const CORE_SOURCES = ['README.md', 'DECISIONS.md', 'index.md'];
const CODE_PREFIXES = ['.shiftstone/', 'core/', 'docs/', 'packs/', 'evals/', '_config/'];

function listMarkdown(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function chapterDirs() {
  if (!existsSync(BIBLE)) return [];
  return readdirSync(BIBLE, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d\d-/.test(e.name))
    .map((e) => e.name)
    .sort();
}

/** Backticked paths referenced from README table rows (the ToC file column). */
function tocPaths(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) continue;
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const target = match[1];
      if (/^[A-Za-z0-9_.\\/-]+\.(md|json|ya?ml|ts|js)$/.test(target) || /^[A-Za-z0-9_-]+\//.test(target)) {
        out.push(target.replace(/\/$/, ''));
      }
    }
  }
  return [...new Set(out)];
}

/** Inline code spans outside fenced blocks (a link graph over code references). */
function inlineCodeRefs(markdown) {
  const text = markdown.replace(/```[\s\S]*?```/g, '');
  const out = [];
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const span = match[1].trim().replace(/^[,;:]+/, '').replace(/[.,;:]+$/, '');
    if (!CODE_PREFIXES.some((prefix) => span.startsWith(prefix))) continue;
    if (span.includes('{{') || span.includes('*') || span.includes('<') || span.includes('>')) continue;
    if (!/^[\w./-]+$/.test(span)) continue;
    out.push(span.replace(/\/$/, ''));
  }
  return [...new Set(out)];
}

function decisionIds(text) {
  const ids = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/\bDEC-\d{3}\b/);
    if (m) ids.push(m[0]);
  }
  return ids;
}

function seedDecisions() {
  const out = [];
  const packsDir = existsSync(path.join(root, '.shiftstone', 'packs'))
    ? path.join(root, '.shiftstone', 'packs')
    : path.join(root, 'packs');
  if (!existsSync(packsDir)) return out;
  for (const pack of readdirSync(packsDir, { withFileTypes: true })) {
    if (!pack.isDirectory()) continue;
    const seed = path.join(packsDir, pack.name, 'decisions-seed.yaml');
    if (!existsSync(seed)) continue;
    const text = readFileSync(seed, 'utf8');
    for (const match of text.matchAll(/^\s*-\s+id:\s*"(DEC-\d{3})"/gm)) {
      out.push({ pack: pack.name, id: match[1] });
    }
  }
  return out;
}

function buildDrift() {
  const missingSources = CORE_SOURCES.filter((file) => !existsSync(path.join(BIBLE, file)));
  const drift = [];
  const readmePath = path.join(BIBLE, 'README.md');
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';

  // ---- bible ↔ code: the ToC must match the chapter structure on disk ----
  for (const dir of chapterDirs()) {
    if (!readme.includes(`${dir}/`)) {
      drift.push({ kind: 'bible-toc-missing-chapter', detail: `README.md ToC has no row for ${dir}/` });
    }
    if (!existsSync(path.join(BIBLE, dir, 'index.md'))) {
      drift.push({ kind: 'chapter-index-missing', detail: `${dir}/index.md` });
    }
  }
  for (const toc of tocPaths(readme)) {
    if (!existsSync(path.join(BIBLE, toc))) {
      drift.push({ kind: 'bible-toc-broken-file', detail: toc });
    }
  }

  // ---- bible ↔ code: every referenced workspace path must exist ----
  for (const file of listMarkdown(BIBLE)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    for (const ref of inlineCodeRefs(readFileSync(file, 'utf8'))) {
      if (!existsSync(path.join(root, ref))) {
        drift.push({ kind: 'bible-references-missing-path', where: rel, detail: ref });
      }
    }
  }

  // ---- decisions ↔ bible / code ----
  if (!readme.includes('DECISIONS.md')) {
    drift.push({ kind: 'bible-toc-missing-decisions', detail: 'README.md does not reference DECISIONS.md' });
  }
  const decisionsPath = path.join(BIBLE, 'DECISIONS.md');
  const decisionsText = existsSync(decisionsPath) ? readFileSync(decisionsPath, 'utf8') : '';
  const localIds = decisionIds(decisionsText);
  const dupes = localIds.filter((id, i) => localIds.indexOf(id) !== i);
  for (const id of [...new Set(dupes)]) {
    drift.push({ kind: 'adr-duplicate-id', detail: `${id} appears more than once in DECISIONS.md` });
  }
  const isAutoCompiled = decisionsText.includes('compile-decisions.js');
  const seeds = seedDecisions();
  for (const seed of seeds) {
    if (!isAutoCompiled && localIds.includes(seed.id)) {
      drift.push({
        kind: 'adr-seed-collision',
        detail: `${seed.id} exists in both DECISIONS.md and packs/${seed.pack}/decisions-seed.yaml`,
      });
    }
  }
  const known = new Set([...localIds, ...seeds.map((s) => s.id)]);
  for (const file of listMarkdown(BIBLE)) {
    if (path.basename(file) === 'DECISIONS.md') continue;
    const rel = path.relative(root, file).replace(/\\/g, '/');
    for (const id of decisionIds(readFileSync(file, 'utf8'))) {
      if (!known.has(id)) {
        drift.push({ kind: 'adr-cited-but-missing', where: rel, detail: `${id} is cited but defined nowhere` });
      }
    }
  }

  return {
    sources: {
      code: { chapters: chapterDirs(), referenced_paths_checked: true },
      bible: { toc: tocPaths(readme).length, present: readme.length > 0 },
      decisions: { local: localIds.length, seeded: seeds.length },
    },
    missing: missingSources,
    drift,
  };
}

const mode = process.argv[2] ?? '--check';
const report = buildDrift();
const broken = report.missing.length > 0 || report.drift.length > 0;

if (mode === '--enumerate') {
  for (const m of report.missing) {
    console.log(`missing: ${m}`);
  }
  for (const d of report.drift) {
    console.log(`drift: ${d.kind} ${d.id ?? ''}`);
  }
  process.exit(0);
}

if (mode === '--report') {
  console.log(JSON.stringify(report, null, 2));
  process.exit(broken ? 1 : 0);
}

if (mode === '--apply') {
  if (report.missing.length > 0) {
    console.error(`bible-sync: bible core files missing (${report.missing.join(', ')}) — escalate`);
    process.exit(BLOCKED_EXIT);
  }
  if (!broken) {
    console.log('bible-sync: code, bible and decisions agree');
    process.exit(0);
  }
  console.error(`bible-sync: drift detected (${report.drift.length} item(s)) — resolving it requires agent actuation`);
  process.exit(1);
}

// --check
if (broken) {
  console.error(
    report.missing.length > 0
      ? `bible-sync: drift — bible core files missing: ${report.missing.join(', ')}`
      : `bible-sync: drift — ${JSON.stringify(report.drift)}`,
  );
  process.exit(1);
}
console.log('bible-sync: code, bible and decisions agree');
process.exit(0);
