#!/usr/bin/env node
/**
 * 4-Layer Agent Pre-Flight Gate Engine with Compounding Context (UG-11 / Unit U10)
 *
 * Enforces 4 sequential layers before an AI agent modifies code:
 *   Layer 1 — Scope & Glob Resolution: Resolves target file/glob against
 *              skills-manifest.yaml and active pack's preflight-matrix.yaml.
 *   Layer 2 — Mandatory Skill Manifest Verification: Verifies required skills exist
 *              on disk (SKILL.md + instructions.md) and computes SHA-256 read receipts.
 *   Layer 3 — Bible SSOT & Reference Matrix Verification: Verifies required docs/bible/
 *              chapters exist on disk and are active (not superseded/deprecated).
 *   Layer 4 — Verification Command Declaration: Verifies non-empty L1/L2 command.
 *
 * Compounding context: Queries docs/reports/learning/*.json and docs/decisions/*.md
 * for related lessons and injects them into output and receipt.
 *
 * On pass: Emits .agent-preflight-receipt.json with a 30-minute TTL.
 * Modes:
 *   --target "<file-or-glob>" [--skills "<s1,s2>"] [--bible "<b1,b2>"] --verify-cmd "<cmd>"
 *   --check <targetFile>
 *   --self-test
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PREFLIGHT_RECEIPT_FILENAME = '.agent-preflight-receipt.json';
export const RECEIPT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Minimal glob matching: **, *, ? */
export function matchGlob(pattern, file) {
  const pat = pattern.replace(/\\/g, '/');
  const target = file.replace(/\\/g, '/');
  let re = '^';
  for (let i = 0; i < pat.length; i += 1) {
    const c = pat[i];
    if (c === '*') {
      if (pat[i + 1] === '*') {
        if (pat[i + 2] === '/') {
          re += '(?:[^/]+/)*';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '.';
    } else if ('[].()+^${}|'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  re += '$';
  return new RegExp(re).test(target);
}

/** Compute SHA-256 of string or buffer */
export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

/** Parse JSON safely */
function parseJson(raw, filePath) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON in ${filePath}: ${err.message}`);
  }
}

/** Parse YAML safely */
function parseYamlContent(raw, filePath) {
  try {
    return parseYaml(raw);
  } catch (err) {
    throw new Error(`Failed to parse YAML in ${filePath}: ${err.message}`);
  }
}

/** Get active packs list */
export function getActivePacks(root = ROOT) {
  const wsManifestPath = path.join(root, '.shiftstone', 'governance', 'workspace-manifest.json');
  if (existsSync(wsManifestPath)) {
    try {
      const manifest = parseJson(readFileSync(wsManifestPath, 'utf8'), wsManifestPath);
      if (Array.isArray(manifest.spec?.activePacks) && manifest.spec.activePacks.length > 0) {
        return manifest.spec.activePacks;
      }
    } catch {}
  }
  const regPath = path.join(root, 'packs', '_registry.yaml');
  if (existsSync(regPath)) {
    try {
      const reg = parseYamlContent(readFileSync(regPath, 'utf8'), regPath);
      if (Array.isArray(reg?.activePacks)) return reg.activePacks;
    } catch {}
  }
  return ['rr8-supabase-cf'];
}

/** Load preflight matrices for active packs */
export function loadPreflightMatrices(root = ROOT) {
  const packs = getActivePacks(root);
  const matrices = [];
  for (const pack of packs) {
    const matrixPath = path.join(root, 'packs', pack, 'preflight-matrix.yaml');
    if (existsSync(matrixPath)) {
      const parsed = parseYamlContent(readFileSync(matrixPath, 'utf8'), matrixPath);
      matrices.push({ pack, matrixPath, rules: parsed?.rules || [] });
    }
  }
  return matrices;
}

/** Load skills manifest if present */
export function loadSkillsManifest(root = ROOT) {
  const manifestPath = path.join(root, '.shiftstone', 'context', 'skills-manifest.yaml');
  if (!existsSync(manifestPath)) return null;
  return parseYamlContent(readFileSync(manifestPath, 'utf8'), manifestPath);
}

/** Resolve required skills and bible chapters for target globs/files */
export function resolveRequirements(targets, root = ROOT) {
  const targetList = Array.isArray(targets) ? targets : [targets];
  const requiredSkills = new Set();
  const requiredBibleDocs = new Set();
  const matchedRules = [];

  const matrices = loadPreflightMatrices(root);
  for (const { pack, rules } of matrices) {
    for (const rule of rules) {
      let matched = false;
      for (const target of targetList) {
        for (const glob of rule.globs || []) {
          if (matchGlob(glob, target) || matchGlob(target, glob) || target.startsWith(glob.replace(/\/\*\*?$/, ''))) {
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      if (matched) {
        matchedRules.push({ pack, ruleId: rule.id, description: rule.description });
        for (const s of rule.skills || []) requiredSkills.add(s);
        for (const b of rule.bible || []) requiredBibleDocs.add(b);
      }
    }
  }

  // Also check skills-manifest paths
  const skillsManifest = loadSkillsManifest(root);
  if (skillsManifest?.spec?.skills) {
    for (const skill of skillsManifest.spec.skills) {
      if (Array.isArray(skill.paths)) {
        for (const target of targetList) {
          for (const p of skill.paths) {
            if (matchGlob(p, target)) {
              requiredSkills.add(skill.name);
            }
          }
        }
      }
    }
  }

  return {
    targets: targetList,
    matchedRules,
    requiredSkills: Array.from(requiredSkills).sort(),
    requiredBibleDocs: Array.from(requiredBibleDocs).sort(),
  };
}

/** Check skill on disk and return content hash */
export function verifySkill(skillName, root = ROOT) {
  const candidates = [
    path.join(root, '.agents', 'skills', skillName),
    ...getActivePacks(root).map((p) => path.join(root, 'packs', p, 'skills', skillName)),
  ];

  let foundDir = null;
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isDirectory()) {
      foundDir = c;
      break;
    }
  }

  if (!foundDir) {
    return { ok: false, error: `Skill "${skillName}" not found on disk in .agents/skills/ or active packs` };
  }

  const skillMd = path.join(foundDir, 'SKILL.md');
  const instrMd = path.join(foundDir, 'instructions.md');

  if (!existsSync(skillMd)) {
    return { ok: false, error: `Skill "${skillName}" missing SKILL.md in ${path.relative(root, foundDir)}` };
  }

  let instrHash = '';
  if (existsSync(instrMd)) {
    instrHash = sha256(readFileSync(instrMd, 'utf8'));
  } else {
    // If 1-tier or 2-tier without instructions.md, hash SKILL.md
    instrHash = sha256(readFileSync(skillMd, 'utf8'));
  }

  return { ok: true, skillDir: path.relative(root, foundDir), instrHash };
}

/** Verify Bible doc on disk and check status */
export function verifyBibleDoc(docRelPath, root = ROOT) {
  let fullPath = path.join(root, docRelPath);
  if (!existsSync(fullPath)) {
    const sub = docRelPath.replace(/^docs[\/\\]bible[\/\\]/, '');
    const packsDir = path.join(root, 'packs');
    if (existsSync(packsDir)) {
      for (const pack of readdirSync(packsDir, { withFileTypes: true })) {
        if (!pack.isDirectory()) continue;
        const candidate = path.join(packsDir, pack.name, 'bible-overlays', sub);
        if (existsSync(candidate)) {
          fullPath = candidate;
          break;
        }
      }
    }
  }
  if (!existsSync(fullPath)) {
    return { ok: false, error: `Bible document not found: ${docRelPath}` };
  }
  const content = readFileSync(fullPath, 'utf8');
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch) {
    try {
      const data = parseYaml(frontmatterMatch[1]);
      const status = data?.status;
      if (status === 'superseded' || status === 'deprecated' || status === 'rejected') {
        return {
          ok: false,
          error: `Bible document ${docRelPath} is marked status: ${status} (supersededBy: ${data.supersededBy || 'none'})`,
        };
      }
    } catch {}
  }
  return { ok: true, path: docRelPath };
}

/** Search prior learning records and decisions matching keywords */
export function searchCompoundingContext(keywords, root = ROOT) {
  const lessons = [];
  const query = keywords.map((k) => k.toLowerCase());

  const learningDir = path.join(root, 'docs', 'reports', 'learning');
  if (existsSync(learningDir)) {
    const files = readdirSync(learningDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      try {
        const full = path.join(learningDir, f);
        const data = parseJson(readFileSync(full, 'utf8'), full);
        const text = `${data.summary || ''} ${data.lesson || ''} ${data.category || ''} ${(data.promotionTargets || []).join(' ')}`.toLowerCase();
        if (query.some((q) => text.includes(q))) {
          lessons.push({
            type: 'learning-record',
            id: data.learningId || f,
            summary: data.summary,
            lesson: data.lesson,
          });
        }
      } catch {}
    }
  }

  const decisionsDir = path.join(root, 'docs', 'decisions');
  if (existsSync(decisionsDir)) {
    const files = readdirSync(decisionsDir).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      try {
        const full = path.join(decisionsDir, f);
        const content = readFileSync(full, 'utf8');
        const lower = content.toLowerCase();
        if (query.some((q) => lower.includes(q))) {
          const titleMatch = content.match(/^#\s+(.+)$/m);
          lessons.push({
            type: 'decision',
            id: f.replace(/\.md$/, ''),
            title: titleMatch ? titleMatch[1] : f,
          });
        }
      } catch {}
    }
  }

  return lessons;
}

/** Execute 4-Layer Pre-Flight Gate */
export function runPreflight(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const targets = options.targets || (options.target ? [options.target] : []);
  const declaredSkills = options.skills || [];
  const declaredBible = options.bible || [];
  const verifyCmd = (options.verifyCmd || '').trim();

  if (targets.length === 0) {
    return {
      ok: false,
      code: 'MISSING_TARGET',
      message: 'Pre-flight gate requires at least one --target file or glob pattern',
      violations: ['No --target specified'],
    };
  }

  // Layer 1: Scope & Glob Resolution
  const resolved = resolveRequirements(targets, root);
  const violations = [];

  // Check declared skills vs required skills if declaredSkills provided
  if (declaredSkills.length > 0) {
    const missingDeclared = resolved.requiredSkills.filter((s) => !declaredSkills.includes(s));
    if (missingDeclared.length > 0) {
      violations.push(`Layer 1 Violation: Claimed skills omit required skill(s): ${missingDeclared.join(', ')}`);
    }
  }

  // Check declared bible vs required bible if declaredBible provided
  if (declaredBible.length > 0) {
    const missingBible = resolved.requiredBibleDocs.filter((b) => !declaredBible.includes(b));
    if (missingBible.length > 0) {
      violations.push(`Layer 1 Violation: Claimed Bible docs omit required chapter(s): ${missingBible.join(', ')}`);
    }
  }

  // Layer 2: Mandatory Skill Manifest Verification
  const skillReceipts = {};
  for (const skill of resolved.requiredSkills) {
    const res = verifySkill(skill, root);
    if (!res.ok) {
      violations.push(`Layer 2 Violation: ${res.error}`);
    } else {
      skillReceipts[skill] = res.instrHash;
    }
  }

  // Layer 3: Bible SSOT & Reference Matrix Verification
  for (const doc of resolved.requiredBibleDocs) {
    const res = verifyBibleDoc(doc, root);
    if (!res.ok) {
      violations.push(`Layer 3 Violation: ${res.error}`);
    }
  }

  // Layer 4: Verification Command Declaration
  if (!verifyCmd) {
    violations.push('Layer 4 Violation: Missing verification command (--verify-cmd is required)');
  }

  if (violations.length > 0) {
    return {
      ok: false,
      code: 'PREFLIGHT_GATE_FAILED',
      violations,
      resolved,
    };
  }

  // Search Compounding Context
  const keywords = [...targets, ...resolved.requiredSkills];
  const priorLessons = searchCompoundingContext(keywords, root);

  // Generate Receipt
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RECEIPT_TTL_MS);
  const receiptPayload = {
    schemaVersion: 'preflight-receipt/v1',
    timestamp: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    targetGlobs: targets,
    verifiedSkills: resolved.requiredSkills,
    verifiedBibleDocs: resolved.requiredBibleDocs,
    verifyCmd,
    priorLessons,
  };

  const receiptHash = sha256(JSON.stringify(receiptPayload));
  const fullReceipt = { ...receiptPayload, receiptHash };

  const receiptPath = path.join(root, PREFLIGHT_RECEIPT_FILENAME);
  writeFileSync(receiptPath, JSON.stringify(fullReceipt, null, 2), 'utf8');

  return {
    ok: true,
    receipt: fullReceipt,
    receiptPath,
    resolved,
    priorLessons,
  };
}

/** Check existing receipt against a target file */
export function checkReceipt(targetFile, root = ROOT) {
  const receiptPath = path.join(root, PREFLIGHT_RECEIPT_FILENAME);
  if (!existsSync(receiptPath)) {
    return {
      ok: false,
      code: 'PREFLIGHT_RECEIPT_MISSING',
      message: `No pre-flight receipt found at ${PREFLIGHT_RECEIPT_FILENAME}. Run: node .shiftstone/scripts/agent-preflight.js --target "${targetFile}" --verify-cmd "<cmd>"`,
    };
  }

  let receipt;
  try {
    receipt = parseJson(readFileSync(receiptPath, 'utf8'), receiptPath);
  } catch (err) {
    return {
      ok: false,
      code: 'PREFLIGHT_RECEIPT_CORRUPT',
      message: `Corrupt receipt at ${receiptPath}: ${err.message}`,
    };
  }

  const now = new Date();
  const expiresAt = new Date(receipt.expiresAt);
  if (now > expiresAt) {
    return {
      ok: false,
      code: 'PREFLIGHT_RECEIPT_EXPIRED',
      message: `Pre-flight receipt expired at ${receipt.expiresAt} (current: ${now.toISOString()}). Re-run agent-preflight.js.`,
    };
  }

  const normTarget = targetFile.replace(/\\/g, '/');
  const covered = (receipt.targetGlobs || []).some((glob) => {
    return matchGlob(glob, normTarget) || normTarget.startsWith(glob.replace(/\/\*\*?$/, ''));
  });

  if (!covered) {
    return {
      ok: false,
      code: 'PREFLIGHT_SCOPE_MISMATCH',
      message: `Pre-flight receipt does not cover target path "${targetFile}". Active globs: ${(receipt.targetGlobs || []).join(', ')}`,
    };
  }

  return {
    ok: true,
    receipt,
  };
}

/** Self-test mode */
export function runSelfTest(root = ROOT) {
  const matrices = loadPreflightMatrices(root);
  if (matrices.length === 0) {
    return { ok: false, error: 'Zero preflight matrices found for active packs' };
  }

  const errors = [];
  for (const { pack, matrixPath, rules } of matrices) {
    if (rules.length === 0) {
      errors.push(`${matrixPath}: declared 0 rules`);
      continue;
    }
    for (const rule of rules) {
      if (!rule.id || !rule.globs) {
        errors.push(`${pack} rule missing id or globs`);
      }
      for (const skill of rule.skills || []) {
        const check = verifySkill(skill, root);
        if (!check.ok) {
          errors.push(`[${pack}] rule "${rule.id}": ${check.error}`);
        }
      }
      for (const bibleDoc of rule.bible || []) {
        const check = verifyBibleDoc(bibleDoc, root);
        if (!check.ok) {
          errors.push(`[${pack}] rule "${rule.id}": ${check.error}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, matricesCount: matrices.length };
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);

  if (args.includes('--self-test')) {
    const res = runSelfTest(ROOT);
    if (!res.ok) {
      console.error('FAIL: Pre-flight matrix self-test failed:');
      for (const err of res.errors || [res.error]) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    console.log(`ok — Agent pre-flight self-test passed cleanly (${res.matricesCount} pack matrices verified).`);
    process.exit(0);
  }

  const checkIndex = args.indexOf('--check');
  if (checkIndex !== -1 && args[checkIndex + 1]) {
    const targetFile = args[checkIndex + 1];
    const res = checkReceipt(targetFile, ROOT);
    if (!res.ok) {
      console.error(`FAIL: ${res.code} — ${res.message}`);
      process.exit(1);
    }
    console.log(`ok — Pre-flight receipt valid for "${targetFile}" (expires: ${res.receipt.expiresAt}).`);
    process.exit(0);
  }

  // Parse arguments
  let targets = [];
  let skills = [];
  let bible = [];
  let verifyCmd = '';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--target' && args[i + 1]) {
      targets.push(...args[i + 1].split(',').map((s) => s.trim()).filter(Boolean));
      i += 1;
    } else if (arg === '--skills' && args[i + 1]) {
      skills.push(...args[i + 1].split(',').map((s) => s.trim()).filter(Boolean));
      i += 1;
    } else if (arg === '--bible' && args[i + 1]) {
      bible.push(...args[i + 1].split(',').map((s) => s.trim()).filter(Boolean));
      i += 1;
    } else if (arg === '--verify-cmd' && args[i + 1]) {
      verifyCmd = args[i + 1];
      i += 1;
    }
  }

  const res = runPreflight({ targets, skills, bible, verifyCmd, root: ROOT });
  if (!res.ok) {
    console.error('=== Agent Pre-Flight Gate Refusal (UG-11) ===');
    console.error(`Error Code: ${res.code}`);
    for (const v of res.violations || []) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log('=== Agent Pre-Flight Gate PASSED (UG-11) ===');
  console.log(`  Targets:         ${res.resolved.targets.join(', ')}`);
  console.log(`  Verified Skills: ${res.resolved.requiredSkills.join(', ') || 'none'}`);
  console.log(`  Verified Bible:  ${res.resolved.requiredBibleDocs.join(', ') || 'none'}`);
  console.log(`  Verification:    ${res.receipt.verifyCmd}`);
  console.log(`  Receipt:         ${res.receiptPath}`);
  console.log(`  Expires At:      ${res.receipt.expiresAt}`);
  if (res.priorLessons.length > 0) {
    console.log(`  Compounding Lessons Injected (${res.priorLessons.length}):`);
    for (const l of res.priorLessons) {
      console.log(`    * [${l.type}] ${l.id}: ${l.summary || l.title}`);
    }
  }
  process.exit(0);
}
