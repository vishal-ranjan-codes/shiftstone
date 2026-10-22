/**
 * Generalized dual-repo engine (blueprint section 8.3): N app repositories
 * under one workspace root, each with its own .git and remote.
 *
 * Runs last in init: apps are scaffolded and governance is seeded before
 * any repository is staged or committed. Never pushes to a network.
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function safeExecGit(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function ensureAppGitignore(appDir) {
  const gitignorePath = path.join(appDir, '.gitignore');
  const wanted = ['.workspace-git.json', 'docs/plans/*/state.json', '.loops/*/state.json'];
  let existing = '';
  if (existsSync(gitignorePath)) existing = readFileSync(gitignorePath, 'utf8');
  const missing = wanted.filter((line) => !existing.split(/\r?\n/).includes(line));
  if (missing.length === 0) return false;
  const prefix = existing.length === 0 || existing.endsWith('\n') ? existing : `${existing}\n`;
  writeFileSync(gitignorePath, `${prefix}${missing.join('\n')}\n`, 'utf8');
  return true;
}

function appendRootIgnores(root, appPaths) {
  const gitignorePath = path.join(root, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, '', 'utf8');
  }
  const existing = readFileSync(gitignorePath, 'utf8');
  const wanted = [
    '',
    '# App directories (each is its own git repo)',
    ...appPaths.map((appPath) => `/${appPath.replace(/\\/g, '/')}/`),
    '# Loop state',
    '.loops/*/state.json',
  ];
  const existingLines = existing.split(/\r?\n/);
  const missing = wanted.filter((line) => {
    if (line === '') return false;
    return !existingLines.includes(line);
  });
  if (missing.length === 0) return false;
  appendFileSync(gitignorePath, `${missing.join('\n')}\n`, 'utf8');
  return true;
}

/**
 * @param {{ root: string, composition: any, answers: Record<string, any> }} params
 * @returns {Array<{ path: string, remote: string | null, archetype: string }>}
 */
export function setupDualRepo({ root, composition, answers }) {
  const projectNameLower = answers.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const ghUser = answers.ghUser ?? null;
  const repos = [];

  composition.archetypes.forEach((archetype, index) => {
    const appPath = archetype.effectiveAppPath;
    const appDir = path.join(root, appPath);
    const remoteUrl =
      ghUser !== null
        ? `https://github.com/${ghUser}/${appRepoName(projectNameLower, archetype, index, answers)}.git`
        : archetype.manifest?.metadata?.remoteUrl ?? null;

    if (!existsSync(appDir)) {
      // Nothing scaffolded yet (e.g. validate-only or a placeholder pack
      // with no scaffold) — still record the intended repo.
      repos.push({ path: appPath, remote: remoteUrl, archetype: archetype.name });
      return;
    }

    const gitDir = path.join(appDir, '.git');
    if (!existsSync(gitDir)) {
      safeExecGit('git init -b main', appDir);
    } else {
      // Strip the starter's upstream remote so pushes never target the
      // boilerplate repository (pre-refactor behavior, blueprint 8.3).
      safeExecGit('git remote remove origin', appDir);
    }
    if (remoteUrl !== null) {
      safeExecGit(`git remote add origin ${remoteUrl}`, appDir);
    }
    safeExecGit('git branch -M main', appDir);
    ensureAppGitignore(appDir);
    safeExecGit('git add -A', appDir);
    safeExecGit(
      `git commit -m "feat: initialize ${answers.projectName} ${archetype.manifest?.metadata?.displayName ?? archetype.name} app"`,
      appDir,
    );
    repos.push({ path: appPath, remote: remoteUrl, archetype: archetype.name });
  });

  appendRootIgnores(
    root,
    composition.archetypes.map((a) => a.effectiveAppPath),
  );

  // Root workspace repository: drop the framework template remote, set the
  // project's own remote, stage the seeded workspace locally.
  const rootGitDir = path.join(root, '.git');
  if (existsSync(rootGitDir)) {
    const currentOrigin = safeExecGit('git remote get-url origin', root);
    if (currentOrigin && currentOrigin.includes('react-router-supabase-workspace-framework')) {
      safeExecGit('git remote remove origin', root);
    }
    if (ghUser !== null) {
      const workspaceRepo = answers.workspaceRepo ?? `${projectNameLower}-workspace`;
      const wsRemoteUrl = `https://github.com/${ghUser}/${workspaceRepo}.git`;
      safeExecGit(`git remote add origin ${wsRemoteUrl}`, root);
    }
    safeExecGit('git branch -M main', root);
    safeExecGit('git add -A', root);
    safeExecGit(`git commit -m "chore: initialize ${answers.projectName} workspace governance"`, root);
  }

  // Workspace deployment descriptor (blueprint section 8.3, version 2)
  const workspaceRepo = answers.workspaceRepo ?? `${projectNameLower}-workspace`;
  const metadata = {
    version: 2,
    projectName: answers.projectName,
    githubUser: ghUser,
    workspace: {
      repo: workspaceRepo,
      remote: ghUser !== null ? `https://github.com/${ghUser}/${workspaceRepo}.git` : null,
      branch: 'main',
      pushed: false,
    },
    archetypes: composition.archetypes.map((archetype, index) => ({
      name: archetype.name,
      appPath: archetype.effectiveAppPath,
      repo: appRepoName(projectNameLower, archetype, index, answers),
      remote:
        ghUser !== null
          ? `https://github.com/${ghUser}/${appRepoName(projectNameLower, archetype, index, answers)}.git`
          : archetype.manifest?.metadata?.remoteUrl ?? null,
    })),
    initialized: new Date().toISOString(),
    pushed: false,
  };
  writeFileSync(path.join(root, '.workspace-git.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return repos;
}

function appRepoName(projectNameLower, archetype, index, answers) {
  if (index === 0) return answers.appRepo ?? `${projectNameLower}-app`;
  return `${projectNameLower}-${archetype.name}-app`;
}
