//go:build integration

package queue

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/google/uuid"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
)

func TestSprint1MigrationsSeedAndQueueTransactions(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	container, err := postgres.Run(ctx, "postgres:17-alpine",
		postgres.WithDatabase("quevo_test"), postgres.WithUsername("quevo"),
		postgres.WithPassword("quevo-test"), postgres.BasicWaitStrategies())
	if err != nil {
		t.Fatalf("start PostgreSQL: %v", err)
	}
	t.Cleanup(func() {
		if err := testcontainers.TerminateContainer(container); err != nil {
			t.Errorf("stop PostgreSQL: %v", err)
		}
	})
	url, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("get PostgreSQL URL: %v", err)
	}
	gormDB, err := database.Open(url, database.PoolConfig{MaxIdleConns: 2, MaxOpenConns: 10, ConnMaxLifetime: time.Minute})
	if err != nil {
		t.Fatalf("open PostgreSQL: %v", err)
	}
	db, err := gormDB.DB()
	if err != nil {
		t.Fatalf("get PostgreSQL pool: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := db.PingContext(ctx); err != nil {
		t.Fatalf("ping PostgreSQL: %v", err)
	}

	if err := database.Migrate(ctx, gormDB); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	if err := database.Migrate(ctx, gormDB); err != nil {
		t.Fatalf("repeat migrations: %v", err)
	}
	var migrationCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM schema_migrations`).Scan(&migrationCount); err != nil || migrationCount != 1 {
		t.Fatalf("migration ledger count = %d, err %v; want 1", migrationCount, err)
	}
	seed := database.SeedCredentials{CustomerHash: "test-customer-hash", OperatorHash: "test-operator-hash"}
	if err := database.SeedDemo(ctx, gormDB, seed); err != nil {
		t.Fatalf("seed demo: %v", err)
	}
	if err := database.SeedDemo(ctx, gormDB, seed); err != nil {
		t.Fatalf("repeat demo seed: %v", err)
	}
	for table, want := range map[string]int{"branches": 1, "services": 1, "app_users": 2, "operator_services": 1} {
		var count int
		if err := db.QueryRowContext(ctx, `SELECT count(*) FROM `+table).Scan(&count); err != nil || count != want {
			t.Errorf("%s count = %d, err %v; want %d", table, count, err, want)
		}
	}

	customer2, customer3, customer4, customer5 := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	operator2, operator3, operator4 := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for _, user := range []struct{ id, role, name string }{
		{customer2, "CUSTOMER", "Second Customer"}, {customer3, "CUSTOMER", "Third Customer"},
		{customer4, "CUSTOMER", "Fourth Customer"}, {customer5, "CUSTOMER", "Fifth Customer"},
		{operator2, "OPERATOR", "Second Operator"}, {operator3, "OPERATOR", "Third Operator"},
		{operator4, "OPERATOR", "Fourth Operator"},
	} {
		if _, err := db.ExecContext(ctx, `INSERT INTO app_users (id, role, display_name, login_identifier, credential_hash)
			VALUES ($1, $2, $3, $4, 'test-hash')`, user.id, user.role, user.name, user.id+"@quevo.local"); err != nil {
			t.Fatalf("insert test user: %v", err)
		}
	}
	for _, operator := range []string{operator2, operator3, operator4} {
		if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id) VALUES ($1, $2)`, operator, database.DemoServiceID); err != nil {
			t.Fatalf("authorize test operator: %v", err)
		}
	}
	repo := NewRepository(gormDB)
	date := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)
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
	var start sync.WaitGroup
	start.Add(1)
	for _, operator := range []string{operator3, operator4} {
		go func(operator string) {
			start.Wait()
			ticket, ok, err := repo.CallNext(ctx, CallNextInput{OperatorID: operator, ServiceID: database.DemoServiceID, BusinessDate: date})
			callResults <- callResult{ticket: ticket, ok: ok, err: err}
		}(operator)
	}
	start.Done()
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
