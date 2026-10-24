/**
 * nextjs-prisma-pg scaffold (graduated to LOCK-B4 bar).
 * Generates an App Router project with Prisma schema and Vitest health test.
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
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          test: 'vitest run',
          lint: 'next lint',
          typecheck: 'tsc --noEmit',
          'db:migrate': 'prisma migrate dev',
          'db:generate': 'prisma generate',
        },
        dependencies: {
          '@prisma/client': '^6.0.0',
          next: '^15.0.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
        },
        devDependencies: {
          '@types/node': '^22.0.0',
          '@types/react': '^19.0.0',
          '@types/react-dom': '^19.0.0',
          prisma: '^6.0.0',
          typescript: '^5.6.0',
          vitest: '^3.0.0',
        },
      },
      null,
      2,
    )}\n`,
    'tsconfig.json': `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      },
      null,
      2,
    )}\n`,
    'app/layout.tsx': `import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '{{PROJECT_NAME}}',
  description: 'Next.js App Router with Prisma & PostgreSQL',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
    'app/page.tsx': `export default function HomePage() {
  return (
    <main>
      <h1>{{PROJECT_NAME}}</h1>
      <p>Next.js + Prisma + PostgreSQL Starter</p>
    </main>
  );
}
`,
    'app/api/health/route.ts': `import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
`,
    'app/api/health/route.test.ts': `import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  it('returns status ok with 200 code', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ status: 'ok' });
  });
});
`,
    'prisma/schema.prisma': `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`,
    'README.md': `# {{PROJECT_NAME}} — Next.js web app

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
  if (created.length > 0) console.log(`   ⬡ nextjs scaffold created: ${created.join(', ')}`);
  return { created };
}
