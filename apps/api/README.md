# Quevo API

A Go API scaffold using Gin and GORM, organized as a feature-first modular monolith. The current endpoint is `GET /api/v1/health`; it does not use the database. OpenAPI 3.1 JSON is served at `/openapi.json`, and Swagger UI is served at `/swagger/`.

The `go.mod` module path is a placeholder (`example.com/quevo/apps/api`) because this checkout has no Git remote or established Go import path. Update it and the internal imports when the canonical repository path is known.

## Run

Requires Go 1.25 or later. From this directory:

```sh
go run ./cmd/server
```

The server listens on `:8080` by default. Environment values can be exported in the shell or provided by the deployment environment. `.env.example` lists the supported variables; the application does not load `.env` files itself.

`DATABASE_URL` is optional. When it is set, the app creates a GORM PostgreSQL connection pool without pinging the database at startup. The health endpoint therefore remains available if PostgreSQL is offline. No schema or migrations are created automatically.

## Database setup

Apply versioned migrations explicitly, then seed synthetic demo accounts. Run from `apps/api` with PostgreSQL available:

```sh
make migrate-up
export QUEVO_CUSTOMER_PASSWORD='choose-a-local-demo-password'
export QUEVO_OPERATOR_PASSWORD='choose-another-local-demo-password'
make seed-demo
```

The seed creates one UTC demo branch, one active service, a Customer, an Operator, and the operator's service authorization. It is safe to rerun. Passwords are supplied through the environment, hashed with bcrypt, and never printed or committed. Demo logins are `customer@quevo.local` and `operator@quevo.local`. Do not use these local accounts in a deployed environment.

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
- `internal/platform/database` initializes the reusable GORM PostgreSQL pool.
- `internal/health` owns the current HTTP handler and route registration.

Future features should live in their own `internal/<feature>` package. A feature should add handler, service, repository, model, and DTO files only when needed, then expose a route-registration function that `internal/app/router.go` calls with a group under `/api/v1`. Keep cross-feature wiring explicit and avoid placeholder interfaces until a concrete use requires them.


Regenerate the OpenAPI spec after changing endpoint annotations or response types with `make generate-openapi` from this directory. The generated JSON is embedded into the API binary and served by the API itself.
