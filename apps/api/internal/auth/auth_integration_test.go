//go:build integration

package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"example.com/quevo/apps/api/internal/app"
	"example.com/quevo/apps/api/internal/auth"
	"example.com/quevo/apps/api/internal/platform/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

func TestAuthFlowWithPostgres(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	container, err := postgres.Run(ctx, "postgres:17-alpine",
		postgres.WithDatabase("quevo_auth_test"),
		postgres.WithUsername("quevo"),
		postgres.WithPassword("quevo-test"),
		postgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Fatalf("start PostgreSQL container: %v", err)
	}
	t.Cleanup(func() {
		if err := testcontainers.TerminateContainer(container); err != nil {
			t.Errorf("stop PostgreSQL container: %v", err)
		}
	})

	databaseURL, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("get PostgreSQL connection string: %v", err)
	}
	db, err := database.Open(databaseURL, database.PoolConfig{
		MaxIdleConns: 1, MaxOpenConns: 2, ConnMaxLifetime: time.Minute,
	})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get SQL connection pool: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })

	if err := db.Exec(`CREATE TABLE users (
		id uuid PRIMARY KEY,
		role text NOT NULL,
		display_name text NOT NULL,
		login_identifier text NOT NULL UNIQUE,
		credential_hash text NOT NULL
	)`).Error; err != nil {
		t.Fatalf("create auth test schema: %v", err)
	}
	if err := db.Exec(`CREATE TABLE sessions (
		id uuid PRIMARY KEY,
		user_id uuid NOT NULL REFERENCES users(id),
		token_hash text NOT NULL UNIQUE,
		created_at timestamptz NOT NULL,
		expires_at timestamptz NOT NULL,
		revoked_at timestamptz
	)`).Error; err != nil {
		t.Fatalf("create session test schema: %v", err)
	}
	if err := db.Exec(`CREATE TABLE operator_services (
		operator_id uuid NOT NULL REFERENCES users(id),
		service_id uuid NOT NULL,
		PRIMARY KEY (operator_id, service_id)
	)`).Error; err != nil {
		t.Fatalf("create operator service test schema: %v", err)
	}

	customerID := uuid.New()
	operatorID := uuid.New()
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("local-demo-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash test password: %v", err)
	}
	for _, user := range []struct {
		id, role, name, identifier string
	}{
		{customerID.String(), string(auth.RoleCustomer), "Demo Customer", "customer@example.test"},
		{operatorID.String(), string(auth.RoleOperator), "Demo Operator", "operator@example.test"},
	} {
		if err := db.Exec(`INSERT INTO users (id, role, display_name, login_identifier, credential_hash) VALUES (?, ?, ?, ?, ?)`, user.id, user.role, user.name, user.identifier, string(passwordHash)).Error; err != nil {
			t.Fatalf("seed test user: %v", err)
		}
	}

	authorizedServiceID := uuid.New()
	if err := db.Exec(`INSERT INTO operator_services (operator_id, service_id) VALUES (?, ?)`, operatorID, authorizedServiceID).Error; err != nil {
		t.Fatalf("seed operator service access: %v", err)
	}

	authService := auth.NewService(auth.NewGORMRepository(db), time.Hour)
	router := app.NewRouter(zap.NewNop(), authService)
	router.Group("/api/v1").GET("/operator/services/:serviceID", auth.RequireSession(authService), auth.RequireOperatorService(authService, "serviceID"), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	for _, user := range []struct {
		identifier string
		role       auth.Role
	}{
		{identifier: "customer@example.test", role: auth.RoleCustomer},
		{identifier: "operator@example.test", role: auth.RoleOperator},
	} {
		t.Run(string(user.role), func(t *testing.T) {
			login := request(router, http.MethodPost, "/api/v1/auth/login", map[string]string{
				"identifier": user.identifier,
				"password":   "local-demo-password",
			}, "")
			if login.Code != http.StatusOK {
				t.Fatalf("login status = %d, want %d: %s", login.Code, http.StatusOK, login.Body.String())
			}
			var body auth.LoginResponse
			if err := json.Unmarshal(login.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode login response: %v", err)
			}
			if body.User.Role != user.role || body.SessionToken == "" {
				t.Fatalf("login response = %#v, want role %q and session", body, user.role)
			}

			me := request(router, http.MethodGet, "/api/v1/auth/me", nil, body.SessionToken)
			if me.Code != http.StatusOK {
				t.Fatalf("current-user status = %d, want %d: %s", me.Code, http.StatusOK, me.Body.String())
			}
			if user.role == auth.RoleCustomer {
				response := request(router, http.MethodGet, "/api/v1/operator/services/"+authorizedServiceID.String(), nil, body.SessionToken)
				if response.Code != http.StatusForbidden {
					t.Fatalf("customer operator-route status = %d, want %d", response.Code, http.StatusForbidden)
				}
			} else {
				allowed := request(router, http.MethodGet, "/api/v1/operator/services/"+authorizedServiceID.String(), nil, body.SessionToken)
				if allowed.Code != http.StatusNoContent {
					t.Fatalf("authorized operator route status = %d, want %d", allowed.Code, http.StatusNoContent)
				}
				denied := request(router, http.MethodGet, "/api/v1/operator/services/"+uuid.NewString(), nil, body.SessionToken)
				if denied.Code != http.StatusForbidden {
					t.Fatalf("unauthorized operator route status = %d, want %d", denied.Code, http.StatusForbidden)
				}
			}

			logout := request(router, http.MethodPost, "/api/v1/auth/logout", nil, body.SessionToken)
			if logout.Code != http.StatusNoContent {
				t.Fatalf("logout status = %d, want %d", logout.Code, http.StatusNoContent)
			}
			if afterLogout := request(router, http.MethodGet, "/api/v1/auth/me", nil, body.SessionToken); afterLogout.Code != http.StatusUnauthorized {
				t.Fatalf("revoked session status = %d, want %d", afterLogout.Code, http.StatusUnauthorized)
			}
		})
	}

	badLogin := request(router, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"identifier": "customer@example.test",
		"password":   "incorrect",
	}, "")
	if badLogin.Code != http.StatusUnauthorized {
		t.Fatalf("invalid login status = %d, want %d", badLogin.Code, http.StatusUnauthorized)
	}
}

func request(router http.Handler, method, path string, body any, token string) *httptest.ResponseRecorder {
	var encoded []byte
	if body != nil {
		encoded, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(encoded))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response
}
