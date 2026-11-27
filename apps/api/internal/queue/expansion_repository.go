package queue

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrManagerForbidden         = errors.New("branch manager access required")
	ErrInvalidInput             = errors.New("invalid service or queue configuration")
	ErrRequiredDocumentsMissing = errors.New("required documents have not been uploaded")
)

type formFieldRow struct {
	ID       string `gorm:"column:id"`
	Position int    `gorm:"column:position"`
	Type     string `gorm:"column:type"`
	Label    string `gorm:"column:label"`
	Required bool   `gorm:"column:required"`
	Options  string `gorm:"column:options_json"`
}

func loadServiceFields(db *gorm.DB, serviceID string, fields *[]ServiceFormField) error {
	var rows []formFieldRow
	if err := db.Table("service_form_fields").Select("id::text AS id, position, field_type AS type, label, required, options::text AS options_json").
		Where("service_id = ?", serviceID).Order("position, id").Scan(&rows).Error; err != nil {
		return err
	}
	result := make([]ServiceFormField, 0, len(rows))
	for _, row := range rows {
		field := ServiceFormField{ID: row.ID, Position: row.Position, Type: row.Type, Label: row.Label, Required: row.Required, Options: []string{}}
		if err := json.Unmarshal([]byte(row.Options), &field.Options); err != nil {
			return fmt.Errorf("decode service form field options: %w", err)
		}
		result = append(result, field)
	}
	*fields = result
	return nil
}

func validateServiceAnswers(tx *gorm.DB, serviceID string, answers map[string]string) (string, string, error) {
	fields := []ServiceFormField{}
	if err := loadServiceFields(tx, serviceID, &fields); err != nil {
		return "", "", fmt.Errorf("load service request form: %w", err)
	}
	known := make(map[string]ServiceFormField, len(fields))
	labels := make(map[string]string, len(fields))
	for _, field := range fields {
		known[field.ID] = field
		labels[field.ID] = field.Label
	}
	if len(answers) > len(fields) {
		return "", "", ErrInvalidInput
	}
	clean := make(map[string]string, len(answers))
	for id, value := range answers {
		field, ok := known[id]
		if !ok {
			return "", "", ErrInvalidInput
		}
		value = strings.TrimSpace(value)
		maxLength := 200
		if field.Type == "long_text" {
			maxLength = 1000
		}
		if len([]rune(value)) > maxLength {
			return "", "", ErrInvalidInput
		}
		if field.Type == "single_select" {
			if value == "" && !field.Required {
				continue
			}
			valid := false
			for _, option := range field.Options {
				if value == option {
					valid = true
					break
				}
			}
			if !valid {
				return "", "", ErrInvalidInput
			}
		} else if field.Type != "short_text" && field.Type != "long_text" {
			return "", "", ErrInvalidInput
		}
		if value != "" {
			clean[id] = value
		}
	}
	for _, field := range fields {
		if field.Required && clean[field.ID] == "" {
			return "", "", ErrInvalidInput
		}
	}
	encoded, err := json.Marshal(clean)
	if err != nil {
		return "", "", fmt.Errorf("encode request answers: %w", err)
	}
	encodedLabels, err := json.Marshal(labels)
	if err != nil {
		return "", "", fmt.Errorf("encode request field labels: %w", err)
	}
	return string(encoded), string(encodedLabels), nil
}

func writeTicketEvent(tx *gorm.DB, ticketID, fromStatus, toStatus, actorID string) error {
	var actor any
	if actorID != "" {
		actor = actorID
	}
	if err := tx.Exec(`INSERT INTO ticket_events (id, ticket_id, from_status, to_status, actor_id)
		VALUES (?, ?, ?, ?, ?)`, uuid.NewString(), ticketID, nullableString(fromStatus), toStatus, actor).Error; err != nil {
		return fmt.Errorf("record ticket status event: %w", err)
	}
	return nil
}

