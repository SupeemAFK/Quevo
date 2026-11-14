package database

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	DemoBranchID      = "10000000-0000-4000-8000-000000000001"
	DemoServiceID     = "10000000-0000-4000-8000-000000000002"
	DemoCustomerID    = "10000000-0000-4000-8000-000000000003"
	DemoOperatorID    = "10000000-0000-4000-8000-000000000004"
	DemoCustomerEmail = "customer@quevo.local"
	DemoOperatorEmail = "operator@quevo.local"
)

type SeedCredentials struct {
	CustomerPasswordHash string
	OperatorPasswordHash string
}

type SeededAccounts struct {
	Customer bool
	Operator bool
}

// SeedDemo inserts synthetic records and reports which users were created.
// Existing credentials are preserved. If provided, deliver runs before commit
// so a delivery error rolls back newly created accounts.
func SeedDemo(ctx context.Context, db *gorm.DB, credentials SeedCredentials, deliver func(SeededAccounts) error) (SeededAccounts, error) {
	if credentials.CustomerPasswordHash == "" || credentials.OperatorPasswordHash == "" {
		return SeededAccounts{}, fmt.Errorf("both seeded account password hashes are required")
	}
	var accounts SeededAccounts
	statements := []struct {
		query   string
		args    []any
		created *bool
	}{
		{`INSERT INTO branches (id, name, timezone) VALUES (?, 'Quevo Demo Branch', 'UTC')
			ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone`, []any{DemoBranchID}, nil},
		{`INSERT INTO services (id, branch_id, name, active) VALUES (?, ?, 'General Service', true)
			ON CONFLICT (id) DO UPDATE SET branch_id = EXCLUDED.branch_id, name = EXCLUDED.name, active = EXCLUDED.active`, []any{DemoServiceID, DemoBranchID}, nil},
		{`INSERT INTO users (id, role, display_name, email, password_hash)
			VALUES (?, 'CUSTOMER', 'Demo Customer', ?, ?)
			ON CONFLICT (id) DO NOTHING`, []any{DemoCustomerID, DemoCustomerEmail, credentials.CustomerPasswordHash}, &accounts.Customer},
		{`INSERT INTO users (id, role, display_name, email, password_hash)
			VALUES (?, 'OPERATOR', 'Demo Operator', ?, ?)
			ON CONFLICT (id) DO NOTHING`, []any{DemoOperatorID, DemoOperatorEmail, credentials.OperatorPasswordHash}, &accounts.Operator},
		{`INSERT INTO operator_services (operator_id, service_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, []any{DemoOperatorID, DemoServiceID}, nil},
	}
	// Never print the seed SQL: its parameters include credential hashes.
	if err := db.Session(&gorm.Session{Logger: logger.Discard}).WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, statement := range statements {
			result := tx.Exec(statement.query, statement.args...)
			if result.Error != nil {
				return fmt.Errorf("seed demo records: %w", result.Error)
			}
			if statement.created != nil {
				*statement.created = result.RowsAffected == 1
			}
		}
		if deliver != nil && (accounts.Customer || accounts.Operator) {
			return deliver(accounts)
		}
		return nil
	}); err != nil {
		return SeededAccounts{}, fmt.Errorf("seed transaction: %w", err)
	}
	return accounts, nil
}
