//go:build integration

package queue

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"sync"
	"testing"

	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/google/uuid"
)

// Issue #19 (F-013/FR-021). These tests verify no-show acceptance criteria that
// are not already covered in sprint2_expansion_integration_test.go. They add no
// production code; they exercise the implemented PENDING -> NO_SHOW transition
// on a real PostgreSQL database.

func insertVerificationUser(t *testing.T, db *sql.DB, role, name string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := db.Exec(`INSERT INTO users (id, role, display_name, email, password_hash) VALUES ($1, $2, $3, $4, 'test-hash')`,
		id, role, name, id+"@quevo.local"); err != nil {
		t.Fatalf("insert %s %s: %v", role, name, err)
	}
	return id
}

// callNextAssigned joins customerID and calls them next for operatorID, returning the PENDING ticket.
func callNextAssigned(t *testing.T, repo *Repository, ctx context.Context, operatorID, customerID string) Ticket {
	t.Helper()
	if _, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID}); err != nil {
		t.Fatalf("join queue: %v", err)
	}
	called, ok, err := repo.CallNext(ctx, CallNextInput{OperatorID: operatorID, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID})
	if err != nil || !ok {
		t.Fatalf("call next = found=%v err=%v", ok, err)
	}
	if called.Status != "PENDING" || called.AssignedOperatorID.String != operatorID {
		t.Fatalf("called ticket = %#v; want PENDING assigned to operator %s", called, operatorID)
	}
	return called
}

