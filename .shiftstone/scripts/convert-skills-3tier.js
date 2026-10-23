#!/usr/bin/env node
/**
 * Converts skills to the 3-tier progressive-disclosure structure
 * (blueprint §6.2):
 *
 *   SKILL.md       Tier 1 manifest — frontmatter + title + description +
 *                  pointers (always visible, small)
 *   instructions.md Tier 2 procedural knowledge — the original skill body,
 *                  loaded on task match
 *   resources/     Tier 3 deep reference — long example/reference sections
 *                  extracted on explicit need
 *
 * Idempotent: skills that already have instructions.md only get their
 * SKILL.md slimmed to the manifest form. Run after authoring new skills:
 *   node .shiftstone/scripts/convert-skills-3tier.js
 *
 * Covers core skills (real dirs in .agents/skills) and active pack skills
 * (packs/<pack>/skills/ — phase 4); the pack field defaults from location.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { listActivePackSkills, listCoreSkills } from '../context/skill-paths.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const RESOURCE_SECTION = /^## .*(example|cheatsheet|full reference|pattern library|deep dive)/i;

function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };
  return {
    data: parseYaml(match[1]) ?? {},
    body: raw.slice(match[0].length),
  };
}

function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Extract long example/reference sections into resources/. */
function extractResources(body) {
  const lines = body.split(/\r?\n/);
  const resources = [];
  const kept = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const sectionLines = current.lines;
    if (sectionLines.length >= 24 && RESOURCE_SECTION.test(sectionLines[0])) {
      const slug = slugify(sectionLines[0].replace(/^##\s+/, ''));
      resources.push({ slug, content: sectionLines.join('\n').trimEnd() });
    } else {
      kept.push(...sectionLines);
    }
    current = null;
  };

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      flush();
      current = { lines: [line] };
    } else if (current) {
      current.lines.push(line);
    } else {
      kept.push(line);
    }
  }
  flush();
  return { body: kept.join('\n'), resources };
}

function buildManifestSkm(data, name, resources, defaultPack) {
  const frontmatter = {
    name: data.name ?? name,
    description: data.description ?? '',
    type: 'skill',
    timestamp: data.timestamp ?? new Date().toISOString(),
    version: data.version ?? '1.0.0',
    pack: data.pack ?? defaultPack,
    ...(data.tags ? { tags: data.tags } : {}),
  };
  const lines = [
    '---',
    stringifyYaml(frontmatter).trimEnd(),
    '---',
    '',
    `# ${frontmatter.name}`,
    '',
    frontmatter.description,
    '',
    '- Procedural knowledge: [instructions.md](./instructions.md)',
  ];
  for (const resource of resources) {
    lines.push(`- Deep reference: [resources/${resource.slug}.md](./resources/${resource.slug}.md)`);
  }
  lines.push('');
  return lines.join('\n');
}

function convertSkill(dir, defaultPack) {
  const skillPath = path.join(dir, 'SKILL.md');
  if (!existsSync(skillPath)) return { name: path.basename(dir), skipped: 'no SKILL.md' };

  const name = path.basename(dir);
  const raw = readFileSync(skillPath, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const instructionsPath = path.join(dir, 'instructions.md');
  const alreadyConverted = existsSync(instructionsPath);

  if (alreadyConverted) {
    // Keep instructions.md as-is; slim SKILL.md to the manifest form.
    const resDir = path.join(dir, 'resources');
    const resources = existsSync(resDir)
      ? readdirSync(resDir).filter((f) => f.endsWith('.md')).map((f) => ({ slug: f.replace(/\.md$/, '') }))
      : [];
    const slim = buildManifestSkm(data, name, resources, defaultPack);
    if (slim !== raw) writeFileSync(skillPath, slim, 'utf8');
    return { name, action: 'slimmed SKILL.md' };
  }

  const { body: stripped, resources } = extractResources(body);
  const resourceLinks = resources
    .map((r) => `\nSee [resources/${r.slug}.md](./resources/${r.slug}.md) for the long-form reference.\n`)
    .join('');
  writeFileSync(instructionsPath, `${stripped.trimEnd()}\n${resourceLinks}`, 'utf8');

  if (resources.length > 0) {
    const resDir = path.join(dir, 'resources');
    mkdirSync(resDir, { recursive: true });
    for (const resource of resources) {
      writeFileSync(path.join(resDir, `${resource.slug}.md`), `${resource.content}\n`, 'utf8');
    }
  }

  writeFileSync(skillPath, buildManifestSkm(data, name, resources, defaultPack), 'utf8');
  return { name, action: `converted (${resources.length} resource file(s))` };
}

// Core skills: real dirs in .agents/skills. Pack skills: active packs' dirs
// (junctions in .agents/skills are skipped — they are a materialized view).
const targets = [
  ...listCoreSkills(ROOT).map((name) => ({
    dir: path.join(ROOT, '.agents', 'skills', name),
    pack: 'core',
  })),
  ...listActivePackSkills(ROOT).map((skill) => ({ dir: skill.dir, pack: skill.pack })),
].sort((a, b) => (path.basename(a.dir) < path.basename(b.dir) ? -1 : 1));

let converted = 0;
for (const target of targets) {
  const result = convertSkill(target.dir, target.pack);
  if (result.skipped) {
    console.log(`skip    ${result.name}: ${result.skipped}`);
  } else {
    console.log(`${result.action === 'slimmed SKILL.md' ? 'slimmed' : 'converted'}  ${result.name}: ${result.action}`);
    converted += 1;
  }
}
console.log(`done — ${converted} skill(s) processed of ${targets.length}`);
