// @title Quevo API
// @version 1.0.0
// @description HTTP API for the Quevo application.
// @servers.url /api/v1
// @servers.description API v1 base path
// @externalDocs.description API documentation in Swagger UI.
// @externalDocs.url /swagger/
// @title Quevo API
// @version 1.0.0
// @description HTTP API for the Quevo application.
// @servers.url /api/v1
// @servers.description API v1 base path
// @externalDocs.description API documentation in Swagger UI.
// @externalDocs.url /swagger/
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
package main

import (
	"errors"
	"fmt"
	"net/http"

	"example.com/quevo/apps/api/internal/app"
	"example.com/quevo/apps/api/internal/platform/config"
	"go.uber.org/zap"
)

func main() {
	logger := zap.Must(zap.NewProduction())
	defer func() { _ = logger.Sync() }()

	if err := run(logger); err != nil {
		logger.Fatal("server stopped", zap.Error(err))
	}
}

func run(logger *zap.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}

	application, err := app.New(cfg, logger)
	if err != nil {
		return fmt.Errorf("initialize application: %w", err)
	}
	defer func() {
		if err := application.Close(); err != nil {
			logger.Error("close application", zap.Error(err))
		}
	}()

	server := application.HTTPServer()
	logger.Info("HTTP server listening", zap.String("address", server.Addr))

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve HTTP: %w", err)
	}
	return nil
}