func TestNoShowPersistsNoShowAtAndActingOperatorPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)
	customer := insertVerificationUser(t, db, "CUSTOMER", "No-Show Customer")
	assigned := callNextAssigned(t, repo, ctx, database.DemoOperatorID, customer)

	noShow, err := repo.MarkNoShow(ctx, database.DemoOperatorID, assigned.ID)
	if err != nil || noShow.Status != "NO_SHOW" {
		t.Fatalf("no-show = %#v, err %v", noShow, err)
	}

	// Persistence + terminal invariants at the row level.
	var status string
	var calledAt, startedAt, completedAt, skippedAt, cancelledAt, noShowAt sql.NullTime
	var assignedOperator sql.NullString
	if err := db.QueryRowContext(ctx, `SELECT status, called_at, started_at, completed_at, skipped_at, cancelled_at, no_show_at, assigned_operator_id::text
		FROM tickets WHERE id = $1`, assigned.ID).
		Scan(&status, &calledAt, &startedAt, &completedAt, &skippedAt, &cancelledAt, &noShowAt, &assignedOperator); err != nil {
		t.Fatalf("read no-show ticket: %v", err)
	}
	if status != "NO_SHOW" || !noShowAt.Valid {
		t.Fatalf("persisted %s no_show_at=%v; want NO_SHOW with a timestamp", status, noShowAt)
	}
	if !calledAt.Valid || startedAt.Valid || completedAt.Valid || skippedAt.Valid || cancelledAt.Valid {
		t.Fatalf("lifecycle timestamps called=%v started=%v completed=%v skipped=%v cancelled=%v; want only called + no_show_at",
			calledAt, startedAt, completedAt, skippedAt, cancelledAt)
	}
	if assignedOperator.String != database.DemoOperatorID {
		t.Fatalf("assigned_operator_id = %v; want acting operator %s", assignedOperator, database.DemoOperatorID)
	}

	// Acting operator + transition recorded atomically in ticket_events.
	var fromStatus, toStatus string
	var actorID sql.NullString
	if err := db.QueryRowContext(ctx, `SELECT from_status, to_status, actor_id::text FROM ticket_events
		WHERE ticket_id = $1 ORDER BY occurred_at DESC, id DESC LIMIT 1`, assigned.ID).Scan(&fromStatus, &toStatus, &actorID); err != nil {
		t.Fatalf("read ticket event: %v", err)
	}
	if fromStatus != "PENDING" || toStatus != "NO_SHOW" || actorID.String != database.DemoOperatorID {
		t.Fatalf("event = %s -> %s actor=%v; want PENDING -> NO_SHOW actor=%s", fromStatus, toStatus, actorID, database.DemoOperatorID)
	}

	// Terminal: re-marking no-show is invalid and appends no further event.
	if _, err := repo.MarkNoShow(ctx, database.DemoOperatorID, assigned.ID); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("re-no-show = %v; want invalid transition", err)
	}
	var eventCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM ticket_events WHERE ticket_id = $1 AND to_status = 'NO_SHOW'`, assigned.ID).Scan(&eventCount); err != nil {
		t.Fatalf("count events: %v", err)
	}
	if eventCount != 1 {
		t.Fatalf("NO_SHOW events = %d; want exactly 1", eventCount)
	}
}

func TestNoShowWaitingTicketRejectedPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)

	// WAITING is not assigned and not PENDING: it cannot be marked no-show.
	waitingCustomer := insertVerificationUser(t, db, "CUSTOMER", "Waiting Customer")
	if _, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: waitingCustomer, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID}); err != nil {
		t.Fatalf("join waiting customer: %v", err)
	}
	var waitingID string
	if err := db.QueryRowContext(ctx, `SELECT id::text FROM tickets WHERE customer_id = $1 AND status = 'WAITING'`, waitingCustomer).Scan(&waitingID); err != nil {
		t.Fatalf("find waiting ticket: %v", err)
	}
	if _, err := repo.MarkNoShow(ctx, database.DemoOperatorID, waitingID); err == nil {
		t.Fatal("WAITING ticket was marked no-show; want rejection")
	} else if !errors.Is(err, ErrTicketNotFound) && !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("WAITING no-show = %v; want ticket-not-found or invalid transition", err)
	}
	var waitingStatus string
	if err := db.QueryRowContext(ctx, `SELECT status FROM tickets WHERE id = $1`, waitingID).Scan(&waitingStatus); err != nil || waitingStatus != "WAITING" {
		t.Fatalf("WAITING ticket after rejected no-show = %s err=%v", waitingStatus, err)
	}
}

func TestNoShowOperatingTicketRejectedPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)
	customer := insertVerificationUser(t, db, "CUSTOMER", "Operating Customer")
	assigned := callNextAssigned(t, repo, ctx, database.DemoOperatorID, customer)

	if _, err := repo.TransitionTicket(ctx, database.DemoOperatorID, assigned.ID, "start"); err != nil {
		t.Fatalf("start service: %v", err)
	}
	if _, err := repo.MarkNoShow(ctx, database.DemoOperatorID, assigned.ID); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("OPERATING no-show = %v; want invalid transition", err)
	}
	var status string
	if err := db.QueryRowContext(ctx, `SELECT status FROM tickets WHERE id = $1`, assigned.ID).Scan(&status); err != nil || status != "OPERATING" {
		t.Fatalf("OPERATING ticket after rejected no-show = %s err=%v", status, err)
	}
}

func TestNoShowRequiresAssignedAuthorizedOperatorPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)
	customer := insertVerificationUser(t, db, "CUSTOMER", "Assignment Customer")
	assigned := callNextAssigned(t, repo, ctx, database.DemoOperatorID, customer)

	otherOperator := insertVerificationUser(t, db, "OPERATOR", "Other Operator")
	// Wrong operator (not the assignee) cannot mark no-show.
	if _, err := repo.MarkNoShow(ctx, otherOperator, assigned.ID); !errors.Is(err, ErrTicketNotFound) {
		t.Fatalf("wrong-operator no-show = %v; want ticket-not-found", err)
	}
	// A non-existent ticket id is likewise rejected safely.
	if _, err := repo.MarkNoShow(ctx, database.DemoOperatorID, uuid.NewString()); !errors.Is(err, ErrTicketNotFound) {
		t.Fatalf("unknown ticket no-show = %v; want ticket-not-found", err)
	}

	// State unchanged by rejected attempts.
	var status string
	if err := db.QueryRowContext(ctx, `SELECT status FROM tickets WHERE id = $1`, assigned.ID).Scan(&status); err != nil || status != "PENDING" {
		t.Fatalf("ticket after rejected no-show = %s err=%v; want PENDING", status, err)
	}
	var noShowEvents int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM ticket_events WHERE ticket_id = $1 AND to_status = 'NO_SHOW'`, assigned.ID).Scan(&noShowEvents); err != nil || noShowEvents != 0 {
		t.Fatalf("NO_SHOW events after rejected attempts = %d err=%v; want 0", noShowEvents, err)
	}

	// The assigned operator can still succeed.
	if _, err := repo.MarkNoShow(ctx, database.DemoOperatorID, assigned.ID); err != nil {
		t.Fatalf("assigned operator no-show after rejected attempts: %v", err)
	}
}

func TestNoShowReleasesSlotAndAllowsRejoinPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)
	customer := insertVerificationUser(t, db, "CUSTOMER", "Rejoin Customer")
	second := insertVerificationUser(t, db, "CUSTOMER", "Next Customer")
	assigned := callNextAssigned(t, repo, ctx, database.DemoOperatorID, customer)
	noShowNumber := assigned.TicketNumber

	if _, err := repo.MarkNoShow(ctx, database.DemoOperatorID, assigned.ID); err != nil {
		t.Fatalf("no-show: %v", err)
	}

	// Operator's active slot is released: a second WAITING customer can be called.
	if _, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: second, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID}); err != nil {
		t.Fatalf("join second customer: %v", err)
	}
	next, ok, err := repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID})
	if err != nil || !ok || next.ID == assigned.ID {
		t.Fatalf("call-next after no-show = %#v ok=%v err=%v; want next WAITING ticket", next, ok, err)
	}

	// NO_SHOW ticket number is not reused; customer may rejoin as a NEW ticket.
	rejoined, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customer, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("rejoin after no-show: %v", err)
	}
	if rejoined.ID == assigned.ID {
		t.Fatal("rejoin reused the same ticket id")
	}
	if rejoined.Status != "WAITING" || rejoined.TicketNumber == noShowNumber {
		t.Fatalf("rejoined ticket = %#v; want WAITING with a fresh number (no-show number %s)", rejoined, noShowNumber)
	}
	if oldNum, err1 := strconv.Atoi(noShowNumber); err1 == nil {
		if newNum, err2 := strconv.Atoi(rejoined.TicketNumber); err2 == nil && newNum <= oldNum {
			t.Fatalf("rejoined number %d not after no-show number %d", newNum, oldNum)
		}
	}
}

func TestNoShowConcurrentActionsPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)

	t.Run("no-show vs no-show", func(t *testing.T) {
		for attempt := 0; attempt < 10; attempt++ {
			customer := insertVerificationUser(t, db, "CUSTOMER", "Concurrent No-Show")
			assigned := callNextAssigned(t, repo, ctx, database.DemoOperatorID, customer)

			var (
				start      = make(chan struct{})
				wg         sync.WaitGroup
				errA, errB error
			)
			wg.Add(2)
			go func() { defer wg.Done(); <-start; _, errA = repo.MarkNoShow(ctx, database.DemoOperatorID, assigned.ID) }()
			go func() { defer wg.Done(); <-start; _, errB = repo.MarkNoShow(ctx, database.DemoOperatorID, assigned.ID) }()
			close(start)
			wg.Wait()

			successes := 0
			for _, err := range []error{errA, errB} {
				if err == nil {
					successes++
				} else if !errors.Is(err, ErrInvalidTransition) {
					t.Fatalf("attempt %d losing concurrent no-show error = %v; want invalid transition", attempt, err)
				}
			}
			if successes != 1 {
				t.Fatalf("attempt %d: %d concurrent no-show calls succeeded; want exactly 1 (errA=%v errB=%v)", attempt, successes, errA, errB)
			}
			var noShowEvents int
			if err := db.QueryRowContext(ctx, `SELECT count(*) FROM ticket_events WHERE ticket_id = $1 AND to_status = 'NO_SHOW'`, assigned.ID).Scan(&noShowEvents); err != nil || noShowEvents != 1 {
				t.Fatalf("attempt %d: NO_SHOW events = %d err=%v; want exactly 1", attempt, noShowEvents, err)
			}
		}
	})

	t.Run("no-show vs start", func(t *testing.T) {
		for attempt := 0; attempt < 10; attempt++ {
			customer := insertVerificationUser(t, db, "CUSTOMER", "Concurrent Start")
			assigned := callNextAssigned(t, repo, ctx, database.DemoOperatorID, customer)

			var (
				start     = make(chan struct{})
				wg        sync.WaitGroup
				noShowErr error
				startErr  error
			)
			wg.Add(2)
			go func() {
				defer wg.Done()
				<-start
				_, noShowErr = repo.MarkNoShow(ctx, database.DemoOperatorID, assigned.ID)
			}()
			go func() {
				defer wg.Done()
				<-start
				_, startErr = repo.TransitionTicket(ctx, database.DemoOperatorID, assigned.ID, "start")
			}()
			close(start)
			wg.Wait()

			noShowWon := noShowErr == nil
			startWon := startErr == nil
			if noShowWon == startWon {
				t.Fatalf("attempt %d: noShowErr=%v startErr=%v; want exactly one successful mutation", attempt, noShowErr, startErr)
			}
			if !noShowWon && !errors.Is(noShowErr, ErrInvalidTransition) {
				t.Fatalf("attempt %d: losing no-show error = %v; want invalid transition", attempt, noShowErr)
			}
			if !startWon && !errors.Is(startErr, ErrInvalidTransition) {
				t.Fatalf("attempt %d: losing start error = %v; want invalid transition", attempt, startErr)
			}

			var (
				status              string
				noShowAt, startedAt sql.NullTime
			)
			if err := db.QueryRowContext(ctx, `SELECT status, no_show_at, started_at FROM tickets WHERE id = $1`, assigned.ID).Scan(&status, &noShowAt, &startedAt); err != nil {
				t.Fatalf("attempt %d read ticket: %v", attempt, err)
			}
			if noShowWon {
				if status != "NO_SHOW" || !noShowAt.Valid || startedAt.Valid {
					t.Fatalf("attempt %d: no-show won but persisted %s no_show_at=%v started_at=%v", attempt, status, noShowAt, startedAt)
				}
			} else {
				if status != "OPERATING" || noShowAt.Valid || !startedAt.Valid {
					t.Fatalf("attempt %d: start won but persisted %s no_show_at=%v started_at=%v", attempt, status, noShowAt, startedAt)
				}
				// Free the operator's active slot for the next iteration.
				if _, err := repo.TransitionTicket(ctx, database.DemoOperatorID, assigned.ID, "complete"); err != nil {
					t.Fatalf("attempt %d clear operating ticket: %v", attempt, err)
				}
			}
		}
	})
}
