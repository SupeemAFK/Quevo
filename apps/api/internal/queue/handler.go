package queue

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"

	"example.com/quevo/apps/api/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ServiceResponse struct {
	ID                string             `json:"id" binding:"required" example:"10000000-0000-4000-8000-000000000002"`
	BranchID          string             `json:"branchId" binding:"required" example:"10000000-0000-4000-8000-000000000001"`
	BranchName        string             `json:"branchName" binding:"required" example:"Quevo Demo Branch"`
	Name              string             `json:"name" binding:"required" example:"General Service"`
	Queues            []AvailableQueue   `json:"queues" binding:"required"`
	Fields            []ServiceFormField `json:"fields" binding:"required"`
	AllowsUploads     bool               `json:"allowsUploads"`
	RequiresDocuments bool               `json:"requiresDocuments"`
	DocumentGuidance  string             `json:"documentGuidance"`
}

type ServicesResponse struct {
	Items []ServiceResponse `json:"items" binding:"required"`
}

type CustomerTicketsResponse struct {
	Items []TicketResponse `json:"items" binding:"required"`
}

type TicketResponse struct {
	ID                string         `json:"id" binding:"required" example:"d6d26a41-5c50-4ca9-b4f7-e82d7558da79"`
	BranchID          string         `json:"branchId" binding:"required" example:"10000000-0000-4000-8000-000000000001"`
	BranchName        string         `json:"branchName" binding:"required" example:"Quevo Demo Branch"`
	ServiceID         string         `json:"serviceId" binding:"required" example:"10000000-0000-4000-8000-000000000002"`
	ServiceName       string         `json:"serviceName" binding:"required" example:"General Service"`
	QueueID           string         `json:"queueId" binding:"required"`
	QueueName         string         `json:"queueName" binding:"required"`
	RequestAnswers    RequestAnswers `json:"requestAnswers" binding:"required"`
	RequestLabels     RequestAnswers `json:"requestLabels" binding:"required"`
	AllowsUploads     bool           `json:"allowsUploads"`
	RequiresDocuments bool           `json:"requiresDocuments"`
	DocumentGuidance  string         `json:"documentGuidance"`
	BusinessDate      string         `json:"businessDate" binding:"required" example:"2026-11-07"`
	TicketNumber      string         `json:"ticketNumber" binding:"required" example:"1"`
	Status            string         `json:"status" binding:"required" example:"WAITING"`
	JoinedAt          time.Time      `json:"joinedAt" binding:"required" example:"2026-11-07T12:00:00Z"`
}

type QueueErrorResponse struct {
	Code      string `json:"code" binding:"required" example:"active_ticket_exists"`
	Message   string `json:"message" binding:"required" example:"You already have an active ticket for this service today"`
	RequestID string `json:"requestId" binding:"required" example:"0e85b5d4-fdda-48fd-a026-45128b73afc3"`
}

type JoinTicketRequest struct {
	RequestAnswers RequestAnswers `json:"requestAnswers"`
	RequestLabels  RequestAnswers `json:"requestLabels"`
}

type TicketDocumentsResponse struct {
	Items []TicketDocument `json:"items" binding:"required"`
}

type Handler struct {
	repository *Repository
}

func RegisterRoutes(routes *gin.RouterGroup, authService *auth.Service, repository *Repository) {
	handler := Handler{repository: repository}
	customerRoutes := routes.Group("")
	customerRoutes.Use(auth.RequireSession(authService), auth.RequireRoles(auth.RoleCustomer))
	customerRoutes.GET("/services", handler.listServices)
	customerRoutes.POST("/branches/:branchID/services/:serviceID/tickets", handler.joinQueue)
	customerRoutes.POST("/branches/:branchID/queues/:queueID/tickets", handler.joinQueueByQueue)
	customerRoutes.GET("/tickets/active", handler.listActiveTickets)
	customerRoutes.GET("/tickets/:ticketID", handler.getTicket)
	customerRoutes.POST("/tickets/:ticketID/cancel", handler.cancelTicket)
	customerRoutes.POST("/tickets/:ticketID/documents", handler.uploadDocument)
	documentRoutes := routes.Group("")
	documentRoutes.Use(auth.RequireSession(authService), auth.RequireRoles(auth.RoleCustomer, auth.RoleOperator, auth.RoleBranchManager))
	documentRoutes.GET("/tickets/:ticketID/documents", handler.listDocuments)
	documentRoutes.GET("/tickets/:ticketID/documents/:documentID", handler.downloadDocument)
	registerOperatorRoutes(routes, authService, repository)
	registerExpansionRoutes(routes, authService, repository)
}

