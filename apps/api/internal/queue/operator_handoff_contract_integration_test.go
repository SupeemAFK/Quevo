//go:build integration

package queue

import (
	"net/http"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/auth"
	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// TestLab7HandoffOptionsAvailableToAssignedOperator verifies the changed
// operator-assignment contract through the authenticated HTTP API.
func TestLab7HandoffOptionsAvailableToAssignedOperator(t *testing.T) {
	ctx, gormDB, db := newSeededPostgresDB(t)
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("local-demo-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE users SET password_hash = $1 WHERE id = $2`, passwordHash, database.DemoOperatorID); err != nil {
		t.Fatal(err)
	}
	repository := NewRepository(gormDB)
	ticket, err := repository.JoinQueue(ctx, JoinQueueInput{CustomerID: database.DemoCustomerID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID})
	if err != nil {
		t.Fatalf("join queue: %v", err)
	}
	if _, found, err := repository.CallNext(ctx, CallNextInput{OperatorID: database.DemoOperatorID, BranchID: database.DemoBranchID, ServiceID: database.DemoServiceID}); err != nil || !found {
		t.Fatalf("call next: found %v, err %v", found, err)
	}

	authService := auth.NewService(auth.NewGORMRepository(gormDB), time.Hour)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	api := router.Group("/api/v1")
	auth.RegisterRoutes(api, authService)
	RegisterRoutes(api, authService, repository)
	operator := loginQueueAPIUser(t, router, "operator@quevo.local")
	response := queueAPIRequest(router, http.MethodGet, "/api/v1/operator/tickets/"+ticket.ID+"/handoff-options", nil, operator)
	if response.Code != http.StatusOK {
		t.Fatalf("handoff options status = %d, want %d: %s", response.Code, http.StatusOK, response.Body.String())
	}
}
