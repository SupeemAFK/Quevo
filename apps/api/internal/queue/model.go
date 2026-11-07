package queue

import (
	"database/sql"
	"time"
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
