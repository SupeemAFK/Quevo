# Repository guidance

## Project map

- `apps/api`: Go API using Gin, GORM, PostgreSQL, and Zap.
- `apps/web`: React and TypeScript app using TanStack Start and Bun.
- `tests/e2e`: Playwright browser tests.
- `docs`: development and architecture notes.
- `compose.yaml`: local PostgreSQL, API, and web services.

## Development rules

- Keep API features under `apps/api/internal/<feature>` and wire route groups explicitly in `internal/app/router.go`.
- Keep database access in repositories or platform packages; do not put it in Gin handlers.
- Use the existing Zap logger for API request and application logs.
- Do not add automatic schema migration at startup. Add explicit migrations with a feature that needs them.
- Keep server-only API calls and secrets out of browser code. TanStack server functions are the web-to-API boundary.
- Keep routes, handlers, and data structures small and name them by their purpose.
- Use Bun and commit `apps/web/bun.lock`; do not create an npm lockfile for the web app.
- Add shadcn components with `bun --bun x shadcn add <component>` and keep the Tailwind v4 Vite plugin configured in `apps/web/vite.config.ts`.
- Treat `apps/api/internal/apidocs/swagger.json` and `apps/web/src/client/api/schema.d.ts` as generated. After API contract changes, run `make generate-openapi` in `apps/api`, then `bun run generate:api` in `apps/web`.
- Add or update Playwright E2E coverage for important user-visible flows.
- Prefer the documented commands in `README.md` and `docs/development.md`.

## Local checks

- Lint: `make lint` (Biome for web; golangci-lint for Go, including gofmt checks).
- API unit and contract: `cd apps/api && go test ./... && go vet ./...`
- API PostgreSQL integration: `cd apps/api && go test -tags=integration ./internal/platform/database`
- Web unit and component: `cd apps/web && bun install --frozen-lockfile && bun run test`
- E2E: install Chromium with `cd tests && bun --bun x playwright install chromium`, then run `bun --bun x playwright test`; Docker is required for Testcontainers PostgreSQL.
- Full CI suite: `make test` (Docker and a Playwright Chromium installation are required).
- Full local stack: `docker compose up --build`
