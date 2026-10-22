/**
 * Interactive archetype composition interview (blueprint section 5.4).
 *
 * Runs when init is invoked without --archetype/--archetypes/--validate.
 * Keeps the pre-refactor question flow (project name, layout, package
 * manager, GitHub user, starter clone, extra skills) and adds archetype
 * selection as the first question.
 */

import readline from 'node:readline';
import { listPackNames, loadPack } from './pack-loader.js';
import { DEFAULT_ARCHETYPE } from './compose.js';

/**
 * @param {{ root?: string, input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream }} [options]
 * @returns {Promise<Record<string, any>>} raw interview answers
 */
export async function interview(options = {}) {
  const root = options.root;
  const rl = readline.createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
  });
  const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    const packNames = listPackNames(root ?? process.cwd());
    const answers = {};

    if (packNames.length > 0) {
      console.log('Select your Stack Archetype:');
      packNames.forEach((name, index) => {
        let label = name;
        try {
          const pack = loadPack(root ?? process.cwd(), name);
          const tier = pack.manifest?.metadata?.tier ?? 'community';
          const display = pack.manifest?.metadata?.displayName ?? name;
          label = `${display} (${name}, ${tier})`;
        } catch {
          /* keep directory name */
        }
        console.log(` ${index + 1}) ${label}`);
      });
      const defaultIndex = Math.max(packNames.indexOf(DEFAULT_ARCHETYPE), 0);
      const choice = await ask(
        `👉 Enter choice (1-${packNames.length}) [Default: ${defaultIndex + 1}]: `,
      );
      const parsed = parseInt(choice.trim(), 10);
      const picked =
        Number.isFinite(parsed) && parsed >= 1 && parsed <= packNames.length
          ? packNames[parsed - 1]
          : packNames[defaultIndex];
      answers.archetypes = picked;
    }

    answers.projectName = (await ask('❓ Enter your Project Name (e.g. AcmeSaaS): ')).trim() || 'MySaaSApp';

    console.log('\nSelect your Project Layout Style:');
    console.log(' 1) Monorepo (apps/<app> + root documentation & governance) [Recommended]');
    console.log(' 2) Standard Single App (app in root)');
    const layoutChoice = await ask('👉 Enter Choice (1-2) [Default: 1]: ');
    answers.layout = layoutChoice.trim() === '2' ? 'single' : 'monorepo';

    console.log('\nSelect package manager:');
    console.log(' 1) pnpm [Recommended]');
    console.log(' 2) npm');
    console.log(' 3) yarn');
    const pmChoice = await ask('👉 Enter Choice (1-3) [Default: 1]: ');
    answers.packageManager =
      pmChoice.trim() === '2' ? 'npm' : pmChoice.trim() === '3' ? 'yarn' : 'pnpm';

    const ghUser = await ask('\nGitHub Username / Org (or press Enter to configure later): ');
    answers.ghUser = ghUser.trim() || null;

    if (answers.archetypes?.includes(DEFAULT_ARCHETYPE)) {
      const cloneChoice = await ask(
        '\nStarter Boilerplate Setup: clone the official starter into the app folder? (y/n) [Default: y]: ',
      );
      answers.cloneStarter = !cloneChoice.trim().toLowerCase().startsWith('n');
    }

    const skillsInput = await ask(
      '\nAdditional Project Integrations/Skills (comma-separated, optional): ',
    );
    answers.skills = skillsInput.trim() || null;

    return answers;
  } finally {
    rl.close();
  }
}
