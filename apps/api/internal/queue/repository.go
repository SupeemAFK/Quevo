package queue

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrActiveTicket            = errors.New("customer already has an active ticket")
	ErrOperatorHasActiveTicket = errors.New("operator already has an active ticket")
	ErrQueueUnauthorized       = errors.New("user is not authorized for this queue action")
	ErrServiceUnavailable      = errors.New("service is not available")
	ErrTicketNotFound          = errors.New("customer ticket not found")
)

type Repository struct{ db *gorm.DB }

func NewRepository(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) ListAvailableServices(ctx context.Context, branchID string) ([]AvailableService, error) {
	var services []AvailableService
	query := r.db.WithContext(ctx).
		Table("services AS s").
		Select("s.id::text AS id, s.branch_id::text AS branch_id, b.name AS branch_name, s.name, s.allows_uploads, s.requires_documents, s.document_guidance").
		Joins("JOIN branches AS b ON b.id = s.branch_id").
		Where("s.active = ?", true)
	if branchID != "" {
		query = query.Where("s.branch_id = ?", branchID)
	}
	if err := query.Order("b.name, s.name, s.id").Scan(&services).Error; err != nil {
		return nil, fmt.Errorf("list available services: %w", err)
	}
	for i := range services {
		if err := r.db.WithContext(ctx).Table("service_queues").
			Select("id::text AS id, name").Where("service_id = ? AND active", services[i].ID).
			Order("name, id").Scan(&services[i].Queues).Error; err != nil {
			return nil, fmt.Errorf("list service queues: %w", err)
		}
		if err := loadServiceFields(r.db.WithContext(ctx), services[i].ID, &services[i].Fields); err != nil {
			return nil, fmt.Errorf("list service form fields: %w", err)
		}
		if services[i].Queues == nil {
			services[i].Queues = []AvailableQueue{}
		}
		if services[i].Fields == nil {
			services[i].Fields = []ServiceFormField{}
		}
	}
	filtered := services[:0]
	for _, service := range services {
		if len(service.Queues) > 0 {
			filtered = append(filtered, service)
		}
	}
	services = filtered
	if services == nil {
		services = []AvailableService{}
	}
	return services, nil
}

// JoinQueue creates a waiting ticket and allocates its number in one transaction.
// If BusinessDate is zero, the repository calculates it using the branch timezone.
func (r *Repository) JoinQueue(ctx context.Context, input JoinQueueInput) (Ticket, error) {
	var ticket Ticket
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var role, branchName, serviceName, queueID, queueName, serviceID, documentGuidance string
		var active bool
		var allowsUploads, requiresDocuments bool
		var branchID string
		var branchBusinessDate time.Time
		requestedQueueID := input.QueueID
		if requestedQueueID == "" {
			requestedQueueID = input.ServiceID
		}
		err := tx.Raw(`SELECT s.branch_id::text, s.id::text, q.id::text, q.name, u.role,
			s.active AND q.active, b.name, s.name, s.allows_uploads, s.requires_documents, s.document_guidance,
			(now() AT TIME ZONE b.timezone)::date
			FROM service_queues q JOIN services s ON s.id = q.service_id
			JOIN branches b ON b.id = s.branch_id CROSS JOIN users u
			WHERE q.id = ? AND q.branch_id = ? AND (CAST(? AS text) = '' OR s.id::text = ?) AND u.id = ?`,
			requestedQueueID, input.BranchID, input.ServiceID, input.ServiceID, input.CustomerID).
			Row().Scan(&branchID, &serviceID, &queueID, &queueName, &role, &active, &branchName, &serviceName,
			&allowsUploads, &requiresDocuments, &documentGuidance, &branchBusinessDate)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && !active) {
			return ErrServiceUnavailable
		}
		if err == nil && role != "CUSTOMER" {
			return ErrQueueUnauthorized
		}
		if err != nil {
			return fmt.Errorf("validate customer and service: %w", err)
		}
		var lockedCustomerID string
		err = tx.Raw(`SELECT id::text FROM users WHERE id = ? AND role = 'CUSTOMER' FOR UPDATE`, input.CustomerID).
			Row().Scan(&lockedCustomerID)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrQueueUnauthorized
		}
		if err != nil {
			return fmt.Errorf("lock customer before joining: %w", err)
		}
		var exists bool
		err = tx.Raw(`SELECT EXISTS (SELECT 1 FROM tickets WHERE customer_id = ?
			AND status IN ('WAITING', 'PENDING', 'OPERATING'))`, input.CustomerID).Row().Scan(&exists)
		if err != nil {
			return fmt.Errorf("check customer's active ticket: %w", err)
		}
		if exists {
			return ErrActiveTicket
		}
		answers, labels, err := validateServiceAnswers(tx, serviceID, input.RequestAnswers)
		if err != nil {
			return err
		}
		dateValue := input.BusinessDate
		if dateValue.IsZero() {
			dateValue = branchBusinessDate
		}
		date := dateValue.Format("2006-01-02")
		last, err := lockSequence(tx, branchID, serviceID, queueID, date)
		if err != nil {
			return err
		}
		next := last + 1
		if err := tx.Exec(`UPDATE queue_sequences SET last_issued = ?
			WHERE branch_id = ? AND queue_id = ? AND business_date = ?`, next, branchID, queueID, date).Error; err != nil {
			return fmt.Errorf("advance queue sequence: %w", err)
		}
		err = tx.Raw(`INSERT INTO tickets (id, branch_id, service_id, queue_id, business_date, ticket_number, customer_id, status, request_answers, request_labels)
			VALUES (?, ?, ?, ?, ?, ?, ?, 'WAITING', ?::jsonb, ?::jsonb)
			RETURNING id::text, branch_id::text, service_id::text, queue_id::text, business_date, ticket_number,
			customer_id::text, assigned_operator_id::text, status, joined_at, called_at`,
			uuid.NewString(), branchID, serviceID, queueID, date, fmt.Sprint(next), input.CustomerID, answers, labels).
			Row().Scan(
			&ticket.ID, &ticket.BranchID, &ticket.ServiceID, &ticket.QueueID, &ticket.BusinessDate, &ticket.TicketNumber,
			&ticket.CustomerID, &ticket.AssignedOperatorID, &ticket.Status, &ticket.JoinedAt, &ticket.CalledAt)
		if err != nil {
			return fmt.Errorf("create waiting ticket: %w", err)
		}
		ticket.BranchName = branchName
		ticket.ServiceName = serviceName
		ticket.QueueID = queueID
		ticket.QueueName = queueName
		ticket.AllowsUploads = allowsUploads
		ticket.RequiresDocuments = requiresDocuments
		ticket.DocumentGuidance = documentGuidance
		ticket.RequestAnswers = RequestAnswers{}
		if err := json.Unmarshal([]byte(answers), &ticket.RequestAnswers); err != nil {
			return fmt.Errorf("decode validated request answers: %w", err)
		}
		if err := json.Unmarshal([]byte(labels), &ticket.RequestLabels); err != nil {
			return fmt.Errorf("decode request field labels: %w", err)
		}
		if err := writeTicketEvent(tx, ticket.ID, "", "WAITING", input.CustomerID); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return Ticket{}, err
	}
	return ticket, nil
}

