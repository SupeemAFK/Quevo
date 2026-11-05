//go:build integration

package database

import (
	"context"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
)

func TestOpenConnectsToPostgresContainer(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

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
	db, err := Open(databaseURL, PoolConfig{
		MaxIdleConns:    1,
		MaxOpenConns:    2,
		ConnMaxLifetime: time.Minute,
	})
	if err != nil {
		t.Fatalf("open GORM connection: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get SQL connection pool: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })

	if err := sqlDB.PingContext(ctx); err != nil {
		t.Fatalf("ping PostgreSQL: %v", err)
	}
	var result int
	if err := db.Raw("SELECT 1").Scan(&result).Error; err != nil {
		t.Fatalf("query PostgreSQL through GORM: %v", err)
	}
	if result != 1 {
		t.Fatalf("SELECT 1 = %d, want 1", result)
	}
}
