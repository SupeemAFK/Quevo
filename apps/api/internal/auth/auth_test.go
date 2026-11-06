package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func TestLoginCreatesHashedSession(t *testing.T) {
	repository := newMemoryRepository(t, RoleCustomer)
	service := NewService(repository, time.Hour)

	result, err := service.Login(context.Background(), "  CUSTOMER@EXAMPLE.TEST ", "correct-password")
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if result.User.ID != repository.user.ID || result.User.Role != RoleCustomer {
		t.Fatalf("Login() user = %#v, want seeded customer", result.User)
	}
	if result.SessionToken == "" {
		t.Fatal("Login() returned an empty token")
	}
	if result.ExpiresAt.Before(time.Now()) || result.ExpiresAt.After(time.Now().Add(time.Hour+time.Minute)) {
		t.Fatalf("Login() expiry = %v, want about one hour from now", result.ExpiresAt)
	}
	if len(repository.sessions) != 1 {
		t.Fatalf("stored sessions = %d, want 1", len(repository.sessions))
	}
	if repository.sessions[0].TokenHash == result.SessionToken || len(repository.sessions[0].TokenHash) != 64 {
		t.Fatal("repository must store only the SHA-256 token hash")
	}
}

func TestLoginRejectsInvalidCredentialsWithoutCreatingSession(t *testing.T) {
	for _, test := range []struct {
		name       string
		identifier string
		password   string
	}{
		{name: "wrong password", identifier: "customer@example.test", password: "wrong-password"},
		{name: "unknown user", identifier: "unknown@example.test", password: "correct-password"},
	} {
		t.Run(test.name, func(t *testing.T) {
			repository := newMemoryRepository(t, RoleCustomer)
			_, err := NewService(repository, time.Hour).Login(context.Background(), test.identifier, test.password)
			if !errors.Is(err, ErrInvalidCredentials) {
				t.Fatalf("Login() error = %v, want ErrInvalidCredentials", err)
			}
			if len(repository.sessions) != 0 {
				t.Fatalf("stored sessions = %d, want 0", len(repository.sessions))
			}
		})
	}
}

func TestAuthenticateRejectsExpiredAndRevokedSessions(t *testing.T) {
	for _, test := range []struct {
		name    string
		expires time.Time
		revoked *time.Time
	}{
		{name: "expired", expires: time.Now().Add(-time.Minute)},
		{name: "revoked", expires: time.Now().Add(time.Hour), revoked: timePtr(time.Now())},
	} {
		t.Run(test.name, func(t *testing.T) {
			repository := newMemoryRepository(t, RoleCustomer)
			repository.sessions = []Session{{
				ID: "session-id", UserID: repository.user.ID, TokenHash: hashSessionToken("opaque-token"),
				ExpiresAt: test.expires, RevokedAt: test.revoked,
			}}
			_, err := NewService(repository, time.Hour).Authenticate(context.Background(), "opaque-token")
			if !errors.Is(err, ErrUnauthenticated) {
				t.Fatalf("Authenticate() error = %v, want ErrUnauthenticated", err)
			}
		})
	}
}

func TestRequireCustomerOwnership(t *testing.T) {
	customer := Actor{ID: "customer-1", Role: RoleCustomer}
	if err := RequireCustomerOwnership(customer, "customer-1"); err != nil {
		t.Fatalf("owner check error = %v, want nil", err)
	}
	if err := RequireCustomerOwnership(customer, "customer-2"); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("other customer's resource error = %v, want ErrNotOwner", err)
	}
	operator := Actor{ID: "operator-1", Role: RoleOperator}
	if err := RequireCustomerOwnership(operator, "operator-1"); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("operator resource error = %v, want ErrNotOwner", err)
	}
}

func TestRequireOperatorServiceChecksRoleAndAssignment(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repository := newMemoryRepository(t, RoleOperator)
	repository.operatorServices = map[string]bool{
		repository.user.ID + ":service-1": true,
	}
	service := NewService(repository, time.Hour)
	login, err := service.Login(context.Background(), repository.user.LoginIdentifier, "correct-password")
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

func newMemoryRepository(t *testing.T, role Role) *memoryRepository {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash test password: %v", err)
	}
	return &memoryRepository{
		user: User{
			ID: "b173f94e-9db0-41eb-945e-44c8af09027d", Role: role, DisplayName: "Demo Customer",
			LoginIdentifier: "customer@example.test", CredentialHash: string(hash),
		},
	}
}

type memoryRepository struct {
	user             User
	sessions         []Session
	operatorServices map[string]bool
}

func (r *memoryRepository) FindUserByIdentifier(_ context.Context, identifier string) (User, error) {
	if identifier != r.user.LoginIdentifier {
		return User{}, ErrNotFound
	}
	return r.user, nil
}

func (r *memoryRepository) FindUserByID(_ context.Context, id string) (User, error) {
	if id != r.user.ID {
		return User{}, ErrNotFound
	}
	return r.user, nil
}

func (r *memoryRepository) HasOperatorServiceAccess(_ context.Context, operatorID, serviceID string) (bool, error) {
	return r.operatorServices[operatorID+":"+serviceID], nil
}

func (r *memoryRepository) CreateSession(_ context.Context, session Session) error {
	r.sessions = append(r.sessions, session)
	return nil
}

func (r *memoryRepository) FindSessionByTokenHash(_ context.Context, tokenHash string) (Session, error) {
	for _, session := range r.sessions {
		if session.TokenHash == tokenHash {
			return session, nil
		}
	}
	return Session{}, ErrNotFound
}

func (r *memoryRepository) RevokeSession(_ context.Context, tokenHash string, revokedAt time.Time) error {
	for index := range r.sessions {
		if r.sessions[index].TokenHash == tokenHash && r.sessions[index].RevokedAt == nil {
			r.sessions[index].RevokedAt = &revokedAt
			return nil
		}
	}
	return nil
}

func performRequest(router http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func timePtr(value time.Time) *time.Time {
	return &value
}
