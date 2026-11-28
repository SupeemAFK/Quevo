package queue

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

var ErrInvalidTransition = errors.New("invalid ticket transition")

type OperatorQueue struct {
	BranchID     string
	BranchName   string
	ServiceID    string
	QueueID      string
	QueueName    string
	ServiceName  string
	BusinessDate string
	WaitingCount int64
}

type OperatorQueueDetail struct {
	Queue   OperatorQueue
	Waiting []Ticket
	Current *Ticket
	Recent  []Ticket
}

// HandoffCandidate is an operator eligible to receive a transferred ticket.
type HandoffCandidate struct {
	ID          string
	DisplayName string
}

type TicketHandoff struct {
	ID                  string
	TicketNumber        string
	Status              string
	RecipientOperatorID string
	TransferredAt       time.Time
}

// ListOperatorQueues returns only active services assigned to the operator.
func (r *Repository) ListOperatorQueues(ctx context.Context, operatorID string) ([]OperatorQueue, error) {
	var queues []OperatorQueue
	err := r.db.WithContext(ctx).Raw(`SELECT DISTINCT b.id::text AS branch_id, b.name AS branch_name,
		s.id::text AS service_id, q.id::text AS queue_id, q.name AS queue_name, s.name AS service_name,
		to_char((now() AT TIME ZONE b.timezone)::date, 'YYYY-MM-DD') AS business_date,
		(SELECT count(*) FROM tickets t WHERE t.branch_id = b.id AND t.queue_id = q.id
		 AND t.business_date = (now() AT TIME ZONE b.timezone)::date AND t.status = 'WAITING') AS waiting_count
		FROM service_queues q JOIN services s ON s.id = q.service_id JOIN branches b ON b.id = s.branch_id
		JOIN users u ON u.id = ? AND u.role = 'OPERATOR'
		WHERE ((q.active AND s.active) OR EXISTS (SELECT 1 FROM tickets t WHERE t.queue_id = q.id AND t.status IN ('WAITING', 'PENDING', 'OPERATING')))
		AND (EXISTS (SELECT 1 FROM queue_operators qo WHERE qo.queue_id = q.id AND qo.operator_id = u.id)
		 OR EXISTS (SELECT 1 FROM counter_queues cq JOIN counter_operators co ON co.counter_id = cq.counter_id WHERE cq.queue_id = q.id AND co.operator_id = u.id)
		 OR (q.id = s.id AND EXISTS (SELECT 1 FROM operator_services os WHERE os.service_id = s.id AND os.operator_id = u.id)))
		ORDER BY branch_name, service_name, queue_name, queue_id`, operatorID).Scan(&queues).Error
	if err != nil {
		return nil, fmt.Errorf("list operator queues: %w", err)
	}
	if queues == nil {
		queues = []OperatorQueue{}
	}
	return queues, nil
}

