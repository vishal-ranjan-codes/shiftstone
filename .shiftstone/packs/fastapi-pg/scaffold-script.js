/**
 * fastapi-pg scaffold (task 4.9 placeholder) — creates the app skeleton.
 * Replace the body with a starter clone when the pack graduates from
 * placeholder status.
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
    'main.py': '"""FastAPI application entrypoint."""\n\nfrom fastapi import FastAPI\n\napp = FastAPI(title="{{PROJECT_NAME}}")\n\n\n@app.get("/health")\nasync def health() -> dict[str, str]:\n    return {"status": "ok"}\n',
    'pyproject.toml': '[project]\nname = "{{PROJECT_NAME_LOWER}}"\nversion = "0.1.0"\ndescription = "FastAPI + PostgreSQL service"\nrequires-python = ">=3.12"\ndependencies = [\n  "fastapi>=0.115",\n  "uvicorn>=0.30",\n  "sqlalchemy>=2.0",\n  "psycopg[binary]>=3.2",\n  "pydantic>=2.8",\n]\n',
    'README.md': '# {{PROJECT_NAME}} API\n\nRun locally:\n\n```bash\nuv run uvicorn main:app --reload\n```\n',
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
  if (created.length > 0) console.log(`   🐍 fastapi scaffold created: ${created.join(', ')}`);
  return { created };
}
