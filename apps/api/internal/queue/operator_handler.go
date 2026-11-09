package queue

import (
	"errors"
	"net/http"
	"time"

	"example.com/quevo/apps/api/internal/auth"
	"github.com/gin-gonic/gin"
)

type OperatorTicketResponse struct {
	ID           string    `json:"id" binding:"required"`
	TicketNumber string    `json:"ticketNumber" binding:"required"`
	Status       string    `json:"status" binding:"required"`
	BusinessDate string    `json:"businessDate" binding:"required"`
	JoinedAt     time.Time `json:"joinedAt" binding:"required"`
}

type OperatorQueueResponse struct {
	BranchID     string `json:"branchId" binding:"required"`
	BranchName   string `json:"branchName" binding:"required"`
	ServiceID    string `json:"serviceId" binding:"required"`
	ServiceName  string `json:"serviceName" binding:"required"`
	BusinessDate string `json:"businessDate" binding:"required"`
	WaitingCount int64  `json:"waitingCount"`
}

type OperatorQueuesResponse struct {
	Items []OperatorQueueResponse `json:"items" binding:"required"`
}
type OperatorQueueDetailResponse struct {
	Queue   OperatorQueueResponse    `json:"queue" binding:"required"`
	Waiting []OperatorTicketResponse `json:"waiting" binding:"required"`
	Current *OperatorTicketResponse  `json:"current,omitempty"`
}

func registerOperatorRoutes(routes *gin.RouterGroup, service *auth.Service, repository *Repository) {
	h := Handler{repository: repository}
	group := routes.Group("/operator")
	group.Use(auth.RequireSession(service), auth.RequireRoles(auth.RoleOperator))
	group.GET("/queues", h.listOperatorQueues)
	group.GET("/branches/:branchID/services/:serviceID/tickets", h.getOperatorQueue)
	group.POST("/branches/:branchID/services/:serviceID/tickets/call-next", h.callNext)
	group.POST("/tickets/:ticketID/start", h.startTicket)
	group.POST("/tickets/:ticketID/complete", h.completeTicket)
	group.POST("/tickets/:ticketID/skip", h.skipTicket)
}

// listOperatorQueues godoc
// @Summary List authorized operator queues
// @Tags operator
// @ID getOperatorQueues
// @Produce json
// @Security BearerAuth
// @Success 200 {object} OperatorQueuesResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /operator/queues [get]
func (h Handler) listOperatorQueues(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Queues are temporarily unavailable")
		return
	}
	actor, _ := auth.ActorFromContext(c)
	queues, err := h.repository.ListOperatorQueues(c.Request.Context(), actor.ID)
	if err != nil {
		operatorError(c, err)
		return
	}
	response := OperatorQueuesResponse{Items: make([]OperatorQueueResponse, 0, len(queues))}
	for _, q := range queues {
		response.Items = append(response.Items, operatorQueueResponse(q))
	}
	c.JSON(http.StatusOK, response)
}

// getOperatorQueue godoc
// @Summary Get an authorized operator queue
// @Tags operator
// @ID getOperatorQueue
// @Produce json
// @Param branchId path string true "Branch ID" format(uuid)
// @Param serviceId path string true "Service ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} OperatorQueueDetailResponse
// @Failure 400 {object} QueueErrorResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /operator/branches/{branchId}/services/{serviceId}/tickets [get]
func (h Handler) getOperatorQueue(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Queues are temporarily unavailable")
		return
	}
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	serviceID, ok := parsePathUUID(c, "serviceID")
	if !ok {
		return
	}
	actor, _ := auth.ActorFromContext(c)
	detail, err := h.repository.GetOperatorQueue(c.Request.Context(), actor.ID, branchID, serviceID)
	if err != nil {
		operatorError(c, err)
		return
	}
	response := OperatorQueueDetailResponse{Queue: operatorQueueResponse(detail.Queue), Waiting: make([]OperatorTicketResponse, 0, len(detail.Waiting))}
	for _, ticket := range detail.Waiting {
		response.Waiting = append(response.Waiting, operatorTicketResponse(ticket))
	}
	if detail.Current != nil {
		current := operatorTicketResponse(*detail.Current)
		response.Current = &current
	}
	c.JSON(http.StatusOK, response)
}