func (r *Repository) GetOperatorQueue(ctx context.Context, operatorID, branchID, queueID string) (OperatorQueueDetail, error) {
	queues, err := r.ListOperatorQueues(ctx, operatorID)
	if err != nil {
		return OperatorQueueDetail{}, err
	}
	var selected *OperatorQueue
	for i := range queues {
		if queues[i].BranchID == branchID && queues[i].QueueID == queueID {
			selected = &queues[i]
			break
		}
	}
	if selected == nil {
		return OperatorQueueDetail{}, ErrQueueUnauthorized
	}
	var waiting []Ticket
	err = r.db.WithContext(ctx).Table("tickets t").Select(`t.id::text AS id, t.ticket_number, t.status, t.business_date, t.joined_at,
		t.request_answers, t.request_labels, s.allows_uploads, s.requires_documents`).Joins("JOIN services s ON s.id = t.service_id").
		Where("t.branch_id = ? AND t.queue_id = ? AND t.business_date = ? AND t.status = 'WAITING'", branchID, queueID, selected.BusinessDate).
		Order("t.joined_at, t.id").Scan(&waiting).Error
	if err != nil {
		return OperatorQueueDetail{}, fmt.Errorf("list waiting tickets: %w", err)
	}
	if waiting == nil {
		waiting = []Ticket{}
	}
	var recent []Ticket
	err = r.db.WithContext(ctx).Table("tickets t").Select(`t.id::text AS id, t.ticket_number, t.status, t.business_date, t.joined_at,
		t.request_answers, t.request_labels, s.allows_uploads, s.requires_documents`).Joins("JOIN services s ON s.id = t.service_id").
		Where("t.branch_id = ? AND t.queue_id = ? AND t.business_date = ? AND t.status IN ('COMPLETED', 'SKIPPED', 'CANCELLED', 'NO_SHOW')", branchID, queueID, selected.BusinessDate).
		Order("(SELECT max(e.occurred_at) FROM ticket_events e WHERE e.ticket_id = t.id) DESC, t.id DESC").Limit(10).Scan(&recent).Error
	if err != nil {
		return OperatorQueueDetail{}, fmt.Errorf("list recent queue tickets: %w", err)
	}
	if recent == nil {
		recent = []Ticket{}
	}
	var current Ticket
	err = r.db.WithContext(ctx).Table("tickets t").Select(`t.id::text AS id, t.ticket_number, t.status, t.business_date, t.joined_at,
		t.request_answers, t.request_labels, s.allows_uploads, s.requires_documents`).Joins("JOIN services s ON s.id = t.service_id").
		Where("t.branch_id = ? AND t.queue_id = ? AND t.assigned_operator_id = ? AND t.status IN ('PENDING', 'OPERATING')", branchID, queueID, operatorID).
		Take(&current).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return OperatorQueueDetail{}, fmt.Errorf("find current ticket: %w", err)
	}
	result := OperatorQueueDetail{Queue: *selected, Waiting: waiting, Recent: recent}
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
	case "no-show":
		expected, next, update = "PENDING", "NO_SHOW", "UPDATE tickets SET status = 'NO_SHOW', no_show_at = now() WHERE id = ?"
	default:
		return Ticket{}, ErrInvalidTransition
	}
	var ticket Ticket
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var status, serviceID, queueID string
		err := tx.Raw(`SELECT t.status, t.service_id::text, t.queue_id::text FROM tickets t JOIN service_queues q ON q.id = t.queue_id
			WHERE t.id = ? AND t.assigned_operator_id = ? AND (
				EXISTS (SELECT 1 FROM queue_operators qo WHERE qo.queue_id = q.id AND qo.operator_id = ?)
				OR EXISTS (SELECT 1 FROM counter_queues cq JOIN counter_operators co ON co.counter_id = cq.counter_id WHERE cq.queue_id = q.id AND co.operator_id = ?)
				OR (q.id = t.service_id AND EXISTS (SELECT 1 FROM operator_services os WHERE os.service_id = t.service_id AND os.operator_id = ?))
			) FOR UPDATE OF t`, ticketID, operatorID, operatorID, operatorID, operatorID).Row().Scan(&status, &serviceID, &queueID)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTicketNotFound
		}
		if err != nil {
			return fmt.Errorf("lock assigned ticket: %w", err)
		}
		if status != expected {
			return ErrInvalidTransition
		}
		if action == "start" {
			var required bool
			var documentCount int64
			if err := tx.Raw(`SELECT s.requires_documents, (SELECT count(*) FROM ticket_documents d WHERE d.ticket_id = ?)
				FROM services s WHERE s.id = ?`, ticketID, serviceID).Row().Scan(&required, &documentCount); err != nil {
				return err
			}
			if required && documentCount == 0 {
				return ErrRequiredDocumentsMissing
			}
		}
		err = tx.Raw(update+` RETURNING id::text, ticket_number, status, business_date, joined_at`, ticketID).
			Row().Scan(&ticket.ID, &ticket.TicketNumber, &ticket.Status, &ticket.BusinessDate, &ticket.JoinedAt)
		if err != nil {
			return fmt.Errorf("transition ticket to %s: %w", next, err)
		}
		if err := writeTicketEvent(tx, ticket.ID, status, next, operatorID); err != nil {
			return err
		}
		if err := loadTicketServiceContext(tx, ticket.ID, &ticket); err != nil {
			return err
		}
		_ = queueID
		return nil
	})
	if err != nil {
		return Ticket{}, err
	}
	return ticket, nil
}

