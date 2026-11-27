//go:build integration

package queue

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/auth"
	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestOperatorTicketHandoffWithPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("local-demo-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE users SET password_hash = $1 WHERE id IN ($2, $3)`, passwordHash, database.DemoCustomerID, database.DemoOperatorID); err != nil {
		t.Fatal(err)
	}

	recipientA, recipientB, busyOperator, wrongServiceOperator := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	otherCustomerA, otherCustomerB := uuid.NewString(), uuid.NewString()
	raceCustomerA, raceCustomerB := uuid.NewString(), uuid.NewString()
	otherService := uuid.NewString()
	users := []struct{ id, role, name, email string }{
		{recipientA, "OPERATOR", "Recipient A", "recipient-a@quevo.local"},
		{recipientB, "OPERATOR", "Recipient B", "recipient-b@quevo.local"},
		{busyOperator, "OPERATOR", "Busy Operator", "busy-operator@quevo.local"},
		{wrongServiceOperator, "OPERATOR", "Other Service Operator", "other-service-operator@quevo.local"},
		{otherCustomerA, "CUSTOMER", "Other Customer A", "other-customer-a@quevo.local"},
		{otherCustomerB, "CUSTOMER", "Other Customer B", "other-customer-b@quevo.local"},
		{raceCustomerA, "CUSTOMER", "Race Customer A", "race-customer-a@quevo.local"},
		{raceCustomerB, "CUSTOMER", "Race Customer B", "race-customer-b@quevo.local"},
	}
	for _, user := range users {
		if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash)
			VALUES ($1, $2, $3, $4, $5)`, user.id, user.role, user.name, user.email, passwordHash); err != nil {
			t.Fatalf("insert %s: %v", user.name, err)
		}
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO services (id, branch_id, name, active)
		VALUES ($1, $2, 'Other Service', true)`, otherService, database.DemoBranchID); err != nil {
		t.Fatal(err)
	}
	for _, assignment := range []struct{ operator, service string }{
		{recipientA, database.DemoServiceID}, {recipientB, database.DemoServiceID},
		{busyOperator, database.DemoServiceID}, {wrongServiceOperator, otherService},
	} {
		if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id) VALUES ($1, $2)`, assignment.operator, assignment.service); err != nil {
			t.Fatalf("authorize operator %s: %v", assignment.operator, err)
		}
	}

	repo := NewRepository(gormDB)
	busyTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: otherCustomerA, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join busy operator ticket: %v", err)
	}
	if _, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: busyOperator, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("assign busy operator ticket: found %v, err %v", found, err)
	}
	firstTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoCustomerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join handoff ticket: %v", err)
	}
	if _, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("assign handoff ticket: found %v, err %v", found, err)
	}

	secondTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: otherCustomerB, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join second handoff ticket: %v", err)
	}

	authService := auth.NewService(auth.NewGORMRepository(gormDB), time.Hour)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	api := router.Group("/api/v1")
	auth.RegisterRoutes(api, authService)
	RegisterRoutes(api, authService, repo)
	operator := loginQueueAPIUser(t, router, "operator@quevo.local")
	recipient := loginQueueAPIUser(t, router, "recipient-a@quevo.local")
	customer := loginQueueAPIUser(t, router, "customer@quevo.local")
	optionsPath := "/api/v1/operator/tickets/" + firstTicket.ID + "/handoff-options"
	handoffPath := "/api/v1/operator/tickets/" + firstTicket.ID + "/handoff"

	options := queueAPIRequest(router, http.MethodGet, optionsPath, nil, operator)
	if options.Code != http.StatusOK {
		t.Fatalf("handoff options = %d %s", options.Code, options.Body.String())
	}
	var optionsBody HandoffCandidatesResponse
	if err := json.Unmarshal(options.Body.Bytes(), &optionsBody); err != nil {
		t.Fatalf("decode handoff options: %v", err)
	}
	candidateIDs := make(map[string]bool, len(optionsBody.Items))
	for _, candidate := range optionsBody.Items {
		candidateIDs[candidate.ID] = true
	}
	if len(candidateIDs) != 2 || !candidateIDs[recipientA] || !candidateIDs[recipientB] || candidateIDs[busyOperator] || candidateIDs[wrongServiceOperator] {
		t.Fatalf("handoff candidates = %#v; want only both authorized idle operators", optionsBody.Items)
	}

	for _, test := range []struct {
		name, token, target string
		want                int
	}{
		{"busy recipient", operator, busyOperator, http.StatusConflict},
		{"wrong-service recipient", operator, wrongServiceOperator, http.StatusConflict},
		{"self handoff", operator, database.DemoOperatorID, http.StatusConflict},
		{"not assigned", recipient, recipientA, http.StatusNotFound},
		{"customer role", customer, recipientA, http.StatusForbidden},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := queueAPIRequest(router, http.MethodPost, handoffPath, map[string]string{"recipientOperatorId": test.target}, test.token)
			if response.Code != test.want {
				t.Fatalf("status = %d, want %d: %s", response.Code, test.want, response.Body.String())
			}
		})
	}

	var beforeCalledAt sql.NullString
	if err := db.QueryRowContext(ctx, `SELECT called_at::text FROM tickets WHERE id = $1`, firstTicket.ID).Scan(&beforeCalledAt); err != nil {
		t.Fatal(err)
	}
	transferred := queueAPIRequest(router, http.MethodPost, handoffPath, map[string]string{"recipientOperatorId": recipientA}, operator)
	if transferred.Code != http.StatusOK {
		t.Fatalf("handoff = %d %s", transferred.Code, transferred.Body.String())
	}
	var handoffBody OperatorHandoffResponse
	if err := json.Unmarshal(transferred.Body.Bytes(), &handoffBody); err != nil {
		t.Fatalf("decode handoff response: %v", err)
	}
	if handoffBody.ID != firstTicket.ID || handoffBody.Status != "PENDING" || handoffBody.RecipientOperatorID != recipientA || handoffBody.TransferredAt.IsZero() {
		t.Fatalf("handoff response = %#v", handoffBody)
	}
	assertHandoffState(t, ctx, db, firstTicket.ID, "PENDING", recipientA, beforeCalledAt.String, "")
	if response := queueAPIRequest(router, http.MethodPost, "/api/v1/operator/tickets/"+firstTicket.ID+"/start", nil, operator); response.Code != http.StatusNotFound {
		t.Fatalf("previous operator start = %d %s; want not found", response.Code, response.Body.String())
	}
	if response := queueAPIRequest(router, http.MethodPost, "/api/v1/operator/tickets/"+firstTicket.ID+"/start", nil, recipient); response.Code != http.StatusOK {
		t.Fatalf("recipient start = %d %s", response.Code, response.Body.String())
	}
	var beforeStartedAt sql.NullString
	if err := db.QueryRowContext(ctx, `SELECT started_at::text FROM tickets WHERE id = $1`, firstTicket.ID).Scan(&beforeStartedAt); err != nil {
		t.Fatal(err)
	}
	retransferred := queueAPIRequest(router, http.MethodPost, handoffPath, map[string]string{"recipientOperatorId": recipientB}, recipient)
	if retransferred.Code != http.StatusOK {
		t.Fatalf("handoff operating ticket = %d %s", retransferred.Code, retransferred.Body.String())
	}
	assertHandoffState(t, ctx, db, firstTicket.ID, "OPERATING", recipientB, beforeCalledAt.String, beforeStartedAt.String)
	var auditCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM ticket_handoffs WHERE ticket_id = $1`, firstTicket.ID).Scan(&auditCount); err != nil || auditCount != 2 {
		t.Fatalf("handoff audit count = %d, err %v; want 2", auditCount, err)
	}
	if response := queueAPIRequest(router, http.MethodPost, "/api/v1/operator/tickets/"+firstTicket.ID+"/complete", nil, recipient); response.Code != http.StatusNotFound {
		t.Fatalf("previous recipient complete = %d %s; want not found", response.Code, response.Body.String())
	}
	if response := queueAPIRequest(router, http.MethodPost, "/api/v1/operator/tickets/"+firstTicket.ID+"/complete", nil, loginQueueAPIUser(t, router, "recipient-b@quevo.local")); response.Code != http.StatusOK {
		t.Fatalf("new recipient complete = %d %s", response.Code, response.Body.String())
	}

	if _, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("call second ticket: found %v, err %v", found, err)
	}
	if response := queueAPIRequest(router, http.MethodPost, "/api/v1/operator/tickets/"+secondTicket.ID+"/handoff", map[string]string{"recipientOperatorId": busyOperator}, operator); response.Code != http.StatusConflict {
		t.Fatalf("handoff to busy operator = %d %s; want conflict", response.Code, response.Body.String())
	}
	if response := queueAPIRequest(router, http.MethodPost, "/api/v1/operator/tickets/"+busyTicket.ID+"/handoff", map[string]string{"recipientOperatorId": recipientA}, operator); response.Code != http.StatusNotFound {
		t.Fatalf("handoff another operator's ticket = %d %s; want not found", response.Code, response.Body.String())
	}
	if response := queueAPIRequest(router, http.MethodPost, "/api/v1/operator/tickets/"+secondTicket.ID+"/start", nil, operator); response.Code != http.StatusOK {
		t.Fatalf("start second ticket = %d %s", response.Code, response.Body.String())
	}
	if response := queueAPIRequest(router, http.MethodPost, "/api/v1/operator/tickets/"+secondTicket.ID+"/complete", nil, operator); response.Code != http.StatusOK {
		t.Fatalf("complete second ticket = %d %s", response.Code, response.Body.String())
	}
	if response := queueAPIRequest(router, http.MethodPost, "/api/v1/operator/tickets/"+secondTicket.ID+"/handoff", map[string]string{"recipientOperatorId": recipientA}, operator); response.Code != http.StatusConflict {
		t.Fatalf("handoff completed ticket = %d %s; want conflict", response.Code, response.Body.String())
	}

	// Compete to give the same idle operator an active ticket by handoff and call-next.
	raceTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: raceCustomerA, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join race handoff ticket: %v", err)
	}
	if _, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: recipientB, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("assign race handoff ticket: found %v, err %v", found, err)
	}
	if _, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: raceCustomerB, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID}); err != nil {
		t.Fatalf("join race call-next ticket: %v", err)
	}
	start := make(chan struct{})
	var wait sync.WaitGroup
	wait.Add(2)
	handoffResult := make(chan error, 1)
	callNextResult := make(chan error, 1)
	go func() {
		defer wait.Done()
		<-start
		_, err := repo.HandoffTicket(ctx, recipientB, raceTicket.ID, recipientA)
		handoffResult <- err
	}()
	go func() {
		defer wait.Done()
		<-start
		_, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: recipientA, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
		if err == nil && !found {
			err = errors.New("call-next did not find the race ticket")
		}
		callNextResult <- err
	}()
	close(start)
	wait.Wait()
	handoffErr, callNextErr := <-handoffResult, <-callNextResult
	if handoffErr == nil && !errors.Is(callNextErr, ErrOperatorHasActiveTicket) {
		t.Fatalf("call-next after successful handoff = %v; want active-ticket rejection", callNextErr)
	}
	if callNextErr == nil && !errors.Is(handoffErr, ErrHandoffRecipientUnavailable) {
		t.Fatalf("handoff after successful call-next = %v; want unavailable-recipient rejection", handoffErr)
	}
	if handoffErr != nil && callNextErr != nil {
		t.Fatalf("both concurrent assignments failed: handoff %v, call-next %v", handoffErr, callNextErr)
	}
	var recipientActiveTickets int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM tickets WHERE assigned_operator_id = $1 AND status IN ('PENDING', 'OPERATING')`, recipientA).Scan(&recipientActiveTickets); err != nil {
		t.Fatalf("count recipient active tickets after race: %v", err)
	}
	if recipientActiveTickets != 1 {
		t.Fatalf("recipient has %d active tickets after race; want 1", recipientActiveTickets)
	}
}

func assertHandoffState(t *testing.T, ctx context.Context, db *sql.DB, ticketID, wantStatus, wantOperator, wantCalledAt, wantStartedAt string) {
	t.Helper()
	var status, assignedOperator string
	var calledAt, startedAt sql.NullString
	if err := db.QueryRowContext(ctx, `SELECT status, assigned_operator_id::text, called_at::text, started_at::text
		FROM tickets WHERE id = $1`, ticketID).Scan(&status, &assignedOperator, &calledAt, &startedAt); err != nil {
		t.Fatalf("read handed-off ticket: %v", err)
	}
	if status != wantStatus || assignedOperator != wantOperator || calledAt.String != wantCalledAt || startedAt.String != wantStartedAt {
		t.Fatalf("ticket after handoff = status %s, operator %s, called_at %q, started_at %q; want %s, %s, %q, %q",
			status, assignedOperator, calledAt.String, startedAt.String, wantStatus, wantOperator, wantCalledAt, wantStartedAt)
	}
}