func (r *Repository) FindCustomerTicket(ctx context.Context, customerID, ticketID string) (Ticket, error) {
	var ticket Ticket
	err := r.db.WithContext(ctx).
		Table("tickets AS t").
		Select(`t.id::text AS id, t.branch_id::text AS branch_id, b.name AS branch_name,
			t.service_id::text AS service_id, s.name AS service_name, t.queue_id::text AS queue_id, q.name AS queue_name,
			s.allows_uploads, s.requires_documents, s.document_guidance,
			t.request_answers, t.request_labels, t.business_date,
			t.ticket_number, t.customer_id::text AS customer_id,
			t.assigned_operator_id::text AS assigned_operator_id, t.status, t.joined_at, t.called_at`).
		Joins("JOIN branches AS b ON b.id = t.branch_id").
		Joins("JOIN services AS s ON s.id = t.service_id").
		Joins("JOIN service_queues AS q ON q.id = t.queue_id").
		Where("t.id = ? AND t.customer_id = ?", ticketID, customerID).
		Take(&ticket).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Ticket{}, ErrTicketNotFound
	}
	if err != nil {
		return Ticket{}, fmt.Errorf("find customer ticket: %w", err)
	}
	return ticket, nil
}

func (r *Repository) ListActiveCustomerTickets(ctx context.Context, customerID string) ([]Ticket, error) {
	var tickets []Ticket
	err := r.db.WithContext(ctx).
		Table("tickets AS t").
		Select(`t.id::text AS id, t.branch_id::text AS branch_id, b.name AS branch_name,
			t.service_id::text AS service_id, s.name AS service_name, t.queue_id::text AS queue_id, q.name AS queue_name,
			s.allows_uploads, s.requires_documents, s.document_guidance,
			t.request_answers, t.request_labels, t.business_date,
			t.ticket_number, t.customer_id::text AS customer_id,
			t.assigned_operator_id::text AS assigned_operator_id, t.status, t.joined_at, t.called_at`).
		Joins("JOIN branches AS b ON b.id = t.branch_id").
		Joins("JOIN services AS s ON s.id = t.service_id").
		Joins("JOIN service_queues AS q ON q.id = t.queue_id").
		Where("t.customer_id = ? AND t.status IN ('WAITING', 'PENDING', 'OPERATING')", customerID).
		Order("t.joined_at DESC, t.id").
		Scan(&tickets).Error
	if err != nil {
		return nil, fmt.Errorf("list active customer tickets: %w", err)
	}
	if tickets == nil {
		tickets = []Ticket{}
	}
	return tickets, nil
}

