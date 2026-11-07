//go:build integration

package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
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
	"gorm.io/gorm"
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

	if err := database.Migrate(ctx, db); err != nil {
		t.Fatalf("apply production migrations: %v", err)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte("local-demo-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash test password: %v", err)
	}
	if err := database.SeedDemo(ctx, db, database.SeedCredentials{
		CustomerPasswordHash: string(passwordHash),
		OperatorPasswordHash: string(passwordHash),
	}); err != nil {
		t.Fatalf("seed demo users: %v", err)
	}
	assertGORMAuthLogsAreSafe(t, ctx, db)
	if _, err := sqlDB.ExecContext(ctx, `UPDATE users SET email = ' Customer@Quevo.Local ' WHERE id = $1`, database.DemoCustomerID); err != nil {
		t.Fatalf("prepare mixed-case email: %v", err)
	}

	authorizedServiceID := database.DemoServiceID

	authService := auth.NewService(auth.NewGORMRepository(db), time.Hour)
	router := app.NewRouter(zap.NewNop(), authService)
	router.Group("/api/v1").GET("/operator/services/:serviceID", auth.RequireSession(authService), auth.RequireOperatorService(authService, "serviceID"), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	for _, user := range []struct {
		email, id, displayName string
		role                   auth.Role
	}{
		{email: "customer@quevo.local", id: database.DemoCustomerID, displayName: "Demo Customer", role: auth.RoleCustomer},
		{email: "operator@quevo.local", id: database.DemoOperatorID, displayName: "Demo Operator", role: auth.RoleOperator},
	} {
		t.Run(string(user.role), func(t *testing.T) {
			login := request(router, http.MethodPost, "/api/v1/auth/login", map[string]string{
				"email":    user.email,
				"password": "local-demo-password",
			}, "")
			if login.Code != http.StatusOK {
				t.Fatalf("login status = %d, want %d: %s", login.Code, http.StatusOK, login.Body.String())
			}
			var body auth.LoginResponse
			if err := json.Unmarshal(login.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode login response: %v", err)
			}
			if body.User.ID != user.id || body.User.DisplayName != user.displayName || body.User.Role != user.role || body.SessionToken == "" {
				t.Fatalf("login response = %#v; want user %s with role %q and a session", body, user.id, user.role)
			}

			me := request(router, http.MethodGet, "/api/v1/auth/me", nil, body.SessionToken)
			if me.Code != http.StatusOK {
				t.Fatalf("current-user status = %d, want %d: %s", me.Code, http.StatusOK, me.Body.String())
			}
			var currentUser auth.MeResponse
			if err := json.Unmarshal(me.Body.Bytes(), &currentUser); err != nil {
				t.Fatalf("decode current-user response: %v", err)
			}
			if currentUser.User.ID != user.id || currentUser.User.Role != user.role {
				t.Fatalf("current user = %#v; want id %s and role %s", currentUser.User, user.id, user.role)
			}
			if user.role == auth.RoleCustomer {
				response := request(router, http.MethodGet, "/api/v1/operator/services/"+authorizedServiceID, nil, body.SessionToken)
				if response.Code != http.StatusForbidden {
					t.Fatalf("customer operator-route status = %d, want %d", response.Code, http.StatusForbidden)
				}
			} else {
				allowed := request(router, http.MethodGet, "/api/v1/operator/services/"+authorizedServiceID, nil, body.SessionToken)
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
		"email":    "customer@quevo.local",
		"password": "incorrect",
	}, "")
	if badLogin.Code != http.StatusUnauthorized {
		t.Fatalf("invalid login status = %d, want %d", badLogin.Code, http.StatusUnauthorized)
	}
}

func assertGORMAuthLogsAreSafe(t *testing.T, ctx context.Context, db *gorm.DB) {
	t.Helper()

	previousWriter := log.Writer()
	var output bytes.Buffer
	log.SetOutput(&output)
	defer log.SetOutput(previousWriter)

	repository := auth.NewGORMRepository(db)
	if _, err := repository.FindUserByEmail(ctx, "missing@example.test"); !errors.Is(err, auth.ErrNotFound) {
		t.Fatalf("missing email lookup error = %v, want ErrNotFound", err)
	}
	if _, err := repository.FindSessionByTokenHash(ctx, strings.Repeat("a", 64)); !errors.Is(err, auth.ErrNotFound) {
		t.Fatalf("missing session lookup error = %v, want ErrNotFound", err)
	}
	if output.Len() != 0 {
		t.Fatalf("expected record-not-found lookups to be omitted from GORM logs, got %q", output.String())
	}

	const sensitiveEmail = "do-not-log@example.test"
	var result struct{ ID string }
	err := db.WithContext(ctx).Table("users").Select("missing_column").
		Where("email = ?", sensitiveEmail).Take(&result).Error
	if err == nil {
		t.Fatal("query with a missing column unexpectedly succeeded")
	}
	if output.Len() == 0 {
		t.Fatal("expected the failed query to be logged")
	}
	if strings.Contains(output.String(), sensitiveEmail) {
		t.Fatalf("GORM query log exposed a bound email: %q", output.String())
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
