SWAG_VERSION := v2.0.0-rc6

.PHONY: generate-openapi test-unit test-integration migrate-up seed-demo
generate-openapi:
	go run github.com/swaggo/swag/v2/cmd/swag@$(SWAG_VERSION) init -g main.go -d ./cmd/server,./internal/health --parseInternal --v3.1 -o internal/apidocs --outputTypes json

test-unit:
	go test ./...

test-integration:
	go test -tags=integration ./internal/platform/database

migrate-up:
	go run ./cmd/migrate

seed-demo:
	go run ./cmd/seed
