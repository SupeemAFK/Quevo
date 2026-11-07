//go:build integration

package queue

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"gorm.io/gorm"
)

func newTestPostgresDB(t *testing.T) (context.Context, *gorm.DB, *sql.DB) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	t.Cleanup(cancel)

	container, err := postgres.Run(ctx,
		"postgres:17-alpine",
		postgres.WithDatabase("quevo_test"),
		postgres.WithUsername("quevo"),
		postgres.WithPassword("quevo-test"),
		postgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Fatalf("start PostgreSQL container: %v", err)
	}
	t.Cleanup(func() {
		if err := testcontainers.TerminateContainer(container); err != nil {
			t.Errorf("stop PostgreSQL container: %v", err)
		}
	})

	databaseURL, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("get PostgreSQL connection string: %v", err)
	}
	gormDB, err := database.Open(databaseURL, database.PoolConfig{
		MaxIdleConns:    2,
		MaxOpenConns:    10,
		ConnMaxLifetime: time.Minute,
	})
	if err != nil {
		t.Fatalf("open GORM connection: %v", err)
	}
	db, err := gormDB.DB()
	if err != nil {
		t.Fatalf("get SQL connection pool: %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Errorf("close PostgreSQL connection pool: %v", err)
		}
	})
	if err := db.PingContext(ctx); err != nil {
		t.Fatalf("ping PostgreSQL: %v", err)
	}

	return ctx, gormDB, db
}

func newSeededPostgresDB(t *testing.T) (context.Context, *gorm.DB, *sql.DB) {
	t.Helper()
	ctx, gormDB, db := newTestPostgresDB(t)
	if err := database.Migrate(ctx, gormDB); err != nil {
		t.Fatalf("migrate PostgreSQL schema: %v", err)
	}
	if err := database.SeedDemo(ctx, gormDB, database.SeedCredentials{
		CustomerPasswordHash: "test-customer-hash",
		OperatorPasswordHash: "test-operator-hash",
	}); err != nil {
		t.Fatalf("seed PostgreSQL fixtures: %v", err)
	}
	return ctx, gormDB, db
}
