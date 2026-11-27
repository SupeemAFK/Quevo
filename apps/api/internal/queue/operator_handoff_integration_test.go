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
	if _, err := db.ExecContext(ctx, `UPDATE users SET password_hash = $1 WHERE id = $2`, passwordHash, database.DemoOperatorID); err != nil {
		t.Fatal(err)
	}

	firstRecipient, secondRecipient := uuid.NewString(), uuid.NewString()
	for i, operatorID := range []string{firstRecipient, secondRecipient} {
		name := []string{"First Recipient", "Second Recipient"}[i]
		if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash)
			VALUES ($1, 'OPERATOR', $2, $3, $4)`, operatorID, name, operatorID+"@quevo.local", passwordHash); err != nil {
			t.Fatalf("insert recipient operator: %v", err)
		}
		if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id) VALUES ($1, $2)`, operatorID, database.DemoServiceID); err != nil {
			t.Fatalf("authorize recipient operator: %v", err)
		}
	}

	repo := NewRepository(gormDB)
	ticket, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoCustomerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join queue: %v", err)
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
	secondOperator := loginQueueAPIUser(t, router, secondRecipient+"@quevo.local")
	ticketPath := "/api/v1/operator/tickets/" + ticket.ID

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
	if len(targets.Items) != 2 || targets.Items[0].ID == "" || targets.Items[0].DisplayName == "" {
		t.Fatalf("eligible handoff targets = %#v; want both authorized, available operators", targets.Items)
	}

	handoff := func(actorToken, recipientID string) {
		t.Helper()
		response := queueAPIRequest(router, http.MethodPost, ticketPath+"/handoff", map[string]string{"operatorId": recipientID}, actorToken)
		if response.Code != http.StatusOK {
			t.Fatalf("handoff to %s = %d %s; want %d", recipientID, response.Code, response.Body.String(), http.StatusOK)
		}
	}
	handoff(oldOperator, firstRecipient)

	var assignedOperator, status string
	var calledAt, startedAt *time.Time
	if err := db.QueryRowContext(ctx, `SELECT assigned_operator_id::text, status, called_at, started_at FROM tickets WHERE id = $1`, ticket.ID).
		Scan(&assignedOperator, &status, &calledAt, &startedAt); err != nil {
		t.Fatal(err)
	}
	if assignedOperator != firstRecipient || status != "PENDING" || calledAt == nil || startedAt != nil {
		t.Fatalf("pending ticket after handoff = assignee %s, status %s, called %v, started %v", assignedOperator, status, calledAt, startedAt)
	}
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
	handoff(firstOperator, secondRecipient)
	if err := db.QueryRowContext(ctx, `SELECT assigned_operator_id::text, status, started_at FROM tickets WHERE id = $1`, ticket.ID).
		Scan(&assignedOperator, &status, &startedAt); err != nil {
		t.Fatal(err)
	}
	if assignedOperator != secondRecipient || status != "OPERATING" || startedAt == nil || !startedAt.Equal(startedAtBeforeHandoff) {
		t.Fatalf("operating ticket after handoff = assignee %s, status %s, started %v; want unchanged service start %v", assignedOperator, status, startedAt, startedAtBeforeHandoff)
	}
	if denied := queueAPIRequest(router, http.MethodPost, ticketPath+"/complete", nil, firstOperator); denied.Code != http.StatusNotFound {
		t.Fatalf("previous operator complete after handoff = %d %s; want %d", denied.Code, denied.Body.String(), http.StatusNotFound)
	}
	if completed := queueAPIRequest(router, http.MethodPost, ticketPath+"/complete", nil, secondOperator); completed.Code != http.StatusOK {
		t.Fatalf("receiving operator complete = %d %s; want %d", completed.Code, completed.Body.String(), http.StatusOK)
	}

	historyResponse := queueAPIRequest(router, http.MethodGet, ticketPath+"/history", nil, secondOperator)
	if historyResponse.Code != http.StatusOK {
		t.Fatalf("ticket history = %d %s; want %d", historyResponse.Code, historyResponse.Body.String(), http.StatusOK)
	}
	var history struct {
		Items []struct {
			EventType      string  `json:"eventType"`
			ActorID        *string `json:"actorId"`
			FromOperatorID *string `json:"fromOperatorId"`
			ToOperatorID   *string `json:"toOperatorId"`
		} `json:"items"`
	}
	if err := json.Unmarshal(historyResponse.Body.Bytes(), &history); err != nil {
		t.Fatalf("decode ticket history: %v", err)
	}
	var handoffEvents []struct {
		ActorID        *string
		FromOperatorID *string
		ToOperatorID   *string
	}
	for _, event := range history.Items {
		if event.EventType == "HANDOFF" {
			handoffEvents = append(handoffEvents, struct {
				ActorID        *string
				FromOperatorID *string
				ToOperatorID   *string
			}{event.ActorID, event.FromOperatorID, event.ToOperatorID})
		}
	}
	validAudit := len(handoffEvents) == 2
	if validAudit {
		validAudit = handoffEvents[0].ActorID != nil && handoffEvents[0].FromOperatorID != nil && handoffEvents[0].ToOperatorID != nil &&
			handoffEvents[1].ActorID != nil && handoffEvents[1].FromOperatorID != nil && handoffEvents[1].ToOperatorID != nil &&
			*handoffEvents[0].ActorID == database.DemoOperatorID && *handoffEvents[0].FromOperatorID == database.DemoOperatorID && *handoffEvents[0].ToOperatorID == firstRecipient &&
			*handoffEvents[1].ActorID == firstRecipient && *handoffEvents[1].FromOperatorID == firstRecipient && *handoffEvents[1].ToOperatorID == secondRecipient
	}
	if !validAudit {
		t.Fatalf("handoff audit history = %#v; want both actor/from/to handoffs", handoffEvents)
	}
}
