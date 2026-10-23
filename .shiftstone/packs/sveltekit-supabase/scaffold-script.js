/**
 * sveltekit-supabase scaffold (task 7.5 placeholder) — creates the app
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
    'src/routes/+page.svelte': `<script lang="ts">\n  let { data } = $props();\n</script>\n\n<h1>{{PROJECT_NAME}}</h1>\n<p>SvelteKit + Supabase starter.</p>\n`,
    'src/routes/+page.server.ts': `import type { PageServerLoad } from './$types';\n\nexport const load: PageServerLoad = async () => ({\n  status: 'ok',\n});\n`,
    'svelte.config.js': `import adapter from '@sveltejs/adapter-cloudflare';\nimport { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\n\nconst config = {\n  preprocess: vitePreprocess(),\n  kit: {\n    adapter: adapter(),\n  },\n};\n\nexport default config;\n`,
    'package.json': `{\n  "name": "{{PROJECT_NAME_LOWER}}",\n  "version": "0.1.0",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "dev": "vite dev",\n    "build": "vite build",\n    "preview": "vite preview",\n    "check": "svelte-check --tsconfig ./tsconfig.json"\n  },\n  "dependencies": {\n    "@supabase/supabase-js": "^2",\n    "@sveltejs/adapter-cloudflare": "^4",\n    "@sveltejs/kit": "^2",\n    "svelte": "^5"\n  }\n}\n`,
    'README.md': '# {{PROJECT_NAME}}\n\nSvelteKit + Supabase starter.\n\n```bash\npnpm install\npnpm dev\n```\n',
  };
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(targetDir, name);
    if (existsSync(file)) continue;
    mkdirSync(path.dirname(file), { recursive: true });
    const resolved = content
      .split('{{PROJECT_NAME_LOWER}}').join(projectNameLower)
      .split('{{PROJECT_NAME}}').join(projectName);
    writeFileSync(file, resolved, 'utf8');
    created.push(path.join(appPath, name));
  }
  if (created.length > 0) console.log(`   🟢 sveltekit scaffold created: ${created.join(', ')}`);
  return { created };
}