func writeTicketHandoffEvent(tx *gorm.DB, ticketID, status, actorID, fromOperatorID, toOperatorID string) error {
	if err := tx.Exec(`INSERT INTO ticket_events (id, ticket_id, event_type, from_status, to_status, actor_id, from_operator_id, to_operator_id)
		VALUES (?, ?, 'HANDOFF', ?, ?, ?, ?, ?)`, uuid.NewString(), ticketID, status, status, actorID, fromOperatorID, toOperatorID).Error; err != nil {
		return fmt.Errorf("record ticket handoff event: %w", err)
	}
	return nil
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func (r *Repository) ListManagedBranches(ctx context.Context, managerID string) ([]ManagedBranch, error) {
	var branches []ManagedBranch
	err := r.db.WithContext(ctx).Raw(`SELECT b.id::text AS id, b.name
		FROM branch_managers bm JOIN branches b ON b.id = bm.branch_id
		JOIN users u ON u.id = bm.manager_id
		WHERE bm.manager_id = ? AND u.role = 'BRANCH_MANAGER'
		ORDER BY b.name, b.id`, managerID).Scan(&branches).Error
	if err != nil {
		return nil, fmt.Errorf("list managed branches: %w", err)
	}
	if branches == nil {
		branches = []ManagedBranch{}
	}
	return branches, nil
}

func (r *Repository) requireManagerBranch(ctx context.Context, managerID, branchID string) error {
	var allowed bool
	err := r.db.WithContext(ctx).Raw(`SELECT EXISTS (
		SELECT 1 FROM branch_managers bm JOIN users u ON u.id = bm.manager_id
		WHERE bm.branch_id = ? AND bm.manager_id = ? AND u.role = 'BRANCH_MANAGER')`, branchID, managerID).Row().Scan(&allowed)
	if err != nil {
		return fmt.Errorf("check branch manager assignment: %w", err)
	}
	if !allowed {
		return ErrManagerForbidden
	}
	return nil
}

func (r *Repository) GetManagerCatalog(ctx context.Context, managerID, branchID string) (ManagerCatalog, error) {
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return ManagerCatalog{}, err
	}
	var result ManagerCatalog
	if err := r.db.WithContext(ctx).Raw(`SELECT id::text AS id, name FROM branches WHERE id = ?`, branchID).Scan(&result.Branch).Error; err != nil {
		return ManagerCatalog{}, fmt.Errorf("load branch: %w", err)
	}
	var services []ManagerService
	err := r.db.WithContext(ctx).Raw(`SELECT id::text AS id, name, active, allows_uploads, requires_documents,
		document_guidance FROM services WHERE branch_id = ? ORDER BY name, id`, branchID).Scan(&services).Error
	if err != nil {
		return ManagerCatalog{}, fmt.Errorf("list managed services: %w", err)
	}
	for i := range services {
		if err := r.db.WithContext(ctx).Table("service_queues").
			Select("id::text AS id, name, active").Where("service_id = ?", services[i].ID).
			Order("name, id").Scan(&services[i].Queues).Error; err != nil {
			return ManagerCatalog{}, fmt.Errorf("list service queues: %w", err)
		}
		if services[i].Queues == nil {
			services[i].Queues = []ManagerQueue{}
		}
		if err := loadServiceFields(r.db.WithContext(ctx), services[i].ID, &services[i].Fields); err != nil {
			return ManagerCatalog{}, fmt.Errorf("list service fields: %w", err)
		}
	}
	if services == nil {
		services = []ManagerService{}
	}
	result.Services = services
	if err := r.db.WithContext(ctx).Raw(`SELECT id::text AS id, name, active FROM branch_counters
		WHERE branch_id = ? ORDER BY name, id`, branchID).Scan(&result.Counters).Error; err != nil {
		return ManagerCatalog{}, fmt.Errorf("list branch counters: %w", err)
	}
	for i := range result.Counters {
		if err := r.db.WithContext(ctx).Table("counter_queues cq").
			Select("q.id::text AS id").Joins("JOIN service_queues q ON q.id = cq.queue_id").
			Where("cq.counter_id = ?", result.Counters[i].ID).Order("q.name, q.id").Scan(&result.Counters[i].QueueIDs).Error; err != nil {
			return ManagerCatalog{}, fmt.Errorf("list counter queue assignments: %w", err)
		}
		if err := r.db.WithContext(ctx).Table("counter_operators co").
			Select("u.id::text AS id, u.display_name AS name").Joins("JOIN users u ON u.id = co.operator_id").
			Where("co.counter_id = ?", result.Counters[i].ID).Order("u.display_name, u.id").Scan(&result.Counters[i].Operators).Error; err != nil {
			return ManagerCatalog{}, fmt.Errorf("list counter operator assignments: %w", err)
		}
		if result.Counters[i].QueueIDs == nil {
			result.Counters[i].QueueIDs = []string{}
		}
		if result.Counters[i].Operators == nil {
			result.Counters[i].Operators = []ManagerOperator{}
		}
	}
	if result.Counters == nil {
		result.Counters = []ManagerCounter{}
	}
	if err := r.db.WithContext(ctx).Raw(`SELECT id::text AS id, display_name AS name FROM users
		WHERE role = 'OPERATOR' AND (
			EXISTS (SELECT 1 FROM operator_services os JOIN services s ON s.id = os.service_id WHERE os.operator_id = users.id AND s.branch_id = ?)
			OR EXISTS (SELECT 1 FROM counter_operators co JOIN branch_counters c ON c.id = co.counter_id WHERE co.operator_id = users.id AND c.branch_id = ?)
			OR EXISTS (SELECT 1 FROM queue_operators qo JOIN service_queues q ON q.id = qo.queue_id WHERE qo.operator_id = users.id AND q.branch_id = ?)
		) ORDER BY display_name, id`, branchID, branchID, branchID).Scan(&result.Operators).Error; err != nil {
		return ManagerCatalog{}, fmt.Errorf("list operators: %w", err)
	}
	if result.Operators == nil {
		result.Operators = []ManagerOperator{}
	}
	return result, nil
}

