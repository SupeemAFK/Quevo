package queue

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrActiveTicket            = errors.New("customer already has an active ticket in this queue")
	ErrOperatorHasActiveTicket = errors.New("operator already has an active ticket")
	ErrQueueUnauthorized       = errors.New("user is not authorized for this queue action")
)

type Repository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

// JoinQueue creates a waiting ticket and allocates its number in one transaction.
// BusinessDate is the branch-local calendar date supplied by the caller.
func (r *Repository) JoinQueue(ctx context.Context, input JoinQueueInput) (Ticket, error) {
	var ticket Ticket
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var branchID, role string
		var active bool
		err := tx.Raw(`SELECT s.branch_id::text, u.role, s.active FROM services s CROSS JOIN app_users u
			WHERE s.id = ? AND u.id = ?`, input.ServiceID, input.CustomerID).Row().Scan(&branchID, &role, &active)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && (role != "CUSTOMER" || !active)) {
			return ErrQueueUnauthorized
		}
		if err != nil {
			return fmt.Errorf("validate customer and service: %w", err)
		}
		date := input.BusinessDate.Format("2006-01-02")
		last, err := lockSequence(tx, branchID, input.ServiceID, date)
		if err != nil {
			return err
		}
		var exists bool
		err = tx.Raw(`SELECT EXISTS (SELECT 1 FROM tickets WHERE customer_id = ? AND branch_id = ?
			AND service_id = ? AND business_date = ? AND status IN ('WAITING', 'PENDING', 'OPERATING'))`,
			input.CustomerID, branchID, input.ServiceID, date).Row().Scan(&exists)
		if err != nil {
			return fmt.Errorf("check duplicate active ticket: %w", err)
		}
		if exists {
			return ErrActiveTicket
		}
		next := last + 1
		if err := tx.Exec(`UPDATE queue_sequences SET last_issued = ?
			WHERE branch_id = ? AND service_id = ? AND business_date = ?`, next, branchID, input.ServiceID, date).Error; err != nil {
			return fmt.Errorf("advance queue sequence: %w", err)
		}
		err = tx.Raw(`INSERT INTO tickets (id, branch_id, service_id, business_date, ticket_number, customer_id, status)
			VALUES (?, ?, ?, ?, ?, ?, 'WAITING')
			RETURNING id::text, branch_id::text, service_id::text, business_date, ticket_number,
			customer_id::text, assigned_operator_id::text, status, joined_at, called_at`,
			uuid.NewString(), branchID, input.ServiceID, date, fmt.Sprint(next), input.CustomerID).Row().Scan(
			&ticket.ID, &ticket.BranchID, &ticket.ServiceID, &ticket.BusinessDate, &ticket.TicketNumber,
			&ticket.CustomerID, &ticket.AssignedOperatorID, &ticket.Status, &ticket.JoinedAt, &ticket.CalledAt)
		if err != nil {
			return fmt.Errorf("create waiting ticket: %w", err)
		}
		return nil
	})
	if err != nil {
		return Ticket{}, err
	}
	return ticket, nil
}

// CallNext locks the queue and claims its oldest waiting ticket atomically.
func (r *Repository) CallNext(ctx context.Context, input CallNextInput) (Ticket, bool, error) {
	var ticket Ticket
	var found bool
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var branchID string
		var allowed bool
		err := tx.Raw(`SELECT s.branch_id::text, (u.role = 'OPERATOR' AND os.operator_id IS NOT NULL)
			FROM services s CROSS JOIN app_users u
			LEFT JOIN operator_services os ON os.service_id = s.id AND os.operator_id = u.id
			WHERE s.id = ? AND u.id = ? AND s.active`, input.ServiceID, input.OperatorID).Row().Scan(&branchID, &allowed)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && !allowed) {
			return ErrQueueUnauthorized
		}
		if err != nil {
			return fmt.Errorf("validate operator authorization: %w", err)
		}
		date := input.BusinessDate.Format("2006-01-02")
		if _, err := lockSequence(tx, branchID, input.ServiceID, date); err != nil {
			return err
		}
		var active bool
		if err := tx.Raw(`SELECT EXISTS (SELECT 1 FROM tickets WHERE assigned_operator_id = ?
			AND status IN ('PENDING', 'OPERATING'))`, input.OperatorID).Row().Scan(&active); err != nil {
			return fmt.Errorf("check operator active ticket: %w", err)
		}
		if active {
			return ErrOperatorHasActiveTicket
		}
		var ticketID string
		err = tx.Raw(`SELECT id::text FROM tickets WHERE branch_id = ? AND service_id = ?
			AND business_date = ? AND status = 'WAITING' ORDER BY joined_at, id LIMIT 1 FOR UPDATE`,
			branchID, input.ServiceID, date).Row().Scan(&ticketID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("select oldest waiting ticket: %w", err)
		}
		err = tx.Raw(`UPDATE tickets SET status = 'PENDING', assigned_operator_id = ?, called_at = now()
			WHERE id = ? AND status = 'WAITING'
			RETURNING id::text, branch_id::text, service_id::text, business_date, ticket_number,
			customer_id::text, assigned_operator_id::text, status, joined_at, called_at`, input.OperatorID, ticketID).Row().Scan(
			&ticket.ID, &ticket.BranchID, &ticket.ServiceID, &ticket.BusinessDate, &ticket.TicketNumber,
			&ticket.CustomerID, &ticket.AssignedOperatorID, &ticket.Status, &ticket.JoinedAt, &ticket.CalledAt)
		if err != nil {
			return fmt.Errorf("assign next ticket: %w", err)
		}
		found = true
		return nil
	})
	if err != nil {
		return Ticket{}, false, err
	}
	return ticket, found, nil
}

func lockSequence(tx *gorm.DB, branchID, serviceID, date string) (int64, error) {
	if err := tx.Exec(`INSERT INTO queue_sequences (branch_id, service_id, business_date)
		VALUES (?, ?, ?) ON CONFLICT DO NOTHING`, branchID, serviceID, date).Error; err != nil {
		return 0, fmt.Errorf("ensure queue sequence: %w", err)
	}
	var last int64
	if err := tx.Raw(`SELECT last_issued FROM queue_sequences WHERE branch_id = ? AND service_id = ?
		AND business_date = ? FOR UPDATE`, branchID, serviceID, date).Row().Scan(&last); err != nil {
		return 0, fmt.Errorf("lock queue sequence: %w", err)
	}
	return last, nil
}
