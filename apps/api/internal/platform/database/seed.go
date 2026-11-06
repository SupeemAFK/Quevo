package database

import (
	"context"
	"database/sql"
	"fmt"
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
func SeedDemo(ctx context.Context, db *sql.DB, credentials SeedCredentials) error {
	if credentials.CustomerHash == "" || credentials.OperatorHash == "" {
		return fmt.Errorf("both seeded account credential hashes are required")
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin demo seed: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	statements := []struct {
		query string
		args  []any
	}{
		{`INSERT INTO branches (id, name, timezone) VALUES ($1, 'Quevo Demo Branch', 'UTC')
			ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone`, []any{DemoBranchID}},
		{`INSERT INTO services (id, branch_id, name, active) VALUES ($1, $2, 'General Service', true)
			ON CONFLICT (id) DO UPDATE SET branch_id = EXCLUDED.branch_id, name = EXCLUDED.name, active = EXCLUDED.active`, []any{DemoServiceID, DemoBranchID}},
		{`INSERT INTO app_users (id, role, display_name, login_identifier, credential_hash)
			VALUES ($1, 'CUSTOMER', 'Demo Customer', 'customer@quevo.local', $2)
			ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name,
			login_identifier = EXCLUDED.login_identifier, credential_hash = EXCLUDED.credential_hash`, []any{DemoCustomerID, credentials.CustomerHash}},
		{`INSERT INTO app_users (id, role, display_name, login_identifier, credential_hash)
			VALUES ($1, 'OPERATOR', 'Demo Operator', 'operator@quevo.local', $2)
			ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name,
			login_identifier = EXCLUDED.login_identifier, credential_hash = EXCLUDED.credential_hash`, []any{DemoOperatorID, credentials.OperatorHash}},
		{`INSERT INTO operator_services (operator_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, []any{DemoOperatorID, DemoServiceID}},
	}
	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement.query, statement.args...); err != nil {
			return fmt.Errorf("seed demo records: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit demo seed: %w", err)
	}
	return nil
}
