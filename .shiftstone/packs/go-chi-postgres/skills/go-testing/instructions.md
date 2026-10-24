# Go Testing & Handler Verification Skill

> Load this skill when authoring unit tests, table-driven tests, testing Chi HTTP handlers with httptest, or running race detection in Go.

---

## 1. Table-Driven Test Structure

Use standard table-driven test patterns with subtests (`t.Run`):

```go
package health_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		target     string
		wantStatus int
		wantBody   string
	}{
		{
			name:       "health returns 200 ok",
			method:     http.MethodGet,
			target:     "/health",
			wantStatus: http.StatusOK,
			wantBody:   `{"status":"ok"}`,
		},
		{
			name:       "wrong method returns 405",
			method:     http.MethodPost,
			target:     "/health",
			wantStatus: http.StatusMethodNotAllowed,
			wantBody:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.target, nil)
			rec := httptest.NewRecorder()

			// Handler call
			// handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rec.Code, tt.wantStatus)
			}
		})
	}
}
```

---

## 2. HTTP Handler Testing with `httptest.ResponseRecorder`

```go
func TestHealthHandlerDirect(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var res map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res["status"] != "ok" {
		t.Errorf("expected status 'ok', got %q", res["status"])
	}
}
```

---

## 3. Running Tests and Race Detection

```bash
# Run all package tests
go test ./...

# Run tests with verbose output
go test -v ./...

# Run tests with data race detector
go test -race ./...

# Run tests with coverage profiling
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
```
