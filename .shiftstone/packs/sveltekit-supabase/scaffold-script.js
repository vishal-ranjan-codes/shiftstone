/**
 * sveltekit-supabase scaffold (graduated to LOCK-B4 bar).
 * Generates a SvelteKit project with Supabase SSR and Vitest health test.
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
        name: `${projectNameLower}-web`,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite dev',
          build: 'vite build',
          preview: 'vite preview',
          test: 'vitest run',
          'test:ui': 'vitest --ui',
          lint: 'svelte-check && eslint .',
          typecheck: 'svelte-check --tsconfig ./tsconfig.json',
        },
        dependencies: {
          '@supabase/ssr': '^0.5.0',
          '@supabase/supabase-js': '^2.45.0',
          '@sveltejs/adapter-cloudflare': '^4.0.0',
          '@sveltejs/kit': '^2.5.0',
          svelte: '^5.0.0',
        },
        devDependencies: {
          '@sveltejs/vite-plugin-svelte': '^4.0.0',
          'svelte-check': '^4.0.0',
          typescript: '^5.6.0',
          vite: '^5.4.0',
          vitest: '^3.0.0',
        },
      },
      null,
      2,
    )}\n`,
    'svelte.config.js': `import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
  },
};

export default config;
`,
    'src/routes/+layout.svelte': `<script lang="ts">
  let { children } = $props();
</script>

<main>
  {@render children()}
</main>
`,
    'src/routes/+page.svelte': `<script lang="ts">
  let { data } = $props();
</script>

<h1>{{PROJECT_NAME}}</h1>
<p>SvelteKit + Supabase Starter</p>
`,
    'src/routes/health/+server.ts': `import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return json({ status: 'ok' });
};
`,
    'src/routes/health/+server.test.ts': `import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('GET /health endpoint', () => {
  it('returns json status ok', async () => {
    const res = await GET({} as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
`,
    'README.md': `# {{PROJECT_NAME}} — SvelteKit + Supabase

\`\`\`bash
pnpm dev
\`\`\`

Run tests:

\`\`\`bash
pnpm test
\`\`\`
`,
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
