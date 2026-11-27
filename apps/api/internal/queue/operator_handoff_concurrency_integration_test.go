//go:build integration

package queue

import (
	"errors"
	"sync"
	"testing"

	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/google/uuid"
)

func TestHandoffSerializesRecipientClaimWithCallNext(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	recipientID, secondCustomerID := uuid.NewString(), uuid.NewString()
	if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash) VALUES
		($1, 'OPERATOR', 'Handoff Recipient', $2, 'test-hash'),
		($3, 'CUSTOMER', 'Second Customer', $4, 'test-hash')`, recipientID, recipientID+"@quevo.local", secondCustomerID, secondCustomerID+"@quevo.local"); err != nil {
		t.Fatalf("insert concurrency fixture users: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id) VALUES ($1, $2)`, recipientID, database.DemoServiceID); err != nil {
		t.Fatalf("authorize handoff recipient: %v", err)
	}
	repo := NewRepository(gormDB)
	firstTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoCustomerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join first ticket: %v", err)
	}
	secondTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: secondCustomerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join second ticket: %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET joined_at = now() - interval '2 minutes' WHERE id = $1`, firstTicket.ID); err != nil {
		t.Fatalf("order first ticket: %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET joined_at = now() - interval '1 minute' WHERE id = $1`, secondTicket.ID); err != nil {
		t.Fatalf("order second ticket: %v", err)
	}
	if _, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("assign first ticket: found=%t err=%v", found, err)
	}

	type handoffResult struct{ err error }
	type callResult struct {
		ticket Ticket
		found  bool
		err    error
	}
	start := make(chan struct{})
	handoffResults := make(chan handoffResult, 1)
	callResults := make(chan callResult, 1)
	var group sync.WaitGroup
	group.Add(2)
	go func() {
		defer group.Done()
		<-start
		_, err := repo.HandoffTicket(ctx, database.DemoOperatorID, firstTicket.ID, recipientID)
		handoffResults <- handoffResult{err: err}
	}()
	go func() {
		defer group.Done()
		<-start
		ticket, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: recipientID, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID})
		callResults <- callResult{ticket: ticket, found: found, err: err}
	}()
	close(start)
	group.Wait()
	handoff := <-handoffResults
	call := <-callResults

	var firstAssignee string
	if err := db.QueryRowContext(ctx, `SELECT assigned_operator_id::text FROM tickets WHERE id = $1`, firstTicket.ID).Scan(&firstAssignee); err != nil {
		t.Fatal(err)
	}
	var recipientActiveCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM tickets WHERE assigned_operator_id = $1 AND status IN ('PENDING', 'OPERATING')`, recipientID).Scan(&recipientActiveCount); err != nil {
		t.Fatal(err)
	}
	if recipientActiveCount != 1 {
		t.Fatalf("recipient active tickets = %d, want exactly one", recipientActiveCount)
	}

	switch {
	case handoff.err == nil:
		if !errors.Is(call.err, ErrOperatorHasActiveTicket) || call.found || firstAssignee != recipientID {
			t.Fatalf("handoff/call result = handoff %v, call found=%t err=%v, first assignee=%s; want handoff win and call rejected", handoff.err, call.found, call.err, firstAssignee)
		}
	case errors.Is(handoff.err, ErrHandoffRecipientBusy):
		if call.err != nil || !call.found || call.ticket.ID != secondTicket.ID || firstAssignee != database.DemoOperatorID {
			t.Fatalf("handoff/call result = handoff %v, call found=%t err=%v ticket=%s first assignee=%s; want call win and handoff rejected", handoff.err, call.found, call.err, call.ticket.ID, firstAssignee)
		}
	default:
		t.Fatalf("handoff error = %v, want success or ErrHandoffRecipientBusy", handoff.err)
	}
}

func TestHandoffSerializesTwoTransfersToTheSameRecipient(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	firstOperatorID, secondOperatorID, recipientID := uuid.NewString(), uuid.NewString(), uuid.NewString()
	secondCustomerID := uuid.NewString()
	if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash) VALUES
		($1, 'OPERATOR', 'First Source', $2, 'test-hash'),
		($3, 'OPERATOR', 'Second Source', $4, 'test-hash'),
		($5, 'OPERATOR', 'Shared Recipient', $6, 'test-hash'),
		($7, 'CUSTOMER', 'Second Customer', $8, 'test-hash')`,
		firstOperatorID, firstOperatorID+"@quevo.local", secondOperatorID, secondOperatorID+"@quevo.local",
		recipientID, recipientID+"@quevo.local", secondCustomerID, secondCustomerID+"@quevo.local"); err != nil {
		t.Fatalf("insert concurrent handoff fixture users: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id) VALUES
		($1, $3), ($2, $3), ($4, $3)`, firstOperatorID, secondOperatorID, database.DemoServiceID, recipientID); err != nil {
		t.Fatalf("authorize concurrent handoff operators: %v", err)
	}
	repo := NewRepository(gormDB)
	firstTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoCustomerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join first ticket: %v", err)
	}
	secondTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: secondCustomerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join second ticket: %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET joined_at = now() - interval '2 minutes' WHERE id = $1`, firstTicket.ID); err != nil {
		t.Fatalf("order first ticket: %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET joined_at = now() - interval '1 minute' WHERE id = $1`, secondTicket.ID); err != nil {
		t.Fatalf("order second ticket: %v", err)
	}
	if _, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: firstOperatorID, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("assign first ticket: found=%t err=%v", found, err)
	}
	if _, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: secondOperatorID, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("assign second ticket: found=%t err=%v", found, err)
	}

	start := make(chan struct{})
	results := make(chan error, 2)
	var group sync.WaitGroup
	for _, transfer := range []struct{ operatorID, ticketID string }{
		{operatorID: firstOperatorID, ticketID: firstTicket.ID},
		{operatorID: secondOperatorID, ticketID: secondTicket.ID},
	} {
		group.Add(1)
		go func(operatorID, ticketID string) {
			defer group.Done()
			<-start
			_, err := repo.HandoffTicket(ctx, operatorID, ticketID, recipientID)
			results <- err
		}(transfer.operatorID, transfer.ticketID)
	}
	close(start)
	group.Wait()
	firstResult, secondResult := <-results, <-results
	var successCount, busyCount int
	for _, err := range []error{firstResult, secondResult} {
		switch {
		case err == nil:
			successCount++
		case errors.Is(err, ErrHandoffRecipientBusy):
			busyCount++
		default:
			t.Fatalf("concurrent handoff error = %v, want success or ErrHandoffRecipientBusy", err)
		}
	}
	if successCount != 1 || busyCount != 1 {
		t.Fatalf("concurrent handoffs = %d success, %d busy; want exactly one of each", successCount, busyCount)
	}
	var recipientActiveCount, handoffEvents int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM tickets WHERE assigned_operator_id = $1 AND status IN ('PENDING', 'OPERATING')`, recipientID).Scan(&recipientActiveCount); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM ticket_events WHERE ticket_id IN ($1, $2) AND event_type = 'HANDOFF'`, firstTicket.ID, secondTicket.ID).Scan(&handoffEvents); err != nil {
		t.Fatal(err)
	}
	if recipientActiveCount != 1 || handoffEvents != 1 {
		t.Fatalf("recipient active tickets = %d and handoff audit events = %d; want one each", recipientActiveCount, handoffEvents)
	}
}
