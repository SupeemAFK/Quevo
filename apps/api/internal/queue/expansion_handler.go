package queue

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"example.com/quevo/apps/api/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type managedBranchesResponse struct {
	Items []ManagedBranch `json:"items" binding:"required"`
}
type managerServiceInput struct {
	Name   string `json:"name" binding:"required"`
	Active *bool  `json:"active"`
}
type managerQueueInput struct {
	Name   string `json:"name" binding:"required"`
	Active *bool  `json:"active"`
}
type managerCounterInput struct {
	Name   string `json:"name" binding:"required"`
	Active *bool  `json:"active"`
}
type assignmentInput struct {
	QueueIDs    []string `json:"queueIds"`
	OperatorIDs []string `json:"operatorIds"`
}
type historyResponse struct {
	Items  []TicketEvent `json:"items" binding:"required"`
	Limit  int           `json:"limit"`
	Offset int           `json:"offset"`
	Total  int64         `json:"total"`
}

func registerExpansionRoutes(routes *gin.RouterGroup, service *auth.Service, repository *Repository) {
	manager := routes.Group("/manager")
	manager.Use(auth.RequireSession(service), auth.RequireRoles(auth.RoleBranchManager))
	manager.GET("/branches", func(c *gin.Context) { managerListBranches(c, repository) })
	manager.GET("/branches/:branchID/catalog", func(c *gin.Context) { managerGetCatalog(c, repository) })
	manager.POST("/branches/:branchID/services", func(c *gin.Context) { managerCreateService(c, repository) })
	manager.PATCH("/branches/:branchID/services/:serviceID", func(c *gin.Context) { managerUpdateService(c, repository) })
	manager.POST("/branches/:branchID/services/:serviceID/queues", func(c *gin.Context) { managerCreateQueue(c, repository) })
	manager.PATCH("/branches/:branchID/queues/:queueID", func(c *gin.Context) { managerUpdateQueue(c, repository) })
	manager.POST("/branches/:branchID/counters", func(c *gin.Context) { managerCreateCounter(c, repository) })
	manager.PATCH("/branches/:branchID/counters/:counterID", func(c *gin.Context) { managerUpdateCounter(c, repository) })
	manager.PUT("/branches/:branchID/counters/:counterID/assignments", func(c *gin.Context) { managerSetCounterAssignments(c, repository) })
	manager.PUT("/branches/:branchID/services/:serviceID/form", func(c *gin.Context) { managerSetServiceForm(c, repository) })
	manager.GET("/branches/:branchID/services/:serviceID/summary", func(c *gin.Context) { managerGetSummary(c, repository) })
	manager.GET("/tickets/:ticketID/history", func(c *gin.Context) { getTicketHistory(c, repository) })

	operatorHistory := routes.Group("/operator")
	operatorHistory.Use(auth.RequireSession(service), auth.RequireRoles(auth.RoleOperator))
	operatorHistory.GET("/tickets/:ticketID/history", func(c *gin.Context) { getOperatorTicketHistory(c, repository) })
}

// managerListBranches lists branches assigned to the signed-in manager.
// @Summary List managed branches
// @Tags manager
// @ID getManagerBranches
// @Security BearerAuth
// @Success 200 {object} managedBranchesResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Router /manager/branches [get]
func managerListBranches(c *gin.Context, repository *Repository) {
	actor, _ := auth.ActorFromContext(c)
	items, err := repository.ListManagedBranches(c.Request.Context(), actor.ID)
	if err != nil {
		managerError(c, err)
		return
	}
	c.JSON(http.StatusOK, managedBranchesResponse{Items: items})
}

