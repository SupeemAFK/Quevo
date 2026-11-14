# Quevo

Quevo is a full-stack prototype with a Go API, a Bun-managed TypeScript web app, PostgreSQL, and Playwright E2E tests.

## Quick start

Requirements: Docker with the Compose plugin. Start the full stack from the repository root:

```sh
docker compose up --build
```

Open the web app at [http://localhost:3000](http://localhost:3000). The API health endpoint is [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health). API documentation is at [http://localhost:8080/swagger/](http://localhost:8080/swagger/), with the generated spec at [http://localhost:8080/openapi.json](http://localhost:8080/openapi.json). PostgreSQL is exposed on port `5432` with local-only development credentials configured in `compose.yaml`.

Authentication uses the database but does not create its schema or demo accounts automatically. To prepare local demo sign-in, copy `apps/api/.env.example` to `apps/api/.env`, fill in the local database URL using the credentials in `compose.yaml`. Then run these commands from the repository root while Compose is running:

```sh
cd apps/api
make migrate-up
make seed-demo
```

Save the generated demo passwords from the private terminal. Rerunning the seed preserves existing passwords.

Stop the foreground stack with `Ctrl+C`, or stop a detached stack with:

```sh
docker compose down
```

To remove the local database volume as well, use `docker compose down -v`.

See the [Lab 5 deployment guide](docs/labs/lab-05/deployment.md) for the environment variable inventory and release setup. Restart a standalone API after changing its `.env` so it picks up the new database URL.

## Start selected services

Run commands from the repository root. `--no-deps` skips Compose dependencies that are normally started automatically.

```sh
# PostgreSQL only
docker compose up --build db

# API and its PostgreSQL dependency
docker compose up --build api

# API only; the current health endpoint does not use PostgreSQL
docker compose up --build --no-deps api

# Web and API without PostgreSQL
docker compose up --build --no-deps api web

# Web, API, and PostgreSQL
docker compose up --build web
```

Stop a foreground selection with `Ctrl+C`. The API's current health endpoint does not need the database; database-backed features will need PostgreSQL running.

## Project structure

```text
.
├── apps/
│   ├── api/        Go, Gin, GORM, PostgreSQL, Zap, and OpenAPI 3.1
│   └── web/        React, TanStack Start, TypeScript, Tailwind, shadcn, and Bun
├── docs/           Requirements, system design, and development notes
├── tests/e2e/      Playwright browser tests
├── compose.yaml    Local development services
└── AGENTS.md       AI coding guidance
```

The web app calls the API through a TanStack server function, so the API address stays on the server and does not need browser CORS access.

## Product workflows

Customers can sign in, select an active service, join its queue, recover active tickets, and view their own ticket status. Authorized operators can see assigned queues, call the next ticket, and start, complete, or skip tickets through the persisted queue workflow. The API enforces roles, queue access, ticket assignment, and valid transitions; PostgreSQL allocates queue numbers and records state changes transactionally. The user journey and ticket lifecycle are documented in [docs/requirements/workflows.md](docs/requirements/workflows.md); the system architecture and data model are in [docs/design/system-sds.md](docs/design/system-sds.md), and the sign-in/session contract is in [docs/design/authentication.md](docs/design/authentication.md). The requirements-to-feature-to-sprint matrix and official Theme 9 / Deliverable 1 crosswalk are in [docs/requirements/traceability.md](docs/requirements/traceability.md). The course milestones and proposed feature allocation are in [docs/sprints/plan.md](docs/sprints/plan.md). Issue effort weights and label conventions are in [docs/sprints/estimation.md](docs/sprints/estimation.md).

## Run locally

See [docs/development.md](docs/development.md) for standalone API and web commands, environment variables, Playwright setup, and guidance for adding backend features.

API checks:

```sh
cd apps/api
go test ./...
go vet ./...
```

Web development and build:

```sh
cd apps/web
bun install --frozen-lockfile
API_BASE_URL=http://localhost:8080 bun --bun run dev
```

In another terminal, build with:

```sh
cd apps/web
bun --bun run build
```

## Test

The web app uses Bun for dependencies and the dev server. Vitest and Playwright require Node 24 (`.nvmrc`). Web unit and component tests use React Testing Library and MSW. Go unit tests use the standard library. The database integration and Playwright E2E suites start isolated PostgreSQL containers with Testcontainers. E2E starts the real Go API and web app, applies the real migrations and demo seed, and covers sign-in, service selection, queue joining, ticket reload and recovery, and duplicate-join rejection against PostgreSQL; it does not mock the backend.

Install Playwright's Chromium browser once:

```sh
cd tests
bun install --frozen-lockfile
bunx playwright install chromium
```

Run every suite from the repository root (Docker and Chromium are required):

```sh
make test
```

Run individual suites:

```sh
cd apps/web && bun run test
cd apps/api && go test ./...                 # unit and OpenAPI provider contract
cd apps/api && go test -tags=integration ./...
cd tests && bunx playwright test             # full stack with real PostgreSQL
```

The API integration test starts and removes its own PostgreSQL container. Playwright starts a separate temporary PostgreSQL container, builds and starts the API, starts the Bun web server, then shuts everything down after the browser tests. GitHub Actions runs the same `make test` command after installing Go, Bun, and Chromium.

## Lint

Run the web and Go lint checks from the repository root:

```sh
make lint
```

The web check uses Biome through Bun. The Go check uses golangci-lint `v2.15.0` (pinned in `apps/api/.golangci-lint-version`) with the standard linter set and `gofmt` formatting checks. `make lint` downloads that pinned version into the ignored `.tools/` directory on first use.

## API and generated types

`GET /api/v1/health` returns `{"status":"healthy"}`. The API also exposes `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout`. Authentication requires the `users` and `sessions` migrations to be applied and demo accounts to be seeded; see [the local setup steps](apps/api/README.md#database-setup) and [docs/design/authentication.md](docs/design/authentication.md). Swagger UI is served at `/swagger/`, and the generated OpenAPI 3.1 JSON is served at `/openapi.json`.

To regenerate after changing Go endpoint annotations or response types, run from the repository root:

```sh
cd apps/api && make generate-openapi
cd ../web && bun install --frozen-lockfile && bun run generate:api
```

`openapi-typescript` generates `apps/web/src/client/api/schema.d.ts`; `openapi-fetch` uses it for typed requests, and TanStack Start server functions call the health and auth endpoints. `kin-openapi` validates the generated API document and health/auth provider responses in Go tests. `DATABASE_URL` is optional for standalone API development; Compose sets it for the local stack.