// joinQueueByQueue creates a waiting ticket in the selected service queue.
//
// @Summary Join a selected queue
// @Tags tickets
// @ID postCustomerQueueTicket
// @Accept json
// @Produce json
// @Param branchId path string true "Branch ID" format(uuid)
// @Param queueId path string true "Queue ID" format(uuid)
// @Param request body JoinTicketRequest true "Customer request details"
// @Security BearerAuth
// @Success 201 {object} TicketResponse
// @Failure 400 {object} QueueErrorResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Failure 404 {object} QueueErrorResponse
// @Failure 409 {object} QueueErrorResponse
// @Router /branches/{branchId}/queues/{queueId}/tickets [post]
func (h Handler) joinQueueByQueue(c *gin.Context) { h.joinQueue(c) }

// ListServices returns active services available to customers.
//
// ListServices godoc
// @Summary List available services
// @Description Returns active services. An optional branch ID filters the list.
// @Tags services
// @ID getServices
// @Produce json
// @Param branchId query string false "Filter by branch ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} ServicesResponse
// @Failure 400 {object} QueueErrorResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /services [get]
func (h Handler) listServices(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Services are temporarily unavailable")
		return
	}
	branchID := strings.TrimSpace(c.Query("branchId"))
	if branchID != "" {
		if _, err := uuid.Parse(branchID); err != nil {
			writeQueueError(c, http.StatusBadRequest, "invalid_request", "A valid branch ID is required")
			return
		}
	}
	services, err := h.repository.ListAvailableServices(c.Request.Context(), branchID)
	if err != nil {
		writeQueueError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
		return
	}
	response := ServicesResponse{Items: make([]ServiceResponse, 0, len(services))}
	for _, service := range services {
		response.Items = append(response.Items, ServiceResponse{
			ID: service.ID, BranchID: service.BranchID, BranchName: service.BranchName, Name: service.Name,
			Queues: service.Queues, Fields: service.Fields, AllowsUploads: service.AllowsUploads,
			RequiresDocuments: service.RequiresDocuments, DocumentGuidance: service.DocumentGuidance,
		})
	}
	c.JSON(http.StatusOK, response)
}

// JoinQueue creates a waiting ticket for the authenticated customer.
//
// JoinQueue godoc
// @Summary Join a service queue
// @Description Creates a WAITING ticket and allocates its number using the branch-local business date.
// @Tags tickets
// @ID postCustomerTicket
// @Produce json
// @Param branchId path string true "Branch ID" format(uuid)
// @Param serviceId path string true "Service ID" format(uuid)
// @Security BearerAuth
// @Success 201 {object} TicketResponse
// @Failure 400 {object} QueueErrorResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Failure 404 {object} QueueErrorResponse
// @Failure 409 {object} QueueErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /branches/{branchId}/services/{serviceId}/tickets [post]
func (h Handler) joinQueue(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Queue joining is temporarily unavailable")
		return
	}
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	queueID := strings.TrimSpace(c.Param("queueID"))
	serviceID := strings.TrimSpace(c.Param("serviceID"))
	if queueID != "" {
		if _, err := uuid.Parse(queueID); err != nil {
			queueBadRequest(c)
			return
		}
	}
	if serviceID != "" {
		if _, err := uuid.Parse(serviceID); err != nil {
			queueBadRequest(c)
			return
		}
	}
	if queueID == "" && serviceID == "" {
		queueBadRequest(c)
		return
	}
	actor, ok := auth.ActorFromContext(c)
	if !ok {
		writeQueueError(c, http.StatusUnauthorized, "unauthorized", "Authentication is required")
		return
	}
	var request JoinTicketRequest
	if c.Request.ContentLength != 0 {
		decoder := json.NewDecoder(io.LimitReader(c.Request.Body, 16<<10))
		if err := decoder.Decode(&request); err != nil {
			queueBadRequest(c)
			return
		}
		if decoder.Decode(new(any)) != io.EOF {
			queueBadRequest(c)
			return
		}
	}
	ticket, err := h.repository.JoinQueue(c.Request.Context(), JoinQueueInput{
		CustomerID:     actor.ID,
		BranchID:       branchID,
		ServiceID:      serviceID,
		QueueID:        queueID,
		RequestAnswers: request.RequestAnswers,
	})
	if errors.Is(err, ErrServiceUnavailable) {
		writeQueueError(c, http.StatusNotFound, "service_not_found", "The selected service is not available")
		return
	}
	if errors.Is(err, ErrActiveTicket) {
		writeQueueError(c, http.StatusConflict, "active_ticket_exists", "You already have an active ticket for this service today")
		return
	}
	if errors.Is(err, ErrQueueUnauthorized) {
		writeQueueError(c, http.StatusForbidden, "forbidden", "You do not have permission to join this queue")
		return
	}
	if errors.Is(err, ErrInvalidInput) {
		writeQueueError(c, http.StatusBadRequest, "invalid_request", "Review the service form and try again")
		return
	}
	if err != nil {
		writeQueueError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
		return
	}
	c.JSON(http.StatusCreated, ticketResponse(ticket))
}

