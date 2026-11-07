# Quevo API

A Go API using Gin and GORM, organized as a feature-first modular monolith. It exposes `GET /api/v1/health` and sign-in, sign-out, and current-user endpoints under `/api/v1/auth`. Health does not use the database. Auth endpoints use the `app_users` and `sessions` tables from the versioned migrations; see [the authentication contract](../../docs/design/authentication.md). OpenAPI 3.1 JSON is served at `/openapi.json`, and Swagger UI is served at `/swagger/`.

## Run

Requires Go 1.26, as specified in `go.mod`. From this directory:

```sh
go run ./cmd/server
```

The server listens on `:8080` by default. Configuration loads an optional `.env` file from the current directory; exported environment values take precedence. `.env.example` lists the supported variables. The server, migration command, and seed command use the same configuration.

`DATABASE_URL` is optional. When it is set, the app creates a GORM PostgreSQL connection pool without pinging the database at startup. The health endpoint therefore remains available if PostgreSQL is offline. No schema or migrations are created automatically.

## Database setup

Apply versioned migrations explicitly, then seed synthetic demo accounts. Run from `apps/api` with PostgreSQL available:

```sh
make migrate-up
export QUEVO_CUSTOMER_PASSWORD='choose-a-local-demo-password'
export QUEVO_OPERATOR_PASSWORD='choose-another-local-demo-password'
make seed-demo
```

The seed creates one UTC demo branch, one active service, a Customer, an Operator, and the operator's service authorization. It is safe to rerun. Passwords are supplied through `.env` or the environment, hashed with bcrypt, and never printed or committed. Demo logins are `customer@quevo.local` and `operator@quevo.local`. Do not use these local accounts in a deployed environment.

## Logging

Zap writes structured JSON for application and HTTP request logs. Request logs include the method, matched route, status, and latency; query strings are omitted. Panic recovery also logs a stack trace.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DATABASE_URL` | unset | PostgreSQL connection URL; leave unset to disable database initialization |
| `DB_MAX_IDLE_CONNS` | `5` | Maximum idle database connections |
| `DB_MAX_OPEN_CONNS` | `10` | Maximum open database connections |
| `DB_CONN_MAX_LIFETIME` | `30m` | Maximum lifetime for a pooled database connection |
| `SESSION_TTL` | `12h` | Lifetime for newly created sessions |
| `QUEVO_CUSTOMER_PASSWORD` | unset | Local demo customer password used by `make seed-demo` |
| `QUEVO_OPERATOR_PASSWORD` | unset | Local demo operator password used by `make seed-demo` |

## Endpoint

```sh
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/openapi.json
```

Response:

```json
{"status":"healthy"}
```

## Check and build

```sh
go test ./...
go vet ./...
go build -o /tmp/quevo-api ./cmd/server
```

The health handler does not connect to PostgreSQL.

## Architecture

- `cmd/server` loads configuration and starts the HTTP server.
- `internal/app` wires optional infrastructure and configures the HTTP server and router.
- `internal/platform/config` parses and validates environment variables.
- `internal/platform/database` owns the reusable PostgreSQL pool, versioned migrations, and demo seed logic.
- `internal/auth` verifies credentials, stores opaque server-side sessions, and enforces session and role checks.
- `internal/health` owns the current HTTP handler and route registration.

Future features should live in their own `internal/<feature>` package. A feature should add handler, service, repository, model, and DTO files only when needed, then expose a route-registration function that `internal/app/router.go` calls with a group under `/api/v1`. Keep cross-feature wiring explicit and avoid placeholder interfaces until a concrete use requires them.


Regenerate the OpenAPI spec after changing endpoint annotations or response types with `make generate-openapi` from this directory. The generated JSON is embedded into the API binary and served by the API itself.