func (r *Repository) CreateService(ctx context.Context, managerID, branchID, name string) (ManagerService, error) {
	name = strings.TrimSpace(name)
	if len([]rune(name)) == 0 || len([]rune(name)) > 80 {
		return ManagerService{}, ErrInvalidInput
	}
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return ManagerService{}, err
	}
	serviceID, queueID := uuid.NewString(), uuid.NewString()
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`INSERT INTO services (id, branch_id, name, active) VALUES (?, ?, ?, true)`, serviceID, branchID, name).Error; err != nil {
			return err
		}
		if err := tx.Exec(`INSERT INTO service_queues (id, branch_id, service_id, name, active) VALUES (?, ?, ?, 'Main queue', true)`, queueID, branchID, serviceID).Error; err != nil {
			return err
		}
		return tx.Exec(`INSERT INTO counter_queues (counter_id, queue_id)
			SELECT id, ? FROM branch_counters WHERE branch_id = ? AND active ORDER BY name, id LIMIT 1`, queueID, branchID).Error
	})
	if err != nil {
		return ManagerService{}, err
	}
	return ManagerService{ID: serviceID, Name: name, Active: true, Queues: []ManagerQueue{{ID: queueID, Name: "Main queue", Active: true}}, Fields: []ServiceFormField{}}, nil
}

func (r *Repository) UpdateService(ctx context.Context, managerID, branchID, serviceID, name string, active bool) error {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 80 {
		return ErrInvalidInput
	}
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return err
	}
	result := r.db.WithContext(ctx).Exec(`UPDATE services SET name = ?, active = ? WHERE id = ? AND branch_id = ?`, name, active, serviceID, branchID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) CreateQueue(ctx context.Context, managerID, branchID, serviceID, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 80 {
		return ErrInvalidInput
	}
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return err
	}
	id := uuid.NewString()
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Exec(`INSERT INTO service_queues (id, branch_id, service_id, name, active)
			SELECT ?, ?, id, ?, true FROM services WHERE id = ? AND branch_id = ?`, id, branchID, name, serviceID, branchID)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return tx.Exec(`INSERT INTO counter_queues (counter_id, queue_id)
			SELECT id, ? FROM branch_counters WHERE branch_id = ? AND active ORDER BY name, id LIMIT 1`, id, branchID).Error
	})
	return err
}

