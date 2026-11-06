# Development guide

## Local stack with Docker Compose

From the repository root, run:

```sh
docker compose up --build
```

Compose starts PostgreSQL, the Go API, and the TanStack Start web app. Open `http://localhost:3000`. The API is available at `http://localhost:8080`; Swagger UI is at `http://localhost:8080/swagger/` and the generated OpenAPI JSON is at `http://localhost:8080/openapi.json`. PostgreSQL is exposed on port `5432` for local tools. Stop the stack with `Ctrl+C`. Add `-d` to run it in the background and use `docker compose down` to stop it.

Compose stores database files in the named `postgres-data` volume. To reset the local database, run `docker compose down -v`.

The web source is bind-mounted for hot reload. The API source is also mounted; restart it after Go code edits with `docker compose restart api`.

## Run services without Docker

Start PostgreSQL separately if you need it. The API can also run without a database connection for its current health endpoint.

```sh
cd apps/api
go run ./cmd/server
```

In another terminal, install Bun if needed, then run:

```sh
cd apps/web
bun install --frozen-lockfile
API_BASE_URL=http://localhost:8080 bun --bun run dev
```

The web app defaults `API_BASE_URL` to `http://localhost:8080`.

## End-to-end tests

Install web and test dependencies once, and install Playwright's Chromium browser:

```sh
cd apps/web && bun install --frozen-lockfile
cd ../../tests && bun install --frozen-lockfile && bunx playwright install chromium
```

Run the browser tests from `tests/`:

```sh
bunx playwright test
```

Playwright global setup starts a temporary PostgreSQL container with Testcontainers, builds and starts the real Go API with its `DATABASE_URL`, then starts the Bun web dev server. It waits for both apps to respond and shuts down the servers and container after the run. The E2E smoke test does not mock the API. Docker must be running; E2E uses ports `8080` and `3000`.

## Test suites

Run the full CI suite from the repository root with `make test`. It runs web unit/component tests, Go unit and OpenAPI contract tests, a Go integration test against temporary PostgreSQL, generated OpenAPI type checks, and full-stack Playwright E2E tests. The full suite requires Docker and a Playwright Chromium installation.

To run only the Go PostgreSQL integration test:

```sh
cd apps/api && go test -tags=integration ./...
```

The API integration suite uses Testcontainers PostgreSQL for the database and authentication flows. Authentication requires the users and sessions migrations and seeded identities described in [the authentication contract](design/authentication.md); issue #15 owns those migrations and seeds.

## Lint

Run `make lint` from the repository root. It runs Biome on the web app and golangci-lint on the API. On first use, it downloads the pinned Go linter into the ignored `.tools/` directory. The version is recorded in `apps/api/.golangci-lint-version`.

## Add a backend feature

Create a package under `apps/api/internal` for each feature. Begin with the files the feature needs; add service or repository layers when the logic or persistence warrants them. Register the feature's routes in `internal/app/router.go`. Keep database schema changes in explicit migrations, rather than automatically changing the schema when the API starts.

For a background queue later, keep queue setup and worker lifecycle in a dedicated `internal/platform/queue` package, and let feature code publish typed jobs through a small interface. Avoid starting a broker or worker until a feature actually needs asynchronous work.

## Generate API docs and the TypeScript client

Document each Go endpoint with Swag annotations beside its handler. Then regenerate the OpenAPI spec and frontend types in order:

```sh
cd apps/api && make generate-openapi
cd ../web && bun run generate:api
```

The API emits OpenAPI 3.1 at `apps/api/internal/apidocs/swagger.json`, serves it at `/openapi.json`, and hosts Swagger UI at `/swagger/`. `openapi-typescript` writes `apps/web/src/client/api/schema.d.ts`, and `openapi-fetch` uses those types for API requests. TanStack Query calls the typed request through a TanStack Start server function so the API URL stays server-side.
