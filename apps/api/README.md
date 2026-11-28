# Quevo API

A Go API using Gin and GORM, organized as a feature-first modular monolith. It exposes `GET /api/v1/health` and sign-in, sign-out, and current-user endpoints under `/api/v1/auth`. Health does not use the database. Auth endpoints use the `users` and `sessions` tables from the versioned migrations; see [the authentication contract](../../docs/design/authentication.md). OpenAPI 3.1 JSON is served at `/openapi.json`, and Swagger UI is served at `/swagger/`.

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
make seed-demo
```

The seed creates one UTC demo branch, a sample bank service catalog with service-specific request forms, six default queues, one counter and its operator assignments, and customer/operator/branch-manager accounts. Account Opening and Personal Loan Application require an uploaded supporting document before an operator can start service. Attachments are private to the ticket and limited to five PDF, PNG, or JPG files of at most 10 MiB each. The demo upload path does not include malware scanning; production deployment must add a private object store, encryption-at-rest policy, document scanning, and retention controls before accepting real customer files. See [branch management and customer documents](../../docs/branch-management.md). The seed generates a random password for each new account and stores the bcrypt hash in PostgreSQL. Run it in a private terminal and save the generated login details when they appear. Rerunning the seed preserves existing passwords.

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

## Endpoint

```sh
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/swagger/
curl http://localhost:8080/openapi.json
```

Swagger UI and the OpenAPI document are available without signing in in local development and on the production API service. The deployed URL and access policy are recorded in the [Lab 5 deployment guide](../../docs/labs/lab-05/deployment.md#swagger-access-policy). API endpoint authentication and role checks remain in force when requests are sent from Swagger UI.

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