func (r *Repository) UpdateQueue(ctx context.Context, managerID, branchID, queueID, name string, active bool) error {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 80 {
		return ErrInvalidInput
	}
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return err
	}
	result := r.db.WithContext(ctx).Exec(`UPDATE service_queues SET name = ?, active = ? WHERE id = ? AND branch_id = ?`, name, active, queueID, branchID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

type FormConfiguration struct {
	AllowsUploads     bool                    `json:"allowsUploads"`
	RequiresDocuments bool                    `json:"requiresDocuments"`
	DocumentGuidance  string                  `json:"documentGuidance"`
	Fields            []ServiceFormFieldInput `json:"fields"`
}

type ServiceFormFieldInput struct {
	Type     string   `json:"type"`
	Label    string   `json:"label"`
	Required bool     `json:"required"`
	Options  []string `json:"options"`
}

func validateFormConfiguration(config FormConfiguration) error {
	if config.RequiresDocuments && !config.AllowsUploads || len([]rune(config.DocumentGuidance)) > 500 || len(config.Fields) > 5 {
		return ErrInvalidInput
	}
	for _, field := range config.Fields {
		if field.Type != "short_text" && field.Type != "long_text" && field.Type != "single_select" {
			return ErrInvalidInput
		}
		if label := strings.TrimSpace(field.Label); label == "" || len([]rune(label)) > 80 {
			return ErrInvalidInput
		}
		if (field.Type == "short_text" || field.Type == "long_text") && len(field.Options) != 0 {
			return ErrInvalidInput
		}
		if field.Type == "single_select" {
			if len(field.Options) < 1 || len(field.Options) > 12 {
				return ErrInvalidInput
			}
			seen := map[string]bool{}
			for _, option := range field.Options {
				option = strings.TrimSpace(option)
				if option == "" || len([]rune(option)) > 60 || seen[strings.ToLower(option)] {
					return ErrInvalidInput
				}
				seen[strings.ToLower(option)] = true
			}
		}
	}
	return nil
}

func (r *Repository) UpdateServiceForm(ctx context.Context, managerID, branchID, serviceID string, config FormConfiguration) error {
	if err := validateFormConfiguration(config); err != nil {
		return err
	}
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return err
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Exec(`UPDATE services SET allows_uploads = ?, requires_documents = ?, document_guidance = ?
			WHERE id = ? AND branch_id = ?`, config.AllowsUploads, config.RequiresDocuments, strings.TrimSpace(config.DocumentGuidance), serviceID, branchID)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		if err := tx.Exec(`DELETE FROM service_form_fields WHERE service_id = ?`, serviceID).Error; err != nil {
			return err
		}
		for i, field := range config.Fields {
			options, err := json.Marshal(field.Options)
			if err != nil {
				return err
			}
			if err := tx.Exec(`INSERT INTO service_form_fields (id, service_id, position, field_type, label, required, options)
				VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)`, uuid.NewString(), serviceID, i+1, field.Type, strings.TrimSpace(field.Label), field.Required, string(options)).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *Repository) CreateCounter(ctx context.Context, managerID, branchID, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 80 {
		return ErrInvalidInput
	}
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return err
	}
	return r.db.WithContext(ctx).Exec(`INSERT INTO branch_counters (id, branch_id, name, active) VALUES (?, ?, ?, true)`, uuid.NewString(), branchID, name).Error
}

func (r *Repository) UpdateCounter(ctx context.Context, managerID, branchID, counterID, name string, active bool) error {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 80 {
		return ErrInvalidInput
	}
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return err
	}
	result := r.db.WithContext(ctx).Exec(`UPDATE branch_counters SET name = ?, active = ? WHERE id = ? AND branch_id = ?`, name, active, counterID, branchID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) SetCounterAssignments(ctx context.Context, managerID, branchID, counterID string, queueIDs, operatorIDs []string) error {
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return err
	}
	if len(queueIDs) > 100 || len(operatorIDs) > 100 {
		return ErrInvalidInput
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var allowed bool
		if err := tx.Raw(`SELECT EXISTS (SELECT 1 FROM branch_counters WHERE id = ? AND branch_id = ?)`, counterID, branchID).Row().Scan(&allowed); err != nil {
			return err
		}
		if !allowed {
			return gorm.ErrRecordNotFound
		}
		if err := tx.Exec(`DELETE FROM counter_queues WHERE counter_id = ?`, counterID).Error; err != nil {
			return err
		}
		for _, queueID := range queueIDs {
			result := tx.Exec(`INSERT INTO counter_queues (counter_id, queue_id)
				SELECT ?, id FROM service_queues WHERE id = ? AND branch_id = ?`, counterID, queueID, branchID)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrInvalidInput
			}
		}
		if err := tx.Exec(`DELETE FROM counter_operators WHERE counter_id = ?`, counterID).Error; err != nil {
			return err
		}
		for _, operatorID := range operatorIDs {
			result := tx.Exec(`INSERT INTO counter_operators (counter_id, operator_id)
				SELECT ?, id FROM users WHERE id = ? AND role = 'OPERATOR'`, counterID, operatorID)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrInvalidInput
			}
		}
		return nil
	})
}

