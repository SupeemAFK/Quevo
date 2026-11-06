package auth

import (
	"context"
	"errors"
	"testing"
	"time"
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
