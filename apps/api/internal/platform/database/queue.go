package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var (
	ErrActiveTicket            = errors.New("customer already has an active ticket in this queue")
	ErrOperatorHasActiveTicket = errors.New("operator already has an active ticket")
	ErrQueueUnauthorized       = errors.New("user is not authorized for this queue action")
)

type Ticket struct {
	ID                 string
	BranchID           string
	ServiceID          string
	BusinessDate       time.Time
	TicketNumber       string
	CustomerID         string
	AssignedOperatorID sql.NullString
	Status             string
	JoinedAt           time.Time
	CalledAt           sql.NullTime
}

type JoinQueueInput struct {
	CustomerID   string
	ServiceID    string
	BusinessDate time.Time
}

// JoinQueue allocates a number and creates the WAITING ticket under the same
// per-queue lock and transaction. The caller supplies the branch-local date.
func JoinQueue(ctx context.Context, db *sql.DB, input JoinQueueInput) (Ticket, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return Ticket{}, fmt.Errorf("begin queue join: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var branchID string
	var customerRole string
	var active bool
	err = tx.QueryRowContext(ctx, `
		SELECT s.branch_id::text, u.role, s.active
		FROM services s CROSS JOIN app_users u
		WHERE s.id = $1 AND u.id = $2
	`, input.ServiceID, input.CustomerID).Scan(&branchID, &customerRole, &active)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && (customerRole != "CUSTOMER" || !active)) {
		return Ticket{}, ErrQueueUnauthorized
	}
	if err != nil {
		return Ticket{}, fmt.Errorf("validate customer and service: %w", err)
	}
	date := input.BusinessDate.Format("2006-01-02")
	if _, err := tx.ExecContext(ctx, `INSERT INTO queue_sequences (branch_id, service_id, business_date)
		VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, branchID, input.ServiceID, date); err != nil {
		return Ticket{}, fmt.Errorf("ensure queue sequence: %w", err)
	}
	var lastIssued int64
	if err := tx.QueryRowContext(ctx, `SELECT last_issued FROM queue_sequences
		WHERE branch_id = $1 AND service_id = $2 AND business_date = $3 FOR UPDATE`, branchID, input.ServiceID, date).Scan(&lastIssued); err != nil {
		return Ticket{}, fmt.Errorf("lock queue sequence: %w", err)
	}
	var activeTicket bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (
		SELECT 1 FROM tickets WHERE customer_id = $1 AND branch_id = $2 AND service_id = $3
		AND business_date = $4 AND status IN ('WAITING', 'PENDING', 'OPERATING')
	)`, input.CustomerID, branchID, input.ServiceID, date).Scan(&activeTicket); err != nil {
		return Ticket{}, fmt.Errorf("check duplicate active ticket: %w", err)
	}
	if activeTicket {
		return Ticket{}, ErrActiveTicket
	}
	next := lastIssued + 1
	if _, err := tx.ExecContext(ctx, `UPDATE queue_sequences SET last_issued = $4
		WHERE branch_id = $1 AND service_id = $2 AND business_date = $3`, branchID, input.ServiceID, date, next); err != nil {
		return Ticket{}, fmt.Errorf("advance queue sequence: %w", err)
	}
	id := uuid.NewString()
	var ticket Ticket
	err = tx.QueryRowContext(ctx, `INSERT INTO tickets
		(id, branch_id, service_id, business_date, ticket_number, customer_id, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'WAITING')
		RETURNING id::text, branch_id::text, service_id::text, business_date, ticket_number,
		customer_id::text, assigned_operator_id::text, status, joined_at, called_at`,
		id, branchID, input.ServiceID, date, fmt.Sprint(next), input.CustomerID).Scan(
		&ticket.ID, &ticket.BranchID, &ticket.ServiceID, &ticket.BusinessDate, &ticket.TicketNumber,
		&ticket.CustomerID, &ticket.AssignedOperatorID, &ticket.Status, &ticket.JoinedAt, &ticket.CalledAt)
	if err != nil {
		return Ticket{}, fmt.Errorf("create waiting ticket: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return Ticket{}, fmt.Errorf("commit queue join: %w", err)
	}
	return ticket, nil
}

type CallNextInput struct {
	OperatorID   string
	ServiceID    string
	BusinessDate time.Time
}

// CallNext claims the oldest WAITING ticket for an authorized operator.
// The queue sequence lock serializes joins and calls; strict FIFO is preserved.
func CallNext(ctx context.Context, db *sql.DB, input CallNextInput) (Ticket, bool, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return Ticket{}, false, fmt.Errorf("begin call-next: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var branchID string
	var allowed bool
	err = tx.QueryRowContext(ctx, `
		SELECT s.branch_id::text, (u.role = 'OPERATOR' AND os.operator_id IS NOT NULL)
		FROM services s CROSS JOIN app_users u
		LEFT JOIN operator_services os ON os.service_id = s.id AND os.operator_id = u.id
		WHERE s.id = $1 AND u.id = $2 AND s.active
	`, input.ServiceID, input.OperatorID).Scan(&branchID, &allowed)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !allowed) {
		return Ticket{}, false, ErrQueueUnauthorized
	}
	if err != nil {
		return Ticket{}, false, fmt.Errorf("validate operator authorization: %w", err)
	}
	date := input.BusinessDate.Format("2006-01-02")
	if _, err := tx.ExecContext(ctx, `INSERT INTO queue_sequences (branch_id, service_id, business_date)
		VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, branchID, input.ServiceID, date); err != nil {
		return Ticket{}, false, fmt.Errorf("ensure queue sequence: %w", err)
	}
	var lock int64
	if err := tx.QueryRowContext(ctx, `SELECT last_issued FROM queue_sequences
		WHERE branch_id = $1 AND service_id = $2 AND business_date = $3 FOR UPDATE`, branchID, input.ServiceID, date).Scan(&lock); err != nil {
		return Ticket{}, false, fmt.Errorf("lock queue sequence: %w", err)
	}
	var active bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM tickets
		WHERE assigned_operator_id = $1 AND status IN ('PENDING', 'OPERATING'))`, input.OperatorID).Scan(&active); err != nil {
		return Ticket{}, false, fmt.Errorf("check operator active ticket: %w", err)
	}
	if active {
		return Ticket{}, false, ErrOperatorHasActiveTicket
	}
	var ticketID string
	err = tx.QueryRowContext(ctx, `SELECT id::text FROM tickets
		WHERE branch_id = $1 AND service_id = $2 AND business_date = $3 AND status = 'WAITING'
	ORDER BY joined_at, id LIMIT 1 FOR UPDATE`, branchID, input.ServiceID, date).Scan(&ticketID)
	if errors.Is(err, sql.ErrNoRows) {
		if err := tx.Commit(); err != nil {
			return Ticket{}, false, fmt.Errorf("commit empty call-next: %w", err)
		}
		return Ticket{}, false, nil
	}
	if err != nil {
		return Ticket{}, false, fmt.Errorf("select oldest waiting ticket: %w", err)
	}
	var ticket Ticket
	err = tx.QueryRowContext(ctx, `UPDATE tickets SET status = 'PENDING', assigned_operator_id = $2, called_at = now()
		WHERE id = $1 AND status = 'WAITING'
		RETURNING id::text, branch_id::text, service_id::text, business_date, ticket_number,
		customer_id::text, assigned_operator_id::text, status, joined_at, called_at`, ticketID, input.OperatorID).Scan(
		&ticket.ID, &ticket.BranchID, &ticket.ServiceID, &ticket.BusinessDate, &ticket.TicketNumber,
		&ticket.CustomerID, &ticket.AssignedOperatorID, &ticket.Status, &ticket.JoinedAt, &ticket.CalledAt)
	if err != nil {
		return Ticket{}, false, fmt.Errorf("assign next ticket: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return Ticket{}, false, fmt.Errorf("commit call-next: %w", err)
	}
	return ticket, true, nil
}
