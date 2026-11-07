package queue

import "time"

type JoinQueueInput struct {
	CustomerID   string
	ServiceID    string
	BusinessDate time.Time
}

type CallNextInput struct {
	OperatorID   string
	ServiceID    string
	BusinessDate time.Time
}
