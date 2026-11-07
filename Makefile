.PHONY: test lint lint-web lint-api lint-tools test-web test-api test-api-integration test-contract test-e2e dev-all

GOLANGCI_LINT_BIN := .tools/golangci-lint

test: test-web test-api test-api-integration test-contract test-e2e

lint: lint-web lint-api

lint-web:
	cd apps/web && bun install --frozen-lockfile && bun run lint

lint-api: lint-tools
	cd apps/api && ../../$(GOLANGCI_LINT_BIN) run ./...

lint-tools: $(GOLANGCI_LINT_BIN)

$(GOLANGCI_LINT_BIN): apps/api/.golangci-lint-version
	mkdir -p .tools
	curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b .tools "$$(cat $<)"

test-web:
	cd apps/web && bun install --frozen-lockfile && bun run test

test-api:
	cd apps/api && go test ./... && go vet ./...

test-api-integration:
	cd apps/api && go test -tags=integration ./internal/platform/database ./internal/queue

test-contract:
	cd apps/api && go test ./internal/app -run '^TestHealthProviderMatchesOpenAPI$$'
	cd apps/web && bun run check:api && bun run typecheck

test-e2e:
	cd tests && bun install --frozen-lockfile && bun run test

dev-all:
	docker compose up -d db
	cd apps/api && go run ./cmd/server/main.go
	cd apps/web && bun run dev
