#!/usr/bin/env node
/**
 * Context Contradiction & Drift Validator (UG-03 / Phase 1 Unit U2)
 *
 * Verifies:
 *   1. Universal contradiction pairs defined in .shiftstone/governance/context-integrity-rules.yaml
 *   2. Core stack decoupling (core/ static and path-scoped rules contain zero pack stack terms)
 *   3. Stack-specific forbidden legacy directives declared in pack configs (e.g. packs/rr8-supabase-cf/pack.yaml)
 *
 * Exit code 0 on clean pass; exit code 1 with CONTRADICTION_DETECTED / STACK_LEAK_DETECTED on violation.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function globToRegex(glob) {
  let norm = glob.replace(/\\/g, '/');
  // Escape regex special chars except *
  norm = norm.replace(/[.+^${}()|[\]]/g, '\\$&');
  // Handle /**/ -> /(?:.+/)?
  norm = norm.replace(/\/\*\*(\/)?/g, '/(?:.+/)?');
  // Handle leading **/ -> (?:.+/)?
  norm = norm.replace(/^\*\*\//, '(?:.+/)?');
  // Handle remaining ** -> .*
  norm = norm.replace(/\*\*/g, '.*');
  // Handle remaining single * -> [^/]*
  norm = norm.replace(/(?<!\.)\*/g, '[^/]*');
  return new RegExp(`^${norm}$`, 'i');
}

export function findFilesMatching(rootDir, globPattern) {
  const normGlob = globPattern.replace(/\\/g, '/');
  const regex = globToRegex(normGlob);
  const matched = [];

  // If glob is a specific file, check direct existence
  const directPath = path.join(rootDir, normGlob);
  if (existsSync(directPath) && statSync(directPath).isFile()) {
    return [normGlob];
  }

  // Walk directory
  function walk(currentDir, currentRel) {
    if (!existsSync(currentDir)) return;
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and .git
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full, rel);
      } else if (entry.isFile()) {
        if (regex.test(rel)) {
          matched.push(rel);
        }
      }
    }
  }

  walk(rootDir, '');
  return matched;
}

