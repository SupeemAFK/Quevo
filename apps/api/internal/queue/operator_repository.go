package queue

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

var ErrInvalidTransition = errors.New("invalid ticket transition")

type OperatorQueue struct {
	BranchID     string
	BranchName   string
	ServiceID    string
	ServiceName  string
	BusinessDate string
	WaitingCount int64
}

type OperatorQueueDetail struct {
	Queue   OperatorQueue
	Waiting []Ticket
	Current *Ticket
}

// ListOperatorQueues returns only active services assigned to the operator.
func (r *Repository) ListOperatorQueues(ctx context.Context, operatorID string) ([]OperatorQueue, error) {
	var queues []OperatorQueue
	err := r.db.WithContext(ctx).Raw(`SELECT b.id::text AS branch_id, b.name AS branch_name,
		s.id::text AS service_id, s.name AS service_name,
		to_char((now() AT TIME ZONE b.timezone)::date, 'YYYY-MM-DD') AS business_date,
		(SELECT count(*) FROM tickets t WHERE t.branch_id = b.id AND t.service_id = s.id
		 AND t.business_date = (now() AT TIME ZONE b.timezone)::date AND t.status = 'WAITING') AS waiting_count
		FROM operator_services os JOIN services s ON s.id = os.service_id
		JOIN branches b ON b.id = s.branch_id JOIN users u ON u.id = os.operator_id
		WHERE os.operator_id = ? AND u.role = 'OPERATOR' AND s.active
		ORDER BY b.name, s.name, s.id`, operatorID).Scan(&queues).Error
	if err != nil {
		return nil, fmt.Errorf("list operator queues: %w", err)
	}
	if queues == nil {
		queues = []OperatorQueue{}
	}
	return queues, nil
}

func (r *Repository) GetOperatorQueue(ctx context.Context, operatorID, branchID, serviceID string) (OperatorQueueDetail, error) {
	queues, err := r.ListOperatorQueues(ctx, operatorID)
	if err != nil {
		return OperatorQueueDetail{}, err
	}
	var selected *OperatorQueue
	for i := range queues {
		if queues[i].BranchID == branchID && queues[i].ServiceID == serviceID {
			selected = &queues[i]
			break
		}
	}
	if selected == nil {
		return OperatorQueueDetail{}, ErrQueueUnauthorized
	}
	var waiting []Ticket
	err = r.db.WithContext(ctx).Table("tickets").Select("id::text AS id, ticket_number, status, business_date, joined_at").
		Where("branch_id = ? AND service_id = ? AND business_date = ? AND status = 'WAITING'", branchID, serviceID, selected.BusinessDate).
		Order("joined_at, id").Scan(&waiting).Error
	if err != nil {
		return OperatorQueueDetail{}, fmt.Errorf("list waiting tickets: %w", err)
	}
	if waiting == nil {
		waiting = []Ticket{}
	}
	var current Ticket
	err = r.db.WithContext(ctx).Table("tickets").Select("id::text AS id, ticket_number, status, business_date, joined_at").
		Where("branch_id = ? AND service_id = ? AND assigned_operator_id = ? AND status IN ('PENDING', 'OPERATING')", branchID, serviceID, operatorID).
		Take(&current).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return OperatorQueueDetail{}, fmt.Errorf("find current ticket: %w", err)
	}
	result := OperatorQueueDetail{Queue: *selected, Waiting: waiting}
	if err == nil {
		result.Current = &current
	}
	return result, nil
}

// TransitionTicket locks the assigned ticket and persists the next state and timestamp together.
func (r *Repository) TransitionTicket(ctx context.Context, operatorID, ticketID, action string) (Ticket, error) {
	var expected, next, update string
	switch action {
	case "start":
		expected, next, update = "PENDING", "OPERATING", "UPDATE tickets SET status = 'OPERATING', started_at = now() WHERE id = ?"
	case "complete":
		expected, next, update = "OPERATING", "COMPLETED", "UPDATE tickets SET status = 'COMPLETED', completed_at = now() WHERE id = ?"
	case "skip":
		expected, next, update = "PENDING", "SKIPPED", "UPDATE tickets SET status = 'SKIPPED', skipped_at = now() WHERE id = ?"
	default:
		return Ticket{}, ErrInvalidTransition
	}
	var ticket Ticket
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var status string
		err := tx.Raw(`SELECT t.status FROM tickets t JOIN operator_services os ON os.service_id = t.service_id
			AND os.operator_id = ? WHERE t.id = ? AND t.assigned_operator_id = ? FOR UPDATE OF t`, operatorID, ticketID, operatorID).Row().Scan(&status)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTicketNotFound
		}
		if err != nil {
			return fmt.Errorf("lock assigned ticket: %w", err)
		}
		if status != expected {
			return ErrInvalidTransition
		}
		err = tx.Raw(update+` RETURNING id::text, ticket_number, status, business_date, joined_at`, ticketID).
			Row().Scan(&ticket.ID, &ticket.TicketNumber, &ticket.Status, &ticket.BusinessDate, &ticket.JoinedAt)
		if err != nil {
			return fmt.Errorf("transition ticket to %s: %w", next, err)
		}
		return nil
	})
	if err != nil {
		return Ticket{}, err
	}
	return ticket, nil
}
