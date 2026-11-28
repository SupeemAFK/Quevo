package queue

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const maxTicketDocumentBytes = 10 << 20
const maxTicketDocuments = 5

var ErrDocumentUnavailable = errors.New("ticket documents are not available")

type TicketDocument struct {
	ID        string `json:"id"`
	FileName  string `json:"fileName"`
	MediaType string `json:"mediaType"`
	ByteSize  int64  `json:"byteSize"`
	CreatedAt string `json:"createdAt"`
	Content   []byte `json:"-"`
}

func (r *Repository) SaveTicketDocument(ctx context.Context, customerID, ticketID, fileName, claimedType string, content []byte) (TicketDocument, error) {
	if len(content) == 0 || len(content) > maxTicketDocumentBytes {
		return TicketDocument{}, ErrInvalidInput
	}
	fileName = filepath.Base(strings.TrimSpace(fileName))
	if fileName == "." || fileName == "" || len([]rune(fileName)) > 180 {
		return TicketDocument{}, ErrInvalidInput
	}
	for _, character := range fileName {
		if unicode.IsControl(character) || character == '/' || character == '\\' {
			return TicketDocument{}, ErrInvalidInput
		}
	}
	mediaType := http.DetectContentType(content)
	if mediaType != "application/pdf" && mediaType != "image/jpeg" && mediaType != "image/png" {
		return TicketDocument{}, ErrInvalidInput
	}
	if claimedType != "" && claimedType != "application/octet-stream" && claimedType != mediaType {
		return TicketDocument{}, ErrInvalidInput
	}
	extension := strings.ToLower(filepath.Ext(fileName))
	if mediaType == "application/pdf" && extension != ".pdf" || mediaType == "image/jpeg" && extension != ".jpg" && extension != ".jpeg" || mediaType == "image/png" && extension != ".png" {
		return TicketDocument{}, ErrInvalidInput
	}
	digest := sha256.Sum256(content)
	var document TicketDocument
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var allowsUploads bool
		var status string
		err := tx.Raw(`SELECT s.allows_uploads, t.status FROM tickets t
			JOIN services s ON s.id = t.service_id WHERE t.id = ? AND t.customer_id = ? FOR UPDATE OF t`, ticketID, customerID).Row().Scan(&allowsUploads, &status)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTicketNotFound
		}
		if err != nil {
			return err
		}
		if !allowsUploads || (status != "WAITING" && status != "PENDING") {
			return ErrDocumentUnavailable
		}
		var count int64
		if err := tx.Raw(`SELECT count(*) FROM ticket_documents WHERE ticket_id = ?`, ticketID).Row().Scan(&count); err != nil {
			return err
		}
		if count >= maxTicketDocuments {
			return ErrInvalidInput
		}
		id := uuid.NewString()
		if err := tx.Exec(`INSERT INTO ticket_documents (id, ticket_id, uploaded_by, file_name, media_type, byte_size, sha256, content)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, id, ticketID, customerID, fileName, mediaType, len(content), fmt.Sprintf("%x", digest), content).Error; err != nil {
			return err
		}
		err = tx.Raw(`SELECT id::text AS id, file_name, media_type, byte_size, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
			FROM ticket_documents WHERE id = ?`, id).Row().Scan(&document.ID, &document.FileName, &document.MediaType, &document.ByteSize, &document.CreatedAt)
		return err
	})
	return document, err
}

func (r *Repository) ListTicketDocuments(ctx context.Context, actorID, role, ticketID string) ([]TicketDocument, error) {
	if err := r.authorizeTicketDocuments(ctx, actorID, role, ticketID); err != nil {
		return nil, err
	}
	var documents []TicketDocument
	err := r.db.WithContext(ctx).Table("ticket_documents").
		Select(`id::text AS id, file_name, media_type, byte_size,
		to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`).
		Where("ticket_id = ?", ticketID).Order("created_at, id").Scan(&documents).Error
	if err != nil {
		return nil, fmt.Errorf("list ticket documents: %w", err)
	}
	if documents == nil {
		documents = []TicketDocument{}
	}
	return documents, nil
}

func (r *Repository) GetTicketDocument(ctx context.Context, actorID, role, ticketID, documentID string) (TicketDocument, error) {
	if err := r.authorizeTicketDocuments(ctx, actorID, role, ticketID); err != nil {
		return TicketDocument{}, err
	}
	var document TicketDocument
	err := r.db.WithContext(ctx).Table("ticket_documents").
		Select(`id::text AS id, file_name, media_type, byte_size, content,
		to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`).
		Where("ticket_id = ? AND id = ?", ticketID, documentID).Take(&document).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return TicketDocument{}, ErrDocumentUnavailable
	}
	if err != nil {
		return TicketDocument{}, fmt.Errorf("read ticket document: %w", err)
	}
	return document, nil
}

func (r *Repository) authorizeTicketDocuments(ctx context.Context, actorID, role, ticketID string) error {
	var allowed bool
	err := r.db.WithContext(ctx).Raw(`SELECT EXISTS (SELECT 1 FROM tickets t WHERE t.id = ? AND (
		(? = 'CUSTOMER' AND t.customer_id = ?)
		OR (? = 'BRANCH_MANAGER' AND EXISTS (SELECT 1 FROM branch_managers bm WHERE bm.branch_id = t.branch_id AND bm.manager_id = ?))
		OR (? = 'OPERATOR' AND t.assigned_operator_id = ?)
		OR (? = 'OPERATOR' AND EXISTS (SELECT 1 FROM queue_operators qo WHERE qo.queue_id = t.queue_id AND qo.operator_id = ?))
		OR (? = 'OPERATOR' AND EXISTS (SELECT 1 FROM counter_queues cq JOIN counter_operators co ON co.counter_id = cq.counter_id WHERE cq.queue_id = t.queue_id AND co.operator_id = ?))
	))`, ticketID, role, actorID, role, actorID, role, actorID, role, actorID, role, actorID).Row().Scan(&allowed)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrQueueUnauthorized
	}
	return nil
}