export function validateContextIntegrity(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const violations = [];
  let filesScanned = 0;

  // 1. Load context-integrity-rules.yaml
  const rulesPath = path.join(root, '.shiftstone', 'governance', 'context-integrity-rules.yaml');
  let integrityRules = null;
  if (existsSync(rulesPath)) {
    try {
      integrityRules = parseYaml(readFileSync(rulesPath, 'utf8'));
    } catch (err) {
      violations.push({
        code: 'INVALID_RULES_YAML',
        message: `Failed to parse context-integrity-rules.yaml: ${err.message}`,
      });
    }
  }

  // Check Part A: Universal Contradiction Pairs
  if (integrityRules?.contradictionPairs) {
    for (const rule of integrityRules.contradictionPairs) {
      const allFiles = new Set();
      for (const targetGlob of rule.targets || []) {
        for (const matchedFile of findFilesMatching(root, targetGlob)) {
          allFiles.add(matchedFile);
        }
      }

      for (const fileRel of allFiles) {
        filesScanned++;
        const absPath = path.join(root, fileRel);
        if (!existsSync(absPath)) continue;
        const content = readFileSync(absPath, 'utf8');

        // Check if content matches any allowed pattern that exempts it
        const hasAllowed = (rule.allowedPatterns || []).some((pat) =>
          new RegExp(pat.replace(/^\(\?i\)/, ''), pat.startsWith('(?i)') ? 'i' : '').test(content),
        );
        if (hasAllowed) continue;

        for (const pat of rule.forbiddenPatterns || []) {
          const regex = new RegExp(pat.replace(/^\(\?i\)/, ''), pat.startsWith('(?i)') ? 'i' : '');
          if (regex.test(content)) {
            violations.push({
              code: 'CONTRADICTION_DETECTED',
              ruleId: rule.id,
              file: fileRel,
              pattern: pat,
              message: `${rule.message} (matched: ${pat} in ${fileRel})`,
            });
          }
        }
      }
    }
  }

  // Check Part B: Core Stack Decoupling
  if (integrityRules?.coreStackDecoupling) {
    const decoupling = integrityRules.coreStackDecoupling;
    const allCoreFiles = new Set();
    for (const targetGlob of decoupling.targets || []) {
      for (const matched of findFilesMatching(root, targetGlob)) {
        allCoreFiles.add(matched);
      }
    }

    for (const fileRel of allCoreFiles) {
      filesScanned++;
      const absPath = path.join(root, fileRel);
      if (!existsSync(absPath)) continue;
      const content = readFileSync(absPath, 'utf8');

      for (const item of decoupling.forbiddenStackTerms || []) {
        // Word boundary or hyphen-boundary check
        const regex = new RegExp(`\\b${item.term}\\b`, 'i');
        if (regex.test(content)) {
          violations.push({
            code: 'STACK_LEAK_DETECTED',
            file: fileRel,
            term: item.term,
            reason: item.reason,
            message: `Core rule ${fileRel} contains stack-specific term '${item.term}'. ${item.reason}`,
          });
        }
      }
    }
  }

  // Check Part C: Pack-specific Forbidden Legacy Directives
  const packsDir = existsSync(path.join(root, '.shiftstone', 'packs'))
    ? path.join(root, '.shiftstone', 'packs')
    : path.join(root, 'packs');
  if (existsSync(packsDir)) {
    const packDirs = readdirSync(packsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const packName of packDirs) {
      const packYamlPath = path.join(packsDir, packName, 'pack.yaml');
      if (!existsSync(packYamlPath)) continue;

      let packConfig = null;
      try {
        packConfig = parseYaml(readFileSync(packYamlPath, 'utf8'));
      } catch (err) {
        violations.push({
          code: 'INVALID_PACK_YAML',
          file: path.relative(root, packYamlPath),
          message: `Failed to parse pack config ${packYamlPath}: ${err.message}`,
        });
        continue;
      }

      const scanTargets = packConfig?.spec?.scanTargets || [];
      const forbiddenDirectives = packConfig?.spec?.forbiddenDirectives || [];

      if (forbiddenDirectives.length === 0 || scanTargets.length === 0) continue;

      const packTargetFiles = new Set();
      for (const targetGlob of scanTargets) {
        for (const matched of findFilesMatching(root, targetGlob)) {
          packTargetFiles.add(matched);
        }
      }

      for (const fileRel of packTargetFiles) {
        filesScanned++;
        const absPath = path.join(root, fileRel);
        if (!existsSync(absPath)) continue;
        const content = readFileSync(absPath, 'utf8');

        for (const directive of forbiddenDirectives) {
          const regex = new RegExp(directive.pattern, 'i');
          const lines = content.split(/\r?\n/);

          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            if (regex.test(line)) {
              const window = `${lines[lineIdx - 1] || ''} ${line} ${lines[lineIdx + 1] || ''}`;
              if (directive.allowedPattern && new RegExp(directive.allowedPattern, 'i').test(window)) {
                continue;
              }
              violations.push({
                code: 'FORBIDDEN_DIRECTIVE_DETECTED',
                pack: packName,
                file: fileRel,
                line: lineIdx + 1,
                pattern: directive.pattern,
                reason: directive.reason,
                replacement: directive.replacement,
                message: `[${packName}] Forbidden legacy directive '${directive.pattern}' found in ${fileRel}:${lineIdx + 1}: ${directive.reason} (use '${directive.replacement}' instead)`,
              });
            }
          }
        }
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    filesScanned,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let rootArg = ROOT;
  const rootIdx = process.argv.indexOf('--root');
  if (rootIdx !== -1 && process.argv[rootIdx + 1]) {
    rootArg = process.argv[rootIdx + 1];
  }

  const result = validateContextIntegrity({ root: rootArg });

  console.log('=== Context Contradiction & Integrity Report (UG-03) ===');
  console.log(`  Scanned checks across targets (scanned instances: ${result.filesScanned})`);

  if (!result.ok) {
    console.error(`\nFAIL — ${result.violations.length} context integrity violation(s) detected:`);
    for (const v of result.violations) {
      console.error(`  [${v.code}] ${v.message}`);
    }
    process.exit(1);
  }

  console.log('ok — Zero contradictions, zero stack leaks in core/, and zero forbidden directives detected.');
  process.exit(0);
}
