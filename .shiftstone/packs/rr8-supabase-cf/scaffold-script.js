/**
 * rr8-supabase-cf scaffold (task 4.8) — ingests the official RR8 starter
 * boilerplate into the archetype's app folder and adapts its package.json.
 *
 * Runs as the pack's hooks.pre_init (blueprint section 5.4). The starter is
 * resolved per LOCK-A5 so the scaffold is portable across machines and works
 * offline: an explicit local path, then `SS_LOCAL_STARTER`, then the monorepo
 * template, then a git clone of the published starter.
 *
 *   export async function run(context)   — invoked by the composer
 *   node .shiftstone/packs/rr8-supabase-cf/scaffold-script.js --root=<dir> --yes
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_STARTER_REPO =
  'https://github.com/vishal-ranjan-codes/react-router-supabase-framework.git';
/** LOCK-A5 tier 2: sibling starter template shipped inside the monorepo. */
const MONOREPO_TEMPLATE_REL = 'frameworks/template-react-router8-supabase';
/** LOCK-A5 tier 1: environment override for machines without the monorepo template. */
const STARTER_ENV_VAR = 'SS_LOCAL_STARTER';
const COPY_SKIP = ['.git', 'node_modules', 'build', '.wrangler', '.react-router', '.commandcode', '.dev.vars'];

/**
 * LOCK-A5 starter resolution order. Returns the first source that exists on
 * disk, or `clone` when no local starter is available.
 *
 * @param {{ root?: string, env?: NodeJS.ProcessEnv, explicitPath?: string|null, exists?: (p: string) => boolean }} [opts]
 * @returns {{ source: 'starter-path'|'env'|'monorepo'|'clone', path: string|null }}
 */
export function resolveStarter(opts = {}) {
  const { root = process.cwd(), env = process.env, explicitPath = null, exists = existsSync } = opts;

  if (explicitPath && String(explicitPath).trim().length > 0) {
    const candidate = path.resolve(String(explicitPath).trim());
    if (exists(candidate)) return { source: 'starter-path', path: candidate };
    console.warn(`   ⚠️  --starter-path "${candidate}" does not exist — continuing resolution`);
  }

  const fromEnv = env[STARTER_ENV_VAR];
  if (fromEnv && String(fromEnv).trim().length > 0) {
    const candidate = path.resolve(String(fromEnv).trim());
    if (exists(candidate)) return { source: 'env', path: candidate };
    console.warn(`   ⚠️  ${STARTER_ENV_VAR}="${candidate}" does not exist — continuing resolution`);
  }

  const template = path.resolve(root, MONOREPO_TEMPLATE_REL);
  if (exists(template)) return { source: 'monorepo', path: template };

  return { source: 'clone', path: null };
}

function copyRecursiveSync(src, dest, skip = []) {
  if (!existsSync(src)) return;
  const stats = statSync(src);
  if (stats.isDirectory()) {
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    for (const child of readdirSync(src)) {
      if (skip.includes(child)) continue;
      copyRecursiveSync(path.join(src, child), path.join(dest, child), skip);
    }
  } else {
    copyFileSync(src, dest);
  }
}

function cloneStarter({ repoUrl, targetDir, appPath }) {
  if (appPath === '.') {
    const tempCloneDir = path.join(os.tmpdir(), `rr-starter-${Date.now()}`);
    execFileSync('git', ['clone', '--depth', '1', repoUrl, tempCloneDir], { stdio: 'pipe' });
    console.log('   📋 Copying starter files into workspace root...');
    copyRecursiveSync(tempCloneDir, targetDir, COPY_SKIP);
    rmSync(tempCloneDir, { recursive: true, force: true });
    return;
  }
  if (!existsSync(path.dirname(targetDir))) {
    mkdirSync(path.dirname(targetDir), { recursive: true });
  }
  execFileSync('git', ['clone', '--depth', '1', repoUrl, targetDir], { stdio: 'pipe' });
}

/**
 * @param {{ root: string, composition: any, answers: Record<string, any>, archetype: any }} context
 */
