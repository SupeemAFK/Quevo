package database

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"gorm.io/gorm"
)

//go:embed migrations/*.up.sql
var migrationFiles embed.FS

// Quevo's advisory-lock key serializes migration commands against the same database.
const migrationLockID int64 = 0x517565766f

// Migrate applies each embedded, versioned migration once. All changes commit
// together, and concurrent migration commands wait for the same transaction lock.
// It is called by an explicit command; application startup never changes the schema.
func Migrate(ctx context.Context, db *gorm.DB) error {
	db = db.WithContext(ctx)
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`SELECT pg_advisory_xact_lock(?)`, migrationLockID).Error; err != nil {
			return fmt.Errorf("lock migrations: %w", err)
		}
		if err := tx.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`).Error; err != nil {
			return fmt.Errorf("create migration ledger: %w", err)
		}

		entries, err := fs.Glob(migrationFiles, "migrations/*.up.sql")
		if err != nil {
			return fmt.Errorf("list migration files: %w", err)
		}
		sort.Strings(entries)
		for _, path := range entries {
			version := strings.TrimSuffix(strings.TrimPrefix(path, "migrations/"), ".up.sql")
			var applied bool
			if err := tx.Raw(`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = ?)`, version).Row().Scan(&applied); err != nil {
				return fmt.Errorf("check migration %s: %w", version, err)
			}
			if applied {
				continue
			}
			sqlBytes, err := migrationFiles.ReadFile(path)
			if err != nil {
				return fmt.Errorf("read migration %s: %w", version, err)
			}
			for _, statement := range strings.Split(string(sqlBytes), ";") {
				statement = strings.TrimSpace(statement)
				if statement == "" {
					continue
				}
				if err := tx.Exec(statement).Error; err != nil {
					return fmt.Errorf("apply migration %s: %w", version, err)
				}
			}
			if err := tx.Exec(`INSERT INTO schema_migrations (version) VALUES (?)`, version).Error; err != nil {
				return fmt.Errorf("record migration %s: %w", version, err)
			}
		}
		return nil
	})
}