type ManagedBranch struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type ManagerQueue struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}
type ManagerService struct {
	ID                string             `json:"id"`
	Name              string             `json:"name"`
	Active            bool               `json:"active"`
	AllowsUploads     bool               `json:"allowsUploads"`
	RequiresDocuments bool               `json:"requiresDocuments"`
	DocumentGuidance  string             `json:"documentGuidance"`
	Queues            []ManagerQueue     `json:"queues" gorm:"-"`
	Fields            []ServiceFormField `json:"fields" gorm:"-"`
}
type ManagerOperator struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type ManagerCounter struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Active    bool              `json:"active"`
	QueueIDs  []string          `json:"queueIds" gorm:"-"`
	Operators []ManagerOperator `json:"operators" gorm:"-"`
}
type ManagerCatalog struct {
	Branch    ManagedBranch     `json:"branch"`
	Services  []ManagerService  `json:"services"`
	Counters  []ManagerCounter  `json:"counters"`
	Operators []ManagerOperator `json:"operators"`
}

type TicketEvent struct {
	ID               string    `json:"id"`
	EventType        string    `json:"eventType"`
	FromStatus       *string   `json:"fromStatus,omitempty"`
	ToStatus         string    `json:"toStatus"`
	ActorID          *string   `json:"actorId,omitempty"`
	ActorName        *string   `json:"actorName,omitempty"`
	FromOperatorID   *string   `json:"fromOperatorId,omitempty"`
	FromOperatorName *string   `json:"fromOperatorName,omitempty"`
	ToOperatorID     *string   `json:"toOperatorId,omitempty"`
	ToOperatorName   *string   `json:"toOperatorName,omitempty"`
	OccurredAt       time.Time `json:"occurredAt"`
}
type TicketHistoryPage struct {
	Items  []TicketEvent `json:"items"`
	Limit  int           `json:"limit"`
	Offset int           `json:"offset"`
	Total  int64         `json:"total"`
}

func (r *Repository) TicketHistory(ctx context.Context, actorID, role, ticketID string, limit, offset int) (TicketHistoryPage, error) {
	var allowed bool
	err := r.db.WithContext(ctx).Raw(`SELECT EXISTS (
		SELECT 1 FROM tickets t WHERE t.id = ? AND (
			(? = 'BRANCH_MANAGER' AND EXISTS (SELECT 1 FROM branch_managers bm WHERE bm.branch_id = t.branch_id AND bm.manager_id = ?))
			OR (? = 'OPERATOR' AND t.assigned_operator_id = ?)
			OR (? = 'OPERATOR' AND EXISTS (SELECT 1 FROM queue_operators qo WHERE qo.queue_id = t.queue_id AND qo.operator_id = ?))
			OR (? = 'OPERATOR' AND EXISTS (SELECT 1 FROM counter_queues cq JOIN counter_operators co ON co.counter_id = cq.counter_id WHERE cq.queue_id = t.queue_id AND co.operator_id = ?))
		))`, ticketID, role, actorID, role, actorID, role, actorID, role, actorID).Row().Scan(&allowed)
	if err != nil {
		return TicketHistoryPage{}, err
	}
	if !allowed {
		return TicketHistoryPage{}, ErrQueueUnauthorized
	}
	page := TicketHistoryPage{Items: []TicketEvent{}, Limit: limit, Offset: offset}
	if err := r.db.WithContext(ctx).Table("ticket_events").Where("ticket_id = ?", ticketID).Count(&page.Total).Error; err != nil {
		return page, err
	}
	err = r.db.WithContext(ctx).Table("ticket_events e").Select(`e.id::text AS id, e.event_type, e.from_status, e.to_status,
		e.actor_id::text AS actor_id, actor.display_name AS actor_name,
		e.from_operator_id::text AS from_operator_id, from_operator.display_name AS from_operator_name,
		e.to_operator_id::text AS to_operator_id, to_operator.display_name AS to_operator_name, e.occurred_at`).
		Joins("LEFT JOIN users actor ON actor.id = e.actor_id").
		Joins("LEFT JOIN users from_operator ON from_operator.id = e.from_operator_id").
		Joins("LEFT JOIN users to_operator ON to_operator.id = e.to_operator_id").
		Where("e.ticket_id = ?", ticketID).
		Order("e.occurred_at, e.id").Limit(limit).Offset(offset).Scan(&page.Items).Error
	if err != nil {
		return page, fmt.Errorf("read ticket history: %w", err)
	}
	return page, nil
}