// GetTicket returns a ticket only when it belongs to the authenticated customer.
//
// GetTicket godoc
// @Summary Get my ticket
// @Description Returns the current state of the specified ticket when it belongs to the authenticated customer.
// @Tags tickets
// @ID getCustomerTicket
// @Produce json
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} TicketResponse
// @Failure 400 {object} QueueErrorResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Failure 404 {object} QueueErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /tickets/{ticketId} [get]
func (h Handler) getTicket(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Ticket lookup is temporarily unavailable")
		return
	}
	ticketID, ok := parsePathUUID(c, "ticketID")
	if !ok {
		return
	}
	actor, ok := auth.ActorFromContext(c)
	if !ok {
		writeQueueError(c, http.StatusUnauthorized, "unauthorized", "Authentication is required")
		return
	}
	ticket, err := h.repository.FindCustomerTicket(c.Request.Context(), actor.ID, ticketID)
	if errors.Is(err, ErrTicketNotFound) {
		writeQueueError(c, http.StatusNotFound, "ticket_not_found", "The ticket could not be found")
		return
	}
	if err != nil {
		writeQueueError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
		return
	}
	c.JSON(http.StatusOK, ticketResponse(ticket))
}

// ListActiveTickets returns the authenticated customer's active tickets.
//
// ListActiveTickets godoc
// @Summary List my active tickets
// @Description Returns active tickets owned by the authenticated customer so they can recover a ticket without its original URL.
// @Tags tickets
// @ID getActiveCustomerTickets
// @Produce json
// @Security BearerAuth
// @Success 200 {object} CustomerTicketsResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /tickets/active [get]
func (h Handler) listActiveTickets(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Ticket lookup is temporarily unavailable")
		return
	}
	actor, ok := auth.ActorFromContext(c)
	if !ok {
		writeQueueError(c, http.StatusUnauthorized, "unauthorized", "Authentication is required")
		return
	}
	tickets, err := h.repository.ListActiveCustomerTickets(c.Request.Context(), actor.ID)
	if err != nil {
		writeQueueError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
		return
	}
	response := CustomerTicketsResponse{Items: make([]TicketResponse, 0, len(tickets))}
	for _, ticket := range tickets {
		response.Items = append(response.Items, ticketResponse(ticket))
	}
	c.JSON(http.StatusOK, response)
}

// cancelTicket cancels the customer's waiting ticket.
// @Summary Cancel a waiting ticket
// @Tags tickets
// @ID postCustomerCancelTicket
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} TicketResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 404 {object} QueueErrorResponse
// @Failure 409 {object} QueueErrorResponse
// @Router /tickets/{ticketId}/cancel [post]
func (h Handler) cancelTicket(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Tickets are temporarily unavailable")
		return
	}
	ticketID, ok := parsePathUUID(c, "ticketID")
	if !ok {
		return
	}
	actor, _ := auth.ActorFromContext(c)
	_, err := h.repository.CancelCustomerTicket(c.Request.Context(), actor.ID, ticketID)
	switch {
	case errors.Is(err, ErrTicketNotFound):
		writeQueueError(c, http.StatusNotFound, "ticket_not_found", "The ticket could not be found")
	case errors.Is(err, ErrInvalidTransition):
		writeQueueError(c, http.StatusConflict, "invalid_transition", "Only a waiting ticket can be cancelled")
	case err != nil:
		writeQueueError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
	default:
		ticket, findErr := h.repository.FindCustomerTicket(c.Request.Context(), actor.ID, ticketID)
		if findErr != nil {
			writeQueueError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
			return
		}
		c.JSON(http.StatusOK, ticketResponse(ticket))
	}
}

