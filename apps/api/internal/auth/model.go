package auth

import "time"

type Role string

const (
	RoleCustomer Role = "CUSTOMER"
	RoleOperator Role = "OPERATOR"
)

// User is the authentication data needed for identity and authorization.
type User struct {
	ID           string
	Role         Role
	DisplayName  string
	Email        string
	PasswordHash string
}

// Session stores metadata for a single authenticated login.
type Session struct {
	ID        string
	UserID    string
	TokenHash string
	CreatedAt time.Time
	ExpiresAt time.Time
	RevokedAt *time.Time
}

// Actor is the authenticated user attached to a request.
type Actor struct {
	ID          string
	DisplayName string
	Role        Role
}

// LoginResult includes the secret session token for the trusted web server.
type LoginResult struct {
	User         Actor
	SessionToken string
	ExpiresAt    time.Time
}
