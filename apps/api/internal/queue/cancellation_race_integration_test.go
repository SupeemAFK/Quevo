//go:build integration

package queue

import (
	"database/sql"
	"errors"
	"sync"
	"testing"

	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/google/uuid"
)

// TestCustomerCancellationCallRacePostgres proves AC-12.2: when a customer cancels
// a WAITING ticket while an operator calls the same queue, exactly one of the two
// mutations can win. The losing operation must leave the ticket unchanged.
func TestCustomerCancellationCallRacePostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)
	customerID := uuid.NewString()
	if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash)
		VALUES ($1, 'CUSTOMER', 'Race Customer', $2, 'test-hash')`, customerID, customerID+"@quevo.local"); err != nil {
		t.Fatalf("insert race customer: %v", err)
	}

	cancelWins, callWins := 0, 0
	for attempt := 0; attempt < 10; attempt++ {
		waiting, err := repo.JoinQueue(ctx, JoinQueueInput{
			CustomerID: customerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID,
		})
		if err != nil {
			t.Fatalf("attempt %d join: %v", attempt, err)
		}

		var (
			start       = make(chan struct{})
			wg          sync.WaitGroup
			called      Ticket
			calledFound bool
			callErr     error
			cancelErr   error
		)
		wg.Add(2)
		go func() {
			defer wg.Done()
			<-start
			called, calledFound, callErr = repo.CallNext(ctx, CallNextInput{
				OperatorID: database.DemoOperatorID, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID,
			})
		}()
		go func() {
			defer wg.Done()
			<-start
			_, cancelErr = repo.CancelCustomerTicket(ctx, customerID, waiting.ID)
		}()
		close(start)
		wg.Wait()

		var status string
		var cancelledAt sql.NullTime
		if err := db.QueryRowContext(ctx, `SELECT status, cancelled_at FROM tickets WHERE id = $1`, waiting.ID).
			Scan(&status, &cancelledAt); err != nil {
			t.Fatalf("attempt %d read ticket: %v", attempt, err)
		}

		cancelWon := cancelErr == nil
		callWon := callErr == nil && calledFound
		if cancelWon == callWon {
			t.Fatalf("attempt %d: cancel err=%v, call found=%v err=%v; want exactly one successful mutation",
				attempt, cancelErr, calledFound, callErr)
		}

		if cancelWon {
			cancelWins++
			if calledFound || callErr != nil {
				t.Fatalf("attempt %d: cancel won but call returned found=%v err=%v; want no ticket called", attempt, calledFound, callErr)
			}
			if status != "CANCELLED" || !cancelledAt.Valid {
				t.Fatalf("attempt %d: cancelled ticket persisted as %s at %v; want CANCELLED with a timestamp", attempt, status, cancelledAt)
			}
			continue
		}

		if cancelErr != nil && !errors.Is(cancelErr, ErrInvalidTransition) {
			t.Fatalf("attempt %d: losing cancel error = %v; want invalid transition", attempt, cancelErr)
		}
		callWins++
		if called.ID != waiting.ID || called.Status != "PENDING" {
			t.Fatalf("attempt %d: called ticket = %#v; want the raced ticket in PENDING", attempt, called)
		}
		if status != "PENDING" || cancelledAt.Valid {
			t.Fatalf("attempt %d: called ticket persisted as %s at %v; want PENDING without a cancellation time", attempt, status, cancelledAt)
		}
		if _, err := repo.MarkNoShow(ctx, database.DemoOperatorID, waiting.ID); err != nil {
			t.Fatalf("attempt %d clear called ticket: %v", attempt, err)
		}
	}
	t.Logf("race outcomes: cancel won %d, call won %d", cancelWins, callWins)
}
