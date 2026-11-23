package queue

import (
	"database/sql"
	"time"
)

type Ticket struct {
	ID                 string
	BranchID           string
	BranchName         string
	ServiceID          string
	ServiceName        string
	BusinessDate       time.Time
	TicketNumber       string
	CustomerID         string
	AssignedOperatorID sql.NullString
	Status             string
	JoinedAt           time.Time
	CalledAt           sql.NullTime
}

type AvailableService struct {
	ID         string `gorm:"column:id"`
	BranchID   string `gorm:"column:branch_id"`
	BranchName string `gorm:"column:branch_name"`
	Name       string `gorm:"column:name"`
}
