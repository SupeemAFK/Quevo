package auth

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRequireOperatorServiceChecksRoleAndAssignment(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repository := newMemoryRepository(t, RoleOperator)
	repository.operatorServices = map[string]bool{
		repository.user.ID + ":service-1": true,
	}
	service := NewService(repository, time.Hour)
	login, err := service.Login(context.Background(), repository.user.Email, "correct-password")
	if err != nil {
		t.Fatalf("login operator: %v", err)
	}

	router := gin.New()
	router.GET("/services/:serviceID", RequireSession(service), RequireOperatorService(service, "serviceID"), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	if got := performRequest(router, http.MethodGet, "/services/service-1", "", login.SessionToken).Code; got != http.StatusNoContent {
		t.Fatalf("authorized service status = %d, want %d", got, http.StatusNoContent)
	}
	if got := performRequest(router, http.MethodGet, "/services/service-2", "", login.SessionToken).Code; got != http.StatusForbidden {
		t.Fatalf("unauthorized service status = %d, want %d", got, http.StatusForbidden)
	}
}
