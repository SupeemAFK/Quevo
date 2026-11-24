//go:build integration

package queue

import (
	"errors"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/google/uuid"
)

func TestSprint2QueueExpansionPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	repo := NewRepository(gormDB)
	managerID, customer2, customer3 := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for _, user := range []struct{ id, role, name string }{
		{managerID, "BRANCH_MANAGER", "Demo Manager"},
		{customer2, "CUSTOMER", "Second Customer"},
		{customer3, "CUSTOMER", "Third Customer"},
	} {
		if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash) VALUES ($1, $2, $3, $4, 'test-hash')`, user.id, user.role, user.name, user.id+"@quevo.local"); err != nil {
			t.Fatalf("insert %s: %v", user.role, err)
		}
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO branch_managers (branch_id, manager_id) VALUES ($1, $2)`, database.DemoBranchID, managerID); err != nil {
		t.Fatal(err)
	}

	branches, err := repo.ListManagedBranches(ctx, managerID)
	if err != nil || len(branches) != 1 || branches[0].ID != database.DemoBranchID {
		t.Fatalf("managed branches = %#v, err %v", branches, err)
	}
	catalog, err := repo.GetManagerCatalog(ctx, managerID, database.DemoBranchID)
	if err != nil || len(catalog.Services) != 6 || len(catalog.Counters) != 1 {
		t.Fatalf("catalog = %#v, err %v", catalog, err)
	}
	if _, err := repo.CreateService(ctx, database.DemoOperatorID, database.DemoBranchID, "Unauthorized"); !errors.Is(err, ErrManagerForbidden) {
		t.Fatalf("operator service management error = %v; want forbidden", err)
	}
	if _, err := repo.CreateService(ctx, managerID, database.DemoBranchID, "Account Opening"); err == nil {
		t.Fatal("duplicate service name was accepted")
	}

	accountService := "10000000-0000-4000-8000-000000000010"
	accountQueue := accountService
	account, err := repo.JoinQueue(ctx, JoinQueueInput{
		CustomerID: database.DemoCustomerID, BranchID: database.DemoBranchID,
		ServiceID: accountService, QueueID: accountQueue,
		RequestAnswers: map[string]string{
			"10000000-0000-4000-8000-000000000020": "Everyday account",
			"10000000-0000-4000-8000-000000000025": "Individual",
			"10000000-0000-4000-8000-000000000026": "I would like to discuss the savings options.",
		},
	})
	if err != nil || account.RequestLabels["10000000-0000-4000-8000-000000000020"] != "Which account are you interested in?" {
		t.Fatalf("account-opening join = %#v, err %v", account, err)
	}
	if _, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customer2, BranchID: database.DemoBranchID, QueueID: accountQueue, ServiceID: accountService, RequestAnswers: map[string]string{"10000000-0000-4000-8000-000000000020": "Unknown account"}}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid service option error = %v; want ErrInvalidInput", err)
	}

	called, ok, err := repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, BranchID: database.DemoBranchID, QueueID: accountQueue})
	if err != nil || !ok || called.ID != account.ID {
		t.Fatalf("call account ticket = %#v, found %v, err %v", called, ok, err)
	}
	if _, err := repo.TransitionTicket(ctx, database.DemoOperatorID, account.ID, "start"); !errors.Is(err, ErrRequiredDocumentsMissing) {
		t.Fatalf("start without documents = %v; want ErrRequiredDocumentsMissing", err)
	}
	preStartHistory, err := repo.TicketHistory(ctx, database.DemoOperatorID, "OPERATOR", account.ID, 10, 0)
	if err != nil || preStartHistory.Total != 2 {
		t.Fatalf("history after blocked start = %#v, err %v; want only join and call events", preStartHistory, err)
	}
	pdf := []byte("%PDF-1.4\nQuevo prototype test document\n%%EOF")
	if _, err := repo.SaveTicketDocument(ctx, database.DemoCustomerID, account.ID, "proof.pdf", "application/pdf", pdf); err != nil {
		t.Fatalf("save ticket document: %v", err)
	}
	if _, err := repo.ListTicketDocuments(ctx, customer2, "CUSTOMER", account.ID); !errors.Is(err, ErrQueueUnauthorized) {
		t.Fatalf("other customer's document access = %v; want authorization failure", err)
	}
	if _, err := repo.TransitionTicket(ctx, database.DemoOperatorID, account.ID, "start"); err != nil {
		t.Fatalf("start with required document: %v", err)
	}
	if _, err := repo.TransitionTicket(ctx, database.DemoOperatorID, account.ID, "complete"); err != nil {
		t.Fatalf("complete account service: %v", err)
	}
	if _, err := repo.MarkNoShow(ctx, database.DemoOperatorID, account.ID); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("mark completed ticket no-show = %v; want invalid transition", err)
	}
	history, err := repo.TicketHistory(ctx, database.DemoOperatorID, "OPERATOR", account.ID, 2, 0)
	if err != nil || history.Total != 4 || len(history.Items) != 2 {
		t.Fatalf("ticket history page = %#v, err %v; want first two of four recorded states", history, err)
	}
	secondHistoryPage, err := repo.TicketHistory(ctx, database.DemoOperatorID, "OPERATOR", account.ID, 2, 2)
	if err != nil || len(secondHistoryPage.Items) != 2 || !secondHistoryPage.Items[0].OccurredAt.After(history.Items[1].OccurredAt) {
		t.Fatalf("second ticket history page = %#v, err %v; want subsequent chronological events", secondHistoryPage, err)
	}

	cancelled, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customer2, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatal(err)
	}
	cancelled, err = repo.CancelCustomerTicket(ctx, customer2, cancelled.ID)
	if err != nil || cancelled.Status != "CANCELLED" {
		t.Fatalf("cancelled ticket = %#v, err %v", cancelled, err)
	}
	if _, err := repo.CancelCustomerTicket(ctx, customer2, account.ID); !errors.Is(err, ErrTicketNotFound) {
		t.Fatalf("another customer's cancellation = %v; want ticket not found", err)
	}
	rejoined, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customer2, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil || rejoined.ID == cancelled.ID {
		t.Fatalf("customer rejoin after cancellation = %#v, err %v", rejoined, err)
	}
	if _, err := repo.CancelCustomerTicket(ctx, customer2, rejoined.ID); err != nil {
		t.Fatalf("cancel rejoined ticket: %v", err)
	}

	noShow, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: customer3, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.MarkNoShow(ctx, database.DemoOperatorID, noShow.ID); !errors.Is(err, ErrTicketNotFound) {
		t.Fatalf("mark waiting ticket no-show = %v; want unavailable ticket", err)
	}
	called, ok, err = repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID})
	if err != nil || !ok || called.ID != noShow.ID {
		t.Fatalf("call next general ticket = %#v, found %v, err %v", called, ok, err)
	}
	noShow, err = repo.MarkNoShow(ctx, database.DemoOperatorID, noShow.ID)
	if err != nil || noShow.Status != "NO_SHOW" {
		t.Fatalf("no-show ticket = %#v, err %v", noShow, err)
	}
	detail, err := repo.GetOperatorQueue(ctx, database.DemoOperatorID, database.DemoBranchID, database.DemoServiceID)
	if err != nil || len(detail.Recent) != 3 || detail.Recent[0].Status != "NO_SHOW" {
		t.Fatalf("recent terminal tickets = %#v, err %v", detail.Recent, err)
	}

	from := time.Now().UTC().Truncate(24 * time.Hour)
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET joined_at = $1, called_at = $2, started_at = $3, completed_at = $4 WHERE id = $5`,
		from.Add(time.Hour), from.Add(time.Hour+5*time.Minute), from.Add(time.Hour+10*time.Minute), from.Add(time.Hour+12*time.Minute), account.ID); err != nil {
		t.Fatalf("set deterministic duration timestamps: %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET cancelled_at = $1 WHERE id = $2`, from.Add(24*time.Hour), rejoined.ID); err != nil {
		t.Fatalf("set upper-bound cancellation timestamp: %v", err)
	}
	to := from.AddDate(0, 0, 1)
	generalSummary, err := repo.ServiceSummary(ctx, managerID, database.DemoBranchID, database.DemoServiceID, from, to)
	if err != nil || generalSummary.Cancelled != 1 || generalSummary.NoShow != 1 {
		t.Fatalf("general service summary = %#v, err %v", generalSummary, err)
	}
	accountSummary, err := repo.ServiceSummary(ctx, managerID, database.DemoBranchID, accountService, from, to)
	if err != nil || accountSummary.Completed != 1 || accountSummary.AverageWaitSeconds == nil || *accountSummary.AverageWaitSeconds != 300 || accountSummary.AverageServiceSeconds == nil || *accountSummary.AverageServiceSeconds != 120 {
		t.Fatalf("account service summary = %#v, err %v", accountSummary, err)
	}
}
