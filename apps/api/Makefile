SWAG_VERSION := v2.0.0-rc6

.PHONY: generate-openapi test-unit test-integration
generate-openapi:
	go run github.com/swaggo/swag/v2/cmd/swag@$(SWAG_VERSION) init -g main.go -d ./cmd/server,./internal/health,./internal/auth --parseInternal --v3.1 -o internal/apidocs --outputTypes json

test-unit:
	go test ./...

test-integration:
	go test -tags=integration ./...
