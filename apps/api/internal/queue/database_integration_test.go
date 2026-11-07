//go:build integration

package queue

import (
	"sync"
	"testing"

	"example.com/quevo/apps/api/internal/platform/database"
)

func TestMigrationsAndSeedAreIdempotent(t *testing.T) {
	ctx, gormDB, db := newTestPostgresDB(t)

	if err := database.Migrate(ctx, gormDB); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	var migrationCount int
	if err := db.QueryRowContext(ctx, "SELECT count(*) FROM schema_migrations").Scan(&migrationCount); err != nil {
		t.Fatalf("count migration records: %v", err)
	}
	if migrationCount == 0 {
		t.Fatal("migration ledger is empty after applying migrations")
	}
	if err := database.Migrate(ctx, gormDB); err != nil {
		t.Fatalf("apply migrations a second time: %v", err)
	}
	var repeatedMigrationCount int
	if err := db.QueryRowContext(ctx, "SELECT count(*) FROM schema_migrations").Scan(&repeatedMigrationCount); err != nil {
		t.Fatalf("count migration records after repeat: %v", err)
	}
	if repeatedMigrationCount != migrationCount {
		t.Fatalf("migration records after repeat = %d, want %d", repeatedMigrationCount, migrationCount)
	}
	if err := database.SeedDemo(ctx, gormDB, database.SeedCredentials{
		CustomerHash: "test-customer-hash",
		OperatorHash: "test-operator-hash",
	}); err != nil {
		t.Fatalf("seed demo data: %v", err)
	}
	if err := database.SeedDemo(ctx, gormDB, database.SeedCredentials{
		CustomerHash: "test-customer-hash",
		OperatorHash: "test-operator-hash",
	}); err != nil {
		t.Fatalf("seed demo data a second time: %v", err)
	}

	for _, table := range []struct {
		name string
		want int
	}{
		{name: "branches", want: 1},
		{name: "services", want: 1},
		{name: "app_users", want: 2},
		{name: "operator_services", want: 1},
	} {
		var count int
		if err := db.QueryRowContext(ctx, "SELECT count(*) FROM "+table.name).Scan(&count); err != nil {
			t.Fatalf("count %s: %v", table.name, err)
		}
		if count != table.want {
			t.Errorf("%s rows = %d, want %d", table.name, count, table.want)
		}
	}
}

func TestConcurrentMigrationRunsAreSerialized(t *testing.T) {
	ctx, gormDB, db := newTestPostgresDB(t)

	const callers = 5
	start := make(chan struct{})
	errors := make(chan error, callers)
	var group sync.WaitGroup
	group.Add(callers)
	for range callers {
		go func() {
			defer group.Done()
			<-start
			errors <- database.Migrate(ctx, gormDB)
		}()
	}
	close(start)
	group.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Errorf("concurrent migration: %v", err)
		}
	}

	var migrationCount int
	if err := db.QueryRowContext(ctx, "SELECT count(*) FROM schema_migrations").Scan(&migrationCount); err != nil {
		t.Fatalf("count migration records: %v", err)
	}
	if migrationCount == 0 {
		t.Fatal("migration ledger is empty after concurrent migration")
	}
	var usersTableExists bool
	if err := db.QueryRowContext(ctx, `SELECT to_regclass('public.app_users') IS NOT NULL`).Scan(&usersTableExists); err != nil {
		t.Fatalf("check migrated users table: %v", err)
	}
	if !usersTableExists {
		t.Fatal("app_users table does not exist after concurrent migration")
	}
}