// managerGetCatalog returns the branch service and counter configuration.
// @Summary Get branch catalog
// @Tags manager
// @ID getManagerCatalog
// @Param branchId path string true "Branch ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} ManagerCatalog
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/catalog [get]
func managerGetCatalog(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	actor, _ := auth.ActorFromContext(c)
	result, err := repository.GetManagerCatalog(c.Request.Context(), actor.ID, branchID)
	if err != nil {
		managerError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

// managerCreateService creates a service and its initial queue.
// @Summary Create a service
// @Tags manager
// @ID postManagerService
// @Param branchId path string true "Branch ID" format(uuid)
// @Param request body managerServiceInput true "Service name"
// @Security BearerAuth
// @Success 201 {object} ManagerService
// @Failure 400 {object} QueueErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/services [post]
func managerCreateService(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	var input managerServiceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		queueBadRequest(c)
		return
	}
	actor, _ := auth.ActorFromContext(c)
	service, err := repository.CreateService(c.Request.Context(), actor.ID, branchID, input.Name)
	if err != nil {
		managerError(c, err)
		return
	}
	c.JSON(http.StatusCreated, service)
}

// managerUpdateService updates a branch service.
// @Summary Update a service
// @Tags manager
// @ID patchManagerService
// @Param branchId path string true "Branch ID" format(uuid)
// @Param serviceId path string true "Service ID" format(uuid)
// @Param request body managerServiceInput true "Service settings"
// @Security BearerAuth
// @Success 204
// @Failure 400 {object} QueueErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/services/{serviceId} [patch]
func managerUpdateService(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	serviceID, ok := parsePathUUID(c, "serviceID")
	if !ok {
		return
	}
	var input managerServiceInput
	if err := c.ShouldBindJSON(&input); err != nil || input.Active == nil {
		queueBadRequest(c)
		return
	}
	actor, _ := auth.ActorFromContext(c)
	if err := repository.UpdateService(c.Request.Context(), actor.ID, branchID, serviceID, input.Name, *input.Active); err != nil {
		managerError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// managerCreateQueue adds a named service queue.
// @Summary Create a service queue
// @Tags manager
// @ID postManagerQueue
// @Param branchId path string true "Branch ID" format(uuid)
// @Param serviceId path string true "Service ID" format(uuid)
// @Param request body managerQueueInput true "Queue name"
// @Security BearerAuth
// @Success 201
// @Failure 400 {object} QueueErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/services/{serviceId}/queues [post]
func managerCreateQueue(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	serviceID, ok := parsePathUUID(c, "serviceID")
	if !ok {
		return
	}
	var input managerQueueInput
	if err := c.ShouldBindJSON(&input); err != nil {
		queueBadRequest(c)
		return
	}
	actor, _ := auth.ActorFromContext(c)
	if err := repository.CreateQueue(c.Request.Context(), actor.ID, branchID, serviceID, input.Name); err != nil {
		managerError(c, err)
		return
	}
	c.Status(http.StatusCreated)
}

// managerUpdateQueue updates a service queue.
// @Summary Update a service queue
// @Tags manager
// @ID patchManagerQueue
// @Param branchId path string true "Branch ID" format(uuid)
// @Param queueId path string true "Queue ID" format(uuid)
// @Param request body managerQueueInput true "Queue settings"
// @Security BearerAuth
// @Success 204
// @Failure 400 {object} QueueErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/queues/{queueId} [patch]
func managerUpdateQueue(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	queueID, ok := parsePathUUID(c, "queueID")
	if !ok {
		return
	}
	var input managerQueueInput
	if err := c.ShouldBindJSON(&input); err != nil || input.Active == nil {
		queueBadRequest(c)
		return
	}
	actor, _ := auth.ActorFromContext(c)
	if err := repository.UpdateQueue(c.Request.Context(), actor.ID, branchID, queueID, input.Name, *input.Active); err != nil {
		managerError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// managerCreateCounter creates a branch counter.
// @Summary Create a branch counter
// @Tags manager
// @ID postManagerCounter
// @Param branchId path string true "Branch ID" format(uuid)
// @Param request body managerCounterInput true "Counter name"
// @Security BearerAuth
// @Success 201
// @Failure 400 {object} QueueErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/counters [post]
func managerCreateCounter(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	var input managerCounterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		queueBadRequest(c)
		return
	}
	actor, _ := auth.ActorFromContext(c)
	if err := repository.CreateCounter(c.Request.Context(), actor.ID, branchID, input.Name); err != nil {
		managerError(c, err)
		return
	}
	c.Status(http.StatusCreated)
}

// managerUpdateCounter updates a branch counter.
// @Summary Update a branch counter
// @Tags manager
// @ID patchManagerCounter
// @Param branchId path string true "Branch ID" format(uuid)
// @Param counterId path string true "Counter ID" format(uuid)
// @Param request body managerCounterInput true "Counter settings"
// @Security BearerAuth
// @Success 204
// @Failure 400 {object} QueueErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/counters/{counterId} [patch]
func managerUpdateCounter(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	counterID, ok := parsePathUUID(c, "counterID")
	if !ok {
		return
	}
	var input managerCounterInput
	if err := c.ShouldBindJSON(&input); err != nil || input.Active == nil {
		queueBadRequest(c)
		return
	}
	actor, _ := auth.ActorFromContext(c)
	if err := repository.UpdateCounter(c.Request.Context(), actor.ID, branchID, counterID, input.Name, *input.Active); err != nil {
		managerError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// managerSetCounterAssignments replaces a counter's queue and operator assignments.
// @Summary Set counter assignments
// @Tags manager
// @ID putManagerCounterAssignments
// @Param branchId path string true "Branch ID" format(uuid)
// @Param counterId path string true "Counter ID" format(uuid)
// @Param request body assignmentInput true "Queue and operator IDs"
// @Security BearerAuth
// @Success 204
// @Failure 400 {object} QueueErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/counters/{counterId}/assignments [put]
func managerSetCounterAssignments(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	counterID, ok := parsePathUUID(c, "counterID")
	if !ok {
		return
	}
	var input assignmentInput
	if err := c.ShouldBindJSON(&input); err != nil || input.QueueIDs == nil || input.OperatorIDs == nil {
		queueBadRequest(c)
		return
	}
	for _, id := range append(append([]string{}, input.QueueIDs...), input.OperatorIDs...) {
		if _, err := uuid.Parse(id); err != nil {
			queueBadRequest(c)
			return
		}
	}
	actor, _ := auth.ActorFromContext(c)
	if err := repository.SetCounterAssignments(c.Request.Context(), actor.ID, branchID, counterID, input.QueueIDs, input.OperatorIDs); err != nil {
		managerError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// managerSetServiceForm replaces the customer request form and document policy.
// @Summary Save a service request form
// @Tags manager
// @ID putManagerServiceForm
// @Param branchId path string true "Branch ID" format(uuid)
// @Param serviceId path string true "Service ID" format(uuid)
// @Param request body FormConfiguration true "Request form configuration"
// @Security BearerAuth
// @Success 204
// @Failure 400 {object} QueueErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/services/{serviceId}/form [put]
func managerSetServiceForm(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	serviceID, ok := parsePathUUID(c, "serviceID")
	if !ok {
		return
	}
	var input FormConfiguration
	if err := c.ShouldBindJSON(&input); err != nil || input.Fields == nil {
		queueBadRequest(c)
		return
	}
	actor, _ := auth.ActorFromContext(c)
	if err := repository.UpdateServiceForm(c.Request.Context(), actor.ID, branchID, serviceID, input); err != nil {
		managerError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// managerGetSummary returns branch-scoped service outcomes for a date range.
// @Summary Get service summary
// @Tags manager
// @ID getManagerServiceSummary
// @Param branchId path string true "Branch ID" format(uuid)
// @Param serviceId path string true "Service ID" format(uuid)
// @Param from query string true "Start UTC date" format(date)
// @Param to query string true "End UTC date" format(date)
// @Security BearerAuth
// @Success 200 {object} ServiceSummary
// @Failure 400 {object} QueueErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/branches/{branchId}/services/{serviceId}/summary [get]
func managerGetSummary(c *gin.Context, repository *Repository) {
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	serviceID, ok := parsePathUUID(c, "serviceID")
	if !ok {
		return
	}
	fromValue, toValue := strings.TrimSpace(c.Query("from")), strings.TrimSpace(c.Query("to"))
	fromDate, fromErr := time.Parse("2006-01-02", fromValue)
	toDate, toErr := time.Parse("2006-01-02", toValue)
	if fromErr != nil || toErr != nil || toDate.Before(fromDate) || toDate.Sub(fromDate) > 365*24*time.Hour {
		writeQueueError(c, http.StatusBadRequest, "invalid_request", "A valid UTC date range of at most 366 days is required")
		return
	}
	actor, _ := auth.ActorFromContext(c)
	toExclusive := toDate.AddDate(0, 0, 1)
	result, err := repository.ServiceSummary(c.Request.Context(), actor.ID, branchID, serviceID, fromDate.UTC(), toExclusive.UTC())
	if err != nil {
		managerError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

// getTicketHistory returns the status audit trail for an authorized ticket.
// @Summary Get ticket status history
// @Tags tickets
// @ID getTicketHistory
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Param limit query int false "Maximum events" default(50)
// @Param offset query int false "Events to skip" default(0)
// @Security BearerAuth
// @Success 200 {object} historyResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /manager/tickets/{ticketId}/history [get]
func getTicketHistory(c *gin.Context, repository *Repository) {
	ticketID, ok := parsePathUUID(c, "ticketID")
	if !ok {
		return
	}
	limit, offset := 50, 0
	if value := c.Query("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 || parsed > 100 {
			queueBadRequest(c)
			return
		}
		limit = parsed
	}
	if value := c.Query("offset"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 0 || parsed > 100000 {
			queueBadRequest(c)
			return
		}
		offset = parsed
	}
	actor, _ := auth.ActorFromContext(c)
	page, err := repository.TicketHistory(c.Request.Context(), actor.ID, string(actor.Role), ticketID, limit, offset)
	if err != nil {
		operatorError(c, err)
		return
	}
	c.JSON(http.StatusOK, historyResponse{Items: page.Items, Limit: page.Limit, Offset: page.Offset, Total: page.Total})
}

// getOperatorTicketHistory returns the operator's authorized ticket status audit trail.
// @Summary Get ticket status history
// @Tags operator
// @ID getOperatorTicketHistory
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Param limit query int false "Maximum events" default(50)
// @Param offset query int false "Events to skip" default(0)
// @Security BearerAuth
// @Success 200 {object} historyResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Router /operator/tickets/{ticketId}/history [get]
func getOperatorTicketHistory(c *gin.Context, repository *Repository) {
	getTicketHistory(c, repository)
}

func managerError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrManagerForbidden), errors.Is(err, ErrQueueUnauthorized):
		writeQueueError(c, http.StatusForbidden, "forbidden", "You do not have permission to manage this branch")
	case errors.Is(err, ErrInvalidInput):
		writeQueueError(c, http.StatusBadRequest, "invalid_request", "Review the service configuration and try again")
	case errors.Is(err, gorm.ErrRecordNotFound):
		writeQueueError(c, http.StatusNotFound, "resource_not_found", "The requested branch resource was not found")
	case strings.Contains(strings.ToLower(err.Error()), "duplicate key"):
		writeQueueError(c, http.StatusConflict, "duplicate_resource", "A service, queue, or counter with that name already exists")
	default:
		writeQueueError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
	}
}

func queueBadRequest(c *gin.Context) {
	writeQueueError(c, http.StatusBadRequest, "invalid_request", "Check the request and try again")
}
