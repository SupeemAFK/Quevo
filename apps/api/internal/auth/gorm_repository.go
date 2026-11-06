package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GORMRepository struct {
	db *gorm.DB
}

func NewGORMRepository(db *gorm.DB) *GORMRepository {
	return &GORMRepository{db: db}
}

func (r *GORMRepository) FindUserByIdentifier(ctx context.Context, identifier string) (User, error) {
	var record userRecord
	err := r.db.WithContext(ctx).Where("login_identifier = ?", identifier).Take(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	return record.user(), nil
}

func (r *GORMRepository) FindUserByID(ctx context.Context, id string) (User, error) {
	userID, err := uuid.Parse(id)
	if err != nil {
		return User{}, ErrNotFound
	}
	var record userRecord
	err = r.db.WithContext(ctx).Where("id = ?", userID).Take(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	return record.user(), nil
}

func (r *GORMRepository) HasOperatorServiceAccess(ctx context.Context, operatorID, serviceID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("operator_services").
		Where("operator_id = ? AND service_id = ?", operatorID, serviceID).
		Count(&count).Error
	return count > 0, err
}

func (r *GORMRepository) CreateSession(ctx context.Context, session Session) error {
	sessionID, err := uuid.Parse(session.ID)
	if err != nil {
		return fmt.Errorf("parse session ID: %w", err)
	}
	userID, err := uuid.Parse(session.UserID)
	if err != nil {
		return fmt.Errorf("parse session user ID: %w", err)
	}
	record := sessionRecord{
		ID:        sessionID,
		UserID:    userID,
		TokenHash: session.TokenHash,
		CreatedAt: session.CreatedAt,
		ExpiresAt: session.ExpiresAt,
		RevokedAt: session.RevokedAt,
	}
	return r.db.WithContext(ctx).Create(&record).Error
}

func (r *GORMRepository) FindSessionByTokenHash(ctx context.Context, tokenHash string) (Session, error) {
	var record sessionRecord
	err := r.db.WithContext(ctx).Where("token_hash = ?", tokenHash).Take(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Session{}, ErrNotFound
	}
	if err != nil {
		return Session{}, err
	}
	return record.session(), nil
}

func (r *GORMRepository) RevokeSession(ctx context.Context, tokenHash string, revokedAt time.Time) error {
	return r.db.WithContext(ctx).
		Model(&sessionRecord{}).
		Where("token_hash = ? AND revoked_at IS NULL", tokenHash).
		Update("revoked_at", revokedAt).Error
}

type userRecord struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey"`
	Role            string
	DisplayName     string
	LoginIdentifier string
	CredentialHash  string
}

func (userRecord) TableName() string { return "users" }

func (record userRecord) user() User {
	return User{
		ID:              record.ID.String(),
		Role:            Role(record.Role),
		DisplayName:     record.DisplayName,
		LoginIdentifier: record.LoginIdentifier,
		CredentialHash:  record.CredentialHash,
	}
}

type sessionRecord struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid;not null"`
	TokenHash string    `gorm:"not null;uniqueIndex"`
	CreatedAt time.Time `gorm:"not null"`
	ExpiresAt time.Time `gorm:"not null"`
	RevokedAt *time.Time
}

func (sessionRecord) TableName() string { return "sessions" }

func (record sessionRecord) session() Session {
	return Session{
		ID:        record.ID.String(),
		UserID:    record.UserID.String(),
		TokenHash: record.TokenHash,
		CreatedAt: record.CreatedAt,
		ExpiresAt: record.ExpiresAt,
		RevokedAt: record.RevokedAt,
	}
}
