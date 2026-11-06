package auth

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type LoginRequest struct {
	Identifier string `json:"identifier" binding:"required" example:"customer@example.test"`
	Password   string `json:"password" binding:"required" example:"local-demo-password"`
}

// Identity is the safe user data returned by authenticated endpoints.
type Identity struct {
	ID          string `json:"id" binding:"required" example:"6f8dc23d-01dd-41bc-8a5c-991a77f1c003"`
	DisplayName string `json:"displayName" binding:"required" example:"Demo Customer"`
	Role        Role   `json:"role" binding:"required" example:"CUSTOMER"`
}

type LoginResponse struct {
	User         Identity  `json:"user" binding:"required"`
	SessionToken string    `json:"sessionToken" binding:"required" example:"opaque-session-token"`
	ExpiresAt    time.Time `json:"expiresAt" binding:"required" example:"2026-11-07T12:00:00Z"`
}

type MeResponse struct {
	User Identity `json:"user" binding:"required"`
}

type ErrorResponse struct {
	Code      string `json:"code" binding:"required" example:"unauthorized"`
	Message   string `json:"message" binding:"required" example:"Authentication is required"`
	RequestID string `json:"requestId" binding:"required" example:"0e85b5d4-fdda-48fd-a026-45128b73afc3"`
}

type Handler struct {
	service *Service
}

func RegisterRoutes(routes *gin.RouterGroup, service *Service) {
	handler := Handler{service: service}
	authRoutes := routes.Group("/auth")
	authRoutes.POST("/login", handler.login)
	authRoutes.GET("/me", RequireSession(service), handler.me)
	authRoutes.POST("/logout", RequireSession(service), handler.logout)
}

// Login verifies the supplied credentials and creates an opaque API session.
//
// Login godoc
// @Summary Sign in
// @Description Creates an opaque session for a seeded customer or operator. The token is returned to the web server only and must never be exposed to browser JavaScript.
// @Tags auth
// @ID postAuthLogin
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login credentials"
// @Success 200 {object} LoginResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Failure 503 {object} ErrorResponse
// @Router /auth/login [post]
func (h Handler) login(c *gin.Context) {
	if h.service == nil {
		writeError(c, http.StatusServiceUnavailable, "service_unavailable", "Authentication is temporarily unavailable")
		return
	}

	var request LoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeError(c, http.StatusBadRequest, "invalid_request", "A valid identifier and password are required")
		return
	}
	result, err := h.service.Login(c.Request.Context(), request.Identifier, request.Password)
	if errors.Is(err, ErrInvalidCredentials) {
		writeError(c, http.StatusUnauthorized, "invalid_credentials", "Invalid identifier or password")
		return
	}
	if err != nil {
		writeError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		User:         identityResponse(result.User),
		SessionToken: result.SessionToken,
		ExpiresAt:    result.ExpiresAt,
	})
}

// CurrentUser returns the identity associated with the active API session.
//
// CurrentUser godoc
// @Summary Get current user
// @Description Returns the identity and role derived from the active session.
// @Tags auth
// @ID getAuthMe
// @Produce json
// @Security BearerAuth
// @Success 200 {object} MeResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Failure 503 {object} ErrorResponse
// @Router /auth/me [get]
func (h Handler) me(c *gin.Context) {
	actor, ok := ActorFromContext(c)
	if !ok {
		writeError(c, http.StatusUnauthorized, "unauthorized", "Authentication is required")
		return
	}
	c.JSON(http.StatusOK, MeResponse{User: identityResponse(actor)})
}

// Logout revokes the current API session.
//
// Logout godoc
// @Summary Sign out
// @Description Revokes the current API session.
// @Tags auth
// @ID postAuthLogout
// @Security BearerAuth
// @Success 204 "No Content"
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Failure 503 {object} ErrorResponse
// @Router /auth/logout [post]
func (h Handler) logout(c *gin.Context) {
	if h.service == nil {
		writeError(c, http.StatusServiceUnavailable, "service_unavailable", "Authentication is temporarily unavailable")
		return
	}
	token, ok := bearerToken(c)
	if !ok {
		writeError(c, http.StatusUnauthorized, "unauthorized", "Authentication is required")
		return
	}
	if err := h.service.Logout(c.Request.Context(), token); err != nil {
		writeError(c, http.StatusInternalServerError, "internal_error", "The request could not be completed")
		return
	}
	c.Status(http.StatusNoContent)
}

func writeError(c *gin.Context, status int, code, message string) {
	requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
	if requestID == "" {
		requestID = uuid.NewString()
	}
	c.JSON(status, ErrorResponse{Code: code, Message: message, RequestID: requestID})
}

func identityResponse(actor Actor) Identity {
	return Identity{ID: actor.ID, DisplayName: actor.DisplayName, Role: actor.Role}
}
