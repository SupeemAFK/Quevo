//go:build integration

package queue

import (
	"errors"
	"sync"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/google/uuid"
)

func TestCallNextPreventsOperatorClaimingAcrossServices(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)
	serviceID := uuid.NewString()
	customerID := uuid.NewString()
	businessDate := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)

	if _, err := db.ExecContext(ctx, `INSERT INTO services (id, branch_id, name, active)
		VALUES ($1, $2, 'Second Service', true)`, serviceID, database.DemoBranchID); err != nil {
		t.Fatalf("insert second service: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id)
		VALUES ($1, $2)`, database.DemoOperatorID, serviceID); err != nil {
		t.Fatalf("authorize operator for second service: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash)
		VALUES ($1, 'CUSTOMER', 'Second Customer', $2, 'test-hash')`, customerID, customerID+"@quevo.local"); err != nil {
		t.Fatalf("insert second customer: %v", err)
	}
	for _, input := range []JoinQueueInput{
		{CustomerID: database.DemoCustomerID, ServiceID: database.DemoServiceID, BusinessDate: businessDate},
		{CustomerID: customerID, ServiceID: serviceID, BusinessDate: businessDate},
	} {
		if _, err := repo.JoinQueue(ctx, input); err != nil {
			t.Fatalf("join service %s: %v", input.ServiceID, err)
		}
	}

	type result struct{ err error }
	start := make(chan struct{})
	results := make(chan result, 2)
	var group sync.WaitGroup
	group.Add(2)
	for _, serviceID := range []string{database.DemoServiceID, serviceID} {
		go func(serviceID string) {
			defer group.Done()
			<-start
			_, _, err := repo.CallNext(ctx, CallNextInput{
				OperatorID:   database.DemoOperatorID,
				ServiceID:    serviceID,
				BusinessDate: businessDate,
			})
			results <- result{err: err}
		}(serviceID)
	}
	close(start)
	group.Wait()
	close(results)

	successes, activeTicketErrors := 0, 0
	for result := range results {
		switch {
		case result.err == nil:
			successes++
		case errors.Is(result.err, ErrOperatorHasActiveTicket):
			activeTicketErrors++
		default:
			t.Errorf("call-next error = %v, want success or ErrOperatorHasActiveTicket", result.err)
		}
	}
	if successes != 1 || activeTicketErrors != 1 {
		t.Fatalf("call-next results: successes=%d active-ticket-errors=%d; want 1 each", successes, activeTicketErrors)
	}

	var activeTickets int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM tickets
		WHERE assigned_operator_id = $1 AND status IN ('PENDING', 'OPERATING')`, database.DemoOperatorID).Scan(&activeTickets); err != nil {
		t.Fatalf("count operator active tickets: %v", err)
	}
	if activeTickets != 1 {
		t.Fatalf("active tickets for operator = %d, want 1", activeTickets)
	}
}
