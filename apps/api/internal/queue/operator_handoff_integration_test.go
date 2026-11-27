//go:build integration

package queue

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/auth"
	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestOperatorTicketHandoffAPIWithPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("local-demo-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE users SET password_hash = $1 WHERE id IN ($2, $3)`, passwordHash, database.DemoOperatorID, database.DemoCustomerID); err != nil {
		t.Fatal(err)
	}

	firstRecipient, secondRecipient, thirdRecipient := uuid.NewString(), uuid.NewString(), uuid.NewString()
	otherQueueOperator, otherServiceID := uuid.NewString(), uuid.NewString()
	secondCustomer, waitingCustomer, managerID := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for i, operatorID := range []string{firstRecipient, secondRecipient, thirdRecipient} {
		name := []string{"First Recipient", "Second Recipient", "Third Recipient"}[i]
		if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash)
			VALUES ($1, 'OPERATOR', $2, $3, $4)`, operatorID, name, operatorID+"@quevo.local", passwordHash); err != nil {
			t.Fatalf("insert recipient operator: %v", err)
		}
		if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id) VALUES ($1, $2)`, operatorID, database.DemoServiceID); err != nil {
			t.Fatalf("authorize recipient operator: %v", err)
		}
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash) VALUES
		($1, 'OPERATOR', 'Other Queue Operator', $2, $3),
		($4, 'CUSTOMER', 'Second Customer', $5, $3),
		($6, 'CUSTOMER', 'Waiting Customer', $7, $3),
		($8, 'BRANCH_MANAGER', 'Branch Manager', $9, $3)`, otherQueueOperator, otherQueueOperator+"@quevo.local", passwordHash, secondCustomer, secondCustomer+"@quevo.local", waitingCustomer, waitingCustomer+"@quevo.local", managerID, "manager@quevo.local"); err != nil {
		t.Fatalf("insert boundary test users: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO branch_managers (branch_id, manager_id) VALUES ($1, $2)`, database.DemoBranchID, managerID); err != nil {
		t.Fatalf("authorize branch manager: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO services (id, branch_id, name, active) VALUES ($1, $2, 'Other queue service', true)`, otherServiceID, database.DemoBranchID); err != nil {
		t.Fatalf("insert other service: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO service_queues (id, branch_id, service_id, name, active) VALUES ($1, $2, $1, 'Main queue', true)`, otherServiceID, database.DemoBranchID); err != nil {
		t.Fatalf("insert other service queue: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id) VALUES ($1, $2)`, otherQueueOperator, otherServiceID); err != nil {
		t.Fatalf("authorize other-queue operator: %v", err)
	}

	repo := NewRepository(gormDB)
	ticket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoCustomerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join queue: %v", err)
	}
	secondTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: secondCustomer, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join second customer: %v", err)
	}
	waitingTicket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: waitingCustomer, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join waiting customer: %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET joined_at = now() - interval '3 minutes' WHERE id = $1`, ticket.ID); err != nil {
		t.Fatalf("order first ticket: %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET joined_at = now() - interval '2 minutes' WHERE id = $1`, secondTicket.ID); err != nil {
		t.Fatalf("order second ticket: %v", err)
	}
	if _, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("call next: found=%t err=%v", found, err)
	}

	authService := auth.NewService(auth.NewGORMRepository(gormDB), time.Hour)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	api := router.Group("/api/v1")
	auth.RegisterRoutes(api, authService)
	RegisterRoutes(api, authService, repo)
	oldOperator := loginQueueAPIUser(t, router, "operator@quevo.local")
	firstOperator := loginQueueAPIUser(t, router, firstRecipient+"@quevo.local")
	thirdOperator := loginQueueAPIUser(t, router, thirdRecipient+"@quevo.local")
	customer := loginQueueAPIUser(t, router, "customer@quevo.local")
	manager := loginQueueAPIUser(t, router, "manager@quevo.local")
	ticketPath := "/api/v1/operator/tickets/" + ticket.ID
	waitingTicketPath := "/api/v1/operator/tickets/" + waitingTicket.ID
	if denied := queueAPIRequest(router, http.MethodPost, waitingTicketPath+"/handoff", map[string]string{"operatorId": firstRecipient}, oldOperator); denied.Code != http.StatusNotFound {
		t.Fatalf("waiting ticket handoff = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusNotFound)
	}

	targetsResponse := queueAPIRequest(router, http.MethodGet, ticketPath+"/handoff-targets", nil, oldOperator)
	if targetsResponse.Code != http.StatusOK {
		t.Fatalf("eligible handoff targets = %d %s; want %d", targetsResponse.Code, targetsResponse.Body.String(), http.StatusOK)
	}
	var targets struct {
		Items []struct {
			ID          string `json:"id"`
			DisplayName string `json:"displayName"`
		} `json:"items"`
	}
	if err := json.Unmarshal(targetsResponse.Body.Bytes(), &targets); err != nil {
		t.Fatalf("decode handoff targets: %v", err)
	}
	wantedTargets := map[string]bool{firstRecipient: true, secondRecipient: true, thirdRecipient: true}
	if len(targets.Items) != len(wantedTargets) {
		t.Fatalf("eligible handoff targets = %#v; want three authorized, available operators", targets.Items)
	}
	for _, target := range targets.Items {
		if !wantedTargets[target.ID] || target.DisplayName == "" {
			t.Fatalf("eligible handoff target = %#v; target is unauthorized or missing a name", target)
		}
		delete(wantedTargets, target.ID)
	}
	if len(wantedTargets) != 0 {
		t.Fatalf("eligible handoff targets omitted authorized operators: %#v", wantedTargets)
	}
	for _, token := range []string{customer, manager} {
		if denied := queueAPIRequest(router, http.MethodGet, ticketPath+"/handoff-targets", nil, token); denied.Code != http.StatusForbidden {
			t.Fatalf("non-operator handoff target access = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusForbidden)
		}
	}
	if denied := queueAPIRequest(router, http.MethodPost, ticketPath+"/handoff", map[string]string{"operatorId": firstRecipient}, thirdOperator); denied.Code != http.StatusNotFound {
		t.Fatalf("unassigned operator handoff = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusNotFound)
	}
	if denied := queueAPIRequest(router, http.MethodPost, ticketPath+"/handoff", map[string]string{"operatorId": otherQueueOperator}, oldOperator); denied.Code != http.StatusConflict {
		t.Fatalf("other-queue handoff recipient = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusConflict)
	}
	if denied := queueAPIRequest(router, http.MethodPost, ticketPath+"/handoff", map[string]string{"operatorId": database.DemoCustomerID}, oldOperator); denied.Code != http.StatusConflict {
		t.Fatalf("customer handoff recipient = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusConflict)
	}
	for _, token := range []string{customer, manager} {
		if denied := queueAPIRequest(router, http.MethodPost, ticketPath+"/handoff", map[string]string{"operatorId": firstRecipient}, token); denied.Code != http.StatusForbidden {
			t.Fatalf("non-operator handoff request = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusForbidden)
		}
	}
	if denied := queueAPIRequest(router, http.MethodPost, ticketPath+"/handoff", map[string]string{"operatorId": database.DemoOperatorID}, oldOperator); denied.Code != http.StatusConflict {
		t.Fatalf("self handoff = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusConflict)
	}

	handoff := func(actorToken, recipientID string) {
		t.Helper()
		response := queueAPIRequest(router, http.MethodPost, ticketPath+"/handoff", map[string]string{"operatorId": recipientID}, actorToken)
		if response.Code != http.StatusOK {
			t.Fatalf("handoff to %s = %d %s; want %d", recipientID, response.Code, response.Body.String(), http.StatusOK)
		}
	}
	handoff(oldOperator, firstRecipient)
	queuePath := "/api/v1/operator/branches/" + database.DemoBranchID + "/services/" + database.DemoServiceID + "/tickets"
	oldQueueResponse := queueAPIRequest(router, http.MethodGet, queuePath, nil, oldOperator)
	var oldQueue OperatorQueueDetailResponse
	if oldQueueResponse.Code != http.StatusOK || json.Unmarshal(oldQueueResponse.Body.Bytes(), &oldQueue) != nil || oldQueue.Current != nil {
		t.Fatalf("previous operator queue after handoff = %d %s; want no current ticket", oldQueueResponse.Code, oldQueueResponse.Body.String())
	}
	recipientQueueResponse := queueAPIRequest(router, http.MethodGet, queuePath, nil, firstOperator)
	var recipientQueue OperatorQueueDetailResponse
	if recipientQueueResponse.Code != http.StatusOK || json.Unmarshal(recipientQueueResponse.Body.Bytes(), &recipientQueue) != nil || recipientQueue.Current == nil || recipientQueue.Current.ID != ticket.ID || recipientQueue.Current.Status != "PENDING" {
		t.Fatalf("recipient queue after handoff = %d %s; want the pending current ticket", recipientQueueResponse.Code, recipientQueueResponse.Body.String())
	}
	targetsResponse = queueAPIRequest(router, http.MethodGet, ticketPath+"/handoff-targets", nil, firstOperator)
	if targetsResponse.Code != http.StatusOK {
		t.Fatalf("eligible recipients after first handoff = %d %s", targetsResponse.Code, targetsResponse.Body.String())
	}
	if err := json.Unmarshal(targetsResponse.Body.Bytes(), &targets); err != nil {
		t.Fatalf("decode recipients after first handoff: %v", err)
	}
	for _, target := range targets.Items {
		if target.ID == firstRecipient {
			t.Fatal("handoff list included the current operator")
		}
	}

	var assignedOperator, status, branchID, serviceID, queueID, customerID, ticketNumber string
	var calledAt, startedAt *time.Time
	var joinedAt time.Time
	if err := db.QueryRowContext(ctx, `SELECT assigned_operator_id::text, status, branch_id::text, service_id::text,
		queue_id::text, customer_id::text, ticket_number, joined_at, called_at, started_at FROM tickets WHERE id = $1`, ticket.ID).
		Scan(&assignedOperator, &status, &branchID, &serviceID, &queueID, &customerID, &ticketNumber, &joinedAt, &calledAt, &startedAt); err != nil {
		t.Fatal(err)
	}
	if assignedOperator != firstRecipient || status != "PENDING" || calledAt == nil || startedAt != nil ||
		branchID != ticket.BranchID || serviceID != ticket.ServiceID || queueID != ticket.QueueID || customerID != ticket.CustomerID ||
		ticketNumber != ticket.TicketNumber || !joinedAt.Equal(ticket.JoinedAt) {
		t.Fatalf("pending ticket after handoff = assignee %s, status %s, branch %s, service %s, queue %s, customer %s, number %s, joined %v, called %v, started %v",
			assignedOperator, status, branchID, serviceID, queueID, customerID, ticketNumber, joinedAt, calledAt, startedAt)
	}
	calledAtBeforeHandoff := *calledAt
	if denied := queueAPIRequest(router, http.MethodPost, ticketPath+"/start", nil, oldOperator); denied.Code != http.StatusNotFound {
		t.Fatalf("old operator start after handoff = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusNotFound)
	}
	if started := queueAPIRequest(router, http.MethodPost, ticketPath+"/start", nil, firstOperator); started.Code != http.StatusOK {
		t.Fatalf("new operator start = %d %s; want %d", started.Code, started.Body.String(), http.StatusOK)
	}
	if err := db.QueryRowContext(ctx, `SELECT started_at FROM tickets WHERE id = $1`, ticket.ID).Scan(&startedAt); err != nil || startedAt == nil {
		t.Fatalf("started_at after service start = %v, err %v", startedAt, err)
	}
	startedAtBeforeHandoff := *startedAt
	if _, found, err := repo.CallNext(ctx, CallNextInput{OperatorID: secondRecipient, BranchID: database.DemoBranchID, QueueID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("second recipient call next: found=%t err=%v", found, err)
	}
	if busy := queueAPIRequest(router, http.MethodPost, ticketPath+"/handoff", map[string]string{"operatorId": secondRecipient}, firstOperator); busy.Code != http.StatusConflict {
		t.Fatalf("handoff to busy operator = %d %s; want %d", busy.Code, busy.Body.String(), http.StatusConflict)
	}
	targetsResponse = queueAPIRequest(router, http.MethodGet, ticketPath+"/handoff-targets", nil, firstOperator)
	if err := json.Unmarshal(targetsResponse.Body.Bytes(), &targets); err != nil || targetsResponse.Code != http.StatusOK {
		t.Fatalf("eligible targets with busy operator = %d %s, err %v", targetsResponse.Code, targetsResponse.Body.String(), err)
	}
	for _, target := range targets.Items {
		if target.ID == secondRecipient {
			t.Fatal("handoff target list included an operator with another active ticket")
		}
	}
	var handoffEventCount int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM ticket_events WHERE ticket_id = $1 AND event_type = 'HANDOFF'`, ticket.ID).Scan(&handoffEventCount); err != nil || handoffEventCount != 1 {
		t.Fatalf("handoff events after rejected transfer = %d, err %v; want only the successful first handoff", handoffEventCount, err)
	}
	handoff(firstOperator, thirdRecipient)
	if err := db.QueryRowContext(ctx, `SELECT assigned_operator_id::text, status, called_at, started_at FROM tickets WHERE id = $1`, ticket.ID).
		Scan(&assignedOperator, &status, &calledAt, &startedAt); err != nil {
		t.Fatal(err)
	}
	if assignedOperator != thirdRecipient || status != "OPERATING" || calledAt == nil || !calledAt.Equal(calledAtBeforeHandoff) ||
		startedAt == nil || !startedAt.Equal(startedAtBeforeHandoff) {
		t.Fatalf("operating ticket after handoff = assignee %s, status %s, called %v, started %v; want unchanged timestamps %v and %v",
			assignedOperator, status, calledAt, startedAt, calledAtBeforeHandoff, startedAtBeforeHandoff)
	}
	if denied := queueAPIRequest(router, http.MethodPost, ticketPath+"/complete", nil, firstOperator); denied.Code != http.StatusNotFound {
		t.Fatalf("previous operator complete after handoff = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusNotFound)
	}
	if completed := queueAPIRequest(router, http.MethodPost, ticketPath+"/complete", nil, thirdOperator); completed.Code != http.StatusOK {
		t.Fatalf("receiving operator complete = %d %s; want %d", completed.Code, completed.Body.String(), http.StatusOK)
	}
	if terminal := queueAPIRequest(router, http.MethodPost, ticketPath+"/handoff", map[string]string{"operatorId": firstRecipient}, thirdOperator); terminal.Code != http.StatusConflict {
		t.Fatalf("completed ticket handoff = %d %s; want %d", terminal.Code, terminal.Body.String(), http.StatusConflict)
	}

	historyResponse := queueAPIRequest(router, http.MethodGet, ticketPath+"/history", nil, thirdOperator)
	if historyResponse.Code != http.StatusOK {
		t.Fatalf("ticket history = %d %s; want %d", historyResponse.Code, historyResponse.Body.String(), http.StatusOK)
	}
	var history struct {
		Items []struct {
			EventType      string    `json:"eventType"`
			FromStatus     string    `json:"fromStatus"`
			ToStatus       string    `json:"toStatus"`
			ActorID        *string   `json:"actorId"`
			FromOperatorID *string   `json:"fromOperatorId"`
			ToOperatorID   *string   `json:"toOperatorId"`
			OccurredAt     time.Time `json:"occurredAt"`
		} `json:"items"`
	}
	if err := json.Unmarshal(historyResponse.Body.Bytes(), &history); err != nil {
		t.Fatalf("decode ticket history: %v", err)
	}
	var handoffEvents []struct {
		ActorID        *string
		FromOperatorID *string
		ToOperatorID   *string
		FromStatus     string
		ToStatus       string
		OccurredAt     time.Time
	}
	for _, event := range history.Items {
		if event.EventType == "HANDOFF" {
			handoffEvents = append(handoffEvents, struct {
				ActorID        *string
				FromOperatorID *string
				ToOperatorID   *string
				FromStatus     string
				ToStatus       string
				OccurredAt     time.Time
			}{event.ActorID, event.FromOperatorID, event.ToOperatorID, event.FromStatus, event.ToStatus, event.OccurredAt})
		}
	}
	validAudit := len(handoffEvents) == 2
	if validAudit {
		validAudit = handoffEvents[0].ActorID != nil && handoffEvents[0].FromOperatorID != nil && handoffEvents[0].ToOperatorID != nil &&
			handoffEvents[1].ActorID != nil && handoffEvents[1].FromOperatorID != nil && handoffEvents[1].ToOperatorID != nil &&
			*handoffEvents[0].ActorID == database.DemoOperatorID && *handoffEvents[0].FromOperatorID == database.DemoOperatorID && *handoffEvents[0].ToOperatorID == firstRecipient &&
			*handoffEvents[1].ActorID == firstRecipient && *handoffEvents[1].FromOperatorID == firstRecipient && *handoffEvents[1].ToOperatorID == thirdRecipient &&
			handoffEvents[0].FromStatus == "PENDING" && handoffEvents[0].ToStatus == "PENDING" && !handoffEvents[0].OccurredAt.IsZero() &&
			handoffEvents[1].FromStatus == "OPERATING" && handoffEvents[1].ToStatus == "OPERATING" && !handoffEvents[1].OccurredAt.IsZero()
	}
	if !validAudit {
		t.Fatalf("handoff audit history = %#v; want both actor/from/to handoffs", handoffEvents)
	}
}
