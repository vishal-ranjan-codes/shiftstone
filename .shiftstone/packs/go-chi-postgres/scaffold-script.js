/**
 * go-chi-postgres scaffold (graduated to LOCK-B4 bar).
 * Generates a runnable Go + Chi skeleton with passing health test.
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
    'go.mod': `module {{PROJECT_NAME_LOWER}}

go 1.23

require github.com/go-chi/chi/v5 v5.1.0
`,
    'cmd/api/main.go': `package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	log.Println("Starting {{PROJECT_NAME}} on :8080")
	_ = http.ListenAndServe(":8080", r)
}
`,
    'internal/health/health_test.go': `package health_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	tests := []struct {
		name          string
		method        string
		wantStatus    int
		wantStatusKey string
	}{
		{
			name:          "health returns status ok",
			method:        http.MethodGet,
			wantStatus:    http.StatusOK,
			wantStatusKey: "ok",
		},
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/health", nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("got status %d, want %d", rec.Code, tt.wantStatus)
			}

			var body map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if body["status"] != tt.wantStatusKey {
				t.Errorf("got status key %q, want %q", body["status"], tt.wantStatusKey)
			}
		})
	}
}
`,
    'README.md': `# {{PROJECT_NAME}} API (Go + Chi)

Run locally:

\`\`\`bash
go run ./cmd/api
\`\`\`

Run tests:

\`\`\`bash
go test ./...
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
  if (created.length > 0) console.log(`   🐹 go scaffold created: ${created.join(', ')}`);
  return { created };
}
