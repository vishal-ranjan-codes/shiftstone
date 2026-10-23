#!/usr/bin/env node
/**
 * Universal AI Workspace Framework — Archetype Composer CLI.
 *
 * Usage:
 *   node .shiftstone/init.js                                 (interactive interview)
 *   node .shiftstone/init.js --archetype=rr8-supabase-cf
 *   node .shiftstone/init.js --archetypes=rr8-supabase-cf,fastapi-pg
 *   node .shiftstone/init.js --validate                      (CI: validate without writing)
 *   node .shiftstone/init.js --force-namespace               (section 10.4 escape hatch)
 *
 * Legacy flags from the pre-refactor initializer still work:
 *   --name= -n= --layout= -l= --pm= --app-path= --gh-user= --workspace-repo=
 *   --app-repo= --skills= --clone-starter --starter-repo= --starter-path= -y
 *
 * Pipeline (blueprint section 5.4):
 *   interview | flags -> compose -> validate -> pre-hooks -> seed-governance
 *   -> variable substitution -> post-hooks -> dual-repo
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { composeArchetypes, parseArchetypeList } from './init/compose.js';
import { interview } from './init/interview.js';
import { listPackNames, loadPack } from './init/pack-loader.js';
import {
  unmatchedSkillIncludes,
  validateComposition,
  validatePack,
} from './init/validate-manifest.js';
import { seedGovernance } from './init/seed-governance.js';
import { setupDualRepo } from './init/dual-repo.js';
import {
  DEFAULT_SKIP_DIRS,
  buildVariables,
  substituteInTree,
} from './init/variables.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

export function parseFlags(argv = []) {
  const flags = { raw: argv };
  const valueOf = (name) => {
    const arg = argv.find((a) => a.startsWith(`${name}=`));
    return arg ? arg.slice(name.length + 1).replace(/^["']|["']$/g, '') : null;
  };
  const has = (name) => argv.some((a) => a === name || a.startsWith(`${name}=`));

  flags.validate = has('--validate');
  flags.forceNamespace = has('--force-namespace');
  flags.archetype = valueOf('--archetype');
  flags.archetypes = valueOf('--archetypes');
  flags.projectName = valueOf('--name') ?? valueOf('-n');
  flags.layout = valueOf('--layout') ?? valueOf('-l');
  flags.packageManager = valueOf('--pm');
  flags.appPath = valueOf('--app-path') ?? valueOf('--app-dir');
  flags.ghUser = valueOf('--gh-user');
  flags.workspaceRepo = valueOf('--workspace-repo');
  flags.appRepo = valueOf('--app-repo');
  flags.skills = valueOf('--skills');
  flags.cloneStarter = has('--clone-starter') || has('--copy-starter');
  flags.starterRepo = valueOf('--starter-repo');
  flags.starterPath = valueOf('--starter-path');
  flags.nonInteractive =
    has('-y') || has('--non-interactive') || has('--yes');
  flags.root = valueOf('--root');
  return flags;
}

function answersFromFlags(flags) {
  const projectName = flags.projectName || 'MySaaSApp';
  return {
    archetypes: flags.archetypes ?? flags.archetype ?? undefined,
    projectName,
    layout: (flags.layout ?? 'monorepo').toLowerCase() === 'single' ? 'single' : 'monorepo',
    packageManager: flags.packageManager ?? 'pnpm',
    ghUser: flags.ghUser ?? null,
    workspaceRepo: flags.workspaceRepo ?? null,
    appRepo: flags.appRepo ?? null,
    skills: flags.skills ?? null,
    cloneStarter: Boolean(flags.cloneStarter),
    starterRepo: flags.starterRepo,
    starterPath: flags.starterPath,
  };
}

/** Run a pack hook module: exports `run(context)` (pre_init / post_init). */
async function runHook(archetype, hookRel, context) {
  if (typeof hookRel !== 'string') return false;
  const hookPath = path.join(archetype.dir, hookRel);
  if (!existsSync(hookPath)) return false;
  const mod = await import(pathToFileURL(hookPath).href);
  const run = mod.run ?? mod.default;
  if (typeof run !== 'function') {
    throw new Error(`pack "${archetype.name}": hook ${hookRel} must export run(context)`);
  }
  await run({ ...context, archetype });
  return true;
}

async function runHooks(composition, phase, context) {
  const ran = [];
  for (const archetype of composition.archetypes) {
    if (phase === 'pre') {
      const folderHooks = archetype.manifest.composition?.folder_hooks;
      if (typeof folderHooks === 'string') {
        if (await runHook(archetype, path.posix.join(folderHooks.replace(/\/$/, ''), 'pre-init.js'), context)) {
          ran.push(`${archetype.name}:folder-hooks/pre-init.js`);
        }
      }
      const pre = archetype.manifest.hooks?.pre_init;
      if (await runHook(archetype, pre, context)) ran.push(`${archetype.name}:${pre}`);
      const scaffold = archetype.manifest.composition?.scaffold_script;
      if (pre === undefined && (await runHook(archetype, scaffold, context))) {
        ran.push(`${archetype.name}:${scaffold}`);
      }
    } else {
      const post = archetype.manifest.hooks?.post_init;
      if (await runHook(archetype, post, context)) ran.push(`${archetype.name}:${post}`);
    }
  }
  return ran;
}

