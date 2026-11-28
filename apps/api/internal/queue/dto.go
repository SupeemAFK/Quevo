package queue

import "time"

type JoinQueueInput struct {
	CustomerID   string
	BranchID     string
	ServiceID    string
	BusinessDate time.Time
}

type CallNextInput struct {
	OperatorID   string
	BranchID     string
	ServiceID    string
	BusinessDate time.Time
}
