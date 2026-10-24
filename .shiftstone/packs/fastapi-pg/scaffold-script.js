/**
 * fastapi-pg scaffold (graduated to LOCK-B4 bar).
 * Generates a runnable FastAPI skeleton with pytest health test.
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
    'pyproject.toml': `[project]
name = "{{PROJECT_NAME_LOWER}}"
version = "0.1.0"
description = "FastAPI + PostgreSQL service"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn>=0.30",
  "sqlalchemy>=2.0",
  "psycopg[binary]>=3.2",
  "pydantic>=2.8",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "httpx>=0.27",
  "ruff>=0.6",
  "mypy>=1.11",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]

[tool.ruff]
line-length = 100
target-version = "py312"
`,
    'main.py': `"""FastAPI application entrypoint."""

from fastapi import FastAPI

app = FastAPI(title="{{PROJECT_NAME}}")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
`,
    'tests/test_health.py': `"""Health endpoint verification test."""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
`,
    'README.md': `# {{PROJECT_NAME}} API

Run locally:

\`\`\`bash
uv run uvicorn main:app --reload
\`\`\`

Run tests:

\`\`\`bash
uv run pytest
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
  if (created.length > 0) console.log(`   🐍 fastapi scaffold created: ${created.join(', ')}`);
  return { created };
}