function printBanner() {
  console.log(`\n${colors.magenta}${colors.bright}=============================================================`);
  console.log(' Universal AI Workspace Framework — Archetype Composer');
  console.log(`=============================================================${colors.reset}\n`);
}

/** --validate: schema + reference + conflict checks, nothing written. */
export function runValidate(flags, root = ROOT) {
  const explicit = parseArchetypeList(flags);
  const names = flags.archetype || flags.archetypes ? explicit : listPackNames(root);
  const errors = [];
  const packs = [];
  for (const name of names) {
    try {
      const pack = loadPack(root, name);
      packs.push(pack);
      for (const error of validatePack(pack, { root })) {
        errors.push(`pack "${name}": ${error}`);
      }
      for (const warning of unmatchedSkillIncludes(pack)) console.warn(`warn: pack "${name}": ${warning}`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  // Pairwise conflicts only matter when an explicit composition was given.
  if ((flags.archetype || flags.archetypes) && packs.length > 1) {
    const result = validateComposition({ archetypes: packs }, { root, forceNamespace: flags.forceNamespace });
    errors.push(...result.errors);
    for (const warning of result.warnings) console.warn(`warn: ${warning}`);
  }
  for (const error of errors) console.error(`error: ${error}`);
  console.log(
    errors.length === 0
      ? `ok — ${packs.length} pack manifest(s) valid against packs/_schema.json`
      : `FAIL — ${errors.length} problem(s)`,
  );
  return errors.length === 0 ? 0 : 1;
}

export async function main(argv = process.argv.slice(2)) {
  const flags = parseFlags(argv);
  const root = flags.root ?? ROOT;
  if (flags.validate) return runValidate(flags, root);

  printBanner();

  const needsInterview =
    !flags.nonInteractive &&
    !flags.archetype &&
    !flags.archetypes &&
    (!flags.projectName || !flags.layout);

  let answers;
  if (needsInterview) {
    answers = await interview({ root });
  } else {
    answers = answersFromFlags(flags);
  }

  const composition = composeArchetypes(
    { archetypes: answers.archetypes, forceNamespace: flags.forceNamespace },
    { root },
  );
  if (flags.appPath) composition.archetypes[0].effectiveAppPath = flags.appPath;
  if (answers.workspaceRepo === null) delete answers.workspaceRepo;
  if (answers.appRepo === null) delete answers.appRepo;

  console.log(`${colors.cyan}Composing archetypes:${colors.reset} ${composition.archetypes.map((a) => a.name).join(', ')}`);

  const validation = validateComposition(composition, {
    root,
    forceNamespace: flags.forceNamespace,
  });
  for (const warning of validation.warnings) console.warn(`warn: ${warning}`);
  if (!validation.ok) {
    for (const error of validation.errors) console.error(`error: ${error}`);
    console.error('\n❌ Manifest validation failed — nothing was written.');
    return 1;
  }

  const hookContext = { root, composition, answers, colors };

  const preHooks = await runHooks(composition, 'pre', hookContext);
  for (const hook of preHooks) console.log(`   🔧 pre-init hook: ${hook}`);

  seedGovernance({ root, composition, answers });

  const variables = buildVariables({ answers, composition });
  if (variables.errors.length > 0) {
    for (const error of variables.errors) console.error(`error: ${error}`);
    console.error('\n❌ Variable validation failed.');
    return 1;
  }
  hookContext.variables = variables.map;
  const skipDirs = new Set(DEFAULT_SKIP_DIRS);
  for (const archetype of composition.archetypes) {
    if (archetype.effectiveAppPath && archetype.effectiveAppPath !== '.') {
      skipDirs.add(archetype.effectiveAppPath);
    }
  }
  const substituted = substituteInTree(root, variables.map, { skipDirs });
  console.log(`   ✍️  precision substitution: ${substituted.changed.length} file(s) customized`);

  const postHooks = await runHooks(composition, 'post', hookContext);
  for (const hook of postHooks) console.log(`   🔧 post-init hook: ${hook}`);

  const repos = setupDualRepo({ root, composition, answers });

  console.log(`\n${colors.green}${colors.bright}🏁 Workspace ready.${colors.reset}`);
  console.log(`Archetypes: ${composition.archetypes.map((a) => a.name).join(', ')}`);
  console.log(`Apps: ${repos.map((r) => r.path).join(', ')}`);
  console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
  console.log('  1. Install dependencies with your package manager.');
  console.log('  2. Both git repositories are staged and committed locally (zero network pushes).');
  console.log(`  3. When ready to publish, tell your AI agent: ${colors.cyan}'Push to GitHub'${colors.reset} or run ${colors.cyan}'/push'${colors.reset}.`);
  console.log('  4. Check AGENTS.md for the universal orientation guide.\n');
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code);
    })
    .catch((error) => {
      console.error('Error during initialization:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
