package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func newMemoryRepository(t *testing.T, role Role) *memoryRepository {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash test password: %v", err)
	}
	return &memoryRepository{
		user: User{
			ID: "b173f94e-9db0-41eb-945e-44c8af09027d", Role: role, DisplayName: "Demo Customer",
			Email: "customer@example.test", PasswordHash: string(hash),
		},
	}
}

type memoryRepository struct {
	user             User
	sessions         []Session
	operatorServices map[string]bool
}

func (r *memoryRepository) FindUserByEmail(_ context.Context, email string) (User, error) {
	if email != r.user.Email {
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
