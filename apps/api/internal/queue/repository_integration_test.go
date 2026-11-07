//go:build integration

package queue

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/google/uuid"
)

func TestQueueRepositoryPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)
	date := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)

	customer2, customer3, customer4, customer5 := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	operator2, operator3, operator4, operator5 := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	for _, user := range []struct{ id, role, name string }{
		{customer2, "CUSTOMER", "Second Customer"}, {customer3, "CUSTOMER", "Third Customer"},
		{customer4, "CUSTOMER", "Fourth Customer"}, {customer5, "CUSTOMER", "Fifth Customer"},
		{operator2, "OPERATOR", "Second Operator"}, {operator3, "OPERATOR", "Third Operator"},
		{operator4, "OPERATOR", "Fourth Operator"}, {operator5, "OPERATOR", "Fifth Operator"},
	} {
		if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash)
			VALUES ($1, $2, $3, $4, 'test-hash')`, user.id, user.role, user.name, user.id+"@quevo.local"); err != nil {
			t.Fatalf("insert test user: %v", err)
		}
	}
	for _, operator := range []string{operator2, operator3, operator4, operator5} {
		if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id) VALUES ($1, $2)`, operator, database.DemoServiceID); err != nil {
			t.Fatalf("authorize test operator: %v", err)
		}
	}
	if _, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoOperatorID, ServiceID: database.DemoServiceID, BusinessDate: date}); !errors.Is(err, ErrQueueUnauthorized) {
		t.Fatalf("operator join error = %v; want ErrQueueUnauthorized", err)
	}
	if _, _, err := repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoCustomerID, ServiceID: database.DemoServiceID, BusinessDate: date}); !errors.Is(err, ErrQueueUnauthorized) {
		t.Fatalf("customer call-next error = %v; want ErrQueueUnauthorized", err)
	}

	first, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoCustomerID, ServiceID: database.DemoServiceID, BusinessDate: date})
	if err != nil || first.TicketNumber != "1" || first.Status != "WAITING" {
		t.Fatalf("first join = %#v, err %v", first, err)
	}
	if _, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoCustomerID, ServiceID: database.DemoServiceID, BusinessDate: date}); !errors.Is(err, ErrActiveTicket) {
		t.Fatalf("duplicate join error = %v; want ErrActiveTicket", err)
	}
	second, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customer2, ServiceID: database.DemoServiceID, BusinessDate: date})
	if err != nil || second.TicketNumber != "2" {
		t.Fatalf("second join = %#v, err %v; want ticket 2 (duplicate must not consume sequence)", second, err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET joined_at = now() - interval '1 minute' WHERE id = $1`, second.ID); err != nil {
		t.Fatalf("set FIFO fixture time: %v", err)
	}

	rollbackDate := date.AddDate(0, 0, 1)
	if _, err := db.ExecContext(ctx, `INSERT INTO queue_sequences (branch_id, service_id, business_date, last_issued)
		VALUES ($1, $2, $3, 42)`, database.DemoBranchID, database.DemoServiceID, rollbackDate); err != nil {
		t.Fatalf("prepare rollback queue sequence: %v", err)
	}
	assertJoinRollsBackSequence(t, ctx, db, repo, rollbackDate, customer5)
	assertCallNextRollsBackAssignment(t, ctx, db, repo, rollbackDate, operator5)

	called, ok, err := repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, ServiceID: database.DemoServiceID, BusinessDate: date})
	if err != nil || !ok || called.ID != second.ID || called.Status != "PENDING" || !called.CalledAt.Valid {
		t.Fatalf("call-next = %#v, ok %v, err %v; want oldest ticket %s in PENDING", called, ok, err, second.ID)
	}
	if _, _, err := repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, ServiceID: database.DemoServiceID, BusinessDate: date}); !errors.Is(err, ErrOperatorHasActiveTicket) {
		t.Fatalf("second active ticket error = %v; want ErrOperatorHasActiveTicket", err)
	}
	claimed, ok, err := repo.CallNext(ctx, CallNextInput{OperatorID: operator2, ServiceID: database.DemoServiceID, BusinessDate: date})
	if err != nil || !ok || claimed.ID != first.ID {
		t.Fatalf("second operator call-next = %#v, ok %v, err %v; want remaining ticket %s", claimed, ok, err, first.ID)
	}

	// Concurrent joins of different customers share one locked sequence row.
	type joinResult struct {
		ticket Ticket
		err    error
	}
	joinResults := make(chan joinResult, 2)
	for _, customer := range []string{customer3, customer4} {
		go func(customer string) {
			ticket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customer, ServiceID: database.DemoServiceID, BusinessDate: date})
			joinResults <- joinResult{ticket: ticket, err: err}
		}(customer)
	}
	joined := make(map[string]string)
	var concurrentTicketIDs []string
	for range 2 {
		result := <-joinResults
		if result.err != nil {
			t.Fatalf("concurrent join: %v", result.err)
		}
		joined[result.ticket.TicketNumber] = result.ticket.ID
		concurrentTicketIDs = append(concurrentTicketIDs, result.ticket.ID)
	}
	if len(joined) != 2 || joined["3"] == "" || joined["4"] == "" {
		t.Fatalf("concurrent queue numbers = %v; want distinct 3 and 4", joined)
	}

	// Two operators calling concurrently must claim different tickets.
	type callResult struct {
		ticket Ticket
		ok     bool
		err    error
	}
	callResults := make(chan callResult, 2)
	start := make(chan struct{})
	for _, operator := range []string{operator3, operator4} {
		go func(operator string) {
			<-start
			ticket, ok, err := repo.CallNext(ctx, CallNextInput{OperatorID: operator, ServiceID: database.DemoServiceID, BusinessDate: date})
			callResults <- callResult{ticket: ticket, ok: ok, err: err}
		}(operator)
	}
	close(start)
	claimedIDs := make(map[string]bool)
	for range 2 {
		result := <-callResults
		if result.err != nil || !result.ok {
			t.Fatalf("concurrent call-next = %#v, ok %v, err %v", result.ticket, result.ok, result.err)
		}
		claimedIDs[result.ticket.ID] = true
	}
	if len(claimedIDs) != 2 || !claimedIDs[concurrentTicketIDs[0]] || !claimedIDs[concurrentTicketIDs[1]] {
		t.Fatalf("concurrent call-next claimed %v; want both distinct newly joined tickets", claimedIDs)
	}
	// Direct writes prove the partial unique indexes remain the final guard if a
	// future caller bypasses the repository transaction helpers.
	_, err = db.ExecContext(ctx, `INSERT INTO tickets
		(id, branch_id, service_id, business_date, ticket_number, customer_id, status)
		VALUES ($1, $2, $3, $4, '999', $5, 'WAITING')`, uuid.NewString(), database.DemoBranchID, database.DemoServiceID, date, database.DemoCustomerID)
	if err == nil {
		t.Fatal("database accepted a duplicate active customer ticket")
	}
	_, err = db.ExecContext(ctx, `INSERT INTO tickets
		(id, branch_id, service_id, business_date, ticket_number, customer_id, assigned_operator_id, status, called_at)
		VALUES ($1, $2, $3, $4, '998', $5, $6, 'PENDING', now())`, uuid.NewString(), database.DemoBranchID, database.DemoServiceID, date, customer5, database.DemoOperatorID)
	if err == nil {
		t.Fatal("database accepted a second active ticket for one operator")
	}

	var uniqueNumbers int
	if err := db.QueryRowContext(ctx, `SELECT count(DISTINCT ticket_number) FROM tickets WHERE business_date = $1`, date).Scan(&uniqueNumbers); err != nil || uniqueNumbers != 4 {
		t.Fatalf("ticket number count = %d, err %v; want 4", uniqueNumbers, err)
	}
}

func assertJoinRollsBackSequence(t *testing.T, ctx context.Context, db *sql.DB, repo *Repository, date time.Time, customerID string) {
	t.Helper()
	if _, err := db.ExecContext(ctx, `ALTER TABLE tickets ADD CONSTRAINT reject_test_ticket_43 CHECK (ticket_number <> '43')`); err != nil {
		t.Fatalf("add ticket rejection constraint: %v", err)
	}
	_, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customerID, ServiceID: database.DemoServiceID, BusinessDate: date})
	if err == nil {
		t.Fatal("join succeeded despite the test ticket constraint")
	}
	var lastIssued int64
	if err := db.QueryRowContext(ctx, `SELECT last_issued FROM queue_sequences WHERE branch_id = $1 AND service_id = $2 AND business_date = $3`, database.DemoBranchID, database.DemoServiceID, date).Scan(&lastIssued); err != nil || lastIssued != 42 {
		t.Fatalf("queue sequence after failed join = %d, err %v; want 42", lastIssued, err)
	}
	var ticketCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM tickets WHERE customer_id = $1 AND business_date = $2`, customerID, date).Scan(&ticketCount); err != nil || ticketCount != 0 {
		t.Fatalf("tickets after failed join = %d, err %v; want 0", ticketCount, err)
	}
	if _, err := db.ExecContext(ctx, `ALTER TABLE tickets DROP CONSTRAINT reject_test_ticket_43`); err != nil {
		t.Fatalf("remove ticket rejection constraint: %v", err)
	}
	ticket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customerID, ServiceID: database.DemoServiceID, BusinessDate: date})
	if err != nil || ticket.TicketNumber != "43" {
		t.Fatalf("join after rollback = %#v, err %v; want ticket 43", ticket, err)
	}
}

