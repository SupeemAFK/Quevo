.PHONY: test test-web test-api test-api-integration test-contract test-e2e

test: test-web test-api test-api-integration test-contract test-e2e

test-web:
	cd apps/web && bun install --frozen-lockfile && bun run test

test-api:
	cd apps/api && go test ./... && go vet ./...

test-api-integration:
	cd apps/api && go test -tags=integration ./internal/platform/database

test-contract:
	cd apps/api && go test ./internal/app -run '^TestHealthProviderMatchesOpenAPI$$'
	cd apps/web && bun run check:api && bun run typecheck

test-e2e:
	cd tests && bun install --frozen-lockfile && bun run test
