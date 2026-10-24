# Chi Routing & Middleware Skill

> Load this skill when configuring Chi routers, building HTTP middleware, mounting modular sub-routes, or handling JSON requests and responses in Go.

---

## 1. Chi Router Configuration & Middleware Pipeline

```go
package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func NewRouter() *chi.Mux {
	r := chi.NewRouter()

	// Essential middleware stack
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		RespondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	return r
}

func RespondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
```

---

## 2. Sub-routes & URL Parameters

Mount sub-routers with `r.Route`:

```go
func MountUserRoutes(r chi.Router) {
	r.Route("/users", func(r chi.Router) {
		r.Get("/", listUsers)
		r.Post("/", createUser)

		r.Route("/{userID}", func(r chi.Router) {
			r.Get("/", getUser)
			r.Put("/", updateUser)
			r.Delete("/", deleteUser)
		})
	})
}

func getUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userID")
	if userID == "" {
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"id": userID, "name": "Alice"})
}
```

---

## 3. Custom Context Middleware

Pass authenticated user context down the request chain:

```go
import "context"

type contextKey string
const userKey contextKey = "currentUser"

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("Authorization")
		if token == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), userKey, "user-123")
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
```
