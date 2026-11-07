//go:build integration

package queue

import (
	"os"
	"strings"
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
		CustomerPasswordHash: "test-customer-hash",
		OperatorPasswordHash: "test-operator-hash",
	}); err != nil {
		t.Fatalf("seed demo data: %v", err)
	}
	if err := database.SeedDemo(ctx, gormDB, database.SeedCredentials{
		CustomerPasswordHash: "test-customer-hash",
		OperatorPasswordHash: "test-operator-hash",
	}); err != nil {
		t.Fatalf("seed demo data a second time: %v", err)
	}

	for _, table := range []struct {
		name string
		want int
	}{
		{name: "branches", want: 1},
		{name: "services", want: 1},
		{name: "users", want: 2},
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

func TestUserNamingMigrationPreservesExistingData(t *testing.T) {
	ctx, gormDB, db := newTestPostgresDB(t)

	if _, err := db.ExecContext(ctx, `CREATE TABLE schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`); err != nil {
		t.Fatalf("create existing migration ledger: %v", err)
	}
	migration, err := os.ReadFile("../platform/database/migrations/000001_sprint1_queue.up.sql")
	if err != nil {
		t.Fatalf("read initial migration: %v", err)
	}
	for _, statement := range strings.Split(string(migration), ";") {
		statement = strings.TrimSpace(statement)
		if statement == "" {
			continue
		}
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatalf("apply initial migration: %v", err)
		}
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO schema_migrations (version) VALUES ('000001_sprint1_queue')`); err != nil {
		t.Fatalf("record initial migration: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO app_users
		(id, role, display_name, login_identifier, credential_hash)
		VALUES ('20000000-0000-4000-8000-000000000001', 'CUSTOMER', 'Existing Customer', 'existing@example.test', 'bcrypt-hash')`); err != nil {
		t.Fatalf("insert existing user: %v", err)
	}

	if err := database.Migrate(ctx, gormDB); err != nil {
		t.Fatalf("apply user naming migration: %v", err)
	}
	var email, passwordHash string
	if err := db.QueryRowContext(ctx, `SELECT email, password_hash FROM users
		WHERE id = '20000000-0000-4000-8000-000000000001'`).Scan(&email, &passwordHash); err != nil {
		t.Fatalf("read renamed user: %v", err)
	}
	if email != "existing@example.test" || passwordHash != "bcrypt-hash" {
		t.Fatalf("renamed user = (%q, %q); want existing email and password hash", email, passwordHash)
	}
	var oldTableExists bool
	if err := db.QueryRowContext(ctx, `SELECT to_regclass('public.app_users') IS NOT NULL`).Scan(&oldTableExists); err != nil {
		t.Fatalf("check old table name: %v", err)
	}
	if oldTableExists {
		t.Fatal("app_users still exists after the rename migration")
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
	if err := db.QueryRowContext(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&usersTableExists); err != nil {
		t.Fatalf("check migrated users table: %v", err)
	}
	if !usersTableExists {
		t.Fatal("users table does not exist after concurrent migration")
	}
}
