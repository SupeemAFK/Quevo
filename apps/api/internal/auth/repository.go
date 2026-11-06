package auth

import (
	"context"
	"time"
)

// Repository is the persistence boundary used by the auth service.
type Repository interface {
	FindUserByIdentifier(context.Context, string) (User, error)
	FindUserByID(context.Context, string) (User, error)
	HasOperatorServiceAccess(context.Context, string, string) (bool, error)
	CreateSession(context.Context, Session) error
	FindSessionByTokenHash(context.Context, string) (Session, error)
	RevokeSession(context.Context, string, time.Time) error
}
