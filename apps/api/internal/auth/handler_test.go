package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestAuthRoutesEnforceSessionRoleAndOwnership(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repository := newMemoryRepository(t, RoleCustomer)
	service := NewService(repository, time.Hour)
	router := gin.New()
	api := router.Group("/api/v1")
	RegisterRoutes(api, service)
	api.GET("/operator/action", RequireSession(service), RequireRoles(RoleOperator), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	api.GET("/customer/tickets/:customerID", RequireSession(service), RequireRoles(RoleCustomer), func(c *gin.Context) {
		actor, _ := ActorFromContext(c)
		if err := RequireCustomerOwnership(actor, c.Param("customerID")); errors.Is(err, ErrNotOwner) {
			writeError(c, http.StatusNotFound, "not_found", "The requested resource was not found")
			return
		}
		c.Status(http.StatusOK)
	})

	login := performRequest(router, http.MethodPost, "/api/v1/auth/login", `{"identifier":"customer@example.test","password":"correct-password"}`, "")
	if login.Code != http.StatusOK {
		t.Fatalf("login status = %d, want %d: %s", login.Code, http.StatusOK, login.Body.String())
	}
	var loginResponse LoginResponse
	if err := json.Unmarshal(login.Body.Bytes(), &loginResponse); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if strings.Contains(login.Body.String(), "correct-password") || strings.Contains(login.Body.String(), repository.user.CredentialHash) {
		t.Fatal("login response exposed a password or password hash")
	}
	if loginResponse.SessionToken == "" {
		t.Fatal("login response did not contain the server-only session token")
	}

	me := performRequest(router, http.MethodGet, "/api/v1/auth/me", "", loginResponse.SessionToken)
	if me.Code != http.StatusOK || !strings.Contains(me.Body.String(), `"role":"CUSTOMER"`) {
		t.Fatalf("current user response = %d %s, want customer identity", me.Code, me.Body.String())
	}

	if got := performRequest(router, http.MethodGet, "/api/v1/auth/me", "", "").Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous current-user status = %d, want %d", got, http.StatusUnauthorized)
	}
	if got := performRequest(router, http.MethodGet, "/api/v1/operator/action", "", loginResponse.SessionToken).Code; got != http.StatusForbidden {
		t.Fatalf("customer operator-action status = %d, want %d", got, http.StatusForbidden)
	}
	if got := performRequest(router, http.MethodGet, "/api/v1/customer/tickets/other-customer", "", loginResponse.SessionToken).Code; got != http.StatusNotFound {
		t.Fatalf("other customer's ticket status = %d, want %d", got, http.StatusNotFound)
	}
	if got := performRequest(router, http.MethodGet, "/api/v1/customer/tickets/"+repository.user.ID, "", loginResponse.SessionToken).Code; got != http.StatusOK {
		t.Fatalf("own ticket status = %d, want %d", got, http.StatusOK)
	}

	logout := performRequest(router, http.MethodPost, "/api/v1/auth/logout", "", loginResponse.SessionToken)
	if logout.Code != http.StatusNoContent {
		t.Fatalf("logout status = %d, want %d", logout.Code, http.StatusNoContent)
	}
	if got := performRequest(router, http.MethodGet, "/api/v1/auth/me", "", loginResponse.SessionToken).Code; got != http.StatusUnauthorized {
		t.Fatalf("revoked-session current-user status = %d, want %d", got, http.StatusUnauthorized)
	}
}

func TestAuthRoutesReturnSafeErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	RegisterRoutes(router.Group("/api/v1"), nil)

	response := performRequest(router, http.MethodPost, "/api/v1/auth/login", `{"identifier":"x","password":"y"}`, "")
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("login status = %d, want %d", response.Code, http.StatusServiceUnavailable)
	}
	var body ErrorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if body.Code == "" || body.Message == "" || body.RequestID == "" {
		t.Fatalf("error response = %#v, want safe error envelope", body)
	}
}
