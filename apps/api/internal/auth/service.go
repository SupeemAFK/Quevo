package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const DefaultSessionTTL = 12 * time.Hour

var (
	ErrNotFound           = errors.New("auth record not found")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUnauthenticated    = errors.New("unauthenticated")
	ErrForbidden          = errors.New("forbidden")
	ErrNotOwner           = errors.New("resource is not owned by customer")
)

type Service struct {
	repository Repository
	sessionTTL time.Duration
}

func NewService(repository Repository, sessionTTL time.Duration) *Service {
	if sessionTTL <= 0 {
		sessionTTL = DefaultSessionTTL
	}
	return &Service{repository: repository, sessionTTL: sessionTTL}
}

func (s *Service) Login(ctx context.Context, identifier, password string) (LoginResult, error) {
	user, err := s.repository.FindUserByIdentifier(ctx, normalizeIdentifier(identifier))
	if errors.Is(err, ErrNotFound) {
		return LoginResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return LoginResult{}, fmt.Errorf("find login user: %w", err)
	}
	if bcrypt.CompareHashAndPassword([]byte(user.CredentialHash), []byte(password)) != nil || !validRole(user.Role) {
		return LoginResult{}, ErrInvalidCredentials
	}

	token, err := newSessionToken()
	if err != nil {
		return LoginResult{}, fmt.Errorf("create session token: %w", err)
	}
	now := time.Now().UTC()
	expiresAt := now.Add(s.sessionTTL)
	session := Session{
		ID:        uuid.NewString(),
		UserID:    user.ID,
		TokenHash: hashSessionToken(token),
		CreatedAt: now,
		ExpiresAt: expiresAt,
	}
	if err := s.repository.CreateSession(ctx, session); err != nil {
		return LoginResult{}, fmt.Errorf("create session: %w", err)
	}

	return LoginResult{
		User:         Actor{ID: user.ID, DisplayName: user.DisplayName, Role: user.Role},
		SessionToken: token,
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *Service) Authenticate(ctx context.Context, token string) (Actor, error) {
	if strings.TrimSpace(token) == "" {
		return Actor{}, ErrUnauthenticated
	}

	session, err := s.repository.FindSessionByTokenHash(ctx, hashSessionToken(token))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return Actor{}, ErrUnauthenticated
		}
		return Actor{}, fmt.Errorf("find session: %w", err)
	}
	if session.RevokedAt != nil || !session.ExpiresAt.After(time.Now().UTC()) {
		return Actor{}, ErrUnauthenticated
	}

	user, err := s.repository.FindUserByID(ctx, session.UserID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return Actor{}, ErrUnauthenticated
		}
		return Actor{}, fmt.Errorf("find session user: %w", err)
	}
	if !validRole(user.Role) {
		return Actor{}, ErrUnauthenticated
	}

	return Actor{ID: user.ID, DisplayName: user.DisplayName, Role: user.Role}, nil
}

func (s *Service) Logout(ctx context.Context, token string) error {
	if strings.TrimSpace(token) == "" {
		return ErrUnauthenticated
	}
	if err := s.repository.RevokeSession(ctx, hashSessionToken(token), time.Now().UTC()); err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}

func (s *Service) AuthorizeOperatorService(ctx context.Context, actor Actor, serviceID string) error {
	if actor.Role != RoleOperator {
		return ErrForbidden
	}
	allowed, err := s.repository.HasOperatorServiceAccess(ctx, actor.ID, serviceID)
	if err != nil {
		return fmt.Errorf("check operator service access: %w", err)
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}

func normalizeIdentifier(identifier string) string {
	return strings.ToLower(strings.TrimSpace(identifier))
}

func validRole(role Role) bool {
	return role == RoleCustomer || role == RoleOperator
}

func newSessionToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func hashSessionToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// RequireCustomerOwnership hides another customer's resource as not found.
func RequireCustomerOwnership(actor Actor, customerID string) error {
	if actor.Role != RoleCustomer || actor.ID != customerID {
		return ErrNotOwner
	}
	return nil
}
