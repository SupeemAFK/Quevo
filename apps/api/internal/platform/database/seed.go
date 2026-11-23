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
	DemoManagerID     = "10000000-0000-4000-8000-000000000005"
	DemoCounterID     = "10000000-0000-4000-8000-000000000006"
	DemoCustomerEmail = "customer@quevo.local"
	DemoOperatorEmail = "operator@quevo.local"
	DemoManagerEmail  = "manager@quevo.local"
)

type SeedCredentials struct {
	CustomerPasswordHash string
	OperatorPasswordHash string
	ManagerPasswordHash  string
}

type SeededAccounts struct {
	Customer bool
	Operator bool
	Manager  bool
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
		{`INSERT INTO service_queues (id, branch_id, service_id, name, active) VALUES (?, ?, ?, 'Main queue', true)
			ON CONFLICT (id) DO NOTHING`, []any{DemoServiceID, DemoBranchID, DemoServiceID}, nil},
		{`INSERT INTO branch_counters (id, branch_id, name, active) VALUES (?, ?, 'Counter 1', true)
			ON CONFLICT (branch_id, lower(trim(name))) DO NOTHING`, []any{DemoCounterID, DemoBranchID}, nil},
		{`INSERT INTO counter_queues (counter_id, queue_id)
			SELECT id, ? FROM branch_counters WHERE branch_id = ? AND name = 'Counter 1'
			ON CONFLICT DO NOTHING`, []any{DemoServiceID, DemoBranchID}, nil},
		{`INSERT INTO services (id, branch_id, name, active, allows_uploads, requires_documents, document_guidance) VALUES
			('10000000-0000-4000-8000-000000000010', ?, 'Account Opening', true, true, true, 'Bring a government-issued photo ID and proof of address. Upload only the documents requested by the branch.'),
			('10000000-0000-4000-8000-000000000011', ?, 'Card Services', true, false, false, ''),
			('10000000-0000-4000-8000-000000000012', ?, 'Personal Loan Application', true, true, true, 'Bring recent proof of income and the supporting documents requested by the loan officer.'),
			('10000000-0000-4000-8000-000000000013', ?, 'Account Maintenance', true, false, false, ''),
			('10000000-0000-4000-8000-000000000014', ?, 'Digital Banking Help', true, false, false, '')
			ON CONFLICT (id) DO NOTHING`, []any{DemoBranchID, DemoBranchID, DemoBranchID, DemoBranchID, DemoBranchID}, nil},
		{`INSERT INTO service_queues (id, branch_id, service_id, name, active)
			SELECT id, branch_id, id, 'Main queue', active FROM services
			WHERE id IN ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000011',
			'10000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000014')
			ON CONFLICT (id) DO NOTHING`, nil, nil},
		{`INSERT INTO service_form_fields (id, service_id, position, field_type, label, required, options)
			SELECT v.id::uuid, v.service_id::uuid, 1, 'single_select', 'What would you like to open?', true, v.options::jsonb
			FROM (VALUES
			('10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000010','["Everyday account","Savings account","Fixed-term deposit"]'),
			('10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000011','["Replace a damaged card","Report a lost card","Renew an expiring card"]'),
			('10000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000012','["Personal loan","Home loan","Vehicle loan"]'),
			('10000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000013','["Update contact details","Request a statement","Other account maintenance"]'),
			('10000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000014','["Mobile app","Online banking","Transfers and payments"]')
			) AS v(id, service_id, options)
			WHERE NOT EXISTS (SELECT 1 FROM service_form_fields f WHERE f.service_id = v.service_id::uuid)
			ON CONFLICT (id) DO NOTHING`, nil, nil},
		{`INSERT INTO counter_queues (counter_id, queue_id)
			SELECT c.id, q.id FROM branch_counters c JOIN service_queues q ON q.branch_id = c.branch_id
			WHERE c.branch_id = ? AND c.name = 'Counter 1' AND q.service_id IN (
			'10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000011',
			'10000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000014')
			ON CONFLICT DO NOTHING`, []any{DemoBranchID}, nil},
		{`INSERT INTO users (id, role, display_name, email, password_hash)
			VALUES (?, 'CUSTOMER', 'Demo Customer', ?, ?)
			ON CONFLICT (id) DO NOTHING`, []any{DemoCustomerID, DemoCustomerEmail, credentials.CustomerPasswordHash}, &accounts.Customer},
		{`INSERT INTO users (id, role, display_name, email, password_hash)
			VALUES (?, 'OPERATOR', 'Demo Operator', ?, ?)
			ON CONFLICT (id) DO NOTHING`, []any{DemoOperatorID, DemoOperatorEmail, credentials.OperatorPasswordHash}, &accounts.Operator},
		{`INSERT INTO operator_services (operator_id, service_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, []any{DemoOperatorID, DemoServiceID}, nil},
		{`INSERT INTO counter_operators (counter_id, operator_id)
			SELECT id, ? FROM branch_counters WHERE branch_id = ? AND name = 'Counter 1'
			ON CONFLICT DO NOTHING`, []any{DemoOperatorID, DemoBranchID}, nil},
	}
	if credentials.ManagerPasswordHash != "" {
		statements = append(statements,
			struct {
				query   string
				args    []any
				created *bool
			}{`INSERT INTO users (id, role, display_name, email, password_hash)
				VALUES (?, 'BRANCH_MANAGER', 'Demo Branch Manager', ?, ?)
				ON CONFLICT (id) DO NOTHING`, []any{DemoManagerID, DemoManagerEmail, credentials.ManagerPasswordHash}, &accounts.Manager},
			struct {
				query   string
				args    []any
				created *bool
			}{`INSERT INTO branch_managers (branch_id, manager_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, []any{DemoBranchID, DemoManagerID}, nil},
		)
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
		if deliver != nil && (accounts.Customer || accounts.Operator || accounts.Manager) {
			return deliver(accounts)
		}
		return nil
	}); err != nil {
		return SeededAccounts{}, fmt.Errorf("seed transaction: %w", err)
	}
	return accounts, nil
}
