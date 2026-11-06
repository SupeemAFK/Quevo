package app_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/apidocs"
	"example.com/quevo/apps/api/internal/app"
	"example.com/quevo/apps/api/internal/auth"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers/gorillamux"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

func TestHealthProviderMatchesOpenAPI(t *testing.T) {
	ctx := context.Background()
	doc, err := openapi3.NewLoader().LoadFromData(apidocs.Spec)
	if err != nil {
		t.Fatalf("load OpenAPI document: %v", err)
	}
	if err := doc.Validate(ctx); err != nil {
		t.Fatalf("validate OpenAPI document: %v", err)
	}

	contractRouter, err := gorillamux.NewRouter(doc)
	if err != nil {
		t.Fatalf("create OpenAPI router: %v", err)
	}
	contractRequest := httptest.NewRequest(http.MethodGet, "http://api.test/api/v1/health", nil)
	route, pathParams, err := contractRouter.FindRoute(contractRequest)
	if err != nil {
		t.Fatalf("match request to OpenAPI route: %v", err)
	}
	requestInput := &openapi3filter.RequestValidationInput{
		Request:    contractRequest,
		PathParams: pathParams,
		Route:      route,
	}
	if err := openapi3filter.ValidateRequest(ctx, requestInput); err != nil {
		t.Fatalf("validate health request: %v", err)
	}

	response := httptest.NewRecorder()
	providerRequest := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	app.NewRouter(zap.NewNop(), nil).ServeHTTP(response, providerRequest)

	responseInput := &openapi3filter.ResponseValidationInput{
		RequestValidationInput: requestInput,
		Status:                 response.Code,
		Header:                 response.Header(),
	}
	responseInput.SetBodyBytes(response.Body.Bytes())
	if err := openapi3filter.ValidateResponse(ctx, responseInput); err != nil {
		t.Fatalf("validate health response: %v", err)
	}
}

func TestAuthProviderMatchesOpenAPI(t *testing.T) {
	doc, err := openapi3.NewLoader().LoadFromData(apidocs.Spec)
	if err != nil {
		t.Fatalf("load OpenAPI document: %v", err)
	}
	if err := doc.Validate(context.Background()); err != nil {
		t.Fatalf("validate OpenAPI document: %v", err)
	}
	contractRouter, err := gorillamux.NewRouter(doc)
	if err != nil {
		t.Fatalf("create OpenAPI router: %v", err)
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash contract test password: %v", err)
	}
	repository := &contractAuthRepository{user: auth.User{
		ID: "b173f94e-9db0-41eb-945e-44c8af09027d", Role: auth.RoleCustomer,
		DisplayName: "Contract Customer", LoginIdentifier: "customer@example.test", CredentialHash: string(passwordHash),
	}}
	provider := gin.New()
	auth.RegisterRoutes(provider.Group("/api/v1"), auth.NewService(repository, 12*time.Hour))
	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		authorize  string
		wantStatus int
	}{
		{name: "valid login", method: http.MethodPost, path: "/api/v1/auth/login", body: `{"identifier":"customer@example.test","password":"correct-password"}`, wantStatus: http.StatusOK},
		{name: "invalid login", method: http.MethodPost, path: "/api/v1/auth/login", body: `{"identifier":"user@example.test","password":"password"}`, wantStatus: http.StatusUnauthorized},
		{name: "anonymous current user", method: http.MethodGet, path: "/api/v1/auth/me", wantStatus: http.StatusUnauthorized},
		{name: "anonymous logout", method: http.MethodPost, path: "/api/v1/auth/logout", authorize: "Bearer invalid", wantStatus: http.StatusUnauthorized},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			contractRequest := httptest.NewRequest(test.method, "http://api.test"+test.path, strings.NewReader(test.body))
			if test.body != "" {
				contractRequest.Header.Set("Content-Type", "application/json")
			}
			if test.authorize != "" {
				contractRequest.Header.Set("Authorization", test.authorize)
			}
			route, pathParams, err := contractRouter.FindRoute(contractRequest)
			if err != nil {
				t.Fatalf("match request to OpenAPI route: %v", err)
			}
			requestInput := &openapi3filter.RequestValidationInput{
				Request:    contractRequest,
				PathParams: pathParams,
				Route:      route,
				Options:    &openapi3filter.Options{AuthenticationFunc: openapi3filter.NoopAuthenticationFunc},
			}
			if err := openapi3filter.ValidateRequest(context.Background(), requestInput); err != nil {
				t.Fatalf("validate %s request: %v", test.name, err)
			}

			providerRequest := httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
			providerRequest.Header = contractRequest.Header.Clone()
			response := httptest.NewRecorder()
			provider.ServeHTTP(response, providerRequest)
			if response.Code != test.wantStatus {
				t.Fatalf("provider status = %d, want %d: %s", response.Code, test.wantStatus, response.Body.String())
			}

			responseInput := &openapi3filter.ResponseValidationInput{
				RequestValidationInput: requestInput,
				Status:                 response.Code,
				Header:                 response.Header(),
			}
			responseInput.SetBodyBytes(response.Body.Bytes())
			if err := openapi3filter.ValidateResponse(context.Background(), responseInput); err != nil {
				t.Fatalf("validate %s response: %v", test.name, err)
			}

			if strings.HasPrefix(test.path, "/api/v1/auth/") && response.Code >= http.StatusBadRequest {
				var errorBody auth.ErrorResponse
				if err := json.Unmarshal(response.Body.Bytes(), &errorBody); err != nil {
					t.Fatalf("decode auth error response: %v", err)
				}
				if errorBody.RequestID == "" {
					t.Fatal("auth error response is missing requestId")
				}
			}
		})
	}
}

type contractAuthRepository struct {
	user    auth.User
	session *auth.Session
}

func (r *contractAuthRepository) FindUserByIdentifier(_ context.Context, identifier string) (auth.User, error) {
	if identifier != r.user.LoginIdentifier {
		return auth.User{}, auth.ErrNotFound
	}
	return r.user, nil
}

func (r *contractAuthRepository) FindUserByID(_ context.Context, id string) (auth.User, error) {
	if id != r.user.ID {
		return auth.User{}, auth.ErrNotFound
	}
	return r.user, nil
}

func (*contractAuthRepository) HasOperatorServiceAccess(context.Context, string, string) (bool, error) {
	return false, nil
}

func (r *contractAuthRepository) CreateSession(_ context.Context, session auth.Session) error {
	r.session = &session
	return nil
}

func (r *contractAuthRepository) FindSessionByTokenHash(_ context.Context, tokenHash string) (auth.Session, error) {
	if r.session == nil || r.session.TokenHash != tokenHash {
		return auth.Session{}, auth.ErrNotFound
	}
	return *r.session, nil
}

func (r *contractAuthRepository) RevokeSession(_ context.Context, tokenHash string, revokedAt time.Time) error {
	if r.session != nil && r.session.TokenHash == tokenHash {
		r.session.RevokedAt = &revokedAt
	}
	return nil
}

var _ auth.Repository = (*contractAuthRepository)(nil)
