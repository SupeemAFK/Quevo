//go:build integration

package queue

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/auth"
	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestOperatorQueueAPIWithPostgres(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("local-demo-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE users SET password_hash = $1 WHERE id IN ($2, $3)`, passwordHash, database.DemoCustomerID, database.DemoOperatorID); err != nil {
		t.Fatal(err)
	}
	otherOperator, otherCustomer, otherService := uuid.NewString(), uuid.NewString(), uuid.NewString()
	if _, err := db.ExecContext(ctx, `INSERT INTO users (id, role, display_name, email, password_hash) VALUES
		($1, 'OPERATOR', 'Other Operator', 'other-operator@quevo.local', $3),
		($2, 'CUSTOMER', 'Other Customer', 'other-customer@quevo.local', $3)`, otherOperator, otherCustomer, passwordHash); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO operator_services (operator_id, service_id) VALUES ($1, $2)`, otherOperator, database.DemoServiceID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO services (id, branch_id, name, active) VALUES ($1, $2, 'Unauthorized Service', true)`, otherService, database.DemoBranchID); err != nil {
		t.Fatal(err)
	}

	repo := NewRepository(gormDB)
	first, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoCustomerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("first join: %v", err)
	}
	second, err := repo.JoinQueue(ctx, JoinQueueInput{CustomerID: otherCustomer, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("second join: %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE tickets SET joined_at = now() - interval '1 minute' WHERE id = $1`, first.ID); err != nil {
		t.Fatal(err)
	}

	authService := auth.NewService(auth.NewGORMRepository(gormDB), time.Hour)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	api := router.Group("/api/v1")
	auth.RegisterRoutes(api, authService)
	RegisterRoutes(api, authService, repo)
	operator := loginQueueAPIUser(t, router, "operator@quevo.local")
	other := loginQueueAPIUser(t, router, "other-operator@quevo.local")
	customer := loginQueueAPIUser(t, router, "customer@quevo.local")
	queuePath := "/api/v1/operator/branches/" + database.DemoBranchID + "/services/" + database.DemoServiceID + "/tickets"
	unauthorizedPath := "/api/v1/operator/branches/" + database.DemoBranchID + "/services/" + otherService + "/tickets"

	for _, tc := range []struct {
		name, method, path, token string
		want                      int
	}{
		{"anonymous", "GET", "/api/v1/operator/queues", "", http.StatusUnauthorized},
		{"customer", "GET", "/api/v1/operator/queues", customer, http.StatusForbidden},
		{"unauthorized queue", "GET", unauthorizedPath, operator, http.StatusForbidden},
		{"unauthorized call", "POST", unauthorizedPath + "/call-next", operator, http.StatusForbidden},
		{"wrong branch", "GET", "/api/v1/operator/branches/" + uuid.NewString() + "/services/" + database.DemoServiceID + "/tickets", operator, http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := queueAPIRequest(router, tc.method, tc.path, nil, tc.token)
			if response.Code != tc.want {
				t.Fatalf("status = %d, want %d: %s", response.Code, tc.want, response.Body.String())
			}
		})
	}
	overview := queueAPIRequest(router, "GET", "/api/v1/operator/queues", nil, operator)
	var overviewBody OperatorQueuesResponse
	if overview.Code != http.StatusOK || json.Unmarshal(overview.Body.Bytes(), &overviewBody) != nil || len(overviewBody.Items) != 1 || overviewBody.Items[0].WaitingCount != 2 {
		t.Fatalf("operator overview = %d %s; want one authorized queue with two waiting", overview.Code, overview.Body.String())
	}
	queueResponse := queueAPIRequest(router, "GET", queuePath, nil, operator)
	var queueBody OperatorQueueDetailResponse
	if queueResponse.Code != http.StatusOK || json.Unmarshal(queueResponse.Body.Bytes(), &queueBody) != nil || len(queueBody.Waiting) != 2 || queueBody.Waiting[0].ID != first.ID || queueBody.Current != nil {
		t.Fatalf("queue = %d %s; want FIFO waiting tickets", queueResponse.Code, queueResponse.Body.String())
	}
	if strings.Contains(queueResponse.Body.String(), "customerId") || strings.Contains(queueResponse.Body.String(), "email") {
		t.Fatal("operator queue leaked customer identity")
	}
	called := queueAPIRequest(router, "POST", queuePath+"/call-next", nil, operator)
	var calledTicket OperatorTicketResponse
	if called.Code != http.StatusOK || json.Unmarshal(called.Body.Bytes(), &calledTicket) != nil || calledTicket.ID != first.ID || calledTicket.Status != "PENDING" {
		t.Fatalf("call next = %d %s", called.Code, called.Body.String())
	}
	if result := queueAPIRequest(router, "POST", queuePath+"/call-next", nil, operator); result.Code != http.StatusConflict {
		t.Fatalf("second active call = %d %s", result.Code, result.Body.String())
	}
	queueResponse = queueAPIRequest(router, "GET", queuePath, nil, operator)
	if err := json.Unmarshal(queueResponse.Body.Bytes(), &queueBody); err != nil || queueBody.Current == nil || queueBody.Current.ID != first.ID {
		t.Fatalf("current ticket = %s, err %v", queueResponse.Body.String(), err)
	}

	ticketPath := "/api/v1/operator/tickets/" + first.ID
	for _, tc := range []struct {
		name, action, token string
		want                int
	}{
		{"wrong operator", "start", other, http.StatusNotFound},
		{"customer action", "start", customer, http.StatusForbidden},
		{"complete before start", "complete", operator, http.StatusConflict},
		{"start", "start", operator, http.StatusOK},
		{"repeated start", "start", operator, http.StatusConflict},
		{"skip operating", "skip", operator, http.StatusConflict},
		{"complete", "complete", operator, http.StatusOK},
		{"repeated complete", "complete", operator, http.StatusConflict},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := queueAPIRequest(router, "POST", ticketPath+"/"+tc.action, nil, tc.token)
			if response.Code != tc.want {
				t.Fatalf("status = %d, want %d: %s", response.Code, tc.want, response.Body.String())
			}
		})
	}
	var status string
	var calledAt, startedAt, completedAt *time.Time
	if err := db.QueryRowContext(ctx, `SELECT status, called_at, started_at, completed_at FROM tickets WHERE id = $1`, first.ID).Scan(&status, &calledAt, &startedAt, &completedAt); err != nil {
		t.Fatal(err)
	}
	if status != "COMPLETED" || calledAt == nil || startedAt == nil || completedAt == nil {
		t.Fatalf("completed ticket status/timestamps = %s %v %v %v", status, calledAt, startedAt, completedAt)
	}
	called = queueAPIRequest(router, "POST", queuePath+"/call-next", nil, other)
	if called.Code != http.StatusOK || json.Unmarshal(called.Body.Bytes(), &calledTicket) != nil || calledTicket.ID != second.ID {
		t.Fatalf("second call = %d %s", called.Code, called.Body.String())
	}
	skipped := queueAPIRequest(router, "POST", "/api/v1/operator/tickets/"+second.ID+"/skip", nil, other)
	if skipped.Code != http.StatusOK {
		t.Fatalf("skip = %d %s", skipped.Code, skipped.Body.String())
	}
	var skippedAt *time.Time
	if err := db.QueryRowContext(ctx, `SELECT status, skipped_at FROM tickets WHERE id = $1`, second.ID).Scan(&status, &skippedAt); err != nil || status != "SKIPPED" || skippedAt == nil {
		t.Fatalf("skipped ticket = %s %v, err %v", status, skippedAt, err)
	}
	if empty := queueAPIRequest(router, "POST", queuePath+"/call-next", nil, operator); empty.Code != http.StatusNoContent {
		t.Fatalf("empty queue = %d %s", empty.Code, empty.Body.String())
	}
}
