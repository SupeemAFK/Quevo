package database

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	DemoBranchID   = "10000000-0000-4000-8000-000000000001"
	DemoServiceID  = "10000000-0000-4000-8000-000000000002"
	DemoCustomerID = "10000000-0000-4000-8000-000000000003"
	DemoOperatorID = "10000000-0000-4000-8000-000000000004"
)

type SeedCredentials struct {
	CustomerHash string
	OperatorHash string
}

// SeedDemo inserts stable synthetic Sprint 1 records and is safe to rerun.
func SeedDemo(ctx context.Context, db *gorm.DB, credentials SeedCredentials) error {
	if credentials.CustomerHash == "" || credentials.OperatorHash == "" {
		return fmt.Errorf("both seeded account credential hashes are required")
	}
	statements := []struct {
		query string
		args  []any
	}{
		{`INSERT INTO branches (id, name, timezone) VALUES (?, 'Quevo Demo Branch', 'UTC')
			ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone`, []any{DemoBranchID}},
		{`INSERT INTO services (id, branch_id, name, active) VALUES (?, ?, 'General Service', true)
			ON CONFLICT (id) DO UPDATE SET branch_id = EXCLUDED.branch_id, name = EXCLUDED.name, active = EXCLUDED.active`, []any{DemoServiceID, DemoBranchID}},
		{`INSERT INTO app_users (id, role, display_name, login_identifier, credential_hash)
			VALUES (?, 'CUSTOMER', 'Demo Customer', 'customer@quevo.local', ?)
			ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name,
			login_identifier = EXCLUDED.login_identifier, credential_hash = EXCLUDED.credential_hash`, []any{DemoCustomerID, credentials.CustomerHash}},
		{`INSERT INTO app_users (id, role, display_name, login_identifier, credential_hash)
			VALUES (?, 'OPERATOR', 'Demo Operator', 'operator@quevo.local', ?)
			ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name,
			login_identifier = EXCLUDED.login_identifier, credential_hash = EXCLUDED.credential_hash`, []any{DemoOperatorID, credentials.OperatorHash}},
		{`INSERT INTO operator_services (operator_id, service_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, []any{DemoOperatorID, DemoServiceID}},
	}
	// Never print the seed SQL: its parameters include credential hashes.
	if err := db.Session(&gorm.Session{Logger: logger.Discard}).WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, statement := range statements {
			if err := tx.Exec(statement.query, statement.args...).Error; err != nil {
				return fmt.Errorf("seed demo records: %w", err)
			}
		}
		return nil
	}); err != nil {
		return fmt.Errorf("seed transaction: %w", err)
	}
	return nil
}