// uploadDocument stores a validated private ticket attachment.
// @Summary Upload a ticket document
// @Tags tickets
// @ID postCustomerTicketDocument
// @Accept multipart/form-data
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Param file formData file true "PDF, PNG, or JPG file (10 MB maximum)"
// @Security BearerAuth
// @Success 201 {object} TicketDocument
// @Failure 400 {object} QueueErrorResponse
// @Failure 409 {object} QueueErrorResponse
// @Router /tickets/{ticketId}/documents [post]
func (h Handler) uploadDocument(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Document uploads are temporarily unavailable")
		return
	}
	ticketID, ok := parsePathUUID(c, "ticketID")
	if !ok {
		return
	}
	actor, _ := auth.ActorFromContext(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxTicketDocumentBytes+(1<<20))
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		writeQueueError(c, http.StatusBadRequest, "invalid_request", "Choose a PDF, JPG, or PNG file up to 10 MB")
		return
	}
	defer file.Close()
	if header.Size <= 0 || header.Size > maxTicketDocumentBytes {
		writeQueueError(c, http.StatusBadRequest, "invalid_request", "Choose a PDF, JPG, or PNG file up to 10 MB")
		return
	}
	content, err := io.ReadAll(io.LimitReader(file, maxTicketDocumentBytes+1))
	if err != nil || len(content) > maxTicketDocumentBytes {
		writeQueueError(c, http.StatusBadRequest, "invalid_request", "Choose a PDF, JPG, or PNG file up to 10 MB")
		return
	}
	document, err := h.repository.SaveTicketDocument(c.Request.Context(), actor.ID, ticketID, header.Filename, header.Header.Get("Content-Type"), content)
	switch {
	case errors.Is(err, ErrTicketNotFound):
		writeQueueError(c, http.StatusNotFound, "ticket_not_found", "The ticket could not be found")
	case errors.Is(err, ErrDocumentUnavailable):
		writeQueueError(c, http.StatusConflict, "document_upload_unavailable", "Documents cannot be added to this ticket")
	case errors.Is(err, ErrInvalidInput):
		writeQueueError(c, http.StatusBadRequest, "invalid_request", "Choose a PDF, JPG, or PNG file up to 10 MB; up to five files can be added")
	case err != nil:
		writeQueueError(c, http.StatusInternalServerError, "internal_error", "The document could not be saved")
	default:
		c.JSON(http.StatusCreated, document)
	}
}

// listDocuments lists private document metadata for an authorized ticket.
// @Summary List ticket documents
// @Tags tickets
// @ID getTicketDocuments
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} TicketDocumentsResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /tickets/{ticketId}/documents [get]
func (h Handler) listDocuments(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Ticket documents are temporarily unavailable")
		return
	}
	ticketID, ok := parsePathUUID(c, "ticketID")
	if !ok {
		return
	}
	actor, _ := auth.ActorFromContext(c)
	documents, err := h.repository.ListTicketDocuments(c.Request.Context(), actor.ID, string(actor.Role), ticketID)
	if err != nil {
		operatorError(c, err)
		return
	}
	c.JSON(http.StatusOK, TicketDocumentsResponse{Items: documents})
}

// downloadDocument streams a private attachment after checking ticket access.
// @Summary Download a ticket document
// @Tags tickets
// @ID getTicketDocument
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Param documentId path string true "Document ID" format(uuid)
// @Security BearerAuth
// @Produce application/octet-stream
// @Success 200 {string} string "Binary document contents"
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Failure 404 {object} QueueErrorResponse
// @Router /tickets/{ticketId}/documents/{documentId} [get]
func (h Handler) downloadDocument(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Ticket documents are temporarily unavailable")
		return
	}
	ticketID, ok := parsePathUUID(c, "ticketID")
	if !ok {
		return
	}
	documentID, ok := parsePathUUID(c, "documentID")
	if !ok {
		return
	}
	actor, _ := auth.ActorFromContext(c)
	document, err := h.repository.GetTicketDocument(c.Request.Context(), actor.ID, string(actor.Role), ticketID, documentID)
	if err != nil {
		operatorError(c, err)
		return
	}
	c.Header("Cache-Control", "private, no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": document.FileName}))
	c.Data(http.StatusOK, document.MediaType, document.Content)
}

func parsePathUUID(c *gin.Context, name string) (string, bool) {
	value, err := uuid.Parse(c.Param(name))
	if err != nil {
		writeQueueError(c, http.StatusBadRequest, "invalid_request", "A valid resource ID is required")
		return "", false
	}
	return value.String(), true
}

func ticketResponse(ticket Ticket) TicketResponse {
	return TicketResponse{
		ID: ticket.ID, BranchID: ticket.BranchID, BranchName: ticket.BranchName,
		ServiceID: ticket.ServiceID, ServiceName: ticket.ServiceName,
		QueueID: ticket.QueueID, QueueName: ticket.QueueName, RequestAnswers: ticket.RequestAnswers, RequestLabels: ticket.RequestLabels,
		AllowsUploads: ticket.AllowsUploads, RequiresDocuments: ticket.RequiresDocuments, DocumentGuidance: ticket.DocumentGuidance,
		BusinessDate: ticket.BusinessDate.Format("2006-01-02"), TicketNumber: ticket.TicketNumber,
		Status: ticket.Status, JoinedAt: ticket.JoinedAt,
	}
}

func writeQueueError(c *gin.Context, status int, code, message string) {
	requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
	if requestID == "" {
		requestID = uuid.NewString()
	}
	c.JSON(status, QueueErrorResponse{Code: code, Message: message, RequestID: requestID})
}