// ListHandoffCandidates returns authorized idle operators for the assigned ticket's service.
func (r *Repository) ListHandoffCandidates(ctx context.Context, operatorID, ticketID string) ([]HandoffCandidate, error) {
	var candidates []HandoffCandidate
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var serviceID, status string
		err := tx.Raw(`SELECT t.service_id::text, t.status FROM tickets t
			JOIN users u ON u.id = ? AND u.role = 'OPERATOR'
			JOIN operator_services os ON os.operator_id = u.id AND os.service_id = t.service_id
			WHERE t.id = ? AND t.assigned_operator_id = ? FOR UPDATE OF t`, operatorID, ticketID, operatorID).
			Row().Scan(&serviceID, &status)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTicketNotFound
		}
		if err != nil {
			return fmt.Errorf("lock ticket for handoff options: %w", err)
		}
		if status != "PENDING" && status != "OPERATING" {
			return ErrInvalidTransition
		}
		if err := tx.Raw(`SELECT u.id::text AS id, u.display_name FROM users u
			JOIN operator_services os ON os.operator_id = u.id AND os.service_id = ?
			WHERE u.role = 'OPERATOR' AND u.id <> ?
			AND NOT EXISTS (SELECT 1 FROM tickets active WHERE active.assigned_operator_id = u.id
				AND active.status IN ('PENDING', 'OPERATING'))
			ORDER BY u.display_name, u.id`, serviceID, operatorID).Scan(&candidates).Error; err != nil {
			return fmt.Errorf("list handoff candidates: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if candidates == nil {
		candidates = []HandoffCandidate{}
	}
	return candidates, nil
}

// HandoffTicket transfers an active ticket and writes its audit record atomically.
func (r *Repository) HandoffTicket(ctx context.Context, operatorID, ticketID, recipientOperatorID string) (TicketHandoff, error) {
	var handoff TicketHandoff
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var serviceID, status string
		err := tx.Raw(`SELECT t.service_id::text, t.status FROM tickets t
			JOIN users u ON u.id = ? AND u.role = 'OPERATOR'
			JOIN operator_services os ON os.operator_id = u.id AND os.service_id = t.service_id
			WHERE t.id = ? AND t.assigned_operator_id = ? FOR UPDATE OF t`, operatorID, ticketID, operatorID).
			Row().Scan(&serviceID, &status)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTicketNotFound
		}
		if err != nil {
			return fmt.Errorf("lock assigned ticket for handoff: %w", err)
		}
		if status != "PENDING" && status != "OPERATING" {
			return ErrInvalidTransition
		}
		if recipientOperatorID == operatorID {
			return ErrHandoffRecipientUnavailable
		}

		var authorized bool
		if err := tx.Raw(`SELECT EXISTS (SELECT 1 FROM users u JOIN operator_services os
			ON os.operator_id = u.id WHERE u.id = ? AND u.role = 'OPERATOR' AND os.service_id = ?)`,
			recipientOperatorID, serviceID).Row().Scan(&authorized); err != nil {
			return fmt.Errorf("check handoff recipient authorization: %w", err)
		}
		if !authorized {
			return ErrHandoffRecipientUnavailable
		}

		var lockedRecipient string
		err = tx.Raw(`SELECT id::text FROM users WHERE id = ? AND role = 'OPERATOR' FOR UPDATE`, recipientOperatorID).
			Row().Scan(&lockedRecipient)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrHandoffRecipientUnavailable
		}
		if err != nil {
			return fmt.Errorf("lock handoff recipient: %w", err)
		}
		var hasActiveTicket bool
		if err := tx.Raw(`SELECT EXISTS (SELECT 1 FROM tickets WHERE assigned_operator_id = ?
			AND status IN ('PENDING', 'OPERATING'))`, recipientOperatorID).Row().Scan(&hasActiveTicket); err != nil {
			return fmt.Errorf("check handoff recipient workload: %w", err)
		}
		if hasActiveTicket {
			return ErrHandoffRecipientUnavailable
		}

		if err := tx.Raw(`UPDATE tickets SET assigned_operator_id = ? WHERE id = ?
			RETURNING id::text, ticket_number, status, assigned_operator_id::text`, recipientOperatorID, ticketID).
			Row().Scan(&handoff.ID, &handoff.TicketNumber, &handoff.Status, &handoff.RecipientOperatorID); err != nil {
			return fmt.Errorf("assign ticket to handoff recipient: %w", err)
		}
		if err := tx.Raw(`INSERT INTO ticket_handoffs (id, ticket_id, previous_operator_id, new_operator_id)
			VALUES (?, ?, ?, ?) RETURNING transferred_at`, uuid.NewString(), ticketID, operatorID, recipientOperatorID).
			Row().Scan(&handoff.TransferredAt); err != nil {
			return fmt.Errorf("record ticket handoff: %w", err)
		}
		return nil
	})
	if err != nil {
		var postgresError *pgconn.PgError
		if errors.As(err, &postgresError) && postgresError.Code == "23505" && postgresError.ConstraintName == "tickets_one_active_ticket_per_operator" {
			return TicketHandoff{}, ErrHandoffRecipientUnavailable
		}
		return TicketHandoff{}, err
	}
	return handoff, nil
}
