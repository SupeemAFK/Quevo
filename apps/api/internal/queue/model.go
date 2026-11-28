package queue

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type RequestAnswers map[string]string

func (a *RequestAnswers) Scan(value any) error {
	if value == nil {
		*a = RequestAnswers{}
		return nil
	}
	var raw []byte
	switch typed := value.(type) {
	case []byte:
		raw = typed
	case string:
		raw = []byte(typed)
	default:
		return fmt.Errorf("cannot scan request answers from %T", value)
	}
	return json.Unmarshal(raw, a)
}

func (a RequestAnswers) Value() (driver.Value, error) {
	if a == nil {
		a = RequestAnswers{}
	}
	return json.Marshal(a)
}

type Ticket struct {
	ID                 string
	BranchID           string
	BranchName         string
	ServiceID          string
	ServiceName        string
	QueueID            string
	QueueName          string
	BusinessDate       time.Time
	TicketNumber       string
	CustomerID         string
	AssignedOperatorID sql.NullString
	Status             string
	RequestAnswers     RequestAnswers
	RequestLabels      RequestAnswers
	AllowsUploads      bool
	RequiresDocuments  bool
	DocumentGuidance   string
	JoinedAt           time.Time
	CalledAt           sql.NullTime
}

type AvailableService struct {
	ID                string             `gorm:"column:id"`
	BranchID          string             `gorm:"column:branch_id"`
	BranchName        string             `gorm:"column:branch_name"`
	Name              string             `gorm:"column:name"`
	Queues            []AvailableQueue   `json:"queues" gorm:"-"`
	Fields            []ServiceFormField `json:"fields" gorm:"-"`
	AllowsUploads     bool               `json:"allowsUploads"`
	RequiresDocuments bool               `json:"requiresDocuments"`
	DocumentGuidance  string             `json:"documentGuidance"`
}

type AvailableQueue struct {
	ID   string `json:"id" binding:"required"`
	Name string `json:"name" binding:"required"`
}

type ServiceFormField struct {
	ID       string   `json:"id" binding:"required"`
	Position int      `json:"position" binding:"required"`
	Type     string   `json:"type" binding:"required"`
	Label    string   `json:"label" binding:"required"`
	Required bool     `json:"required" binding:"required"`
	Options  []string `json:"options" binding:"required"`
}
