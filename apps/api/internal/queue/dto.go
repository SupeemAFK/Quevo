package queue

import "time"

type JoinQueueInput struct {
	CustomerID     string
	BranchID       string
	ServiceID      string
	QueueID        string
	RequestAnswers map[string]string
	BusinessDate   time.Time
}

type CallNextInput struct {
	OperatorID   string
	BranchID     string
	ServiceID    string
	QueueID      string
	BusinessDate time.Time
}