func assertCallNextRollsBackAssignment(t *testing.T, ctx context.Context, db *sql.DB, repo *Repository, date time.Time, operatorID string) {
	t.Helper()
	if _, err := db.ExecContext(ctx, `ALTER TABLE tickets ADD CONSTRAINT reject_test_pending_43 CHECK (status <> 'PENDING' OR ticket_number <> '43')`); err != nil {
		t.Fatalf("add assignment rejection constraint: %v", err)
	}
	_, ok, err := repo.CallNext(ctx, CallNextInput{OperatorID: operatorID, ServiceID: database.DemoServiceID, BusinessDate: date})
	if err == nil || ok {
		t.Fatalf("call-next under rejection constraint = ok %v, err %v; want rollback error", ok, err)
	}
	var status string
	var assignedOperatorID sql.NullString
	var calledAt sql.NullTime
	if err := db.QueryRowContext(ctx, `SELECT status, assigned_operator_id::text, called_at FROM tickets WHERE ticket_number = '43' AND business_date = $1`, date).Scan(&status, &assignedOperatorID, &calledAt); err != nil {
		t.Fatalf("read ticket after failed call-next: %v", err)
	}
	if status != "WAITING" || assignedOperatorID.Valid || calledAt.Valid {
		t.Fatalf("ticket after failed call-next = status %q, operator %v, calledAt %v; want unchanged WAITING ticket", status, assignedOperatorID, calledAt)
	}
	if _, err := db.ExecContext(ctx, `ALTER TABLE tickets DROP CONSTRAINT reject_test_pending_43`); err != nil {
		t.Fatalf("remove assignment rejection constraint: %v", err)
	}
	ticket, ok, err := repo.CallNext(ctx, CallNextInput{OperatorID: operatorID, ServiceID: database.DemoServiceID, BusinessDate: date})
	if err != nil || !ok || ticket.Status != "PENDING" || ticket.TicketNumber != "43" {
		t.Fatalf("call-next after rollback = %#v, ok %v, err %v; want ticket 43 in PENDING", ticket, ok, err)
	}
}