type ServiceSummary struct {
	Completed             int64    `json:"completed"`
	Skipped               int64    `json:"skipped"`
	Cancelled             int64    `json:"cancelled"`
	NoShow                int64    `json:"noShow"`
	AverageWaitSeconds    *float64 `json:"averageWaitSeconds"`
	AverageServiceSeconds *float64 `json:"averageServiceSeconds"`
}

func (r *Repository) ServiceSummary(ctx context.Context, managerID, branchID, serviceID string, from, to time.Time) (ServiceSummary, error) {
	if err := r.requireManagerBranch(ctx, managerID, branchID); err != nil {
		return ServiceSummary{}, err
	}
	var allowed bool
	if err := r.db.WithContext(ctx).Raw(`SELECT EXISTS (SELECT 1 FROM services WHERE id = ? AND branch_id = ?)`, serviceID, branchID).Row().Scan(&allowed); err != nil {
		return ServiceSummary{}, err
	}
	if !allowed {
		return ServiceSummary{}, gorm.ErrRecordNotFound
	}
	var result ServiceSummary
	err := r.db.WithContext(ctx).Raw(`SELECT
		count(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= ? AND completed_at < ?) AS completed,
		count(*) FILTER (WHERE status = 'SKIPPED' AND skipped_at >= ? AND skipped_at < ?) AS skipped,
		count(*) FILTER (WHERE status = 'CANCELLED' AND cancelled_at >= ? AND cancelled_at < ?) AS cancelled,
		count(*) FILTER (WHERE status = 'NO_SHOW' AND no_show_at >= ? AND no_show_at < ?) AS no_show,
		avg(EXTRACT(EPOCH FROM (called_at - joined_at))) FILTER (WHERE called_at >= ? AND called_at < ?) AS average_wait_seconds,
		avg(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE completed_at >= ? AND completed_at < ? AND status = 'COMPLETED') AS average_service_seconds
		FROM tickets WHERE branch_id = ? AND service_id = ?`,
		from, to, from, to, from, to, from, to, from, to, from, to, branchID, serviceID).Scan(&result).Error
	if err != nil {
		return ServiceSummary{}, fmt.Errorf("summarize service queue: %w", err)
	}
	return result, nil
}

func (r *Repository) CancelCustomerTicket(ctx context.Context, customerID, ticketID string) (Ticket, error) {
	var ticket Ticket
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var status string
		err := tx.Raw(`SELECT status FROM tickets WHERE id = ? AND customer_id = ? FOR UPDATE`, ticketID, customerID).Row().Scan(&status)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTicketNotFound
		}
		if err != nil {
			return err
		}
		if status != "WAITING" {
			return ErrInvalidTransition
		}
		if err := tx.Exec(`UPDATE tickets SET status = 'CANCELLED', cancelled_at = now() WHERE id = ?`, ticketID).Error; err != nil {
			return err
		}
		if err := writeTicketEvent(tx, ticketID, status, "CANCELLED", customerID); err != nil {
			return err
		}
		return tx.Raw(`SELECT t.id::text AS id, t.branch_id::text AS branch_id, b.name AS branch_name,
			t.service_id::text AS service_id, s.name AS service_name, t.queue_id::text AS queue_id, q.name AS queue_name,
			s.allows_uploads, s.requires_documents, s.document_guidance,
			t.business_date, t.ticket_number, t.customer_id::text AS customer_id, t.status, t.joined_at, t.request_answers
			FROM tickets t JOIN branches b ON b.id = t.branch_id JOIN services s ON s.id = t.service_id
			JOIN service_queues q ON q.id = t.queue_id WHERE t.id = ?`, ticketID).Row().Scan(
			&ticket.ID, &ticket.BranchID, &ticket.BranchName, &ticket.ServiceID, &ticket.ServiceName, &ticket.QueueID,
			&ticket.QueueName, &ticket.AllowsUploads, &ticket.RequiresDocuments, &ticket.DocumentGuidance,
			&ticket.BusinessDate, &ticket.TicketNumber, &ticket.CustomerID, &ticket.Status, &ticket.JoinedAt, &ticket.RequestAnswers)
	})
	if err != nil {
		return Ticket{}, err
	}
	return ticket, nil
}

func (r *Repository) MarkNoShow(ctx context.Context, operatorID, ticketID string) (Ticket, error) {
	return r.TransitionTicket(ctx, operatorID, ticketID, "no-show")
}