// CallNext locks the queue and claims its oldest waiting ticket atomically.
func (r *Repository) CallNext(ctx context.Context, input CallNextInput) (Ticket, bool, error) {
	var ticket Ticket
	var found bool
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var branchID string
		var allowed bool
		var businessDate time.Time
		queueID := input.QueueID
		if queueID == "" {
			queueID = input.ServiceID
		}
		err := tx.Raw(`SELECT s.branch_id::text, (u.role = 'OPERATOR' AND (
			EXISTS (SELECT 1 FROM queue_operators qo WHERE qo.queue_id = q.id AND qo.operator_id = u.id)
			OR EXISTS (SELECT 1 FROM counter_queues cq JOIN counter_operators co ON co.counter_id = cq.counter_id
				WHERE cq.queue_id = q.id AND co.operator_id = u.id)
			OR (q.id = s.id AND EXISTS (SELECT 1 FROM operator_services os WHERE os.service_id = s.id AND os.operator_id = u.id))
			)), (now() AT TIME ZONE b.timezone)::date
			FROM service_queues q JOIN services s ON s.id = q.service_id JOIN branches b ON b.id = s.branch_id CROSS JOIN users u
			WHERE q.id = ? AND u.id = ? AND (? = '' OR s.branch_id::text = ?) FOR UPDATE OF u`,
			queueID, input.OperatorID, input.BranchID, input.BranchID).Row().Scan(&branchID, &allowed, &businessDate)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && !allowed) {
			return ErrQueueUnauthorized
		}
		if err != nil {
			return fmt.Errorf("validate operator authorization: %w", err)
		}
		dateValue := input.BusinessDate
		if dateValue.IsZero() {
			dateValue = businessDate
		}
		date := dateValue.Format("2006-01-02")
		var serviceID string
		if err := tx.Raw(`SELECT service_id::text FROM service_queues WHERE id = ?`, queueID).Row().Scan(&serviceID); err != nil {
			return err
		}
		if _, err := lockSequence(tx, branchID, serviceID, queueID, date); err != nil {
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
		err = tx.Raw(`SELECT id::text FROM tickets WHERE branch_id = ? AND queue_id = ?
			AND business_date = ? AND status = 'WAITING' ORDER BY joined_at, id LIMIT 1 FOR UPDATE`,
			branchID, queueID, date).Row().Scan(&ticketID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("select oldest waiting ticket: %w", err)
		}
		err = tx.Raw(`UPDATE tickets SET status = 'PENDING', assigned_operator_id = ?, called_at = now()
			WHERE id = ? AND status = 'WAITING'
			RETURNING id::text, branch_id::text, service_id::text, queue_id::text, business_date, ticket_number,
			customer_id::text, assigned_operator_id::text, status, joined_at, called_at`, input.OperatorID, ticketID).Row().Scan(
			&ticket.ID, &ticket.BranchID, &ticket.ServiceID, &ticket.QueueID, &ticket.BusinessDate, &ticket.TicketNumber,
			&ticket.CustomerID, &ticket.AssignedOperatorID, &ticket.Status, &ticket.JoinedAt, &ticket.CalledAt)
		if err != nil {
			return fmt.Errorf("assign next ticket: %w", err)
		}
		if err := writeTicketEvent(tx, ticket.ID, "WAITING", "PENDING", input.OperatorID); err != nil {
			return err
		}
		if err := loadTicketServiceContext(tx, ticket.ID, &ticket); err != nil {
			return err
		}
		found = true
		return nil
	})
	if err != nil {
		return Ticket{}, false, err
	}
	return ticket, found, nil
}

func loadTicketServiceContext(tx *gorm.DB, ticketID string, ticket *Ticket) error {
	if err := tx.Raw(`SELECT t.request_answers, t.request_labels, s.allows_uploads, s.requires_documents, s.document_guidance
		FROM tickets t JOIN services s ON s.id = t.service_id WHERE t.id = ?`, ticketID).Row().Scan(
		&ticket.RequestAnswers, &ticket.RequestLabels, &ticket.AllowsUploads, &ticket.RequiresDocuments, &ticket.DocumentGuidance); err != nil {
		return fmt.Errorf("load ticket service context: %w", err)
	}
	if ticket.RequestAnswers == nil {
		ticket.RequestAnswers = RequestAnswers{}
	}
	if ticket.RequestLabels == nil {
		ticket.RequestLabels = RequestAnswers{}
	}
	return nil
}

func lockSequence(tx *gorm.DB, branchID, serviceID, queueID, date string) (int64, error) {
	if err := tx.Exec(`INSERT INTO queue_sequences (branch_id, service_id, queue_id, business_date)
		VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`, branchID, serviceID, queueID, date).Error; err != nil {
		return 0, fmt.Errorf("ensure queue sequence: %w", err)
	}
	var last int64
	if err := tx.Raw(`SELECT last_issued FROM queue_sequences WHERE branch_id = ? AND queue_id = ?
		AND business_date = ? FOR UPDATE`, branchID, queueID, date).Row().Scan(&last); err != nil {
		return 0, fmt.Errorf("lock queue sequence: %w", err)
	}
	return last, nil
}
