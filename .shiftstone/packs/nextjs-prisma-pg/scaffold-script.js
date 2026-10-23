/**
 * nextjs-prisma-pg scaffold (task 4.9 placeholder) — creates the app
 * skeleton. Replace the body with a starter clone when the pack graduates
 * from placeholder status.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function run(context) {
  const { root, composition, archetype, answers } = context;
  const composed = composition.archetypes.find((a) => a.name === archetype.name) ?? archetype;
  const appPath = composed.effectiveAppPath ?? composed.manifest.spec.defaultAppPath;
  const targetDir = path.join(root, appPath);
  const created = [];
  const projectName = answers?.projectName ?? 'MySaaSApp';
  const projectNameLower = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    created.push(appPath);
  }
  const files = {
    'package.json': `${JSON.stringify(
      {
        name: '{{PROJECT_NAME_LOWER}}-web',
        version: '0.1.0',
        private: true,
        scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
        dependencies: { next: '^15.0.0', react: '^19.0.0', prisma: '^6.0.0' },
      },
      null,
      2,
    )}\n`,
    'README.md': '# {{PROJECT_NAME}} — Next.js web app\n\n```bash\npnpm dev\n```\n',
  };
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(targetDir, name);
    if (existsSync(file)) continue;
    const resolved = content
      .split('{{PROJECT_NAME_LOWER}}').join(projectNameLower)
      .split('{{PROJECT_NAME}}').join(projectName);
    writeFileSync(file, resolved, 'utf8');
    created.push(path.join(appPath, name));
  }
  if (created.length > 0) console.log(`   ⬡ nextjs scaffold created: ${created.join(', ')}`);
  return { created };
}