// callNext godoc
// @Summary Call the next waiting ticket
// @Tags operator
// @ID postOperatorCallNext
// @Produce json
// @Param branchId path string true "Branch ID" format(uuid)
// @Param serviceId path string true "Service ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} OperatorTicketResponse
// @Success 204 "No waiting ticket"
// @Failure 400 {object} QueueErrorResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} QueueErrorResponse
// @Failure 409 {object} QueueErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /operator/branches/{branchId}/services/{serviceId}/tickets/call-next [post]
func (h Handler) callNext(c *gin.Context) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Queues are temporarily unavailable")
		return
	}
	branchID, ok := parsePathUUID(c, "branchID")
	if !ok {
		return
	}
	serviceID, ok := parsePathUUID(c, "serviceID")
	if !ok {
		return
	}
	actor, _ := auth.ActorFromContext(c)
	ticket, found, err := h.repository.CallNext(c.Request.Context(), CallNextInput{OperatorID: actor.ID, BranchID: branchID, ServiceID: serviceID})
	if err != nil {
		operatorError(c, err)
		return
	}
	if !found {
		c.Status(http.StatusNoContent)
		return
	}
	c.JSON(http.StatusOK, operatorTicketResponse(ticket))
}

// startTicket godoc
// @Summary Start an assigned ticket
// @Tags operator
// @ID postOperatorStartTicket
// @Produce json
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} OperatorTicketResponse
// @Failure 400 {object} QueueErrorResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Failure 404 {object} QueueErrorResponse
// @Failure 409 {object} QueueErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /operator/tickets/{ticketId}/start [post]
func (h Handler) startTicket(c *gin.Context) { h.transitionTicket(c, "start") }

// completeTicket godoc
// @Summary Complete an assigned ticket
// @Tags operator
// @ID postOperatorCompleteTicket
// @Produce json
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} OperatorTicketResponse
// @Failure 400 {object} QueueErrorResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Failure 404 {object} QueueErrorResponse
// @Failure 409 {object} QueueErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /operator/tickets/{ticketId}/complete [post]
func (h Handler) completeTicket(c *gin.Context) { h.transitionTicket(c, "complete") }

// skipTicket godoc
// @Summary Skip an assigned pending ticket
// @Tags operator
// @ID postOperatorSkipTicket
// @Produce json
// @Param ticketId path string true "Ticket ID" format(uuid)
// @Security BearerAuth
// @Success 200 {object} OperatorTicketResponse
// @Failure 400 {object} QueueErrorResponse
// @Failure 401 {object} auth.ErrorResponse
// @Failure 403 {object} auth.ErrorResponse
// @Failure 404 {object} QueueErrorResponse
// @Failure 409 {object} QueueErrorResponse
// @Failure 500 {object} QueueErrorResponse
// @Failure 503 {object} auth.ErrorResponse
// @Router /operator/tickets/{ticketId}/skip [post]
func (h Handler) skipTicket(c *gin.Context) { h.transitionTicket(c, "skip") }

func (h Handler) transitionTicket(c *gin.Context, action string) {
	if h.repository == nil {
		writeQueueError(c, http.StatusServiceUnavailable, "service_unavailable", "Tickets are temporarily unavailable")
		return
	}
	ticketID, ok := parsePathUUID(c, "ticketID")
	if !ok {
		return
	}
	actor, _ := auth.ActorFromContext(c)
	ticket, err := h.repository.TransitionTicket(c.Request.Context(), actor.ID, ticketID, action)
	if err != nil {
		operatorError(c, err)
		return
	}
	c.JSON(http.StatusOK, operatorTicketResponse(ticket))
}

func operatorQueueResponse(q OperatorQueue) OperatorQueueResponse {
	return OperatorQueueResponse(q)
}

func operatorTicketResponse(t Ticket) OperatorTicketResponse {
	return OperatorTicketResponse{ID: t.ID, TicketNumber: t.TicketNumber, Status: t.Status,
		BusinessDate: t.BusinessDate.Format("2006-01-02"), JoinedAt: t.JoinedAt}
}

func operatorError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrQueueUnauthorized):
		writeQueueError(c, http.StatusForbidden, "forbidden", "You do not have permission to access this queue")
	case errors.Is(err, ErrTicketNotFound):
		writeQueueError(c, http.StatusNotFound, "ticket_not_found", "The ticket could not be found")
	case errors.Is(err, ErrOperatorHasActiveTicket):
		writeQueueError(c, http.StatusConflict, "active_ticket_exists", "Finish your current ticket before calling another")
	case errors.Is(err, ErrInvalidTransition):
		writeQueueError(c, http.StatusConflict, "invalid_transition", "This action is not available for the ticket's current status")
	default:
		writeQueueError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
	}
}