export async function run(context) {
  const { root, composition, answers, archetype } = context;
  const composed = composition.archetypes.find((a) => a.name === archetype.name) ?? archetype;
  const appPath = composed.effectiveAppPath ?? composed.manifest.spec.defaultAppPath;
  const targetDir = path.resolve(root, appPath);
  const projectName = answers.projectName ?? 'MySaaSApp';
  const projectNameLower = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const monorepo = (answers.layout ?? composed.manifest.spec.folderLayout) === 'monorepo';
  const npmPackageName = monorepo
    ? `@${projectNameLower}/${path.posix.basename(appPath.replace(/\\/g, '/'))}`
    : projectNameLower;

  if (!answers.cloneStarter) {
    console.log(`   ℹ️  starter clone skipped (no --clone-starter) — ${appPath}/ not scaffolded`);
    return { cloned: false };
  }

  const starterRepoUrl = answers.starterRepo || DEFAULT_STARTER_REPO;
  const starter = resolveStarter({ root, explicitPath: answers.starterPath });

  console.log(`\n📦 Ingesting React Router 8 + Supabase starter boilerplate into '${appPath}'...`);
  let scaffolded = false;

  if (starter.path) {
    console.log(`   🔄 Starter source: local ${starter.source} → ${starter.path}`);
    try {
      copyRecursiveSync(starter.path, targetDir, COPY_SKIP);
      console.log('   ✅ Local starter files copied successfully.');
      scaffolded = true;
    } catch (copyErr) {
      console.error(`   ❌ Local copy failed: ${copyErr instanceof Error ? copyErr.message : String(copyErr)}`);
    }
  }

  if (!scaffolded) {
    console.log(`   🌐 Starter source: git clone → ${starterRepoUrl}`);
    try {
      cloneStarter({ repoUrl: starterRepoUrl, targetDir, appPath });
      scaffolded = true;
    } catch (gitErr) {
      const detail = gitErr instanceof Error ? gitErr.message : String(gitErr);
      console.error(`   ❌ Could not clone the starter from ${starterRepoUrl}: ${detail}`);
      console.error(
        `      Set ${STARTER_ENV_VAR}=<dir> (or pass --starter-path=<dir>) to ingest a local copy of the starter instead,`,
      );
      console.error(`      or copy the starter into '${appPath}' manually and re-run the install step.`);
    }
  }

  // Adapt the cloned app's package.json
  const appPkgPath = path.join(targetDir, 'package.json');
  if (existsSync(appPkgPath)) {
    try {
      const appPkg = JSON.parse(readFileSync(appPkgPath, 'utf8'));
      appPkg.name = npmPackageName;
      if (!appPkg.scripts) appPkg.scripts = {};
      appPkg.scripts['supabase:types'] =
        'npx supabase gen types typescript local > app/types/database.types.ts';
      writeFileSync(appPkgPath, `${JSON.stringify(appPkg, null, 2)}\n`, 'utf8');
      console.log(`   ✅ Updated app package.json (name: "${npmPackageName}")`);
    } catch (err) {
      console.warn(`   ⚠️  Could not update app package.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Blueprint section 5.2: the scaffold runs pnpm install after cloning.
  if (scaffolded && existsSync(appPkgPath)) {
    console.log('   📦 Installing app dependencies (pnpm install)...');
    try {
      execFileSync('pnpm', ['install'], { cwd: targetDir, stdio: 'pipe' });
      console.log('   ✅ App dependencies installed.');
    } catch (err) {
      console.warn(
        `   ⚠️  pnpm install did not complete (run it manually in ${appPath}/): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return { cloned: scaffolded };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const rootArg = args.find((a) => a.startsWith('--root='));
  const root = rootArg ? rootArg.slice('--root='.length) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  run({
    root,
    composition: { archetypes: [{ name: 'rr8-supabase-cf', effectiveAppPath: 'apps/web', manifest: { spec: { folderLayout: 'monorepo' } } }] },
    answers: { projectName: 'MySaaSApp', cloneStarter: args.includes('--yes') || args.includes('-y') },
    archetype: { name: 'rr8-supabase-cf' },
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
