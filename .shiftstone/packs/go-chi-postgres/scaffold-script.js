/**
 * go-chi-postgres scaffold (task 7.5 placeholder) — creates the app
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
    'main.go': `package main\n\nimport (\n\t"net/http"\n\n\t"github.com/go-chi/chi/v5"\n\t"github.com/go-chi/chi/v5/middleware"\n)\n\nfunc main() {\n\tr := chi.NewRouter()\n\tr.Use(middleware.Logger)\n\tr.Get("/health", func(w http.ResponseWriter, _ *http.Request) {\n\t\tw.Header().Set("Content-Type", "application/json")\n\t\tw.Write([]byte("{\\"status\\":\\"ok\\"}"))\n\t})\n\thttp.ListenAndServe(":8080", r)\n}\n`,
    'go.mod': `module github.com/{{PROJECT_NAME_LOWER}}\n\ngo 1.23\n\nrequire github.com/go-chi/chi/v5 v5.1.0\n`,
    'main_test.go': `package main\n\nimport "testing"\n\nfunc TestHealthShape(t *testing.T) {\n\tgot := "{\\"status\\":\\"ok\\"}"\n\tif got == "" {\n\t\tt.Fatal("health payload empty")\n\t}\n}\n`,
    'README.md': '# {{PROJECT_NAME}}\n\nGo + Chi + PostgreSQL service.\n\n```bash\ngo run .\n```\n',
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
  if (created.length > 0) console.log(`   🐹 go scaffold created: ${created.join(', ')}`);
  return { created };
}
