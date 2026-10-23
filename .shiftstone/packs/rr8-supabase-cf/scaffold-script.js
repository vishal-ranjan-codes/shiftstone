/**
 * rr8-supabase-cf scaffold (task 4.8) — clones the official RR8 starter
 * boilerplate into the archetype's app folder and adapts its package.json.
 *
 * Runs as the pack's hooks.pre_init (blueprint section 5.4). Ported from
 * the pre-refactor init.js so the flagship flow behaves identically.
 *
 *   export async function run(context)   — invoked by the composer
 *   node packs/rr8-supabase-cf/scaffold-script.js --root=<dir> --yes
 */

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_STARTER_REPO =
  'https://github.com/vishal-ranjan-codes/react-router-supabase-framework.git';
const DEFAULT_LOCAL_STARTER_PATH = 'D:\\Website\\react-router-supabase-framework';

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
  const starterLocalPath =
    answers.starterPath ||
    (existsSync(DEFAULT_LOCAL_STARTER_PATH) ? DEFAULT_LOCAL_STARTER_PATH : null);

  console.log(`\n📦 Ingesting React Router 8 + Supabase starter boilerplate into '${appPath}'...`);
  let cloneSuccess = false;

  try {
    console.log(`   🌐 Cloning from ${starterRepoUrl}...`);
    if (appPath === '.') {
      const tempCloneDir = path.join(os.tmpdir(), `rr-starter-${Date.now()}`);
      execSync(`git clone --depth 1 "${starterRepoUrl}" "${tempCloneDir}"`, { stdio: 'pipe' });
      console.log('   📋 Copying starter files into workspace root...');
      copyRecursiveSync(tempCloneDir, targetDir, [
        '.git',
        'node_modules',
        'build',
        '.wrangler',
        '.react-router',
        '.dev.vars',
      ]);
      rmSync(tempCloneDir, { recursive: true, force: true });
      cloneSuccess = true;
    } else {
      if (!existsSync(path.dirname(targetDir))) {
        mkdirSync(path.dirname(targetDir), { recursive: true });
      }
      execSync(`git clone --depth 1 "${starterRepoUrl}" "${targetDir}"`, { stdio: 'pipe' });
      cloneSuccess = true;
    }
  } catch (gitErr) {
    console.warn(`   ⚠️  Git clone failed: ${gitErr instanceof Error ? gitErr.message : String(gitErr)}`);
    if (starterLocalPath && existsSync(starterLocalPath)) {
      console.log(`   🔄 Falling back to local starter copy from: ${starterLocalPath}`);
      try {
        copyRecursiveSync(starterLocalPath, targetDir, [
          '.git',
          'node_modules',
          'build',
          '.wrangler',
          '.react-router',
          '.commandcode',
          '.dev.vars',
        ]);
        console.log('   ✅ Local starter files copied successfully.');
        cloneSuccess = true;
      } catch (copyErr) {
        console.error(`   ❌ Local copy failed: ${copyErr instanceof Error ? copyErr.message : String(copyErr)}`);
      }
    } else {
      console.error(`   ❌ Could not clone starter and no local fallback path was available.`);
      console.error(`      You can manually copy the starter into '${appPath}' later.`);
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
  if (cloneSuccess && existsSync(appPkgPath)) {
    console.log('   📦 Installing app dependencies (pnpm install)...');
    try {
      execSync('pnpm install', { cwd: targetDir, stdio: 'pipe' });
      console.log('   ✅ App dependencies installed.');
    } catch (err) {
      console.warn(
        `   ⚠️  pnpm install did not complete (run it manually in ${appPath}/): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return { cloned: cloneSuccess };
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
